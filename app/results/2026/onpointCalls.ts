// The only calls the results pages show: On Point's own. Pure, so it can be unit-tested.
//
// civicAPI supplies the count. Its winner flags are not displayed anywhere on these pages: every "called" mark, tally
// and map outline comes from the engine's call ledger (app/lib/engine/modelCalls.ts), in one of four lanes:
//   standard       the model's probability held above the threshold through every safeguard
//   safe-seat      the forecast's heavy favourite, confirmed on an early count
//   count-settled  no forecast for the race: the count itself settles it (stopped, or the lead out of reach)
//   uncontested    one candidate on the ballot: recorded when the polls close
// An On Point call is a projection by On Point Politics. It is not a certified result.
import type { CRace } from "./live";

export type CallLane = "standard" | "safe-seat" | "count-settled" | "uncontested";
export type OnPointCall = { name: string; party: string | null; /** when the engine made the call (in a replay: the replay's own clock) */ at: string | null; lane: CallLane; /** the candidate's id in the engine, when the call comes from a ledger */ id?: string };
/** by forecast race id */
export type CallBook = Record<string, OnPointCall>;

/** The compact file the live pages read when no engine ledger is available: public/replay/2026/onpoint-calls.json (part of the replay data pack, written by scripts/engine/export_static_replay.ts). */
export type RecordedCalls = { v: 1; engine: string; source: string; asOf: string; calls: Record<string, [name: string, party: string | null, at: string, lane: CallLane]> };

type LedgerRaces = Record<string, { modelCall: null | { candidateId: string; name: string; partyRaw: string | null; calledAt: string; lane?: string } }>;

/** The calls on an engine ledger. */
export function callsFromLedger(races: LedgerRaces | null | undefined): CallBook {
  const out: CallBook = {};
  for (const [id, r] of Object.entries(races ?? {})) if (r.modelCall) out[id] = { name: r.modelCall.name, party: r.modelCall.partyRaw, at: r.modelCall.calledAt, lane: (r.modelCall.lane as CallLane) ?? "standard", id: r.modelCall.candidateId };
  return out;
}
export function callsFromRecorded(f: RecordedCalls | null | undefined): CallBook {
  const out: CallBook = {};
  for (const [id, [name, party, at, lane]] of Object.entries(f?.calls ?? {})) out[id] = { name, party, at, lane };
  return out;
}

const key = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Which row of a civicAPI race is the called candidate: the exact name first, then the name with accents and punctuation folded. */
export function calledIndex(c: CRace, call: OnPointCall | undefined): number {
  if (!call) return -1;
  const exact = c.c.findIndex((x) => x[0] === call.name); if (exact >= 0) return exact;
  const k = key(call.name), hits = c.c.map((x, i) => (key(x[0]) === k ? i : -1)).filter((i) => i >= 0);
  return hits.length === 1 ? hits[0] : -1;
}

/** One civicAPI race with its winner flag set from On Point's call and from nothing else. */
export function withCall(c: CRace, call: OnPointCall | undefined): CRace {
  const w = calledIndex(c, call);
  return { ...c, c: c.c.map((x, i) => [x[0], x[1], x[2], x[3], i === w ? 1 : 0, x[5]]) };
}
/** Every matched race with its winner flags replaced; races without a call show none. */
export function applyCalls(byId: Record<string, CRace>, book: CallBook): Record<string, CRace> {
  const out: Record<string, CRace> = {};
  for (const [id, c] of Object.entries(byId)) out[id] = withCall(c, book[id]);
  return out;
}
/** A civicAPI race the forecast does not cover: its provider winner flag is dropped (there is no On Point call for it). */
export const withoutProviderCall = (c: CRace): CRace => (c.c.some((x) => x[4]) ? { ...c, c: c.c.map((x) => [x[0], x[1], x[2], x[3], 0, x[5]]) } : c);

/**
 * A seat that is certain for one major party before any winner is called: every candidate with votes is of the same
 * party (two Democrats in a top-two general). The seat counts for that party once votes are in; the name does not.
 */
export function certainParty(c: CRace | undefined): "D" | "R" | null {
  if (!c) return null;
  const withVotes = c.c.filter((x) => x[2] > 0); if (withVotes.length < 2) return null;
  const p = (s: string) => { const t = s.trim().toLowerCase(); return t === "d" || t.startsWith("dem") ? "D" : t === "r" || t.startsWith("rep") || t === "gop" ? "R" : null; };
  const first = p(withVotes[0][1]); if (!first) return null;
  return withVotes.every((x) => p(x[1]) === first) ? first : null;
}

export const LANE_LABEL: Record<CallLane, string> = { standard: "On Point call", "safe-seat": "On Point call", "count-settled": "On Point call · count settled", uncontested: "Unopposed" };
export const CALL_NOTE = "A call by On Point Politics from its own model and the reported count. It is a projection, not a certified result.";
