import { defineConfig } from "vitest/config";

// A dedicated config keeps the contract's Node-only test run isolated from the root
// project's Vite/React config (and its platform-specific optional dependencies).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
