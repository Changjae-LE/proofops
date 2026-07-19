import express, { type Express, type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger";
import {
  getUptimeSeconds,
  incrementHttpRequests,
  incrementReceiptsCreated,
  incrementVerificationFailures,
  incrementVerifications,
  renderMetrics,
} from "./metrics";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(__dirname, "../dist");
const SERVICE_VERSION = "0.1.0";

const VALID_EVENT_TYPES = new Set(["receipt_created", "verification_run", "verification_failed"]);

/**
 * Builds the ProofOps Express application. All incident analysis happens in the browser -
 * this server never receives raw evidence. It only serves the production frontend build
 * and exposes operational endpoints (health, readiness, metrics, and a tiny best-effort
 * metrics event relay that carries a fixed event type string, nothing else).
 */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
    incrementHttpRequests();
    next();
  });

  app.use(express.json({ limit: "2kb" }));

  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      service: "proofops",
      version: SERVICE_VERSION,
      uptimeSeconds: getUptimeSeconds(),
      proofProvider: process.env.VITE_PROOF_PROVIDER ?? "local",
    });
  });

  app.get("/readyz", (_req: Request, res: Response) => {
    const frontendReady = fs.existsSync(path.join(STATIC_DIR, "index.html"));
    const providerName =
      (process.env.VITE_PROOF_PROVIDER ?? "local") === "midnight" ? "midnight" : "local-demo";
    res.json({
      status: frontendReady ? "ready" : "degraded",
      frontend: frontendReady,
      proofProvider: {
        name: providerName,
        ready: true,
      },
    });
  });

  app.get("/metrics", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(renderMetrics());
  });

  app.post("/api/events", (req: Request, res: Response) => {
    const type = typeof req.body?.type === "string" ? req.body.type : undefined;
    if (!type || !VALID_EVENT_TYPES.has(type)) {
      res.status(400).json({ error: "Invalid event type" });
      return;
    }

    if (type === "receipt_created") {
      incrementReceiptsCreated();
    } else if (type === "verification_run") {
      incrementVerifications();
    } else if (type === "verification_failed") {
      incrementVerifications();
      incrementVerificationFailures();
    }

    logger.info("metric_event", { type });
    res.status(204).end();
  });

  if (fs.existsSync(STATIC_DIR)) {
    app.use(express.static(STATIC_DIR));
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET") {
        next();
        return;
      }
      res.sendFile(path.join(STATIC_DIR, "index.html"));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("unhandled_error", {
      message: err instanceof Error ? err.message : "unknown error",
    });
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
