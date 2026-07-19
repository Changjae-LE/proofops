import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../server/app";
import { resetMetricsForTests } from "../server/metrics";

describe("server operational endpoints", () => {
  beforeEach(() => {
    resetMetricsForTests();
  });

  it("GET /healthz responds successfully with the expected shape", async () => {
    const app = createApp();
    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.service).toBe("proofops");
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(typeof res.body.proofProvider).toBe("string");
  });

  it("GET /readyz responds successfully with the expected shape", async () => {
    const app = createApp();
    const res = await request(app).get("/readyz");

    expect(res.status).toBe(200);
    expect(typeof res.body.frontend).toBe("boolean");
    expect(res.body.proofProvider).toHaveProperty("name");
    expect(res.body.proofProvider).toHaveProperty("ready");
  });

  it("GET /metrics returns Prometheus text format with the required series and no sensitive values", async () => {
    const app = createApp();
    const res = await request(app).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.text).toContain("proofops_uptime_seconds");
    expect(res.text).toContain("proofops_http_requests_total");
    expect(res.text).toContain("proofops_receipts_created_total");
    expect(res.text).toContain("proofops_verifications_total");
    expect(res.text).toContain("proofops_verification_failures_total");

    // Metrics must never contain incident content, ARNs, IPs, or account IDs.
    expect(res.text).not.toMatch(/arn:aws/i);
    expect(res.text).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
    expect(res.text).not.toContain("123456789012");
  });

  it("POST /api/events increments counters without echoing any payload back", async () => {
    const app = createApp();
    const created = await request(app).post("/api/events").send({ type: "receipt_created" });
    expect(created.status).toBe(204);

    const failed = await request(app).post("/api/events").send({ type: "verification_failed" });
    expect(failed.status).toBe(204);

    const metrics = await request(app).get("/metrics");
    expect(metrics.text).toContain("proofops_receipts_created_total 1");
    expect(metrics.text).toContain("proofops_verifications_total 1");
    expect(metrics.text).toContain("proofops_verification_failures_total 1");
  });

  it("POST /api/events rejects unknown event types", async () => {
    const app = createApp();
    const res = await request(app).post("/api/events").send({ type: "not-a-real-event" });
    expect(res.status).toBe(400);
  });

  it("sets basic security headers", async () => {
    const app = createApp();
    const res = await request(app).get("/healthz");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });
});
