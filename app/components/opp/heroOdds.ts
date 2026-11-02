import { probFraction } from "@/app/lib/fmtPct";
// The race hero's odds, shared by the Theme stage and the Pro hero so both modes print the same numbers.
// Every outcome carries an explicit key and its source probability; nothing is inferred from colors or names,
// and no probability is derived as 100 minus another unless the page passes both sides of a verified distribution.

export type Outcome = {
  /** matches StageCand.key for the candidate or party that wins this outcome; "tie" for a tied chamber */
  key: string;
  name: string;
  color: string;
  /** the model's probability, 0 to 1, exactly as published */
  p: number;
  tie?: boolean;
};

/** True when the outcomes are a complete distribution: two or more, each a probability, summing to 1. */
export function isDistribution(o: readonly Outcome[] | null | undefined, tol = 0.002): o is Outcome[] {
  if (!o || o.length < 2) return false;
  if (!o.every((x) => Number.isFinite(x.p) && x.p >= 0 && x.p <= 1)) return false;
  return Math.abs(o.reduce((s, x) => s + x.p, 0) - 1) <= tol;
}

/** A probability as a whole percent, never rounding a live chance to 0 or a non-certainty to 100. */
export function fmtChance(p: number): string {
  return probFraction(p);
}

/** Whole squares out of `total` for each outcome, largest remainder, so the squares always add up to `total`. */
export function squares(o: readonly Outcome[], total = 100): number[] {
  const raw = o.map((x) => x.p * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((s, n) => s + n, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k][1]]++;
  return out;
}

/** The favourite among the non-tie outcomes, and the strongest rival. */
export function leaders(o: readonly Outcome[]): { lead: Outcome; rival: Outcome | null; tie: Outcome | null } {
  const sides = o.filter((x) => !x.tie).sort((a, b) => b.p - a.p);
  return { lead: sides[0], rival: sides[1] ?? null, tie: o.find((x) => x.tie) ?? null };
}

export function verdictFor(lead: Outcome): string {
  const p = lead.p;
  return `${lead.name} ${p >= 0.95 ? "all but certain" : p >= 0.85 ? "very likely" : p >= 0.65 ? "favored" : "slightly favored"}`;
}

/** Party code to the hero's label and color. Unknown codes keep the code rather than guessing a party. */
export const PARTY_LABEL: Record<string, string> = {
  D: "Democrat", R: "Republican", IND: "Independent", I: "Independent", L: "Libertarian", G: "Green", O: "Other",
};
export const partyLabel = (p: string) => PARTY_LABEL[p] ?? p;
export const HERO_DEM = "#5b8fff", HERO_GOP = "#ff4d6a", HERO_IND = "#b78cff", HERO_TIE = "#8e86a3";
export const partyColor = (p: string) => (p === "D" ? HERO_DEM : p === "R" ? HERO_GOP : HERO_IND);

/** A candidate, party or side as the hero shows it. `pct` is a share of the vote unless `share` says seats. */
export type HeroCand = {
  key?: string; name: string; label: string; color: string;
  /** projected share in percent; `share` says whether it is a share of the vote or of the seats */
  pct: number | null; share?: "vote" | "seat";
  /** projected votes, null or 0 when the forecast has no vote total */
  votes?: number | null;
  /** expected seats, for chamber forecasts */
  seats?: number | null; seatsOf?: number;
};
export type HeroModel = { contested: boolean; cands: HeroCand[]; others: HeroCand[]; odds: Outcome[] | null };

const surname = (n: string) => n.trim().split(/\s+/).pop() || n;
const isProb = (p: unknown): p is number => typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1;

type BallotCand = { name: string; party: string; pct: number; votes?: number | null };

/**
 * Senate, House and governor races (model.json). The model simulates the Democratic slot (r.dem, sometimes an
 * independent) against the Republican slot (r.gop, sometimes an independent) and publishes est.prob, the Republican
 * slot's chance; the Democratic slot's chance is its complement in that same simulation. Candidates are matched to the
 * slots by exact name, never by party or color, and anyone else on the ballot has a share but no modeled chance.
 * `rate` is the model margin; |rate| >= 99 marks a seat with no contest, which gets no probability at all.
 */
export function raceHero(r: { dem: string; gop: string; est: { prob: number }; cands?: BallotCand[] | null }, rate: number, ind = false): HeroModel {
  const all = r.cands ?? [];
  const contested = Math.abs(rate) < 99 && isProb(r.est.prob);
  const demC = all.find((c) => c.name === r.dem), gopC = all.find((c) => c.name === r.gop);
  const card = (c: BallotCand, key?: string): HeroCand => ({ key, name: c.name, label: partyLabel(c.party), pct: c.pct, share: "vote", votes: c.votes ?? 0, color: partyColor(c.party) });
  return {
    contested,
    cands: [demC && card(demC, "dem"), gopC && card(gopC, "gop")].filter((c): c is HeroCand => !!c),
    others: all.filter((c) => c !== demC && c !== gopC && c.pct >= 3).map((c) => card(c)),
    odds: contested ? [
      { key: "dem", name: surname(r.dem), color: demC ? partyColor(demC.party) : ind ? HERO_IND : HERO_DEM, p: 1 - r.est.prob },
      { key: "gop", name: surname(r.gop), color: gopC ? partyColor(gopC.party) : HERO_GOP, p: r.est.prob },
    ] : null,
  };
}

/**
 * Statewide down-ballot offices (downballot.json): the Democratic nominee against the Republican nominee, est.prob the
 * Republican's chance. Without both nominees there is no simulated contest and no probability. Other candidates share
 * one pooled projected vote, so they are listed together with that pooled share, or by name alone when there is none.
 */
export function statewideHero(r: { dem?: string | null; gop?: string | null; est: { prob: number }; others?: { name: string; party: string }[] | null },
  v: { dem: number; rep: number; other: number; total: number } | null | undefined, margin: number): HeroModel {
  const contested = !!r.dem && !!r.gop && Math.abs(margin) < 99 && isProb(r.est.prob);
  const votes = v && v.total > 0 ? v : null;
  const others = r.others ?? [];
  return {
    contested,
    cands: [
      ...(r.dem ? [{ key: "dem", name: r.dem, label: "Democrat", pct: votes ? (100 * votes.dem) / votes.total : null, share: "vote" as const, votes: votes?.dem ?? null, color: HERO_DEM }] : []),
      ...(r.gop ? [{ key: "gop", name: r.gop, label: "Republican", pct: votes ? (100 * votes.rep) / votes.total : null, share: "vote" as const, votes: votes?.rep ?? null, color: HERO_GOP }] : []),
    ],
    others: !others.length ? []
      : votes ? [{ name: others.map((o) => o.name).join(", "), label: others.map((o) => partyLabel(o.party)).join(", ") || "Others", pct: (100 * votes.other) / votes.total, votes: votes.other, color: HERO_IND }]
      : others.map((o) => ({ name: o.name, label: partyLabel(o.party), pct: null, color: HERO_IND })),
    odds: contested ? [
      { key: "dem", name: surname(r.dem!), color: HERO_DEM, p: 1 - r.est.prob },
      { key: "gop", name: surname(r.gop!), color: HERO_GOP, p: r.est.prob },
    ] : null,
  };
}

/**
 * State legislative chambers (statehouse.json). Control is D, R or, in an even chamber, a tie, each with its own
 * published chance; nothing is a complement. Republican seats are seats minus the Democratic median only when no third
 * party can hold a seat. The share is of the vote when the forecast has vote totals and is labelled a share of the
 * seats when it does not, and projected votes appear only when they exist.
 */
export function chamberHero(c: { demControl: number; gopControl: number; tie?: number | null; seats: number; median: number; demSeats: number; gopSeats: number;
  votes?: { dem: number; rep: number; total: number } | null }, dem = HERO_DEM, gop = HERO_GOP): HeroModel {
  const vt = c.votes && c.votes.total > 0 ? c.votes : null;
  const tie = c.tie ?? 0;
  const twoParty = Math.abs(c.demSeats + c.gopSeats - c.seats) < 0.05;
  const side = (key: "D" | "R", name: string, label: string, v: number, seats: number, color: string): HeroCand => ({
    key, name, label, pct: vt ? (100 * v) / vt.total : (100 * seats) / c.seats, share: vt ? "vote" : "seat", votes: vt ? v : null, seats, seatsOf: c.seats, color,
  });
  return {
    contested: true,
    cands: [
      side("D", "Democrats", `Median ${c.median} seats`, vt?.dem ?? 0, c.demSeats, dem),
      side("R", "Republicans", twoParty ? `Median ${c.seats - c.median} seats` : `About ${Math.round(c.gopSeats)} seats expected`, vt?.rep ?? 0, c.gopSeats, gop),
    ],
    others: [],
    odds: [
      { key: "D", name: "Democrats", color: dem, p: c.demControl },
      ...(tie > 0 ? [{ key: "tie", name: "Tied chamber", color: HERO_TIE, p: tie, tie: true }] : []),
      { key: "R", name: "Republicans", color: gop, p: c.gopControl },
    ],
  };
}

/** Ballot measures: Yes and No, est.prob the chance Yes prevails. */
export function measureOdds(prob: number, yes: string, no: string): Outcome[] | null {
  return isProb(prob) ? [{ key: "yes", name: "Yes", color: yes, p: prob }, { key: "no", name: "No", color: no, p: 1 - prob }] : null;
}
