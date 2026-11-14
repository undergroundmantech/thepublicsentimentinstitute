// The replay pack stores a full engine state every few frames and, between them, only what changed since the frame
// before. Pure, and exact: applying a frame's delta to the frame before it gives back that frame, value for value
// (the export checks every frame this way before it writes the pack).
import type { View } from "./serve";

type Rows = View["races"]; type LRaces = View["ledger"]["races"]; type Ev = View["ledger"]["events"][number];
export type FrameDelta = {
  delta: true;
  /** everything but the race rows and the ledger's races and events, whole */
  top: Omit<View, "races" | "ledger">;
  races: Rows; racesGone: string[];
  ledger: { config: View["ledger"]["config"]; asOf: string | null; eventCount: number; races: LRaces; racesGone: string[];
    /** the events list: drop those before `firstSeq`, then append `add` */
    firstSeq: number | null; add: Ev[] };
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function diff<T>(prev: Record<string, T>, cur: Record<string, T>): { changed: Record<string, T>; gone: string[] } {
  const changed: Record<string, T> = {}; for (const [k, v] of Object.entries(cur)) if (!(k in prev) || !same(prev[k], v)) changed[k] = v;
  return { changed, gone: Object.keys(prev).filter((k) => !(k in cur)) };
}
function patch<T>(prev: Record<string, T>, changed: Record<string, T>, gone: string[]): Record<string, T> {
  const out = { ...prev, ...changed }; for (const k of gone) delete out[k]; return out;
}

export function makeDelta(prev: View, cur: View): FrameDelta {
  const { races, ledger, ...top } = cur; const r = diff(prev.races, races), l = diff(prev.ledger.races, ledger.races);
  const lastPrev = prev.ledger.events.length ? prev.ledger.events[prev.ledger.events.length - 1].seq : 0;
  return { delta: true, top, races: r.changed, racesGone: r.gone,
    ledger: { config: ledger.config, asOf: ledger.asOf, eventCount: ledger.eventCount, races: l.changed, racesGone: l.gone, firstSeq: ledger.events.length ? ledger.events[0].seq : null, add: ledger.events.filter((e) => e.seq > lastPrev) } };
}
export function applyDelta(prev: View, d: FrameDelta): View {
  const events = d.ledger.firstSeq == null ? [] : [...prev.ledger.events.filter((e) => e.seq >= (d.ledger.firstSeq as number)), ...d.ledger.add];
  return { ...d.top, races: patch(prev.races, d.races, d.racesGone),
    ledger: { config: d.ledger.config, asOf: d.ledger.asOf, eventCount: d.ledger.eventCount, races: patch(prev.ledger.races, d.ledger.races, d.ledger.racesGone), events } } as View;
}
export const isDelta = (x: unknown): x is FrameDelta => !!x && typeof x === "object" && (x as { delta?: boolean }).delta === true;
