import { Router, type Request, type Response } from "express";
import { logger } from "./logger";
import { getConfiguredContractAddress, getNetwork } from "./midnight/config";

// `./midnight/session` transitively imports @midnight-ntwrk/testkit-js, which runs a
// module-top-level side effect (constructing a default file logger under `logs/tests`)
// that crashes in read-only/restricted environments (e.g. this app's own non-root Docker
// image) the instant the module is loaded - even if no Midnight route is ever called.
// Local-demo-only deployments (the default) must never pay for or risk that: these two
// modules are therefore dynamically imported, once, only the first time an
// /api/midnight/* route actually handles a request.
type SessionModule = typeof import("./midnight/session");
type ReceiptModule = typeof import("./midnight/receipt");
let sessionModulePromise: Promise<SessionModule> | null = null;
let receiptModulePromise: Promise<ReceiptModule> | null = null;

function loadSessionModule(): Promise<SessionModule> {
  sessionModulePromise ??= import("./midnight/session");
  return sessionModulePromise;
}

function loadReceiptModule(): Promise<ReceiptModule> {
  receiptModulePromise ??= import("./midnight/receipt");
  return receiptModulePromise;
}

function isMidnightConfigured(): boolean {
  try {
    getNetwork();
    return true;
  } catch {
    return false;
  }
}

function serializeLedger(ledger: {
  incidentIdHash: Uint8Array;
  evidenceCommitment: Uint8Array;
  policyLimitMinutes: bigint;
  policySatisfied: boolean;
  receiptCount: bigint;
}) {
  return {
    incidentIdHash: Buffer.from(ledger.incidentIdHash).toString("hex"),
    evidenceCommitment: Buffer.from(ledger.evidenceCommitment).toString("hex"),
    policyLimitMinutes: Number(ledger.policyLimitMinutes),
    policySatisfied: ledger.policySatisfied,
    receiptCount: Number(ledger.receiptCount),
  };
}

function hexToBytes32(value: unknown, field: string): Uint8Array {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${field} must be a 64-character hex string (32 bytes)`);
  }
  return new Uint8Array(Buffer.from(value, "hex"));
}

export function createMidnightRouter(): Router {
  const router = Router();

  router.get("/status", async (_req: Request, res: Response) => {
    if (!isMidnightConfigured()) {
      res.json({
        configured: false,
        phase: "not_configured",
        message: "Set MIDNIGHT_NETWORK (local|preview|preprod) and a wallet secret to enable real Midnight mode.",
      });
      return;
    }

    const network = getNetwork();
    const configuredAddress = getConfiguredContractAddress();
    const { getSessionState } = await loadSessionModule();
    const sessionState = getSessionState();

    res.json({
      configured: true,
      network,
      configuredContractAddress: configuredAddress ?? null,
      ...sessionState,
    });
  });

  router.post("/connect", async (_req: Request, res: Response) => {
    if (!isMidnightConfigured()) {
      res.status(400).json({ error: "Midnight network is not configured. Set MIDNIGHT_NETWORK." });
      return;
    }
    try {
      const { getMidnightSession } = await loadSessionModule();
      const session = await getMidnightSession();
      res.json({
        network: session.network,
        contractAddress: session.contractAddress ?? null,
        coinPublicKey: session.wallet.getCoinPublicKey(),
      });
    } catch (err) {
      logger.error("midnight_connect_failed", { message: err instanceof Error ? err.message : String(err) });
      res.status(502).json({ error: err instanceof Error ? err.message : "Wallet connection failed" });
    }
  });

  router.post("/deploy", async (_req: Request, res: Response) => {
    try {
      const { deployNewContract } = await loadSessionModule();
      const session = await deployNewContract();
      res.json({
        network: session.network,
        contractAddress: session.contractAddress,
      });
    } catch (err) {
      logger.error("midnight_deploy_failed", { message: err instanceof Error ? err.message : String(err) });
      res.status(502).json({ error: err instanceof Error ? err.message : "Contract deployment failed" });
    }
  });

  router.post("/receipt", async (req: Request, res: Response) => {
    let incidentIdHash: Uint8Array;
    let evidenceCommitment: Uint8Array;
    let policyLimitMinutes: number;
    let responseMinutes: number;
    try {
      incidentIdHash = hexToBytes32(req.body?.incidentIdHash, "incidentIdHash");
      evidenceCommitment = hexToBytes32(req.body?.evidenceCommitment, "evidenceCommitment");
      policyLimitMinutes = Number(req.body?.policyLimitMinutes);
      responseMinutes = Number(req.body?.responseMinutes);

      if (!Number.isInteger(policyLimitMinutes) || policyLimitMinutes < 0) {
        res.status(400).json({ error: "policyLimitMinutes must be a non-negative integer" });
        return;
      }
      if (!Number.isInteger(responseMinutes) || responseMinutes < 0) {
        res.status(400).json({ error: "responseMinutes must be a non-negative integer" });
        return;
      }
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Invalid request body" });
      return;
    }

    try {
      const { getMidnightSession } = await loadSessionModule();
      const { submitReceipt } = await loadReceiptModule();
      const session = await getMidnightSession();
      if (!session.deployed) {
        res.status(409).json({
          error: "No ProofOps contract is deployed or joined yet. Call POST /api/midnight/deploy first, " +
            "or set MIDNIGHT_CONTRACT_ADDRESS to join an existing one.",
        });
        return;
      }

      const result = await submitReceipt(session.providers, session.deployed, {
        incidentIdHash,
        evidenceCommitment,
        policyLimitMinutes: BigInt(policyLimitMinutes),
        responseMinutes: BigInt(responseMinutes),
      });

      res.json({
        status: "MIDNIGHT_CONFIRMED",
        network: session.network,
        contractAddress: result.contractAddress,
        txId: result.txId,
        blockHeight: result.blockHeight,
        ledger: serializeLedger(result.ledger),
      });
    } catch (err) {
      // Includes the case where the circuit's assertion fails (responseMinutes >
      // policyLimitMinutes): proof construction throws and no transaction is ever
      // submitted. Never fabricate a success response here.
      logger.error("midnight_submit_receipt_failed", { message: err instanceof Error ? err.message : String(err) });
      res.status(502).json({ error: err instanceof Error ? err.message : "Receipt submission failed" });
    }
  });

  router.get("/ledger", async (_req: Request, res: Response) => {
    try {
      const { getMidnightSession } = await loadSessionModule();
      const { readLedgerState } = await loadReceiptModule();
      const session = await getMidnightSession();
      if (!session.contractAddress) {
        res.status(409).json({ error: "No contract deployed or configured yet." });
        return;
      }
      const ledgerState = await readLedgerState(session.providers, session.contractAddress);
      res.json({
        network: session.network,
        contractAddress: session.contractAddress,
        ledger: serializeLedger(ledgerState),
      });
    } catch (err) {
      logger.error("midnight_ledger_query_failed", { message: err instanceof Error ? err.message : String(err) });
      res.status(502).json({ error: err instanceof Error ? err.message : "Ledger query failed" });
    }
  });

  return router;
}
