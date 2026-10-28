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
  // stands down only when RaceDesk's timeline is served from the durable recorder (publicTimeline.ts); otherwise the
  // desk still reads this recorder's history
  const store = env.INTELLIGENCE_CAPTURE_STORE;
  if (store && store !== "github" && env.ONPOINT_PUBLIC_SNAPSHOT === "1") return { status: 200, body: { skipped: "superseded by /api/intelligence/capture" } };
  return null;
}
