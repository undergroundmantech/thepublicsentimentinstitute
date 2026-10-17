// 2026 statewide ballot measures, built by scripts/forecast/measures/build_measures.py into public/forecast/measures.json.
import fs from "node:fs";
import path from "node:path";

export type BMPoll = { pollster: string; sponsor?: string | null; side?: string | null; start?: string | null; end?: string | null; n?: number | null; pop?: string | null; yes: number | null; no: number | null; und?: number | null; url?: string | null; adj?: number | null };
export type Measure = {
  id: string; st: string; slug: string; label: string; title: string; summary: string; type: string; category: string; group: string; lean: "D" | "R" | "none";
  campaign?: string | null; threshold: number; thresholdNote: string; ruleNote?: string | null;
  est: { yes: number; p10: number; p90: number; prob: number }; prior: number; pollAvg: number | null; pollWeight: number;
  polls: BMPoll[]; sources: string[]; counties: Record<string, number>;
};
export type MeasuresData = { meta: { updated: string; measures: number; states: number; sims: number; method: string }; measures: Measure[] };

let cache: MeasuresData | null = null;
export const getMeasures = (): MeasuresData =>
  (cache ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "measures.json"), "utf8")) as MeasuresData);
export const bmHref = (m: Pick<Measure, "st" | "slug">) => `/forecast/measures/${m.st.toLowerCase()}/${m.slug}`;

export const YES = "#2fbf9b", NO = "#e8794a";
export const GROUP_LABEL: Record<string, string> = {
  abortion: "Abortion", marijuana: "Marijuana", drugs_other: "Drugs", minimum_wage: "Minimum wage", labor: "Labor", health_care: "Health care",
  voter_id: "Voter ID", citizen_voting: "Citizen only voting", ranked_choice: "Ranked choice and primaries", supermajority: "Higher bars to pass",
  elections_voting: "Elections", redistricting: "Redistricting", guns: "Guns", criminal_justice: "Criminal justice", immigration: "Immigration",
  lgbtq_rights: "Transgender policy and marriage", civil_rights: "Civil rights", education: "Education", taxes_income: "Income tax", taxes_property: "Property tax",
  taxes_sales_other: "Other taxes", bonds_spending: "Bonds and budgets", housing: "Housing", environment_energy: "Environment and energy", gambling: "Gambling",
  government_ethics: "Government and ethics", animal: "Animals and hunting", other: "Other",
};
/** Yes share fill for a county: pale near 50, deep teal for Yes, deep orange for No. */
export function yesFill(y: number) {
  const a = Math.min(30, Math.abs(y - 50)) / 30;
  const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`;
  return y >= 50 ? mix([214, 242, 234], [14, 110, 88], a) : mix([252, 226, 214], [150, 58, 20], a);
}
export const YES_RAMP = "linear-gradient(90deg,#963a14 0%,#e8794a 30%,#fce2d6 49%,#d6f2ea 51%,#2fbf9b 70%,#0e6e58 100%)";
export function verdict(p: number) {
  if (p >= 0.95) return { label: "Very likely to pass", cls: "cy" };
  if (p >= 0.75) return { label: "Likely to pass", cls: "cy" };
  if (p >= 0.6) return { label: "Leans pass", cls: "cy" };
  if (p > 0.4) return { label: "Toss up", cls: "ct" };
  if (p > 0.25) return { label: "Leans fail", cls: "cn" };
  if (p > 0.05) return { label: "Likely to fail", cls: "cn" };
  return { label: "Very likely to fail", cls: "cn" };
}
