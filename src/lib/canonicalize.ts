// Deterministic recursive JSON canonicalization.
//
// Guarantees:
//   1. Object keys are sorted lexicographically at every nesting level.
//   2. Array order is preserved (arrays are ordered data, not sets).
//   3. Strings, booleans, null, and numbers are serialized consistently via JSON.stringify.
//   4. No timestamps, random values, or environment-dependent data are injected.
//
// Two logically-equal JSON documents that differ only in object key order produce the
// exact same canonical string, and therefore the same downstream hash. Any meaningful
// change to a value (or key) produces a different canonical string.

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export function canonicalize(value: JsonValue): string {
  return stringify(value);
}

function stringify(value: JsonValue): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Cannot canonicalize a non-finite number");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stringify).join(",")}]`;
  }

  if (typeof value === "object") {
    const sortedKeys = Object.keys(value).sort();
    const entries = sortedKeys.map(
      (key) => `${JSON.stringify(key)}:${stringify(value[key] as JsonValue)}`
    );
    return `{${entries.join(",")}}`;
  }

  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}
