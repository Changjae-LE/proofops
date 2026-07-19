# ProofOps - 3-Minute Demo Script

## 1. Problem (30s)

"SRE and security teams need to prove to customers and auditors that an incident was
detected, a policy was evaluated, and containment happened in time - without handing over
raw AWS or Elastic logs, which are full of account IDs, ARNs, IPs, and credentials.
ProofOps analyzes an incident locally and publishes only a privacy-preserving
verification receipt."

## 2. Load sample (15s)

Click **Load Demo Incident**. Point out the incident summary bar: incident ID and event
count loaded, entirely client-side - "watch the network tab, nothing was uploaded."

## 3. Analyze locally (25s)

Click **Analyze Privately**. Read out the result card:

- Incident type: `EC2 IMDS Credential Access Followed by Role Use`
- Severity: `HIGH`, Confidence: `HIGH`
- Response time: `8 minutes` vs. policy limit `15 minutes` -> **Policy satisfied: true**
- Evidence commitment (SHA-256) shown in monospace

"This is a deterministic rule - IMDS access, then credential retrieval, then role use, in
order - not an LLM guess."

## 4. Show redaction (25s)

Switch to the **Privacy Preview** panel. Click the **Original Evidence** tab, scroll to
show a raw session token and role ARN. Click **Redacted Preview** - same document,
`accessKeyId` and IPs partially masked (`AKIA********1234`), `sessionToken` fully
`[REDACTED]`. "This is exactly what a customer or auditor would see."

## 5. Generate receipt (20s)

Click **Generate Verification Receipt**. Point out the `LOCAL_DEMO` status badge and the
warning text: "we never claim this is a blockchain proof unless it actually is one."
Highlight the receipt fields: incident ID hash, evidence commitment, rule ID, policy ID,
policy satisfied - and nothing else.

## 6. Verify unchanged evidence (15s)

Click **Verify Current Evidence**. Large green **VERIFIED** result appears.

## 7. Tamper with evidence (20s)

Click **Tamper a Field & Verify**. Explain: "this flips one field - the source IP on the
role-use event - in a copy of the evidence, nothing else changes."

## 8. Show verification failure (15s)

Large red **VERIFICATION FAILED** result, with the tampered field, old value, new value,
and the two mismatched SHA-256 commitments shown side by side. "One byte changes the whole
hash - that's what makes this tamper-evident."

## 9. Explain Midnight privacy (25s)

"The Compact contract in `contract/src/proofops.compact` takes the response time as a
private witness and only asserts it's within policy - the actual minutes never touch the
public ledger, only the commitments and a boolean result. This isn't just compiled and
simulator-tested: with `VITE_PROOF_PROVIDER=midnight`, this exact flow - Connect Wallet,
Deploy Contract, Generate Verification Receipt - submits a real transaction, gets a real
transaction ID and block height back, and independently re-queries the ledger to confirm
the private response time is genuinely absent. See `docs/MIDNIGHT_DEPLOYMENT.md` for an
already-executed real run."

## 10. Impact for SRE/security teams (10s)

"This turns 'trust us, we handled it' into a receipt anyone can verify - without ever
seeing the incident."

## Bonus: real Midnight network demo (local devnet, ~2 extra minutes)

Only if time allows and Docker is available:

```powershell
npm run midnight:env:up
$env:MIDNIGHT_NETWORK = "local"; $env:VITE_PROOF_PROVIDER = "midnight"
npm run midnight:deploy   # note the printed contract address
$env:MIDNIGHT_CONTRACT_ADDRESS = "<address>"
npm run dev
```

In the UI: the badge now reads `MIDNIGHT NETWORK`. Click **Connect Wallet**, then repeat
steps 2-6 above - **Generate Verification Receipt** now submits a real transaction and
shows a real transaction ID and contract address on the receipt card instead of
`LOCAL_DEMO`. Tear down afterward with `npm run midnight:env:down`.
