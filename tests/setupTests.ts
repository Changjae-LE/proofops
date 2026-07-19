import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";

// jsdom does not implement crypto.subtle; polyfill with Node's WebCrypto implementation
// so SHA-256 evidence commitments can be computed identically in tests and in the browser.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
