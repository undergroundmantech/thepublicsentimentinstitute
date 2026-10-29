// T4 builder: data/vai/prior_<priorId>.json, the frozen forecast prior, addressed by the hash of its inputs.
//   npm run vai:prior            (writes data/vai/prior_<priorId>.json)
//   ... -- --root <dir> --out <file>
import { readdirSync } from "node:fs";
import path from "node:path";
import { buildPrior, PRIOR_BUILDER_VERSION, type CountyRows, type ForecastRace, type IndexEntry } from "../../app/results/_vai/prior";
import type { PriorFile, RaceRulesFile } from "../../app/results/_vai/types";
import { RULES_OUT } from "./build_race_rules";
import { REPO_ROOT, arg, inputRoot, isMain, readInput, sha256, stableJson, writeOutput } from "./io";

export const PRIOR_INPUTS = {
  model: "public/forecast/model.json",
  index: "public/results/2026/index.json",
  countyDir: "public/results/2026/st",
};
export const PRIOR_DIR = "data/vai";

export const priorIdOf = (inputs: { path: string; sha256: string }[]) => sha256(JSON.stringify({ builder: PRIOR_BUILDER_VERSION, inputs })).slice(0, 12);
export const priorPath = (priorId: string) => `${PRIOR_DIR}/prior_${priorId}.json`;

export function collectPrior(root: string): PriorFile {
  const model = readInput<{ meta?: { updated?: string }; races: ForecastRace[] }>(root, PRIOR_INPUTS.model);
  const index = readInput<{ asOf?: string; races: IndexEntry[] }>(root, PRIOR_INPUTS.index);
  // The rule registry is a VAI artefact, so it always comes from this repository.
  const rules = readInput<RaceRulesFile>(REPO_ROOT, RULES_OUT);
  const stFiles = readdirSync(path.join(root, PRIOR_INPUTS.countyDir)).filter((f) => /^[A-Z]{2}\.json$/.test(f)).sort();
  const st = new Map(stFiles.map((f) => {
    const r = readInput<{ counties?: Record<string, CountyRows> }>(root, `${PRIOR_INPUTS.countyDir}/${f}`);
    return [f.slice(0, 2), r] as const;
  }));
  const inputs = [model, index, rules, ...st.values()].map(({ path: p, sha256: h }) => ({ path: p, sha256: h }));
  return buildPrior({
    forecast: { updated: model.json.meta?.updated ?? null, races: model.json.races, file: PRIOR_INPUTS.model },
    index: { asOf: index.json.asOf ?? null, races: index.json.races },
    rules: rules.json,
    counties: (s) => {
      const r = st.get(s);
      return r?.json.counties ? { file: r.path, rows: r.json.counties } : null;
    },
    inputs,
    priorId: priorIdOf(inputs),
  });
}

export const renderPrior = (f: PriorFile) => stableJson(f, ["inputs", "countyAudit", "races"]);

if (isMain(import.meta.url)) {
  const f = collectPrior(inputRoot());
  const out = path.resolve(arg("out") ?? path.join(REPO_ROOT, priorPath(f.priorId)));
  const text = renderPrior(f);
  writeOutput(out, text);
  console.log(`${path.relative(REPO_ROOT, out)}: ${f.races.length} races, ${(text.length / 1024).toFixed(0)} KB (forecast ${f.forecastUpdated}, index ${f.indexAsOf})`);
  console.log("by status ", JSON.stringify(f.counts.byStatus));
  console.log("by live   ", JSON.stringify(f.counts.byLiveUse));
  console.log("by flag   ", JSON.stringify(f.counts.byFlag));
  for (const r of f.races.filter((x) => x.status === "ANCHOR_FAILED")) console.log("FAILED", r.raceId, r.reason);
  for (const a of f.countyAudit) console.log(a.discrepant ? "DISCREPANT" : "watch     ", a.raceId, a.measure, a.countyValue, "vs", a.publishedValue, "gap", a.gap);
}
