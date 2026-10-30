// The v2 research candidate: committed, matches the code, labelled, and v1 is untouched.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HYPER_V2_PATH, renderHyperV2 } from "../../scripts/vai/build_hyper_v2";
import { HYPER_PATH, renderHyper } from "../../scripts/vai/build_hyper";
import { REPO_ROOT } from "../../scripts/vai/io";
import { HYPER_V1, HYPER_V2 } from "../../app/results/_vai/hyper";

test("data/vai/hyper_v2_research.json is exactly what the code renders, and hyper_v1.json is unchanged", () => {
  assert.equal(fs.readFileSync(path.join(REPO_ROOT, HYPER_V2_PATH), "utf8"), renderHyperV2());
  assert.equal(fs.readFileSync(path.join(REPO_ROOT, HYPER_PATH), "utf8"), renderHyper());
  assert.equal(HYPER_V1.inventory.progress, undefined, "v1 keeps the Tobit likelihood");
  assert.notEqual(HYPER_V2.hyperId, HYPER_V1.hyperId);
});

test("v2: every numeric hyperparameter has provenance; only the progress family is study-derived; nothing is claimed as fitted", () => {
  const leaves = (o: unknown, p: string): string[] => (typeof o === "number" ? [p] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k)) : []);
  const keys = Object.keys(HYPER_V2.provenance);
  const covered = (leaf: string) => keys.some((k) => leaf === k || leaf.startsWith(`${k}.`));
  assert.deepEqual([...leaves(HYPER_V2.inventory, "inventory"), ...leaves(HYPER_V2.preference, "preference")].filter((p) => !covered(p)), []);
  assert.equal(HYPER_V2.status, "RESEARCH_CANDIDATE");
  const changed = Object.entries(HYPER_V2.provenance).filter(([k, v]) => HYPER_V1.provenance[k]?.status !== v.status).map(([k]) => k);
  assert.deepEqual(changed, ["inventory.progress"]);
  for (const v of Object.values(HYPER_V2.provenance)) assert.ok(!["FITTED", "CALIBRATED"].includes(v.status));
});
