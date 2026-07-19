/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Separate config for tests that require a real, reachable Midnight network (local
// devnet, Preview, or Preprod) and a synced/funded wallet. Never run by `npm test` -
// only by `npm run midnight:test:integration`, which callers must opt into explicitly
// because it needs live infrastructure and can take minutes per test (wallet sync,
// real proof generation, real transaction confirmation).
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 20 * 60_000,
    hookTimeout: 20 * 60_000,
  },
});
