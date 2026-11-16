// civicAPI's per-race history export (one file per race: every snapshot the provider stored, with its timestamp)
// turned into replay frames. Pure: no clock, no network, no filesystem. A frame at time T holds, for each race, the
// latest snapshot the provider had published at or before T, exactly as published. Nothing is interpolated, and
// nothing later than T is read, so a frame is what a reader of civicAPI saw at that moment.
//
// The compact form read here is written by scripts/engine/extract_civic_history.py, which only drops fields the site
// never reads (colours, map names, precinct rows) and stores a county only when it changed.
import type { CivicRawRace } from "./snapshot";
import { DEFAULT_CONFIG } from "./config";

/** [percent reporting, ...[candidate index, votes]] */
export type CompactRegionRow = [number | null, ...[number, number | null][]];
export type CompactSnap = { t: string; pr: number | null; ca: string | null; lu: string | null; pc: string | null; /** candidates in the provider's order: [candidate index, votes] */ v: [number, number | null][]; w: number[]; r: Record<string, CompactRegionRow>;
  /** region rows the provider stopped listing at this snapshot (it renames and drops rows during a night) */ x?: string[] };
export type CompactRace = {
  id: number; name: string; state: string; category: string; type: string;
  /** [name, party, provider candidate id] */
  cands: [string, string | null, number | string | null][];
  /** region key -> [fips, name, type] */
  regions: Record<string, [string | null, string | null, string | null]>;
  final: (Omit<CompactSnap, "t"> & { district: string | null; ename: string | null; etype: string | null }) | null;
  snaps: CompactSnap[];
};
export type HistoryRace = { race: CompactRace; timesMs: number[]; /** per snapshot: when the race's total last moved (by more than QUIET_MOVE) */ movedAt: string[]; /** per snapshot: the highest total the race had shown up to then */ peakAt: number[]; /** per snapshot: when the total fell below that high (ms), or null while it stands at or near it */ dropAt: (number | null)[] };

/**
 * Sort each race's snapshots by time, and give every candidate entry its provider id. The export lists a candidate's
 * id only in the race's latest state, so an entry from earlier in the night whose party label was later reworded
 * ("Independent", then "Nonpartisan") has none: it takes the id of the one entry with the same name that has one.
 * Without this a candidate would change identity mid-night.
 */
export const prepare = (races: CompactRace[]): HistoryRace[] => races.map((r) => {
  const cands = r.cands.map((c) => { if (c[2] != null) return c; const ids = [...new Set(r.cands.filter((x) => x[0] === c[0] && x[2] != null).map((x) => x[2]))]; return ids.length === 1 ? ([c[0], c[1], ids[0]] as CompactRace["cands"][number]) : c; });
  const snaps = [...r.snaps].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  // A total that has stood still for half a day and then gains a sliver is a canvass correction (provisional and
  // cured ballots, a late box), not a count reopening: it does not restart the clock unless it passes the larger
  // threshold. Not in the states that count for days, where a small daily batch is the count itself.
  const slow = DEFAULT_CONFIG.turnout.quiet.slowStates.includes(r.state);
  let anchor: number | null = null, at = snaps[0]?.t ?? "", peak = 0, dropMs: number | null = null;
  const peakAt: number[] = [], dropAt: (number | null)[] = [];
  const movedAt = snaps.map((s) => {
    const tot = s.v.reduce((t, [, v]) => t + (v ?? 0), 0);
    // The highest total so far, for the "count has gone down" check. A lower total that has stood for COUNT_DROP_HOLD_MS
    // is taken as the provider's correction and becomes the reference (New York's totals were tripled for a day).
    if (tot >= (1 - COUNT_DROP) * peak) { peak = Math.max(peak, tot); dropMs = null; }
    else { const ms = Date.parse(s.t); dropMs ??= ms; if (ms - dropMs >= COUNT_DROP_HOLD_MS) { peak = tot; dropMs = null; } }
    peakAt.push(peak); dropAt.push(dropMs);
    const th = !slow && anchor != null && Date.parse(s.t) - Date.parse(at) >= QUIET_LONG_MS ? QUIET_MOVE_LONG : QUIET_MOVE;
    if (anchor == null || Math.abs(tot - anchor) > th * Math.max(anchor, 1)) { anchor = tot; at = s.t; }
    return at;
  });
  return { race: { ...r, cands, snaps }, timesMs: snaps.map((s) => Date.parse(s.t)), movedAt, peakAt, dropAt };
});

/** Index of the snapshot in force at tMs (the latest at or before it); -1 before the first. */
export function snapIndexAt(h: HistoryRace, tMs: number): number {
  let lo = 0, hi = h.timesMs.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (h.timesMs[mid] <= tMs) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}
const cand = (r: CompactRace, i: number, votes: number | null, winner: boolean) => ({ name: r.cands[i]?.[0] ?? "", party: r.cands[i]?.[1] ?? null, candidate_id: r.cands[i]?.[2] ?? null, votes, winner });

/** The provider's race as published at tMs, in the shape of the live API (what snapshotFromCivic reads). */
export function rawAt(h: HistoryRace, tMs: number, withRegions = false): (CivicRawRace & { called_at?: string | null; polls_close?: string | null }) | null {
  const i = snapIndexAt(h, tMs); if (i < 0) return null;
  const r = h.race, s = r.snaps[i], f = r.final;
  const raw: CivicRawRace & { called_at?: string | null; polls_close?: string | null } = {
    id: r.id, type: f?.etype ?? r.type, election_type: f?.etype ?? r.type, province: r.state, district: f?.district ?? null, election_name: f?.ename ?? r.name,
    percent_reporting: s.pr, last_updated: s.lu, called_at: s.ca, polls_close: s.pc, total_last_changed: h.movedAt[i] ?? null, total_peak: h.dropAt[i] != null && tMs - (h.dropAt[i] as number) >= COUNT_DROP_HOLD_MS ? null : h.peakAt[i] ?? null,
    candidates: s.v.map(([k, v]) => cand(r, k, v, s.w.includes(k))),
  };
  if (withRegions) raw.region_results = regionsAt(h, i);
  return raw;
}
/** The compact rows in force at snapshot i: each region's latest row, without the rows the provider has dropped. */
const rowCache = new WeakMap<CompactRace, { i: number; rows: Map<string, CompactRegionRow>; /** when each row's votes last changed */ at: Map<string, string>; /** the row's total when that clock last started */ anchor: Map<string, number> }>();
/**
 * A county's count has "moved" when its total differs from the total at its last move by more than this share. A
 * correction of a few votes hours later does not reopen a county: without this, trickles of a dozen ballots kept
 * resetting Florida's counties on election night and its governor's race swung between 96% and 99.5% for hours.
 */
export const QUIET_MOVE = 0.005;
/** after QUIET_LONG_MS without a move, a race total restarts its clock only on a change above QUIET_MOVE_LONG */
/** a total this far below its earlier high is a correction in progress, for this long at most */
export const COUNT_DROP = 0.02, COUNT_DROP_HOLD_MS = 24 * 3_600_000;
export const QUIET_LONG_MS = 12 * 3_600_000, QUIET_MOVE_LONG = 0.015;
const rowTotal = (row: CompactRegionRow) => (row.slice(1) as [number, number | null][]).reduce((t, [, v]) => t + (v ?? 0), 0);
export function rowsAt(race: CompactRace, i: number): Map<string, CompactRegionRow> {
  let c = rowCache.get(race); if (!c || c.i > i) { c = { i: -1, rows: new Map(), at: new Map(), anchor: new Map() }; rowCache.set(race, c); }   // frames mostly move forward: carry on from the last one
  for (let j = c.i + 1; j <= i; j++) { const s = race.snaps[j]; for (const k of s.x ?? []) { c.rows.delete(k); c.at.delete(k); c.anchor.delete(k); } for (const [k, row] of Object.entries(s.r ?? {})) { const tot = rowTotal(row), a = c.anchor.get(k); if (a == null || Math.abs(tot - a) > QUIET_MOVE * Math.max(a, 1)) { c.at.set(k, s.t); c.anchor.set(k, tot); } c.rows.set(k, row); } }
  c.i = i; return c.rows;
}
/** County (or town) rows at snapshot i, in the shape of the live API. */
export function regionsAt(h: HistoryRace, i: number): NonNullable<CivicRawRace["region_results"]> {
  const r = h.race, out: NonNullable<CivicRawRace["region_results"]> = {};
  const rows = rowsAt(r, i), at = rowCache.get(r)!.at;
  for (const [k, row] of rows) {
    const meta = r.regions[k] ?? [null, null, null];
    out[k] = { last_changed: at.get(k) ?? null, name: meta[1] ?? k, fips: meta[0] ?? undefined, type: meta[2] ?? null, percent_reporting: row[0], candidates: (row.slice(1) as [number, number | null][]).map(([ci, v]) => cand(r, ci, v, false)) };
  }
  return out;
}

export type FramePlan = { fromMs: number; toMs: number; everyMs: number }[];
/**
 * Frame times: a fixed cadence inside each window, keeping a tick only when at least one race published something new
 * since the previous kept tick. A tick is stamped at its own time, and holds only snapshots at or before it.
 */
export function frameTimes(hs: HistoryRace[], plan: FramePlan): number[] {
  const all = hs.flatMap((h) => h.timesMs).sort((a, b) => a - b); const out: number[] = []; let p = 0, last = -Infinity;
  for (const w of plan) for (let t = Math.max(w.fromMs, last + 1); t <= w.toMs; t = t + w.everyMs - ((t - w.fromMs) % w.everyMs)) {
    let n = 0; while (p < all.length && all[p] <= t) { p++; n++; }
    if (n > 0 || !out.length) { out.push(t); last = t; }
  }
  return out;
}

/** The race with its county rows as published at tMs, in the shape the pages read from the race proxy (CDetail). */
export function detailAt(race: CompactRace, tMs: number): { id: number; name: string; type: string; province: string; district: string | null; pr: number; close: string | null; updated: string | null; test: boolean;
  c: [string, string, number, number, number, number | null][]; regions: Record<string, { n: string; t?: string; pr: number; c: [string, string, number, number, number, number | null][] }> } | null {
  let i = -1; for (let j = 0; j < race.snaps.length && Date.parse(race.snaps[j].t) <= tMs; j++) i = j;
  if (i < 0) return null;
  const s = race.snaps[i], f = race.final;
  const row = (pairs: [number, number | null][], winners: number[]) => { const tot = pairs.reduce((a, [, v]) => a + (v ?? 0), 0);
    return pairs.map(([ci, v]) => [race.cands[ci]?.[0] ?? "", race.cands[ci]?.[1] ?? "", v ?? 0, tot ? Math.round((10000 * (v ?? 0)) / tot) / 100 : 0, winners.includes(ci) ? 1 : 0, null] as [string, string, number, number, number, number | null]); };
  const regions: Record<string, { n: string; t?: string; pr: number; c: [string, string, number, number, number, number | null][] }> = {};
  for (const [k, r] of rowsAt(race, i)) {
    const meta = race.regions[k] ?? [null, null, null];
    regions[meta[0] || k] = { n: meta[1] ?? k, t: meta[2] ?? undefined, pr: r[0] ?? 0, c: row(r.slice(1) as [number, number | null][], []) };
  }
  return { id: race.id, name: f?.ename ?? race.name, type: f?.etype ?? race.type, province: race.state, district: f?.district ?? null, pr: s.pr ?? 0, close: s.pc ?? null, updated: s.lu ?? null, test: false,
    c: row(s.v, s.w), regions };
}
