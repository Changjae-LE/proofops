export type MetricEventType = "receipt_created" | "verification_run" | "verification_failed";

/**
 * Reports a coarse operational event (a counter increment label only) to the Express
 * server's /api/events endpoint so /metrics can reflect real usage. Never sends incident
 * data, evidence, hashes, or any identifier - only a fixed event type string. Best-effort:
 * failures are swallowed since metrics reporting must never block the user-facing flow.
 */
export function reportMetricEvent(type: MetricEventType): void {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
    keepalive: true,
  }).catch(() => {
    // Metrics reporting is best-effort and must never surface to the user.
  });
}
