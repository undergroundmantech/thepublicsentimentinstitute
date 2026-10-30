// Hyperparameter artefact: committed, matches the code, and says plainly that nothing is fitted.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { HYPER_PATH, renderHyper } from "../../scripts/vai/build_hyper";
import { REPO_ROOT } from "../../scripts/vai/io";
import { HYPER_V1 } from "../../app/results/_vai/hyper";

test("data/vai/hyper_v1.json is exactly what the code renders", () => {
  assert.equal(fs.readFileSync(path.join(REPO_ROOT, HYPER_PATH), "utf8"), renderHyper());
});

test("every numeric hyperparameter has a provenance entry, and none is claimed as fitted", () => {
  const leaves = (o: unknown, p: string): string[] => (typeof o === "number" ? [p] : o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => leaves(v, p ? `${p}.${k}` : k)) : []);
  const keys = Object.keys(HYPER_V1.provenance);
  const covered = (leaf: string) => keys.some((k) => leaf === k || leaf.startsWith(`${k}.`));
  const params = [...leaves(HYPER_V1.inventory, "inventory"), ...leaves(HYPER_V1.preference, "preference")];
  assert.deepEqual(params.filter((p) => !covered(p)), []);
  assert.equal(HYPER_V1.status, "INITIAL_UNFITTED");
  for (const v of Object.values(HYPER_V1.provenance)) assert.ok(["INITIAL_UNFITTED", "SPEC_FIXED", "ASSUMED_UNFITTED"].includes(v.status));
});
