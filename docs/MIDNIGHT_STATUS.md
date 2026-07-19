# Midnight Integration Status

This document records exactly what was verified against the real, official Midnight
toolchain during this build, what remains unverified, and how to reproduce every claim
below. Nothing in this document is aspirational - every version number and command was
actually run in this environment.

## Sources consulted

- [docs.midnight.network](https://docs.midnight.network) - Compact language reference,
  compiler usage, compact-tools release notes, and the DApp quickstart.
- [github.com/midnightntwrk/compact](https://github.com/midnightntwrk/compact) - official
  compact-devtools releases.
- [github.com/midnightntwrk/example-counter](https://github.com/midnightntwrk/example-counter) -
  official reference contract, CLI, and `CounterSimulator` test pattern.
- npm registry (`@midnight-ntwrk/compact-runtime`) for the exact runtime package version
  matched to the compiled contract's `runtime-version`.

## Verified toolchain versions (as installed and run in this environment)

| Component | Version |
| --- | --- |
| `compact` devtools CLI | 0.5.1 |
| Compact compiler (`compactc`, via `compact update`) | 0.31.1 |
| Compact language version | 0.23.0 |
| Generated contract runtime version | 0.16.0 |
| Ledger version | ledger-8.0.2 |
| `@midnight-ntwrk/compact-runtime` (npm) | 0.16.0 |
| Node.js (used for contract tooling) | v22.22.1 |

Official docs state Node.js 22+ and Compact compiler 0.31.0 as current quickstart
prerequisites; the versions above match.

## What is real

- **The contract compiles with the real compiler.** `npm run contract:build` runs the
  actual `compact compile src/proofops.compact dist` and produces real TypeScript
  bindings, real zkir circuit files, and real proving/verifying keys
  (`contract/dist/keys/submitReceipt.prover` is 284 KB - an actual proving key, not a
  placeholder).
- **The contract is tested with the real runtime.** `npm run contract:test` runs
  `contract/tests/proofops.test.ts` against `@midnight-ntwrk/compact-runtime` 0.16.0,
  using the same `Contract` / `createConstructorContext` / `createCircuitContext` /
  `ledger()` APIs the official `example-counter` uses - not a hand-rolled mock. Six tests
  pass, including "8 minutes satisfies a 15-minute policy," "16 minutes throws (proof
  cannot be constructed)," and "the private response time never appears as a ledger key."
- **The privacy semantics were independently confirmed from the compiler's own output**,
  not just from the source: `contract/dist/contract/index.js` shows the `assert` on the
  witness-derived response time executing *before* any ledger write, and the generated
  `Ledger` type has exactly five fields, none of which is the response time.

## What is not real (and never claimed to be)

- **No transaction has ever been submitted to any Midnight network** (local devnet,
  `preview`, or `preprod`). `MidnightProofProvider.createReceipt()`
  (`src/midnight/MidnightProofProvider.ts`) throws an explicit, descriptive error instead
  of fabricating a transaction ID or contract address. `VerificationReceipt.status` can
  only be `LOCAL_DEMO` in this build; `MIDNIGHT_CONFIRMED` is a defined-but-unreachable
  value until real submission is wired up.
- **No wallet integration exists.** Deploying the compiled contract and calling
  `submitReceipt` for real requires the full `@midnight-ntwrk/midnight-js` provider stack,
  a funded wallet (Lace or a headless test wallet), and a running proof server / indexer /
  node (via `npm run setup` in the official `create-mn-app` scaffold, or a manually
  operated devnet). Wiring that stack, and keeping it running reliably inside a hackathon
  demo environment, was out of scope for the time available in this session - see
  "Blockers" below.
- **`contract/dist` is a build artifact, not a deployment.** It is gitignored and must be
  regenerated with `npm run contract:build`.

## Windows-specific finding: no native Windows binary

The official `compact-devtools` GitHub releases
(`https://github.com/midnightntwrk/compact/releases`) publish only:

- `compact-aarch64-apple-darwin.tar.xz`
- `compact-x86_64-apple-darwin.tar.xz`
- `compact-aarch64-unknown-linux-musl.tar.xz`
- `compact-x86_64-unknown-linux-musl.tar.xz`
- `compact-installer.sh`

There is no Windows asset. `scripts/contract-build.mjs` and `scripts/contract-test.mjs`
detect this (and specifically avoid `where compact`, which on Windows resolves to the
**unrelated built-in NTFS `compact.exe` utility** - a real naming collision found and
fixed during this build) and transparently shell out to WSL when running on Windows.

### Exact reproduction (what this session actually ran)

```bash
# Inside WSL (Ubuntu), from a clean shell:
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.1/compact-installer.sh | sh
source "$HOME/.local/bin/env"
compact update                     # installs compiler 0.31.1
sudo apt-get install -y unzip      # required by `compact update`'s extractor
compact compile contract/src/proofops.compact contract/dist
cd contract && npm install && npm test
```

From the repository root on Windows, the equivalent is simply:

```powershell
npm run contract:build
npm run contract:test
```

which auto-detect Windows, locate the WSL `Ubuntu` distro, and run the same commands
inside it.

## Provider configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `VITE_PROOF_PROVIDER` | `local` | `local` uses `LocalDemoProofProvider`; `midnight` uses `MidnightProofProvider`. |
| `VITE_MIDNIGHT_NETWORK` | `undeployed` | Label shown in the UI and in receipts. |
| `VITE_MIDNIGHT_PROOF_SERVER_URL` | `http://localhost:6300` | Checked with a real, timeboxed `fetch` in `MidnightProofProvider.getStatus()`. |
| `VITE_MIDNIGHT_CONTRACT_ADDRESS` | (unset) | Without this, `getStatus()` reports `ready: false` and explains why. |

Switching `VITE_PROOF_PROVIDER=midnight` with no further setup does not crash the app: the
UI shows the `MIDNIGHT NETWORK` badge, `SystemStatus` reports the provider as not ready,
and `Generate Verification Receipt` surfaces the real error from `createReceipt()` instead
of silently falling back to a local receipt.

## Known blockers

1. **Full wallet + provider stack integration is unbuilt.** This is the single largest
   remaining gap between "contract compiles and passes simulator tests" (done, verified)
   and "ProofOps submits a real Midnight transaction" (not done). It requires the
   `@midnight-ntwrk/midnight-js` provider APIs, a wallet (headless or Lace), and a running
   proof server / indexer / node - each independently non-trivial and each requiring
   network access this sandboxed session could not durably rely on for a hackathon demo.
2. **Docker Desktop / a local devnet were not stood up for Midnight infrastructure.** The
   default `docker-compose.yml` intentionally does not include Midnight's node/indexer/
   proof-server services (see the comment in that file) because that setup was not
   verified end-to-end here.

## Local-demo vs. real Midnight, feature by feature

| Feature | Status |
| --- | --- |
| Compact contract source | Real, compiles with official compiler |
| Contract privacy semantics (assert before disclose) | Real, verified from compiled output |
| Contract simulator tests | Real, run against `@midnight-ntwrk/compact-runtime` |
| Evidence hashing / redaction / policy evaluation | Real, runs entirely in-browser |
| `LOCAL_DEMO` receipts | Real (as what they claim to be: a local commitment, not a proof) |
| On-chain transaction submission | Not implemented - explicit error, no fabrication |
| Wallet integration | Not implemented |
| Live devnet / testnet deployment | Not attempted |
