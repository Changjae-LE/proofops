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

**Symptom:** `SystemStatus` badge shows `MIDNIGHT NETWORK` but reports "unreachable" or
"not ready"; `Generate Verification Receipt` fails with an error mentioning
`MidnightProofProvider`.

1. This is expected unless a real Midnight devnet/testnet, proof server, and deployed
   contract are configured - see `docs/MIDNIGHT_STATUS.md`.
2. Check `VITE_MIDNIGHT_PROOF_SERVER_URL` and `VITE_MIDNIGHT_CONTRACT_ADDRESS` are set
   correctly for your environment.
3. **Fastest recovery for a demo:** set `VITE_PROOF_PROVIDER=local` (or unset it - `local`
   is the default) and restart. The rest of the app is fully functional in local-demo
   mode; see "Returning to local-demo mode" below.

## Proof transaction timeout

**Symptom:** A Midnight receipt-creation call hangs or times out.

1. `MidnightProofProvider` uses a 2-second timeout on its own reachability check
   (`pingProofServer`), so a hang here indicates a problem upstream of this codebase
   (e.g., the proof server process itself, or the network path to it).
2. Check the proof server process/container is actually running and its logs.
3. As with any provider outage, fall back to local-demo mode to keep a demo moving:
   `VITE_PROOF_PROVIDER=local`.

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
