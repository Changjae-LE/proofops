// Minimal Prometheus text-format metrics. No incident data, hashes, or user-supplied
// values are ever recorded as label values, so metrics can never leak sensitive evidence.

const startedAt = Date.now();

const counters = {
  httpRequestsTotal: 0,
  receiptsCreatedTotal: 0,
  verificationsTotal: 0,
  verificationFailuresTotal: 0,
};

export function incrementHttpRequests(): void {
  counters.httpRequestsTotal += 1;
}

export function incrementReceiptsCreated(): void {
  counters.receiptsCreatedTotal += 1;
}

export function incrementVerifications(): void {
  counters.verificationsTotal += 1;
}

export function incrementVerificationFailures(): void {
  counters.verificationFailuresTotal += 1;
}

export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startedAt) / 1000);
}

export function renderMetrics(): string {
  const lines = [
    "# HELP proofops_uptime_seconds Seconds since the server process started.",
    "# TYPE proofops_uptime_seconds gauge",
    `proofops_uptime_seconds ${getUptimeSeconds()}`,
    "# HELP proofops_http_requests_total Total HTTP requests handled.",
    "# TYPE proofops_http_requests_total counter",
    `proofops_http_requests_total ${counters.httpRequestsTotal}`,
    "# HELP proofops_receipts_created_total Total verification receipts created (any provider).",
    "# TYPE proofops_receipts_created_total counter",
    `proofops_receipts_created_total ${counters.receiptsCreatedTotal}`,
    "# HELP proofops_verifications_total Total evidence verification attempts.",
    "# TYPE proofops_verifications_total counter",
    `proofops_verifications_total ${counters.verificationsTotal}`,
    "# HELP proofops_verification_failures_total Total evidence verification attempts that failed.",
    "# TYPE proofops_verification_failures_total counter",
    `proofops_verification_failures_total ${counters.verificationFailuresTotal}`,
  ];
  return `${lines.join("\n")}\n`;
}

export function resetMetricsForTests(): void {
  counters.httpRequestsTotal = 0;
  counters.receiptsCreatedTotal = 0;
  counters.verificationsTotal = 0;
  counters.verificationFailuresTotal = 0;
}
