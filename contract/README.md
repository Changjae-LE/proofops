# ProofOps Compact Contract

This directory contains the ProofOps Compact smart contract and its off-chain simulator
tests. It compiles and runs against the **real, official Midnight Compact toolchain** -
nothing here is mocked or hand-simulated at the language level.

## Files

- `src/proofops.compact` - the contract source.
- `tests/proofops-simulator.ts` - a thin simulator built on the real
  `@midnight-ntwrk/compact-runtime` package, following the same pattern as the official
  [`midnightntwrk/example-counter`](https://github.com/midnightntwrk/example-counter)
  `CounterSimulator`.
- `tests/proofops.test.ts` - Vitest tests that drive the simulator.
- `dist/` - compiler output (TypeScript bindings, zkir circuits, real proving/verifying
  keys). Generated, not committed - see `.gitignore`.

## What the contract does

Public ledger state holds only:

- `incidentIdHash: Bytes<32>` - SHA-256 of the incident ID.
- `evidenceCommitment: Bytes<32>` - SHA-256 of the canonicalized evidence.
- `policyLimitMinutes: Uint<16>` - the public containment policy limit (15 minutes).
- `policySatisfied: Boolean` - always `true` for any receipt that exists (see below).
- `receiptCount: Uint<32>` - number of receipts recorded.

The private response time (minutes between detection and containment) is supplied only as
a `witness` and is used solely inside an `assert`. It never appears in a ledger field, a
circuit argument, or a circuit return value - `disclose()` is called only on the three
already-public commitment/limit values, never on the witness result.

Because the `assert` runs before any ledger write, a caller whose real response time
exceeds the policy limit cannot produce a valid proof at all: `submitReceipt` throws, and
no ledger state changes. This is why `policySatisfied` is always `true` for any receipt
that was actually recorded - a `false` receipt is mathematically impossible to construct,
not just discouraged.

## Running it yourself

From the repository root:

```bash
npm run contract:build   # compiles src/proofops.compact with the real compiler
npm run contract:test    # runs the simulator tests against the compiled output
```

On native Windows, both scripts automatically shell out to WSL (Ubuntu), because the
official `compact` devtools currently ship only macOS and Linux binaries. See
[`docs/MIDNIGHT_STATUS.md`](../docs/MIDNIGHT_STATUS.md) for verified versions, exact
installation commands, and what was and was not possible to verify in this environment.
