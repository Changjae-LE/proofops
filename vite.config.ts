/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ProofOps frontend build configuration.
// The dev server proxies operational endpoints to the local Express API
// so the same relative paths (/healthz, /readyz, /metrics) work in dev and prod.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/healthz": "http://localhost:8787",
      "/readyz": "http://localhost:8787",
      "/metrics": "http://localhost:8787",
      "/api": "http://localhost:8787",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.ts"],
    // contract/tests has its own vitest.config.ts and its own dependencies
    // (@midnight-ntwrk/compact-runtime, installed only under contract/node_modules) -
    // it must never be picked up by the root test run, which would fail on a fresh
    // checkout before `npm run contract:build` has produced contract/dist.
    // tests/integration/** requires a real, reachable Midnight network and a funded
    // wallet - it has its own vitest.integration.config.ts and is never part of the
    // default (offline, CI-safe) `npm test` run.
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "tests/integration/**"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/", "dist/", "dist-server/", "contract/", "**/*.config.*"],
    },
  },
});
