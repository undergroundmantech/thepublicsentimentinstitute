// Custom events for Vercel Web Analytics and Google Analytics 4, from the browser. Use ev() instead of calling track()
// directly: it keeps data to what Web Analytics accepts, flat strings, numbers, booleans or null,
// strings cut to 255 characters, and attaches the site's feature flags to every event.
//
// Keep each event to two data keys, most useful first. Web Analytics limits how many keys an event
// may carry by plan, and ev() drops anything past MAX_KEYS. The page the event fired on is recorded
// by Web Analytics on its own, so it never needs a key.
import { track } from "@vercel/analytics";
import { FLAG_KEYS } from "./flagValues";

export type EvVal = string | number | boolean | null | undefined;
export type EvData = Record<string, EvVal>;

const MAX_LEN = 255;
const MAX_KEYS = 2;

export function evClean(data?: EvData): Record<string, string | number | boolean | null> | undefined {
  if (!data) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  let n = 0;
  for (const [k0, v] of Object.entries(data)) {
    if (v === undefined || n >= MAX_KEYS) continue;
    const k = k0.slice(0, MAX_LEN);
    if (typeof v === "number") out[k] = Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
    else if (typeof v === "string") out[k] = v.slice(0, MAX_LEN);
    else out[k] = v;
    n++;
  }
  return n ? out : undefined;
}

const last = new Map<string, number>();

/** Send one custom event. The same event with the same data inside a second is sent once. */
export function ev(name: string, data?: EvData): void {
  if (typeof window === "undefined") return;
  const d = evClean(data);
  const sig = name + JSON.stringify(d ?? {});
  const now = Date.now();
  if (now - (last.get(sig) ?? 0) < 1000) return;
  last.set(sig, now);
  if (last.size > 200) last.clear();
  try { track(name.slice(0, MAX_LEN), d, { flags: FLAG_KEYS }); } catch { /* analytics never breaks the page */ }
  // the same event in Google Analytics 4, named the GA way: lower case words joined by underscores, at most 40 characters
  try {
    const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
    if (g) g("event", name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40), d ?? {});
  } catch { /* analytics never breaks the page */ }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Send once the visitor stops changing something, like a slider being dragged. Keyed so each control waits on its own. */
export function evSettled(key: string, name: string, data?: EvData, ms = 1500): void {
  if (typeof window === "undefined") return;
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => { timers.delete(key); ev(name, data); }, ms));
}
