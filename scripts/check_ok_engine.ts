import { projectCounties } from "../app/results/2026-08-25/countyForecast";
import { COUNTY_FORECASTS, type CandidateKey } from "../app/results/_data/okCountyForecast";

type Live = { votes: Record<CandidateKey, number>; total: number; reporting: number };
const f = (n: number) => n.toFixed(2);

// 1. Zero returns must reproduce the baseline exactly.
const z = projectCounties(undefined, 290000);
console.log(
  "zero returns  D", f(z.statewide.shares.drummond), "M", f(z.statewide.shares.mazzei),
  "| lambda", f(z.swing.lambda), "| turnout", Math.round(z.statewide.projectedTurnout),
);

// 2. One wild outlier county must produce lambda = 0 (no extrapolation).
const one: Record<string, Live> = {
  OKLAHOMA: { votes: { drummond: 43100 * 0.9, mazzei: 43100 * 0.1 }, total: 43100, reporting: 100 },
};
const s1 = projectCounties(one, 290000);
console.log(
  "1 outlier     D", f(s1.statewide.shares.drummond), "M", f(s1.statewide.shares.mazzei),
  "| lambda", f(s1.swing.lambda), "| nEff", f(s1.swing.nEff),
  "| raw", f(s1.swing.raw.drummond), "| applied", f(s1.swing.applied.drummond),
);

// 3. Broad uniform +5 to Drummond, everything counted: must recover the truth.
const all: Record<string, Live> = {};
for (const c of COUNTY_FORECASTS) {
  const d = Math.min(100, Math.max(0, c.shares.drummond + 5));
  const t = Math.round(c.projectedTurnout);
  all[c.name.toUpperCase()] = {
    votes: { drummond: (t * d) / 100, mazzei: (t * (100 - d)) / 100 },
    total: t,
    reporting: 100,
  };
}
const s3 = projectCounties(all, 290000);
console.log(
  "all in +5D    D", f(s3.statewide.shares.drummond), "M", f(s3.statewide.shares.mazzei),
  "| lambda", f(s3.swing.lambda), "| voteIn", f(s3.swing.voteIn),
);

// 4. Ten biggest counties fully in with +5: swing should extrapolate, partly.
const part: Record<string, Live> = {};
for (const c of COUNTY_FORECASTS.slice(0, 10)) {
  const d = Math.min(100, c.shares.drummond + 5);
  const t = Math.round(c.projectedTurnout);
  part[c.name.toUpperCase()] = {
    votes: { drummond: (t * d) / 100, mazzei: (t * (100 - d)) / 100 },
    total: t,
    reporting: 100,
  };
}
const s4 = projectCounties(part, 290000);
console.log(
  "10 counties   D", f(s4.statewide.shares.drummond), "M", f(s4.statewide.shares.mazzei),
  "| lambda", f(s4.swing.lambda), "| raw", f(s4.swing.raw.drummond),
  "| applied", f(s4.swing.applied.drummond), "| voteIn", f(s4.swing.voteIn),
);

// 5. Counties under the reporting floor must be ignored by the estimator.
const trickle: Record<string, Live> = {};
for (const c of COUNTY_FORECASTS.slice(0, 20)) {
  const t = Math.round(c.projectedTurnout * 0.1);
  trickle[c.name.toUpperCase()] = {
    votes: { drummond: t, mazzei: 0 },
    total: t,
    reporting: 10,
  };
}
const s5 = projectCounties(trickle, 290000);
console.log(
  "10% trickle   D", f(s5.statewide.shares.drummond), "M", f(s5.statewide.shares.mazzei),
  "| lambda", f(s5.swing.lambda), "| countiesReporting", s5.swing.countiesReporting,
);

console.log(
  "tooClose      zero:", z.list.filter((p) => p.tooCloseToCall).length,
  " allIn:", s3.list.filter((p) => p.tooCloseToCall).length,
  " | reconcile allIn total:", Math.round(s3.statewide.projectedTurnout),
);
