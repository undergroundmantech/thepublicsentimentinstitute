import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyCaptureGate } from "../../app/results/_lib/legacyCaptureGate";

const SECRET = "s".repeat(32);

test("legacy capture fails closed in a deployment without CRON_SECRET", () => {
  assert.deepEqual(legacyCaptureGate({ VERCEL: "1" }, null), { status: 503, body: { error: "capture_disabled" } });
});

test("legacy capture stays open locally without CRON_SECRET", () => {
  assert.equal(legacyCaptureGate({}, null), null);
});

test("legacy capture rejects a missing or wrong bearer", () => {
  assert.equal(legacyCaptureGate({ CRON_SECRET: SECRET }, null)?.status, 401);
  assert.equal(legacyCaptureGate({ CRON_SECRET: SECRET }, `Bearer ${"x".repeat(32)}`)?.status, 401);
  assert.equal(legacyCaptureGate({ CRON_SECRET: SECRET }, SECRET)?.status, 401);
});

test("legacy capture runs with the right bearer while the durable recorder is off", () => {
  assert.equal(legacyCaptureGate({ CRON_SECRET: SECRET, VERCEL: "1" }, `Bearer ${SECRET}`), null);
});

test("legacy capture stands down once the durable recorder is configured, without polling", () => {
  assert.deepEqual(legacyCaptureGate({ CRON_SECRET: SECRET, VERCEL: "1", INTELLIGENCE_CAPTURE_STORE: "blob", ONPOINT_PUBLIC_SNAPSHOT: "1" }, `Bearer ${SECRET}`),
    { status: 200, body: { skipped: "superseded by /api/intelligence/capture" } });
});

test("auth is checked before standing down", () => {
  assert.equal(legacyCaptureGate({ CRON_SECRET: SECRET, INTELLIGENCE_CAPTURE_STORE: "blob" }, null)?.status, 401);
});
