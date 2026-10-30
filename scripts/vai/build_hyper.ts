// Writes data/vai/hyper_v1.json: the Phase B1 hyperparameters, every one INITIAL, UNFITTED or ASSUMED (math §10).
// The committed file is checked against HYPER_V1 by tests/vai/hyper.test.ts, so a value cannot change without this file changing.
import path from "node:path";
import { HYPER_V1 } from "../../app/results/_vai/hyper";
import { arg, isMain, REPO_ROOT, sha256, writeOutput } from "./io";

export const HYPER_PATH = "data/vai/hyper_v1.json";

export const renderHyper = () => `${JSON.stringify({ ...HYPER_V1, note: "Initial, uncalibrated settings. Not estimated from data. Replace with backtest estimates (VAI_V1_BACKTEST_PLAN.md section 4) before any VAI output is published." }, null, 2)}\n`;

if (isMain(import.meta.url)) {
  const out = path.resolve(arg("out") ?? path.join(REPO_ROOT, HYPER_PATH));
  const text = renderHyper();
  writeOutput(out, text);
  console.log(`${path.relative(REPO_ROOT, out)}: ${HYPER_V1.hyperId}, sha256 ${sha256(text).slice(0, 12)}, ${Object.keys(HYPER_V1.provenance).length} parameters`);
}
