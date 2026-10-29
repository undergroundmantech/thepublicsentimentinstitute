// T2 builder: data/vai/race_rules_2026.json from the published results index and the forecast's measure research.
//   npm run vai:rules            (writes data/vai/race_rules_2026.json)
//   ... -- --root <dir> --out <file>
import path from "node:path";
import { buildRaceRules, type IndexRace, type MeasureRuleSource, type RuleContext } from "../../app/results/_vai/rules";
import type { RaceRulesFile } from "../../app/results/_vai/types";
import { REPO_ROOT, arg, inputRoot, isMain, readInput, stableJson, writeOutput } from "./io";

export const RULES_INPUTS = {
  index: "public/results/2026/index.json",
  measures: "public/forecast/measures.json",
  model: "public/forecast/model.json",
};
export const RULES_OUT = "data/vai/race_rules_2026.json";
export const RULES_BUILDER = "scripts/vai/build_race_rules.ts";

export function collectRaceRules(root: string): RaceRulesFile {
  const index = readInput<{ asOf?: string; races: IndexRace[] }>(root, RULES_INPUTS.index);
  const measures = readInput<{ measures: MeasureRuleSource[] }>(root, RULES_INPUTS.measures);
  const model = readInput<{ races: { id: string; rcv?: unknown }[] }>(root, RULES_INPUTS.model);
  const ctx: RuleContext = {
    measures: new Map(measures.json.measures.map((m) => [m.id, { id: m.id, st: m.st, threshold: m.threshold, thresholdNote: m.thresholdNote ?? null, ruleNote: m.ruleNote ?? null, sources: m.sources ?? [] }])),
    forecastRcv: new Set(model.json.races.filter((r) => r.rcv).map((r) => r.id)),
    files: RULES_INPUTS,
  };
  return buildRaceRules(index.json.races, ctx, {
    builder: RULES_BUILDER,
    indexAsOf: index.json.asOf ?? null,
    inputs: [index, measures, model].map(({ path: p, sha256 }) => ({ path: p, sha256 })),
  });
}

export const renderRaceRules = (f: RaceRulesFile) => stableJson(f, ["races"]);

if (isMain(import.meta.url)) {
  const f = collectRaceRules(inputRoot());
  const out = path.resolve(arg("out") ?? path.join(REPO_ROOT, RULES_OUT));
  writeOutput(out, renderRaceRules(f));
  console.log(`${path.relative(REPO_ROOT, out)}: ${f.races.length} races (index asOf ${f.indexAsOf})`);
  console.log("by rule   ", JSON.stringify(f.counts.byRule));
  console.log("by support", JSON.stringify(f.counts.bySupport));
  console.log("by flag   ", JSON.stringify(f.counts.byFlag));
}
