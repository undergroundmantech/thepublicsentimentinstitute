// Gate for the legacy /api/flightrecorder/capture cron. Returns the response to send, or null to run the capture.
import { timingSafeEqual } from "node:crypto";

type Env = Record<string, string | undefined>;
export interface GateResponse { status: number; body: Record<string, string> }

export function legacyCaptureGate(env: Env, authorization: string | null): GateResponse | null {
  const secret = env.CRON_SECRET;
  if (!secret) {
    // fail closed in a deployment; an unset secret stays open only for local development
    if (env.VERCEL) return { status: 503, body: { error: "capture_disabled" } };
  } else {
    const a = Buffer.from(authorization ?? ""), b = Buffer.from(`Bearer ${secret}`);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { status: 401, body: { error: "unauthorized" } };
  }
  // once the durable recorder is configured it polls the same civicAPI races, so this one stands down
  if (env.INTELLIGENCE_CAPTURE_STORE) return { status: 200, body: { skipped: "superseded by /api/intelligence/capture" } };
  return null;
}
