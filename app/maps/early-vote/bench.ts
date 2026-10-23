// Early vote benchmarks: where the party lead of the early vote has to be, by now, for each side to beat the
// On Point forecast by a lot or to flip the race outright.
//
// The chain, one state and one race at a time:
//   1. Party is not a vote. On Point Polling likely voters say how each registration votes: a registered Democrat,
//      Republican or independent is some mix of 2024 Trump, Harris and new voters, and each of those crosses over at
//      its own rate. That gives each party a loyalty, and independents a Democratic share.
//   2. A one point swing in the party lead of the early vote, Democrats to Republicans, moves those ballots by
//      k = dLoyal + rLoyal - 1 points of vote margin. Defections are why k is under 1.
//   3. The early vote is s = expected early ballots / expected total ballots of the electorate. If the gap between the
//      early vote and what the forecast expected by now holds through the rest of the early vote, and Election Day
//      goes as the forecast expects, the race moves by s * k * gap.
//   4. Turn that around and solve for the party lead each target margin needs: the benchmark.
//
// Margins are Republican minus Democrat, in points, as everywhere in the forecast. The forecast already carries a
// small early vote correction (race.ev.shift), so the baseline here is the forecast without it, to avoid counting
// the same ballots twice.
import type { Bench, BenchRace, Crossover } from "./consoleData";

export type P3 = { d: number; r: number; o: number };
/** how each registration votes: the share of Democrats and Republicans who stay with their party, independents' D share */
export type Beh = { dLoyal: number; rLoyal: number; iD: number };

const dOf = (g: number[], x: Crossover) => g[0] * x.trumpToD + g[1] * (1 - x.harrisToR) + g[2] * x.newD;
/** the On Point Polling likely voter rates, nationwide */
export function baseBeh(x: Crossover | null): Beh {
  if (!x) return { dLoyal: 0.89, rLoyal: 0.84, iD: 0.58 };
  return { dLoyal: dOf(x.partyToGroup.Democrat, x), rLoyal: 1 - dOf(x.partyToGroup.Republican, x), iD: dOf(x.partyToGroup.Independent, x) };
}
/** party lead of a set of ballots, Republican positive, points */
export const leadOf = (c: P3) => ((c.r - c.d) / Math.max(1e-9, c.d + c.r + c.o)) * 100;
/** the Democratic share of the vote those ballots cast */
export const dVote = (c: P3, b: Beh) => (c.d * b.dLoyal + c.r * (1 - b.rLoyal) + c.o * b.iD) / Math.max(1e-9, c.d + c.r + c.o);
/** the vote margin those ballots cast, Republican positive, points */
export const voteM = (c: P3, b: Beh) => (1 - 2 * dVote(c, b)) * 100;
/** points of vote margin one point of party lead is worth */
export const kOf = (b: Beh) => Math.max(0.05, b.dLoyal + b.rLoyal - 1);

export type Target = { key: string; side: "D" | "R"; label: string; short: string; margin: number; lead: number; reach: boolean };
export type BenchOut = {
  race: BenchRace; beh: Beh; base: Beh;
  s: number; k: number; F0: number; behDelta: number;
  lead: number; expLead: number; gap: number;
  implied: number; impliedLo: number; impliedHi: number;
  share: number; targets: Target[];
  signal: { side: "D" | "R" | null; strength: 0 | 1 | 2 | 3; word: string };
  /** each registration's ballots so far and how they vote */
  sim: { k: "d" | "o" | "r"; label: string; n: number; dv: number }[];
  simM: number;
  /** Election Day: how the voters still to come are expected to vote, and how they have to break for each result */
  eday: Eday | null;
};
export type Eday = {
  /** 2024 vote of the voters, Trump, Harris and new, early and on Election Day */
  gEarly: number[]; gDay: number[];
  /** vote margins on the forecast's electorate model, Republican positive */
  earlyExp: number; earlyNow: number; dayExp: number;
  /** the Election Day margin each result needs, given the early vote read */
  need: { key: string; side: "D" | "R"; label: string; margin: number; day: number }[];
  dayShare: number;
};

/** The forecast's electorate model sorts voters by their 2024 vote. Election Day voters are whoever the forecast expects
 *  minus the early voters; their margin is set so early and Election Day add up to the forecast. */
function edayOf(b: Bench, xo: Crossover | null, s: number, F0: number, behDelta: number, kGap: number, targets: Target[]): Eday | null {
  if (!xo || !b.gExp || !b.gFc) return null;
  const norm = (g: number[]) => { const t = g.reduce((a, x) => a + Math.max(0, x), 0) || 1; return g.map((x) => Math.max(0, x) / t); };
  const gE = norm(b.gExp), gF = norm(b.gFc);
  const gD = norm(gF.map((x, i) => (x - s * gE[i]) / (1 - s)));
  const m = (g: number[]) => (1 - 2 * dOf(g, xo)) * 100;
  const off = F0 - m(gF);   // the race's own candidates and state, beyond what the 2024 vote explains
  const earlyExp = m(gE) + off + behDelta, dayExp = m(gD) + off + behDelta;
  const earlyNow = earlyExp + kGap;
  const day = (M: number) => (M - s * earlyNow) / (1 - s);
  return { gEarly: gE, gDay: gD, earlyExp, earlyNow, dayExp, dayShare: 1 - s,
    need: targets.filter((t) => t.key === "dbig" || t.key === "track" || t.key === "rbig" || t.key === "flip").map((t) => ({ key: t.key, side: t.side, label: t.label, margin: t.margin, day: day(t.margin) })) };
}

export function benchmark(b: Bench, race: BenchRace, beh: Beh, base: Beh, xo: Crossover | null = null): BenchOut {
  const s = Math.max(0.02, Math.min(0.98, b.expEarly / Math.max(1, b.expTotal)));
  const k = kOf(beh);
  const F0 = race.F - race.evShift;
  // a change in how voters behave moves the whole electorate, not just the early vote
  const behDelta = voteM(b.expFull, beh) - voteM(b.expFull, base);
  const lead = leadOf(b.now), expLead = leadOf(b.expNow), gap = lead - expLead;
  const move = s * k * gap;
  const implied = F0 + behDelta + move;
  // the forecast's own spread, carried around the early vote read
  const implLo = implied + (race.p10 - race.F), implHi = implied + (race.p90 - race.F);
  const need = (M: number) => expLead + (M - F0 - behDelta) / (s * k);
  const mk = (key: string, side: "D" | "R", label: string, short: string, M: number): Target => { const L = need(M); return { key, side, label, short, margin: M, lead: L, reach: Math.abs(L) <= 60 }; };
  const favR = race.F + behDelta > 0, dWho = race.ind ? "The independent" : "Democrats";
  const targets: Target[] = [
    mk("dbig", "D", `${dWho} beat the forecast by 5`, "D +5 on forecast", race.F - 5),
    mk("track", favR ? "R" : "D", "Forecast holds", "On track", race.F),
    mk("rbig", "R", "Republicans beat the forecast by 5", "R +5 on forecast", race.F + 5),
    favR ? mk("flip", "D", `${dWho} flip the race`, "Flip", -0.01) : mk("flip", "R", "Republicans flip the race", "Flip", 0.01),
  ];
  if (race.polls) {
    targets.push(mk("plo", "D", `Matches the best ${race.ind ? "independent" : "Democratic"} poll, ${race.polls.loBy}`, "Best D poll", race.polls.lo));
    targets.push(mk("phi", "R", `Matches the best Republican poll, ${race.polls.hiBy}`, "Best R poll", race.polls.hi));
  }
  const T = targets;
  const share = b.ballots / Math.max(1, b.expEarly);
  const a = Math.abs(move);
  const strength: 0 | 1 | 2 | 3 = a < 0.35 ? 0 : a < 1 ? 1 : a < 2.5 ? 2 : 3;
  const side = strength === 0 ? null : move < 0 ? "D" : "R";
  const word = strength === 0 ? "No clear signal" : `${["", "Slight", "Clear", "Strong"][strength]} signal for ${side === "D" ? (race.ind ? "the independent" : "Democrats") : "Republicans"}`;
  const n = b.ballots;
  const sim = [
    { k: "d" as const, label: "Registered Democrats", n: b.now.d * n, dv: beh.dLoyal },
    { k: "o" as const, label: "Independents and other", n: b.now.o * n, dv: beh.iD },
    { k: "r" as const, label: "Registered Republicans", n: b.now.r * n, dv: 1 - beh.rLoyal },
  ];
  return { race, beh, base, s, k, F0, behDelta, lead, expLead, gap, implied, impliedLo: implLo, impliedHi: implHi, share, targets: T,
    signal: { side, strength, word }, sim, simM: voteM(b.now, beh), eday: edayOf(b, xo, s, F0, behDelta, k * gap, T) };
}
