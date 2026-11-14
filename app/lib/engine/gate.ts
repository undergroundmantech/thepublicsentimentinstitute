// Operator switches and the simulated-data firewall. Everything defaults OFF or closed.
import type { DataMode } from "./types";
type Env = Record<string, string | undefined>;

/** The server forecast API (/api/results/forecast). */
export const engineApiEnabled = (env: Env = process.env) => env.ONPOINT_ENGINE_API === "on";
/** The engine recorder (/api/results/engine-capture). */
export const engineRecorderEnabled = (env: Env = process.env) => env.ONPOINT_ENGINE_RECORDER === "on";
/** Replay of authentic recorded or exported history. */
export const replayEnabled = (env: Env = process.env) => env.ONPOINT_REPLAY === "on";

/**
 * SIMULATED data may be served only in a private development or QA environment: the operator must ask for it by
 * name AND the deployment must not be production. A request parameter, cookie or client flag can never enable it.
 */
export const simulatedAllowed = (env: Env = process.env) => env.ONPOINT_ALLOW_SIMULATED === "on" && env.VERCEL_ENV !== "production";

/** Whether data of this mode may leave the server in this environment, and the HTTP status when it may not. */
export function servable(mode: DataMode, env: Env = process.env): { ok: true } | { ok: false; status: 403 | 404; reason: string } {
  if (mode === "SIMULATED") return simulatedAllowed(env) ? { ok: true } : { ok: false, status: 403, reason: "Simulated data is not available in this environment." };
  if (mode === "HISTORICAL") return replayEnabled(env) ? { ok: true } : { ok: false, status: 404, reason: "Replay is switched off (ONPOINT_REPLAY)." };
  return { ok: true };
}

/** The recorder namespace a mode writes to. Fixed: simulated data has its own, and can enter no other. */
export const namespaceOf = (mode: DataMode) => (mode === "LIVE" ? "live" : mode === "HISTORICAL" ? "historical" : "simulated") as "live" | "historical" | "simulated";
