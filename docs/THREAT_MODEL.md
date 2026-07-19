# ProofOps Threat Model

This is a hackathon MVP. This document is honest about what it does and does not protect
against - it is not a security audit.

## In scope

### Sensitive log disclosure

Raw incident evidence (account IDs, ARNs, IPs, credentials, usernames, emails) must never
leave the browser. Mitigation: all analysis, redaction, canonicalization, and hashing run
client-side (`src/lib/*`); the Express server has no endpoint that accepts evidence.
`server/app.ts`'s only body-accepting route, `POST /api/events`, accepts a 2 KB JSON body
validated against a fixed enum of event-type strings - there is no field for arbitrary
data, so evidence cannot be smuggled through it even by a modified client.

### Evidence tampering

A receipt must detect if the underlying evidence changed after the receipt was created.
Mitigation: `evidenceCommitment` is a SHA-256 hash over canonicalized JSON
(`src/lib/canonicalize.ts`, `hashing.ts`); `verifyEvidenceAgainstReceipt` recomputes the
hash and compares. Demonstrated live by the "Tamper a Field & Verify" flow.

### Malicious JSON input

Uploaded files are validated (`src/lib/validation.ts`) before use: size-capped at 1 MB,
parsed with `JSON.parse` (no `eval`), and structurally checked field-by-field with safe
type guards. Invalid input produces a typed error message, never an unhandled exception
or a crash. The redaction and analyzer functions are defensive against missing/malformed
fields and return typed failure results instead of throwing.

### Credential leakage

`src/lib/redaction.ts` masks a fixed, case-insensitive list of sensitive key names
(account IDs, ARNs, IPs, usernames, emails, access keys, session tokens, passwords,
cookies, authorization headers). Highly sensitive values are fully replaced with
`[REDACTED]`; identifiers useful in truncated form are partially masked
(`AKIA********1234`).

**Known limitation:** redaction is key-name based, not content-based. A free-text field
that happens to contain a secret under a non-recognized key name (for example, an email
address stored as `containedBy` rather than `email`) would not be masked. This was found
and fixed once in the bundled sample data during development; it remains a structural
limitation of the MVP, not just a one-off bug.

### Logs accidentally sent to the server

`server/logger.ts` only ever logs operational metadata the code itself constructs
(route name, event type, error message) - callers are never passed request bodies or
incident data. `POST /api/events` logs only the validated `type` enum value.

### Compromised frontend

Out of scope for this MVP. If the served JavaScript itself were compromised (e.g. a
supply-chain attack on a dependency, or a compromised build pipeline), it could exfiltrate
evidence before hashing. No subresource integrity, no dependency pinning beyond
`package-lock.json`, and no code signing are implemented.

### Provider outage

`MidnightProofProvider.getStatus()` queries this app's own `/api/midnight/status`
endpoint and reports a clear "not ready"/"not configured" status with a reason rather than
hanging or silently retrying forever. `createReceipt()` on that provider throws a
descriptive error (propagated from the server) instead of falling back to a local receipt
while claiming it is a Midnight receipt - the receipt `status` field is the single source
of truth for what actually happened, and the server only ever returns `MIDNIGHT_CONFIRMED`
after a real transaction has actually been confirmed on-chain.

### New trust boundary: the private response time now transits this app's own server

Real on-chain submission requires a wallet and the `@midnight-ntwrk/midnight-js-contracts`
SDK, which cannot safely run in the browser (a wallet secret in a `VITE_*` env var would
be inlined into the public bundle - see `docs/MIDNIGHT_STATUS.md`). The private
`responseMinutes` witness value is therefore sent from the browser to this app's own
`POST /api/midnight/receipt` endpoint (same origin, over the deployment's normal
HTTPS/TLS), which reads once as a circuit witness and never persists or logs it
(`server/midnight/receipt.ts` never calls `logger.*` with it, only with the contract
address and transaction hash). This is a materially different trust boundary than the
`LOCAL_DEMO` and offline-simulator paths, where the response time never leaves the
browser at all. It is still asserted-then-discarded before any ledger write - it is never
written to public chain state - but a fully trustless production design would instead run
proof generation directly in the browser against a co-located/embedded proof server (no
value transits any server), which was out of scope for this integration. This tradeoff is
called out explicitly rather than left implicit.

### Ledger overwrite (single-slot public state)

The `proofops.compact` ledger has exactly one slot per field (`incidentIdHash`,
`evidenceCommitment`, `policyLimitMinutes`, `policySatisfied`) plus a monotonic
`receiptCount`. Each `submitReceipt` call **overwrites** the previous receipt's public
fields rather than keyed-storing per-incident history. `MidnightProofProvider.verifyReceipt()`
handles this honestly: if the current on-chain state doesn't match an older receipt, it
reports a mismatch with an explicit note that this is expected (a newer receipt was
submitted since) rather than implying tampering. A production version would use a `Map`
ledger type keyed by incident ID hash to retain full history.

### Replay of receipts

Not defended against in this MVP. A `LOCAL_DEMO` receipt is just a JSON object with a
commitment; nothing prevents copying and re-presenting one for a different, unrelated
evidence bundle that happens to hash the same only if you can find a SHA-256 collision
(computationally infeasible) - but nothing binds a receipt to a specific verifier session,
a timestamp window, or a nonce either. A real Midnight deployment would need explicit
anti-replay handling (e.g. a nonce or the on-chain `receiptCount` as a monotonic
sequence check) at the verification layer, not just at proof-generation time.

### Local demo limitations

`LOCAL_DEMO` receipts are **not zero-knowledge proofs** and are **not recorded on any
blockchain**. They prove only that "this SHA-256 commitment was computed from this
evidence, and this policy check passed, in this browser" - a verifier must trust the
operator's browser, not a decentralized network. The UI and receipt schema make this
explicit (`status: "LOCAL_DEMO"`, a visible `LOCAL DEMO MODE` badge, and a warning string
returned from `createReceipt()`).

## Explicitly out of scope for this MVP

- Authentication and authorization (anyone with the app open can do anything).
- Multi-user collaboration, audit trail of who ran what.
- Protecting against a compromised or malicious browser extension.
- Rate limiting or abuse protection on `/api/events` or the static server.
- Real-time ingestion pipelines (AWS, Elastic) - only static JSON files are supported.
- Formal verification of the Compact contract beyond the simulator tests in
  `contract/tests/`.
