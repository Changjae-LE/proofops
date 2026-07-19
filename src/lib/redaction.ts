// Recursive, case-insensitive redaction of sensitive fields in incident evidence.
//
// Two masking tiers are used:
//   - Full redaction: the entire value is replaced with "[REDACTED]". Used for secrets
//     that must never be partially visible (session tokens, passwords, cookies, ...).
//   - Partial masking: a short prefix and suffix are kept and the middle is replaced with
//     asterisks, e.g. "AKIAEXAMPLE1234" -> "AKIA********1234". Used for identifiers that
//     are useful to a reviewer in truncated form (account IDs, ARNs, IP addresses, ...).

const FULL_REDACT_KEYS = new Set(
  ["secretAccessKey", "sessionToken", "authorization", "cookie", "token", "password"].map((k) =>
    k.toLowerCase()
  )
);

const PARTIAL_MASK_KEYS = new Set(
  [
    "awsAccountId",
    "accountId",
    "principalArn",
    "roleArn",
    "arn",
    "sourceIPAddress",
    "ipAddress",
    "privateIpAddress",
    "userName",
    "username",
    "email",
    "accessKeyId",
  ].map((k) => k.toLowerCase())
);

const SENSITIVE_KEYS = new Set([...FULL_REDACT_KEYS, ...PARTIAL_MASK_KEYS]);

const REDACTED = "[REDACTED]";
const MASK_RUN = "*".repeat(8);
const MASK_KEEP = 4;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

function partialMask(value: string): string {
  if (value.length <= MASK_KEEP * 2) {
    return REDACTED;
  }
  return `${value.slice(0, MASK_KEEP)}${MASK_RUN}${value.slice(-MASK_KEEP)}`;
}

function maskScalar(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  if (FULL_REDACT_KEYS.has(key.toLowerCase())) {
    return REDACTED;
  }
  return partialMask(stringValue);
}

function redactValue(key: string | null, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item));
  }

  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = redactValue(childKey, childValue);
    }
    return out;
  }

  if (key !== null && isSensitiveKey(key)) {
    return maskScalar(key, value);
  }

  return value;
}

/**
 * Returns a deep, redacted copy of the given value. The input is never mutated.
 */
export function redactEvidence<T>(value: T): T {
  return redactValue(null, value) as T;
}

function countSensitive(key: string | null, value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, item) => sum + countSensitive(key, item), 0);
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce(
      (sum, [childKey, childValue]) => sum + countSensitive(childKey, childValue),
      0
    );
  }
  if (key !== null && isSensitiveKey(key) && value !== null && value !== undefined) {
    return 1;
  }
  return 0;
}

/** Counts how many sensitive leaf fields were found in a value, for display purposes. */
export function countSensitiveFields(value: unknown): number {
  return countSensitive(null, value);
}
