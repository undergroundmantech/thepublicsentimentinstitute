// Validate a research package before it goes into data/intelligence/research.
//
//   npm run intelligence:validate -- <package.json>
//   npm run intelligence:validate -- <package.csv> [<package.meta.json>]   (defaults to the .meta.json sidecar)
//   add --allow-synthetic to check a test fixture
//
// Race ids are checked against the pinned October 25 baseline. Exits 1 if any record is rejected.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { importCsvPackage, importJsonPackage } from "../../app/lib/intelligence/research";
import type { BaselineRace } from "../../app/lib/intelligence/types";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const allowSynthetic = process.argv.includes("--allow-synthetic");
const file = args[0];
if (!file) { console.error("usage: validate_research.ts <package.json | package.csv [meta.json]> [--allow-synthetic]"); process.exit(2); }

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const baseline = JSON.parse(readFileSync(path.join(root, "data/intelligence/baseline/2026-10-25.json"), "utf8")) as { races: BaselineRace[] };
const opts = { knownRaceIds: new Set(baseline.races.map((r) => r.raceId)), rejectSynthetic: !allowSynthetic };

let result;
if (file.endsWith(".csv")) {
  const metaPath = args[1] ?? file.replace(/\.csv$/, ".meta.json");
  if (!existsSync(metaPath)) { console.error(`no package metadata at ${metaPath}`); process.exit(2); }
  result = importCsvPackage(readFileSync(file, "utf8"), JSON.parse(readFileSync(metaPath, "utf8")), opts);
} else {
  result = importJsonPackage(readFileSync(file, "utf8"), opts);
}

const where = (i: { row?: number | null; recordId?: string | null; field?: string | null }) => [i.row != null ? `row ${i.row}` : null, i.recordId, i.field].filter(Boolean).join(" ");
console.log(`package ${result.meta?.packageId ?? "(invalid meta)"}${result.meta?.synthetic ? " [SYNTHETIC]" : ""}: ${result.accepted.length} accepted, ${result.rejected.length} rejected`);
for (const i of result.issues) if (i.severity !== "INFO") console.log(`  ${i.severity} ${i.code} ${where(i)}: ${i.message}`);
for (const r of result.rejected) for (const i of r.issues) if (i.severity === "ERROR") console.log(`  REJECTED ${where({ ...i, row: r.row, recordId: r.recordId })}: ${i.code} ${i.message}`);
if (result.unmatchedRaceIds.length) console.log(`  unmatched race ids: ${result.unmatchedRaceIds.join(", ")}`);
process.exitCode = result.rejected.length || result.issues.some((i) => i.severity === "ERROR") ? 1 : 0;
