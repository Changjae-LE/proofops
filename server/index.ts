import { createServer } from "node:http";
import { createApp } from "./app";
import { logger } from "./logger";

const PORT = Number(process.env.PORT ?? 8787);
const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp();
const server = createServer(app);

server.listen(PORT, () => {
  logger.info("server_started", { port: PORT });
});

function shutdown(signal: string): void {
  logger.info("shutdown_initiated", { signal });

  server.close((err) => {
    if (err) {
      logger.error("shutdown_error", { message: err.message });
      process.exit(1);
    }
    logger.info("shutdown_complete");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("shutdown_timeout_forced_exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
