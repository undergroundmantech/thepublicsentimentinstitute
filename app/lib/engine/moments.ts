// Key moments of a recorded night, for the replay's markers and jump list. Pure. Every moment is derived from two
// consecutive recorded states (or from the provider's poll-closing times), and is stamped with the time of the frame
// in which it first shows: jumping to a moment shows exactly the state that produced it, never anything later.
import type { StoredState } from "./pipeline";
import { STN } from "../../results/2026/live";

export type MomentKind =
  | "POLLS_CLOSE" | "FIRST_VOTES" | "OFFICIAL_CALL" | "OFFICIAL_CALL_CHANGED" | "OFFICIAL_CALL_WITHDRAWN" | "MODEL_CALL" | "MODEL_ALERT"
  | "LEAD_CHANGE" | "FAVORITE_CHANGE" | "CHAMBER_FAVORITE" | "CHAMBER_THRESHOLD" | "CHAMBER_DECIDED" | "BIG_UPDATE";
export type Moment = {
  /** the frame in which it first shows (jump here) */
  t: string; kind: MomentKind;
  /** 3 = the night's headline moments, 2 = notable, 1 = everything else */
  imp: 1 | 2 | 3;
  raceId?: string; st?: string; chamber?: "sen" | "house" | "gov";
  title: string; detail?: string;
  /** the provider's own stated time, when it differs from the frame (an official call's called_at) */
  at?: string;
};
export type RaceMeta = { id: string; nm: string; k: string; st: string; /** pre-election chance of the favourite, 0.5 to 1; null without a forecast */ fav: number | null };

const CH: Record<"sen" | "house" | "gov", { key: "senate" | "house" | "governors"; label: string; need: { D: number; R: number } | null }> = {
  sen: { key: "senate", label: "Senate", need: { D: 51, R: 50 } }, house: { key: "house", label: "House", need: { D: 218, R: 218 } }, gov: { key: "governors", label: "Governorships", need: null },
};
const PARTY = { D: "Democrats", R: "Republicans" } as const;
const pct = (p: number) => (p >= 0.995 ? ">99%" : `${Math.round(100 * p)}%`);
const competitive = (m: RaceMeta) => m.fav != null && m.fav < 0.9;
const big = (m: RaceMeta) => m.k === "sen" || m.k === "gov";
const impOf = (m: RaceMeta, base: 1 | 2 | 3): 1 | 2 | 3 => (big(m) ? base : competitive(m) && (m.k === "house" || m.k === "measure") ? (Math.max(1, base - 1) as 1 | 2 | 3) : 1);
const leaderByVotes = (c: StoredState["races"][string]["c"]) => { let b: typeof c[number] | null = null, tot = 0; for (const x of c) { const v = x[3] ?? 0; tot += v; if (v > 0 && (!b || v > (b[3] ?? 0))) b = x; } return { b, tot }; };

/** Moments that first show in `cur`, given the state before it (null at the start). */
export function momentsBetween(prev: StoredState | null, cur: StoredState, meta: Map<string, RaceMeta>): Moment[] {
  const out: Moment[] = [], t = cur.t;
  // calls and alerts: the ledger's own new events
  const seen = prev?.ledger.events.length ?? 0;
  for (const ev of cur.ledger.events.slice(seen)) {
    const m = meta.get(ev.raceId); if (!m) continue; const st = cur.ledger.races[ev.raceId];
    if (ev.kind === "OFFICIAL_CALL") out.push({ t, kind: "OFFICIAL_CALL", imp: impOf(m, 3), raceId: m.id, st: m.st, title: `${m.nm}: civicAPI calls it for ${ev.name}`, at: st?.official?.calledAt ?? undefined });
    else if (ev.kind === "OFFICIAL_CALL_CHANGED") out.push({ t, kind: "OFFICIAL_CALL_CHANGED", imp: 3, raceId: m.id, st: m.st, title: `${m.nm}: civicAPI moves its call to ${ev.name}`, detail: ev.detail, at: st?.official?.calledAt ?? undefined });
    else if (ev.kind === "OFFICIAL_CALL_WITHDRAWN") out.push({ t, kind: "OFFICIAL_CALL_WITHDRAWN", imp: 3, raceId: m.id, st: m.st, title: `${m.nm}: civicAPI withdraws its call for ${ev.name}`, detail: ev.detail });
    else if (ev.kind === "MODEL_CALLED") out.push({ t, kind: "MODEL_CALL", imp: impOf(m, 3), raceId: m.id, st: m.st, title: `${m.nm}: ${st?.modelCall?.lane === "safe-seat" ? "safe-seat model call" : "model call"} for ${ev.name}`, detail: st?.modelCall?.lane === "safe-seat" ? "A model call in the safe-seat lane (the forecast's heavy favourite, on an early count). Not an official call." : "A model call, not an official call." });
    // the model turning on its own call, or an official call against it, is always a headline: the record keeps both
    else if (ev.kind === "ALERT_MODEL_CONTRADICTS_CALL") out.push({ t, kind: "MODEL_ALERT", imp: 3, raceId: m.id, st: m.st, title: `${m.nm}: the model turns against its own call`, detail: ev.detail });
    else if (ev.kind === "ALERT_OFFICIAL_DISAGREES") out.push({ t, kind: "MODEL_ALERT", imp: 3, raceId: m.id, st: m.st, title: `${m.nm}: the official call goes against the model call`, detail: ev.detail });
    else if (ev.kind.startsWith("ALERT_")) out.push({ t, kind: "MODEL_ALERT", imp: impOf(m, 2), raceId: m.id, st: m.st, title: `${m.nm}: the model's confidence in its call drops`, detail: ev.detail });
  }
  const firstByState = new Map<string, number>(); const hadVotes = new Set<string>();
  if (prev) for (const [id, row] of Object.entries(prev.races)) if (row.counted > 0) { const m = meta.get(id); if (m) hadVotes.add(m.st); }
  for (const [id, row] of Object.entries(cur.races)) {
    const m = meta.get(id); if (!m) continue; const was = prev?.races[id];
    const a = was ? leaderByVotes(was.c) : { b: null, tot: 0 }, b = leaderByVotes(row.c);
    if (b.tot > 0 && a.tot === 0 && !hadVotes.has(m.st)) firstByState.set(m.st, (firstByState.get(m.st) ?? 0) + 1);
    // the lead in the counted vote changes hands (once there is a real count behind the old lead)
    if (a.b && b.b && a.b[0] !== b.b[0] && row.rule !== "multi_seat" && a.tot >= Math.max(2000, 0.02 * (row.expectedFinal || 0)))
      out.push({ t, kind: "LEAD_CHANGE", imp: impOf(m, 2), raceId: id, st: m.st, title: `${m.nm}: ${b.b[1]} takes the lead in the count`, detail: `${b.b[1]} ${(b.b[3] ?? 0).toLocaleString("en-US")}, ${a.b[1]} ${(row.c.find((x) => x[0] === a.b![0])?.[3] ?? 0).toLocaleString("en-US")}` });
    // the model's favourite changes
    // (a flip counts once the new favourite is at 55% or more, so a race sitting on 50% does not flip every update)
    if (was && was.leaderId && row.leaderId && was.leaderId !== row.leaderId && row.probability != null && (row.shown ?? row.probability) >= 0.55 && row.counted > 0 && row.rule !== "multi_seat") {
      const nm = row.c.find((x) => x[0] === row.leaderId)?.[1] ?? "the other side";
      out.push({ t, kind: "FAVORITE_CHANGE", imp: impOf(m, row.counted >= 0.1 * (row.expectedFinal ?? Infinity) ? 3 : 2), raceId: id, st: m.st, title: `${m.nm}: the model now favours ${nm}`, detail: `${pct(row.shown ?? row.probability)} chance, a model estimate` });
    }
    // one update that moves a big race a long way
    const ef = row.expectedFinal ?? 0;
    if (was && big(m) && ef > 0 && a.tot > 0) {
      const jump = (row.counted - was.counted) / ef, dm = was.pm?.rep != null && row.pm?.rep != null ? row.pm.rep - was.pm.rep : 0;
      if (jump >= 0.1 || (Math.abs(dm) >= 5 && was.counted / ef >= 0.2))
        out.push({ t, kind: "BIG_UPDATE", imp: 1, raceId: id, st: m.st, title: `${m.nm}: a large update`, detail: `${Math.round(100 * jump)}% of the expected vote arrives; the reported margin moves ${Math.abs(dm).toFixed(1)} points` });
    }
  }
  for (const [st, n] of firstByState) out.push({ t, kind: "FIRST_VOTES", imp: 1, st, title: `First returns in ${STN[st] ?? st}`, detail: `${n} race${n > 1 ? "s" : ""} begin reporting` });
  // the chambers
  for (const ch of ["sen", "house", "gov"] as const) {
    const c = CH[ch], now = cur.national[c.key], was = prev?.national[c.key]; if (!was) continue;
    const pNow = Math.max(now.pD, now.pR), pWas = Math.max(was.pD, was.pR), lead = now.pD >= now.pR ? "D" : "R", leadWas = was.pD >= was.pR ? "D" : "R";
    if (lead !== leadWas) out.push({ t, kind: "CHAMBER_FAVORITE", imp: 3, chamber: ch, title: `${c.label}: the model now favours ${PARTY[lead]}`, detail: `${pct(pNow)} chance, a model estimate` });
    for (const th of [0.9, 0.99]) if (pNow >= th && pWas < th && lead === leadWas) out.push({ t, kind: "CHAMBER_THRESHOLD", imp: 3, chamber: ch, title: `${c.label}: ${PARTY[lead]} pass ${Math.round(100 * th)}% in the model`, detail: "A model estimate, not a call." });
    if (c.need) for (const p of ["D", "R"] as const) {
      const base = (x: typeof now) => x.called[p] + ((x as { notUp?: { D: number; R: number } }).notUp?.[p] ?? 0);
      if (base(now) >= c.need[p] && base(was) < c.need[p]) out.push({ t, kind: "CHAMBER_DECIDED", imp: 3, chamber: ch, title: `${c.label}: ${PARTY[p]} reach ${c.need[p]} seats on civicAPI's calls`, detail: "Counted from civicAPI's race calls and seats not up; not a certified result." });
    }
  }
  return out;
}

/** Poll closings, from the provider's own closing time for each race: one moment per closing time. */
export function pollCloseMoments(closes: { st: string; close: string }[], frameTimes: string[]): Moment[] {
  const by = new Map<string, Set<string>>();
  for (const c of closes) { if (!c.close) continue; const k = new Date(Date.parse(c.close)).toISOString(); by.set(k, (by.get(k) ?? new Set()).add(c.st)); }
  const out: Moment[] = [];
  for (const [close, sts] of [...by].sort((a, b) => a[0].localeCompare(b[0]))) {
    // shown from the first frame at or after the closing time
    const t = frameTimes.find((x) => x >= close) ?? close; const list = [...sts].sort().map((x) => STN[x] ?? x);
    out.push({ t, kind: "POLLS_CLOSE", imp: 2, at: close, title: `Polls close: ${list.length > 6 ? `${list.slice(0, 6).join(", ")} and ${list.length - 6} more` : list.join(", ")}`, detail: `civicAPI's listed closing time for races in ${list.length} state${list.length > 1 ? "s" : ""}. Some states close in two stages.` });
  }
  return out;
}
