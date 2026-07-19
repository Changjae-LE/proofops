import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/lib/canonicalize";
import { commitEvidence, sha256Hex } from "../src/lib/hashing";

describe("canonicalize", () => {
  it("is deterministic for the same logical document", () => {
    const value = { b: 1, a: [1, 2, 3], c: { z: true, y: null } };
    expect(canonicalize(value)).toBe(canonicalize(structuredClone(value)));
  });

  it("produces identical output regardless of object key order", () => {
    const a = { incidentId: "INC-1", severity: "HIGH", events: [{ id: 1 }, { id: 2 }] };
    const b = { events: [{ id: 1 }, { id: 2 }], severity: "HIGH", incidentId: "INC-1" };
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("preserves array order (arrays are not sorted)", () => {
    const a = { items: [1, 2, 3] };
    const b = { items: [3, 2, 1] };
    expect(canonicalize(a)).not.toBe(canonicalize(b));
  });
});

describe("commitEvidence / sha256Hex", () => {
  it("produces the same SHA-256 hash for key-reordered but logically identical JSON", async () => {
    const a = { incidentId: "INC-1", nested: { x: 1, y: 2 } };
    const b = { nested: { y: 2, x: 1 }, incidentId: "INC-1" };

    const hashA = await commitEvidence(a);
    const hashB = await commitEvidence(b);

    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a different hash when a meaningful field changes", async () => {
    const original = { incidentId: "INC-1", severity: "HIGH" };
    const modified = { incidentId: "INC-1", severity: "LOW" };

    const originalHash = await commitEvidence(original);
    const modifiedHash = await commitEvidence(modified);

    expect(originalHash).not.toBe(modifiedHash);
  });

  it("sha256Hex hashes raw strings directly", async () => {
    const hash = await sha256Hex("");
    // SHA-256 of the empty string is a well-known constant.
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hash).toHaveLength(64);
  });
});
