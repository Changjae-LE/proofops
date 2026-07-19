# ProofOps Runbook

Operational recovery steps for common failure modes. This is an MVP; there is no
on-call rotation or paging integration - these are manual steps for a developer or
demo operator.

## Application fails health check

**Symptom:** `GET /healthz` does not return `200` / `status: "healthy"`.

1. Check the process is actually running: `docker ps` (Docker) or check the terminal
   running `npm start` / `npm run dev`.
2. Check server logs (structured JSON on stdout/stderr) for a `shutdown_error` or crash
   line.
3. Confirm the port isn't already bound: `PORT` env var (default `8787`) must be free.
4. Restart: `npm start` (production) or `npm run dev` (development).

## Frontend build missing

**Symptom:** `GET /readyz` returns `"status": "degraded"`, `"frontend": false`.

1. This means `dist/index.html` does not exist next to the running server.
2. Run `npm run build` (or `npm run build:web` alone) from the repository root.
3. Restart the server (`npm start`). In Docker, rebuild the image:
   `docker compose up --build`.

## Midnight provider unavailable

**Symptom:** `SystemStatus` badge shows `MIDNIGHT NETWORK NOT READY`; `GET
/api/midnight/status` reports `configured: false` or `phase: "error"`.

1. Check server-side env vars are set: `MIDNIGHT_NETWORK` (`local`/`preview`/`preprod`)
   and, for `preview`/`preprod`, exactly one of `MIDNIGHT_<NETWORK>_SEED` /
   `MIDNIGHT_<NETWORK>_MNEMONIC` - see `.env.preprod.example` / `.env.preview.example`.
2. Check the proof server is running: `docker ps` should show a healthy
   `proofops-proof-server-1` (or your own proof server at `MIDNIGHT_PROOF_SERVER`).
3. Check server logs for `midnight_wallet_sync_error`, `midnight_connect_failed`, or
   `midnight_session_ready` (the last one means it *did* connect - the UI just hasn't
   refreshed yet; click Connect Wallet again or reload).
4. **Fastest recovery for a demo:** set `VITE_PROOF_PROVIDER=local` (or unset it - `local`
   is the default) and restart. The rest of the app is fully functional in local-demo
   mode; see "Returning to local-demo mode" below.

## Midnight wallet sync is slow or times out

**Symptom:** `npm run midnight:deploy` / `:demo` / server startup hangs on
`midnight_wallet_sync_progress` log lines for a long time, or eventually logs
`Wallet sync timeout after <n>ms`.

1. This is expected on Preview/Preprod for a fresh wallet - official docs note this can
   take up to ~60 minutes against a live chain with real history. Local devnet syncs in
   seconds; if local sync is slow, check `docker compose -f docker-compose.midnight.yml
   ps` for an unhealthy `node`/`indexer` container.
2. Increase the timeout with `MIDNIGHT_SYNC_TIMEOUT_MS` (milliseconds) if you know the
   network is just slow, not down.
3. A timeout is not a fabricated failure - the process will retry cleanly on the next
   `getMidnightSession()` call (the cached session promise is cleared on error).

## Midnight wallet has insufficient funds

**Symptom:** `Wallet.InsufficientFunds` or similar error during `submitReceipt`/deploy on
Preview/Preprod.

1. The wallet needs both tNIGHT (from the network's public faucet page - see
   `docs/MIDNIGHT_STATUS.md` for the URL) and tDUST (delegated from tNIGHT via 1AM or
   Lace). Local devnet needs neither (the well-known devnet seed is pre-funded).
2. This must be done manually by a human visiting the faucet page - there is no
   programmatic drip endpoint, and this codebase never attempts to fabricate or bypass it.

## On-chain ledger doesn't match an older receipt ("verification failed" on Midnight)

**Symptom:** `Verify Current Evidence` against a `MIDNIGHT_CONFIRMED` receipt reports
`VERIFICATION FAILED`, but you're sure the evidence hasn't changed.

1. This is expected, not a bug, if a *newer* receipt has been submitted to the same
   contract since this one - the contract's ledger holds only the most recently submitted
   receipt (see the "Ledger overwrite" limitation in `docs/THREAT_MODEL.md`), not a full
   history. `MidnightProofProvider.verifyReceipt()`'s message explains this explicitly.
2. To verify an older receipt again, redeploy or use a contract address that hasn't had a
   newer receipt submitted since.

## Real Midnight demo (local devnet)

**Fully offline, reproducible, no faucet needed.**

```powershell
npm run midnight:env:up        # docker: node + indexer + proof-server
$env:MIDNIGHT_NETWORK = "local"
npm run midnight:deploy        # prints a contract address
$env:MIDNIGHT_CONTRACT_ADDRESS = "<address>"
npm run midnight:demo          # real analyze -> submitReceipt -> ledger verify
npm run midnight:failure-test  # confirms the policy assertion can't be bypassed
npm run midnight:env:down      # tear down when finished
```

See `docs/MIDNIGHT_DEPLOYMENT.md` for a real, already-executed run of this exact flow.

## Invalid incident upload

**Symptom:** "Upload JSON" shows a red error message instead of loading the incident.

1. The error message from `src/lib/validation.ts` names the exact missing/invalid field
   (for example, `Incident is missing a valid "detection.detectedAt" timestamp.`) - start
   there.
2. Confirm the file is valid JSON and under 1 MB
   (`src/lib/validation.ts#MAX_INCIDENT_UPLOAD_BYTES`).
3. Compare against `public/samples/imds-role-use-incident.json` for the expected shape.

## Receipt verification mismatch

**Symptom:** "Verify Current Evidence" (using the *same*, non-tampered incident) reports
`VERIFICATION FAILED`.

1. This means the evidence in memory has genuinely changed since the receipt was
   generated in this session (for example, a different incident was loaded or uploaded
   after the receipt was created, without generating a new receipt for it).
2. Re-run the flow in order: Load/Upload -> Analyze Privately -> Generate Verification
   Receipt -> Verify. Generating a new receipt after loading new evidence resolves this.
3. If this happens with the bundled demo incident with no changes, file a bug - this
   indicates a nondeterminism regression in `canonicalize.ts` or `hashing.ts`.

## Docker container restart

**Symptom:** Need to restart the container cleanly, or it keeps restarting.

1. `docker compose ps` to check status; `docker compose logs proofops` for logs.
2. `docker compose restart proofops` for a clean restart.
3. If it is crash-looping, check the health check command output:
   `docker inspect --format='{{json .State.Health}}' <container>`.
4. Full rebuild if the image itself is suspect: `docker compose up --build --force-recreate`.

## Returning to local-demo mode

If anything about the Midnight integration is broken, unavailable, or simply not needed
for a given demo:

1. Set `VITE_PROOF_PROVIDER=local` (or delete/comment it out - `local` is the default).
2. Rebuild the frontend if you changed `.env` after building: `npm run build:web`.
3. Restart the app. Every feature except real on-chain proof submission works fully in
   this mode, and the UI clearly shows the `LOCAL DEMO MODE` badge so nobody mistakes a
   local receipt for an on-chain one.
