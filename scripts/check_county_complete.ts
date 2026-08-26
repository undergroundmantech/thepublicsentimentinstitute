import { fmtReporting, COUNTY_COMPLETE_PCT, projectCounties, type LiveCounty } from "../app/results/2026-08-25/countyForecast";

let bad = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = got === want;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${got}${ok ? "" : ` (want ${want})`}`);
};

console.log(`threshold = ${COUNTY_COMPLETE_PCT}\n`);
eq("0", fmtReporting(0), "0");
eq("56", fmtReporting(56), "56");
eq("94.9", fmtReporting(94.9), "95");
eq("95 (boundary)", fmtReporting(95), ">99");
eq("97", fmtReporting(97), ">99");
eq("100", fmtReporting(100), ">99");

// A snapped county must project no outstanding vote.
const snap = (c: LiveCounty): LiveCounty =>
  c.reporting >= COUNTY_COMPLETE_PCT ? { ...c, reporting: 100 } : c;

const live: Record<string, LiveCounty> = {
  ADAIR: snap({ votes: { drummond: 800, mazzei: 823 }, total: 1623, reporting: 97 }),
};
const out = projectCounties(live);
const adair = out.byName["ADAIR"];
console.log("");
eq("snapped county reporting", Math.round(adair.reporting), 100);
eq("snapped county turnout == counted", Math.round(adair.projectedTurnout), 1623);

console.log(bad === 0 ? "\nALL PASS" : `\n${bad} FAILED`);
process.exit(bad === 0 ? 0 : 1);
