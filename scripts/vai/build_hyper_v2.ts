// Writes data/vai/hyper_v2_research.json: the Phase B2 research candidate. It is never HYPER_V1 and never overwrites hyper_v1.json.
// Checked against HYPER_V2 by tests/vai/hyper_v2.test.ts. Nothing in it is fitted to point-in-time returns.
import path from "node:path";
import { HYPER_V2 } from "../../app/results/_vai/hyper";
import { arg, isMain, REPO_ROOT, sha256, writeOutput } from "./io";

export const HYPER_V2_PATH = "data/vai/hyper_v2_research.json";

export const renderHyperV2 = () => `${JSON.stringify({
  ...HYPER_V2,
  note: "Research candidate. The progress-likelihood family was chosen on SYNTHETIC regimes; every other value is the v1 setting, still INITIAL, UNFITTED or ASSUMED. No hyperparameter is calibrated on point-in-time returns: none exist for the races VAI targets (docs/VAI_V1_BACKTEST_REPORT.md). Not approved for any output.",
  recommendedShiftMode: "MARGINALISED",
  supersedes: null,
  derivedFrom: "vai-hyper-v1-initial",
}, null, 2)}\n`;

if (isMain(import.meta.url)) {
  const out = path.resolve(arg("out") ?? path.join(REPO_ROOT, HYPER_V2_PATH));
  const text = renderHyperV2();
  writeOutput(out, text);
  console.log(`${path.relative(REPO_ROOT, out)}: ${HYPER_V2.hyperId}, sha256 ${sha256(text).slice(0, 12)}, ${Object.keys(HYPER_V2.provenance).length} provenance entries`);
}
