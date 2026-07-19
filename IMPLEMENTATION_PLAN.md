# ProofOps Implementation Plan

Written at the start of the build and kept as a record of the executed sequence (see
`docs/MIDNIGHT_STATUS.md` for what changed vs. this plan during Midnight integration).

1. **Environment & scaffold** - inspect Node/npm/git/Docker/WSL, research the current
   official Midnight toolchain, scaffold the TypeScript/React/Vite/Express project.
2. **Core privacy engine** - types, validation, canonicalization, hashing, redaction,
   deterministic AWS-IMDS-ROLE-USE-001 detection, policy evaluation, receipt model, unit
   tests.
3. **UI** - demo loader, upload, analysis result, privacy preview (original vs. redacted),
   receipt generation, verification incl. tamper demo, provider/system status, dark
   security-ops styling, accessibility.
4. **Operations layer** - Express server (`/healthz`, `/readyz`, `/metrics`,
   `/api/events`), structured logging, graceful shutdown, Docker multi-stage build.
5. **Midnight** - Compact contract, real compiler build, real `compact-runtime` simulator
   tests, provider abstraction (`LocalDemoProofProvider` / `MidnightProofProvider`),
   honest status documentation.
6. **Quality & submission** - CI, README, architecture/threat-model/runbook/demo docs,
   final typecheck/lint/test/build/Docker/health verification.

Outcome: all six phases completed; see the root `README.md` for what is real vs.
local-demo-only, and the final verification results in the closing summary of this
session.
