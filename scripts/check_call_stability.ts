/**
 * Diagnostic: what the board treats as outstanding, and whether the call and
 * the win-probability ring agree. Replicates the board's county-derived basis.
 */
import { forecastRace, type Shares3 } from "../app/lib/electoralModel";
import { evaluateCall } from "../app/lib/raceCall";
import { COUNTY_COMPLETE_PCT } from "../app/results/2026-08-25/countyForecast";
import { STATEWIDE_FORECAST, TURNOUT_MODEL } from "../app/results/_data/okCountyForecast";

const OK_GOV_R = 87529;
const IMPLIED_CAP = 10;
const STILL_COUNTING: Record<string, number> = { TULSA: 81, OKLAHOMA: 81 };

const POLL_PRIOR: Shares3 = {
  Candidate1: STATEWIDE_FORECAST.drummond / 100,
  Candidate2: STATEWIDE_FORECAST.mazzei / 100,
  Candidate3: 0,
};

/** Standard normal CDF, Abramowitz & Stegun 26.2.17 — same as the board's. */
function phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-(z * z) / 2);
  const p =
    d * t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

const main = async () => {
  const r = await fetch(`https://civicapi.org/api/v2/race/${OK_GOV_R}`, {
    cache: "no-store",
  }).then((x) => x.json());

  const votesIn = (cands: { name?: string; votes?: number }[], needle: string) =>
    cands
      .filter((c) => String(c.name || "").toLowerCase().includes(needle))
      .reduce((s, c) => s + (c.votes || 0), 0);

  const dru = votesIn(r.candidates || [], "drummond");
  const maz = votesIn(r.candidates || [], "mazzei");
  const total = dru + maz;

  // County basis, exactly as the board builds it.
  const rr = r.region_results || {};
  let countedVotes = 0;
  let remaining = 0;
  const open: string[] = [];
  for (const key of Object.keys(rr)) {
    const c = rr[key];
    const name = String(c?.name || key).replace(/\s+county$/i, "").trim().toUpperCase();
    const cTotal = (c?.candidates || []).reduce(
      (s: number, x: { votes?: number }) => s + (Number(x.votes) || 0),
      0,
    );
    if (cTotal <= 0) continue;
    countedVotes += cTotal;
    const feed = Number(c?.percent_reporting) || 0;
    let rep = Math.max(feed, STILL_COUNTING[name] ?? 100);
    if (rep >= COUNTY_COMPLETE_PCT) rep = 100;
    if (rep >= COUNTY_COMPLETE_PCT) continue;
    const implied = Math.min(cTotal / (rep / 100), cTotal * IMPLIED_CAP);
    remaining += Math.max(0, implied - cTotal);
    open.push(
      `${name} feed ${feed}% \u2192 ${rep}%, ~${Math.round(implied - cTotal).toLocaleString()} out`,
    );
  }
  const basisTotal = countedVotes + remaining;

  const fc = forecastRace({
    race_rule: "PLURALITY",
    percent_reporting: basisTotal > 0 ? total / basisTotal : 0,
    reported_vote_total: total,
    expected_turnout: basisTotal > 0 ? basisTotal : TURNOUT_MODEL.projected,
    reported_share: {
      Candidate1: total ? dru / total : 0,
      Candidate2: total ? maz / total : 0,
      Candidate3: 0,
    },
    expected_share: POLL_PRIOR,
    poll_avg_shares: POLL_PRIOR,
  });
  const call = evaluateCall(fc, { Candidate1: "Drummond", Candidate2: "Mazzei" });

  const marginPP = (Math.abs(maz - dru) / total) * 100;
  const marginSdPP = Math.max(
    Math.min(
      STATEWIDE_FORECAST.marginSd * Math.sqrt(Math.max(0, 1 - fc.modeled_percent_reporting)),
      fc.modeled_total_vote > 0
        ? ((fc.sd_race * Math.SQRT2) / fc.modeled_total_vote) * 100
        : Infinity,
    ),
    0.1,
  );
  const noPath = call.marginVotes > fc.modeled_vote_remaining;

  console.log(`Feed precincts   ${r.percent_reporting}%   counted ${total.toLocaleString()}`);
  console.log(
    `Drummond ${dru.toLocaleString()}   Mazzei ${maz.toLocaleString()}   lead ${Math.abs(maz - dru).toLocaleString()}\n`,
  );
  console.log(`Counties still counting: ${open.length ? open.join("; ") : "none"}`);
  console.log(
    `Outstanding vote  ${Math.round(remaining).toLocaleString()}   basis total ${Math.round(basisTotal).toLocaleString()}`,
  );
  console.log(`Est. reporting    ${(fc.modeled_percent_reporting * 100).toFixed(1)}%\n`);
  console.log(
    `sd_race ${Math.round(fc.sd_race).toLocaleString()}   z ${call.z.toFixed(2)}   verdict ${call.verdict}`,
  );
  console.log(
    `Projected margin  ${Math.round(call.marginVotes).toLocaleString()} votes vs ${Math.round(fc.modeled_vote_remaining).toLocaleString()} outstanding`,
  );
  console.log(`No-path gate      ${noPath ? "SATISFIED" : "blocks the call"}`);
  console.log(
    `Win probability   ${(phi(marginPP / marginSdPP) * 100).toFixed(1)}%   (margin SD \u00b1${marginSdPP.toFixed(2)} pts)`,
  );
  console.log(`\nBoard shows: ${call.verdict === "CALLABLE" && noPath ? "CALL" : "no call"}`);
};

main();
