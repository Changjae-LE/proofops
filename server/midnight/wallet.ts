// Headless wallet provider for real Midnight network integration, ported from the
// official midnightntwrk/example-hello-world reference (src/wallet.ts). "Headless"
// means a seed/mnemonic-derived wallet with no browser extension - the officially
// supported path for server-side / CI-style transaction submission, as opposed to the
// Lace browser-extension flow used by end-user-facing DApps. This module only ever
// runs on the server; the wallet secret is read from a plain (non-VITE_) environment
// variable and is never sent to, or bundled into, the browser client.
import {
  type CoinPublicKey,
  DustSecretKey,
  type EncPublicKey,
  type FinalizedTransaction,
  LedgerParameters,
  ZswapSecretKeys,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type { MidnightProvider, UnboundTransaction, WalletProvider } from "@midnight-ntwrk/midnight-js-types";
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils";
import type { WalletFacade, FacadeState, UnshieldedKeystore } from "@midnight-ntwrk/wallet-sdk";
import {
  type DustWalletOptions,
  type EnvironmentConfiguration,
  FluentWalletBuilder,
} from "@midnight-ntwrk/testkit-js";
import * as Rx from "rxjs";
import { logger } from "../logger";
import type { WalletSecret } from "./config";

export class MidnightWalletProvider implements MidnightProvider, WalletProvider {
  readonly wallet: WalletFacade;
  readonly unshieldedKeystore: UnshieldedKeystore;

  private constructor(
    wallet: WalletFacade,
    private readonly zswapSecretKeys: ZswapSecretKeys,
    private readonly dustSecretKey: DustSecretKey,
    unshieldedKeystore: UnshieldedKeystore,
  ) {
    this.wallet = wallet;
    this.unshieldedKeystore = unshieldedKeystore;
  }

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(tx: UnboundTransaction, ttl: Date = ttlOneHour()): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey },
      { ttl },
    );
    return await this.wallet.finalizeRecipe(recipe);
  }

  submitTx(tx: FinalizedTransaction): Promise<string> {
    return this.wallet.submitTransaction(tx);
  }

  async start(): Promise<void> {
    logger.info("midnight_wallet_starting");
    await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    return this.wallet.stop();
  }

  static async build(env: EnvironmentConfiguration, secret: WalletSecret): Promise<MidnightWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: env.walletNetworkId === "undeployed" ? 500_000_000_000_000_000n : 1_000n,
      feeBlocksMargin: 5,
    };

    const base = FluentWalletBuilder.forEnvironment(env).withDustOptions(dustOptions);
    const builder = secret.kind === "mnemonic" ? base.withMnemonic(secret.value) : base.withSeed(secret.value);

    const buildResult = await builder.buildWithoutStarting();
    const { wallet, seeds, keystore } = buildResult as {
      wallet: WalletFacade;
      seeds: { masterSeed: string; shielded: Uint8Array; dust: Uint8Array };
      keystore: UnshieldedKeystore;
    };

    logger.info("midnight_wallet_built", { secretKind: secret.kind, seedPrefix: seeds.masterSeed.slice(0, 8) });

    return new MidnightWalletProvider(
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      keystore,
    );
  }
}

function isProgressStrictlyComplete(progress: unknown): boolean {
  if (!progress || typeof progress !== "object") return false;
  const candidate = progress as { isStrictlyComplete?: unknown };
  if (typeof candidate.isStrictlyComplete !== "function") return false;
  return (candidate.isStrictlyComplete as () => boolean)();
}

export async function syncWallet(wallet: WalletFacade, timeout = 300_000): Promise<FacadeState> {
  logger.info("midnight_wallet_sync_starting");
  let emissionCount = 0;
  return Rx.firstValueFrom(
    wallet.state().pipe(
      Rx.tap((state: FacadeState) => {
        emissionCount++;
        const shielded = isProgressStrictlyComplete(state.shielded.state.progress);
        const unshielded = isProgressStrictlyComplete(state.unshielded.progress);
        const dust = isProgressStrictlyComplete(state.dust.state.progress);
        logger.info("midnight_wallet_sync_progress", { emissionCount, shielded, unshielded, dust });
      }),
      Rx.filter(
        (state: FacadeState) =>
          isProgressStrictlyComplete(state.shielded.state.progress) &&
          isProgressStrictlyComplete(state.dust.state.progress) &&
          isProgressStrictlyComplete(state.unshielded.progress),
      ),
      Rx.tap(() => logger.info("midnight_wallet_sync_complete", { emissionCount })),
      Rx.timeout({
        each: timeout,
        with: () => Rx.throwError(() => new Error(`Wallet sync timeout after ${timeout}ms (${emissionCount} emissions)`)),
      }),
      Rx.catchError((err) => {
        logger.error("midnight_wallet_sync_error", { message: String(err) });
        return Rx.throwError(() => err);
      }),
    ),
  );
}
