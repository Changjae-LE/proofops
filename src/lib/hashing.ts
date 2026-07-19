import { canonicalize, type JsonValue } from "./canonicalize";

// Uses the standard Web Crypto API (available in browsers and in Node.js 20+) so the
// exact same hashing code path runs client-side without any server round trip.
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Computes the deterministic SHA-256 evidence commitment for a JSON value.
 * The same logical document always produces the same commitment, regardless of
 * object key order in the source JSON.
 */
export async function commitEvidence(value: JsonValue): Promise<string> {
  const canonical = canonicalize(value);
  return sha256Hex(canonical);
}
