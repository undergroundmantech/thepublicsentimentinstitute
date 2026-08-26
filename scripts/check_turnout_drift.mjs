// Validates the dynamic turnout projection: monotone, floored at counted,
// exact at the prior with nothing in, and capped against a bad update.
const clampPct = (n) => Math.min(Math.max(n, 0), 100);
const IMPLIED_CAP = 10;

function projectTurnout(countedVotes, precinctPct, prior) {
  const pct = clampPct(precinctPct) / 100;
  if (pct <= 0) return Math.max(prior, countedVotes);
  const implied = Math.min(countedVotes / pct, prior * IMPLIED_CAP);
  return Math.max((1 - pct) * prior + pct * implied, countedVotes);
}

const PRIOR = 279046;
const TRUE_TURNOUT = 334000; // suppose the night really runs hot

console.log("Prior", PRIOR.toLocaleString(), "| true turnout", TRUE_TURNOUT.toLocaleString());
console.log("\nprec%   counted   projected   est.rep%");
let prev = 0;
for (const p of [0, 1, 5, 10, 25, 30, 50, 75, 90, 99, 100]) {
  const countedVotes = Math.round(TRUE_TURNOUT * (p / 100));
  const t = projectTurnout(countedVotes, p, PRIOR);
  const rep = t > 0 ? (countedVotes / t) * 100 : 0;
  const flag = [];
  if (t < countedVotes - 0.5) flag.push("BELOW COUNTED");
  if (p > 0 && t < prev - 0.5) flag.push("NON-MONOTONE");
  console.log(
    String(p).padStart(5),
    String(countedVotes.toLocaleString()).padStart(9),
    String(Math.round(t).toLocaleString()).padStart(11),
    rep.toFixed(1).padStart(10),
    flag.join(" "),
  );
  prev = t;
}

console.log("\nEdge cases");
console.log("  0 precincts, 0 votes   ->", projectTurnout(0, 0, PRIOR).toLocaleString(), "(want prior, no jump)");
console.log("  0 precincts, 99k votes ->", projectTurnout(99824, 0, PRIOR).toLocaleString(), "(want prior; no completeness signal)");
console.log("  100% in                ->", projectTurnout(TRUE_TURNOUT, 100, PRIOR).toLocaleString(), "(want truth)");
console.log("  bad update 0.1% / 200k ->", Math.round(projectTurnout(200000, 0.1, PRIOR)).toLocaleString(), "(want capped, not 200M)");
console.log("  counted > projection   ->", projectTurnout(400000, 100, PRIOR).toLocaleString(), "(want floor at counted)");

// Live feed, current returns.
const j = await (await fetch("https://civicapi.org/api/v2/race/87534", { cache: "no-store" })).json();
const live = (j.candidates || []).reduce((s, c) => s + (Number(c.votes) || 0), 0);
const prec = clampPct(Number(j.percent_reporting) || 0);
const t = projectTurnout(live, prec, PRIOR);
console.log("\nSC live now: precincts", prec.toFixed(1) + "%,", live.toLocaleString(), "counted");
console.log("  projected turnout", Math.round(t).toLocaleString(), "(was frozen at", PRIOR.toLocaleString() + ")");
console.log("  est. reporting   ", ((live / t) * 100).toFixed(1) + "%");
