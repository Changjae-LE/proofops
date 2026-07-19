# Midnight Integration Status

This document records exactly what was verified against the real, official Midnight
toolchain, what remains unverified, and how to reproduce every claim below. Nothing in
this document is aspirational - every version number and command was actually run in this
environment. See `docs/MIDNIGHT_DEPLOYMENT.md` for the full transaction-level record.

## Sources consulted

- [docs.midnight.network](https://docs.midnight.network) - current Compact language
  reference, network environments (Preview/Preprod/Mainnet), release notes.
- [github.com/midnightntwrk/example-hello-world](https://github.com/midnightntwrk/example-hello-world) -
  official minimal headless-wallet deploy/test pattern (config/wallet/providers), used as
  the direct template for `server/midnight/*`.
- [github.com/midnightntwrk/example-bboard](https://github.com/midnightntwrk/example-bboard) -
  official reference for `CompiledContract`/witnesses wiring and browser (Lace) wallet
  integration.
- npm registry for exact current `@midnight-ntwrk/*` package versions.

## Verified toolchain versions (as installed and run in this environment)

| Component | Version |
| --- | --- |
| `compact` devtools CLI | 0.5.1 |
| Compact compiler (`compactc`, via `compact update`) | 0.31.1 |
| Compact language version | 0.23.0 |
| Generated contract runtime version | 0.16.0 |
| Ledger version (compiled contract) | ledger-8.0.2 |
| `@midnight-ntwrk/compact-runtime` (npm) | 0.16.0 |
| `@midnight-ntwrk/midnight-js-*` (npm, contracts/types/utils/network-id/providers) | 4.1.1 |
| `@midnight-ntwrk/testkit-js` (npm) | 4.1.1 |
| `@midnight-ntwrk/wallet-sdk` (npm) | 1.2.0 |
| `midnightntwrk/proof-server` (Docker, local devnet) | 8.1.0 |
| `midnightntwrk/indexer-standalone` (Docker, local devnet) | 4.3.3 |
| `midnightntwrk/midnight-node` (Docker, local devnet) | 1.0.0 |
| Node.js | v24.18.0 (Windows), v22.22.1 (WSL, contract compiler only) |

## Network selection

Midnight currently runs three public environments: **Preview**, **Preprod**, and
**Mainnet** (Mainnet launched in the Kūkolu phase, late March 2026). This build targets
**Preprod** for real testnet verification - it is the officially recommended pre-Mainnet
network for DApp testing, does not require real-value assets (funded via a public faucet
with test tokens), and is what the official `example-hello-world`/`example-bboard` repos'
own `*-remote` test scripts target. A local Docker devnet (`docker-compose.midnight.yml`)
is also supported and used for fast, fully-offline, fully-reproducible verification of the
same code path (no faucet, no waiting on a public chain).

## What is real

Everything below was independently confirmed by running the actual command, not inferred
from source review alone. See `docs/MIDNIGHT_DEPLOYMENT.md` for the exact transaction IDs,
block heights, and reproduction commands.

- **The contract compiles with the real compiler** and its privacy semantics (assert
  before disclose) were independently confirmed from the compiled output, as before.
- **The contract simulator tests pass** against the real `@midnight-ntwrk/compact-runtime`
  (`npm run contract:test`).
- **A real headless wallet connects to a real network and syncs.** `server/midnight/wallet.ts`
  uses `@midnight-ntwrk/testkit-js`'s `FluentWalletBuilder` (the same API the official
  examples use for CI-style, non-browser transaction submission) to build and sync a
  seed/mnemonic-derived wallet against Local, Preview, or Preprod.
- **A real contract was deployed to a real (local) Midnight network** via
  `@midnight-ntwrk/midnight-js-contracts`' `deployContract`, and the resulting contract
  address was independently re-queried from the indexer.
- **A real `submitReceipt` transaction was submitted, proven, and confirmed on-chain**,
  with a real transaction hash and block height returned by the network.
- **The ledger was independently re-queried** (a fresh `publicDataProvider.queryContractState`
  call, not the same in-memory result from the submission) and shown to contain only the
  five public fields - the private response time is not present in the field set, not just
  "not shown."
- **The policy-violation case was proven to be rejected by the network**, not just by the
  offline simulator: submitting `responseMinutes=16` against a 15-minute limit throws
  during real proof construction and no transaction is ever produced.
- **Preprod (public testnet):** a real wallet was generated and funded via the public
  faucet, and real sync attempts reached the actual Preprod indexer/node and fully synced
  the shielded and unshielded balances. Blocked on DUST delegation (a separate manual step
  from just funding tNIGHT - see `docs/MIDNIGHT_DEPLOYMENT.md` for the exact error and
  required next action). The identical code path is already fully verified end-to-end on
  Local devnet, so this is a funding/delegation gap, not a code gap.

## What is not real (and never claimed to be)

- **Mainnet.** This build only ever targets Local devnet, Preview, or Preprod - the
  `MidnightNetwork` type does not include `mainnet`, and nothing in this codebase can
  submit a Mainnet transaction.
- **Lace browser-wallet integration.** The real-network path in this build uses a headless
  (seed/mnemonic) wallet running server-side (`server/midnight/wallet.ts`), the same
  officially-supported pattern the Midnight examples use for automated/CI transaction
  submission - not the browser-extension (`@midnight-ntwrk/dapp-connector-api`/Lace) flow.
  Rationale: a headless wallet is fully automatable and independently verifiable end to
  end (as demonstrated above); a Lace-based flow would require a human to click through a
  browser extension for every transaction and could not be verified unattended. See "UI
  and provider architecture" below for how the browser UI still drives this without ever
  holding the wallet secret.
- **`contract/dist` is a build artifact, not a deployment.** Still gitignored, still
  regenerated with `npm run contract:build`.

## UI and provider architecture (why the wallet secret never reaches the browser)

`VITE_*` environment variables are inlined into the public browser bundle by Vite - a
wallet seed or mnemonic must never be one of them, even for a "just a demo" build. All
real wallet/SDK code (`server/midnight/*`) therefore runs server-side only, using plain
(non-`VITE_`-prefixed) environment variables read via `process.env` in Express route
handlers (`server/midnightRoutes.ts`). The browser's `MidnightProofProvider`
(`src/midnight/MidnightProofProvider.ts`) only ever calls this app's own
`/api/midnight/*` endpoints over the same origin; it never talks to Midnight
infrastructure directly and never sees a wallet secret. The private response time is
still computed and read only by the caller until the moment it must be supplied as a
circuit witness - it is sent to this app's own trusted server (never to a third party) and
is asserted-then-discarded by the contract before any ledger write, exactly as before.

## Provider configuration

Client-visible (safe to inline - no secrets):

| Variable | Default | Effect |
| --- | --- | --- |
| `VITE_PROOF_PROVIDER` | `local` | `local` uses `LocalDemoProofProvider`; `midnight` uses `MidnightProofProvider`. |
| `VITE_MIDNIGHT_NETWORK` | `undeployed` | Cosmetic label only, shown before the real status loads from the server. |

Server-only (never `VITE_`-prefixed - see `.env.example`, `.env.preprod.example`,
`.env.preview.example`):

| Variable | Default | Effect |
| --- | --- | --- |
| `MIDNIGHT_NETWORK` | `local` | `local`, `preview`, or `preprod`. |
| `MIDNIGHT_LOCAL_SEED` | well-known public devnet seed | Only used for `local`. |
| `MIDNIGHT_PREVIEW_SEED` / `MIDNIGHT_PREVIEW_MNEMONIC` | (unset) | Exactly one required for `preview`. |
| `MIDNIGHT_PREPROD_SEED` / `MIDNIGHT_PREPROD_MNEMONIC` | (unset) | Exactly one required for `preprod`. |
| `MIDNIGHT_CONTRACT_ADDRESS` | (unset) | If set, the server joins this contract instead of deploying a new one on first use. |
| `MIDNIGHT_PROOF_SERVER` | `http://127.0.0.1:6300` | Local proof server URL (same for every network). |

Switching `VITE_PROOF_PROVIDER=midnight` with no server-side Midnight configuration does
not crash the app: `GET /api/midnight/status` reports `configured: false` with an
actionable message, the UI shows `MIDNIGHT NETWORK NOT READY`, and it never silently falls
back to local mode.

## Local-demo vs. real Midnight, feature by feature

| Feature | Status |
| --- | --- |
| Compact contract source | Real, compiles with official compiler |
| Contract privacy semantics (assert before disclose) | Real, verified from compiled output and from a real rejected transaction |
| Contract simulator tests | Real, run against `@midnight-ntwrk/compact-runtime` |
| Evidence hashing / redaction / policy evaluation | Real, runs entirely in-browser |
| `LOCAL_DEMO` receipts | Real (as what they claim to be: a local commitment, not a proof) |
| Real headless wallet connect + sync | Real, against Local devnet and Preprod |
| Real contract deploy / join | Real, on Local devnet (see `docs/MIDNIGHT_DEPLOYMENT.md`); Preprod blocked on DUST delegation (operator action required) |
| Real `submitReceipt` transaction + confirmation | Real, on Local devnet; Preprod blocked on DUST delegation |
| Independent ledger re-query | Real |
| Policy-violation rejection (on real network) | Real |
| Lace / browser wallet extension integration | Not implemented (headless wallet used instead, see above) |
| Live Mainnet deployment | Not implemented, not attempted |
