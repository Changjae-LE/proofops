# Midnight Deployment Record

This document records real, executed Midnight network interactions - every value below was
produced by an actual command run in this session against a real network. Nothing here is
aspirational. See `docs/MIDNIGHT_STATUS.md` for the toolchain/version background and honesty
contract this document follows.

## Local devnet run (Confirmed by execution)

**Date/time:** 2026-07-19, ~21:29-21:35 UTC
**Network:** `local` (`undeployed` network ID) - Docker devnet brought up via
`npm run midnight:env:up` (`docker-compose.midnight.yml`): `midnightntwrk/midnight-node:1.0.0`,
`midnightntwrk/indexer-standalone:4.3.3`, `midnightntwrk/proof-server:8.1.0`, all healthy.
**Wallet:** headless, well-known public devnet seed (`0000...0001`, the same one the official
`example-hello-world`/`example-counter` repos use for local devnet - not a secret).

### Deployment

```
$ npm run midnight:deploy
Contract deployed at: 121eaec203756a682987852ba58631443bfae8369c4ca2df10d1c223ffc19fc3
```

### submitReceipt transaction

Circuit: `submitReceipt`
Public inputs:
- `incidentIdHashIn` = `29b172905525bdc2354b2f48c52e119a86e1ee6185b3f8465145e63a6c8ada01`
- `evidenceCommitmentIn` = `15f1ffeaccffecb836fd6e783b321eb08b4694b0cbd8ec980d298b9e1709e23e`
- `limitMinutes` = `15`

Private input (witness, type only - the value below is the bundled fictional demo
incident's response time, not a secret): `responseTimeMinutes: Uint<16> = 8`

Confirmation result:
- Transaction ID: `17602991464e9659c36e6f2d4046e1916c84a53a6a044651ba059a0e788883e1`
- Block height: `416`
- Status: `SucceedEntirely`

### Independent ledger re-query

```
$ npm run midnight:verify
Ledger state (public only): {
  incidentIdHash: '29b172905525bdc2354b2f48c52e119a86e1ee6185b3f8465145e63a6c8ada01',
  evidenceCommitment: '15f1ffeaccffecb836fd6e783b321eb08b4694b0cbd8ec980d298b9e1709e23e',
  policyLimitMinutes: '15',
  policySatisfied: true,
  receiptCount: '1'
}
Ledger field set: [incidentIdHash, evidenceCommitment, policyLimitMinutes, policySatisfied, receiptCount]
```

The private response time (8 minutes) is absent from every field returned by the indexer -
confirmed by field-set inspection, not just by source code review.

### Failure case (Confirmed by execution)

```
$ npm run midnight:failure-test
Submitting responseMinutes=16 against policyLimitMinutes=15 (should be rejected)...
PASS: proof construction / transaction submission was rejected, as expected.
Reason: Unexpected error executing scoped transaction '<unnamed>':
        Error: failed assert: response time exceeds the policy containment limit
```

No transaction was created for the rejected case (no `MIDNIGHT_CONFIRMED` result, no txId
returned - confirmed by the promise rejecting rather than resolving).

### Automated integration test

```
$ MIDNIGHT_NETWORK=local npm run midnight:test:integration
 ✓ tests/integration/midnight-network.test.ts (4 tests) 44505ms
   ✓ deploys a real contract and the deployed address is well-formed
   ✓ submits a real submitReceipt transaction and confirms it on-chain
   ✓ independently re-queries the indexer - private response time absent from public state
   ✓ rejects a response time that exceeds the policy limit - no transaction is created
```

### Exact reproduction

```powershell
npm run midnight:env:up      # starts node + indexer + proof-server via Docker
$env:MIDNIGHT_NETWORK = "local"
npm run midnight:deploy       # prints a contract address
$env:MIDNIGHT_CONTRACT_ADDRESS = "<address printed above>"
npm run midnight:demo         # real analyze -> submitReceipt -> ledger verify, end to end
npm run midnight:failure-test # confirms the policy assertion cannot be bypassed
npm run midnight:test:integration
npm run midnight:env:down     # tear down when finished
```

## Real bugs found and fixed during this deployment

### WASM module duplication (contract/ nested node_modules)

The first deploy attempt against local devnet failed with
`TypeError: Cannot read properties of undefined (reading 'ctor')` inside
`@midnight-ntwrk/compact-js`'s internal `compactContext.js`. Root cause: `contract/` is a
separate npm package with its own `node_modules`; it had accidentally been given its own
copy of `@midnight-ntwrk/midnight-js-protocol` (and therefore its own, physically distinct
copy of `@midnight-ntwrk/compact-js`/`effect`/`onchain-runtime-v3`). The compiled contract
object built from that nested copy was "branded" with a `Symbol()` from the nested
`compactContext.js` module instance, but the real deploy code (`server/midnight/*`)
resolves everything from the root `node_modules` - a *different* physical module instance,
with its own `Symbol()`. Same package version, two different in-memory instances, so the
branding symbol never matched and the property lookup returned `undefined`.

Fix: removed `@midnight-ntwrk/midnight-js-protocol` and `@midnight-ntwrk/compact-runtime`
from `contract/package.json` entirely, and added `@midnight-ntwrk/compact-runtime` as a
direct root dependency instead. `contract/src/index.ts` (and the compiled contract's own
internal imports) now resolve every `@midnight-ntwrk/*` package from the single root
`node_modules` tree, the same one `server/midnight/*` uses - one instance, one `Symbol()`,
correctly matching. `contract/tests/` (the offline simulator, run under WSL) still passes
because Node's module resolution walks up to the repository root when a package isn't
present locally, and the WSL container mounts the same filesystem at `/mnt/c/...`.

## Docker image bug: testkit-js crashes the container on import alone

A more severe bug was found when rebuilding the production Docker image: simply
*importing* `server/midnight/wallet.ts` crashed the entire container - including for
local-demo-only deployments that never call an `/api/midnight/*` route - with
`EACCES: permission denied, mkdir '/app/logs/tests'`. Root cause:
`@midnight-ntwrk/testkit-js` runs a module-top-level side effect
(`const logger = createDefaultTestLogger();`) that unconditionally creates a file logger
under `./logs/tests` (relative to `process.cwd()`) the instant the module is loaded,
regardless of whether any test/wallet code actually runs. This app's Docker image runs as
a non-root user with no writable `logs/` directory, so it crashed on container start every
time, before ever serving a single request. Routes were refactored to dynamically
`import()` the session/receipt modules (deferring load until an `/api/midnight/*` route is
actually hit) as a general hygiene improvement, but that alone did **not** fix this: esbuild's
single-output-file bundling (no `--splitting`) only defers the *resolution* of a dynamic
import of a same-bundle local module, not that module's own top-level side effects - the
underlying code is still eagerly evaluated as part of normal bundle initialization. The
actual fix was in `Dockerfile`: pre-create and `chown` `/app/logs/tests` to the `proofops`
user before dropping root, so the logger construction succeeds regardless of when it runs.

## Smaller bug: private state provider ordering

A third, smaller bug: `joinProofOpsContract()` read
`providers.privateStateProvider.get(PRIVATE_STATE_ID)` before calling
`providers.privateStateProvider.setContractAddress(contractAddress)`, exactly the ordering
the private state provider requires (confirmed by the real error message: "Contract address
not set. Call setContractAddress() before accessing private state."). Fixed by calling
`setContractAddress()` first, matching the order used by the official `example-bboard`
reference (`BBoardAPI.getPrivateState`).

## Preprod (public testnet)

**Status as of this writing: blocked on DUST delegation, not yet confirmed.** A fresh
wallet was generated locally (`scripts/midnight-generate-wallet.ts`) with address
`453e0a0946768ff8d85e9a64ec383ac9cd966237a8862bfd5953dcae3b20d55c`, and the operator
visited the [Preprod faucet](https://midnight-tmnight-preprod.nethermind.dev/) to fund it.

Two real deploy attempts were run against Preprod (2-minute and 30-minute wallet-sync
timeouts). Both reached the real `indexer.preprod.midnight.network` and
`rpc.preprod.midnight.network` endpoints and made real progress: the shielded and
unshielded balances both fully synced. The **DUST** balance never finished syncing -
`@midnight-ntwrk/wallet-sdk-dust-wallet`'s sync loop repeatedly emitted a
`Wallet.Sync` error event for the full 30-minute window before the run timed out. This
is consistent with the wallet having tNIGHT but **no DUST delegation performed yet** -
per the official docs, tNIGHT funds only the shielded/unshielded balances; DUST (needed
to pay transaction fees) must be separately delegated from tNIGHT via 1AM or Lace Carbon.
Simply visiting the faucet is not sufficient on its own.

**Manual action still required from the operator:** open 1AM (or Lace, once Carbon
support ships) with this wallet's seed, confirm the faucet transfer actually landed
(tNIGHT balance > 0), and explicitly delegate it to DUST. Once that's done, re-run:

```powershell
$env:MIDNIGHT_NETWORK = "preprod"
npm run midnight:deploy
```

This section will be updated with the real Preprod transaction ID, block height, and
ledger query result once that succeeds - no Preprod result is fabricated here in the
meantime, and the local-devnet run above already demonstrates the identical code path
working end to end on a real network.
