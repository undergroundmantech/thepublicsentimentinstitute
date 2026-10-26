// Builds the Phase 1 race register from the October 25, 2026 forecast, pinned to a git commit so a later forecast
// revision can never slip in.
//
//   npm run intelligence:register                     (defaults: ref 44d06d08, top 50, Senate + governor + House)
//   node --import ./scripts/intelligence/ts-resolve.mjs scripts/intelligence/build_register.ts --ref <sha> --n 50
//
// Writes
//   data/intelligence/baseline/2026-10-25.json        every Senate, governor and House race in the snapshot
//   data/intelligence/register/top50-2026-10-25.json  the N closest by absolute forecast margin
// and refuses to write anything if model.json at the ref is not the 2026-10-25 forecast or disagrees with the
// archived statewide snapshot.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BASELINE_SNAPSHOT_DATE, baselineFromModel, buildRegister, crossCheckArchive, parseLenientJson } from "../../app/lib/intelligence/baseline";
import type { BaselineSource, Office } from "../../app/lib/intelligence/types";

const DEFAULT_REF = "44d06d08e0268bd0fb6d4fb17bb96571933eb8b8";
const MODEL = "public/forecast/model.json";
const ARCHIVE = `public/forecast/archive/${BASELINE_SNAPSHOT_DATE}.json`;

const arg = (name: string, dflt: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt; };
const ref = arg("ref", DEFAULT_REF);
const n = Number(arg("n", "50"));
const offices = arg("offices", "senate,governor,house").split(",") as Office[];
if (!/^[0-9a-f]{7,40}$/i.test(ref)) throw new Error(`--ref must be a commit sha, got ${ref}`);
if (!Number.isInteger(n) || n < 1) throw new Error("--n must be a positive integer");

const show = (file: string) => execFileSync("git", ["show", `${ref}:${file}`], { encoding: "utf8", maxBuffer: 1 << 29 });
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const modelText = show(MODEL), archiveText = show(ARCHIVE);
const { races, updated, problems } = baselineFromModel(parseLenientJson(modelText));
if (updated !== BASELINE_SNAPSHOT_DATE) throw new Error(`${MODEL} at ${ref} is the ${updated} forecast, not ${BASELINE_SNAPSHOT_DATE}`);
const check = crossCheckArchive(races, parseLenientJson(archiveText));
if (check.mismatches.length) throw new Error(`model.json and the archived snapshot disagree:\n${check.mismatches.join("\n")}`);

const source: BaselineSource = {
  snapshotDate: BASELINE_SNAPSHOT_DATE,
  files: [
    { path: MODEL, gitRef: ref, sha256: sha256(modelText) },
    { path: ARCHIVE, gitRef: ref, sha256: sha256(archiveText) },
  ],
  notes: [
    `model.json meta.updated = ${updated}; Senate, governor and House margins read from races[].est`,
    `statewide margins and chances cross-checked against the archive: ${check.checked} races, 0 mismatches${check.missing.length ? `, missing from archive: ${check.missing.join(", ")}` : ""}`,
    "the archive holds no House races; House margins come from model.json at the pinned ref",
    "margin is Republican minus Democratic (or minus the main non-Republican candidate), in points; probB is the Republican chance",
    ...problems,
  ],
};

const generatedAt = new Date().toISOString();
const register = buildRegister(races, { n, offices, generatedAt, source });
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const outBase = path.join(root, "data/intelligence/baseline");
const outReg = path.join(root, "data/intelligence/register");
mkdirSync(outBase, { recursive: true }); mkdirSync(outReg, { recursive: true });
writeFileSync(path.join(outBase, `${BASELINE_SNAPSHOT_DATE}.json`), JSON.stringify({ generatedAt, source, races }, null, 1) + "\n");
writeFileSync(path.join(outReg, `top${n}-${BASELINE_SNAPSHOT_DATE}.json`), JSON.stringify(register, null, 1) + "\n");

const by = (o: Office) => register.entries.filter((e) => e.office === o).length;
console.log(`baseline: ${races.length} races (${problems.length} skipped); archive cross-check ${check.checked} ok`);
console.log(`register: top ${register.entries.length} (senate ${by("senate")}, governor ${by("governor")}, house ${by("house")}); widest margin ${Math.abs(register.entries[register.entries.length - 1].baseline.margin)}`);
