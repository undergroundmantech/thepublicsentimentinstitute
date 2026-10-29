// Server-side loading of research packages from data/intelligence/research. Synthetic packages are refused here:
// they belong to tests. A package that fails validation contributes nothing but its issues.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { importCsvPackage, importJsonPackage, mergePackages } from "./research";
import type { Issue, ResearchRecord, ResearchValidationResult } from "./types";

export const RESEARCH_DIR = path.join(process.cwd(), "data", "intelligence", "research");

export function loadResearchDir(dir: string, knownRaceIds: ReadonlySet<string>, now?: Date): { files: { file: string; result: ResearchValidationResult }[]; records: ResearchRecord[]; issues: Issue[] } {
  if (!existsSync(dir)) return { files: [], records: [], issues: [] };
  const files: { file: string; result: ResearchValidationResult }[] = [];
  const opts = { knownRaceIds, now, rejectSynthetic: true };
  for (const f of readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (f.endsWith(".meta.json") || f.startsWith("_") || f.startsWith(".")) continue;
    if (f.endsWith(".json")) files.push({ file: f, result: importJsonPackage(readFileSync(p, "utf8"), opts) });
    else if (f.endsWith(".csv")) {
      const metaPath = p.replace(/\.csv$/, ".meta.json");
      if (!existsSync(metaPath)) {
        files.push({ file: f, result: { meta: null, accepted: [], rejected: [], issues: [{ code: "MISSING_META", severity: "ERROR", message: `${f} has no ${path.basename(metaPath)} sidecar` }], unmatchedRaceIds: [] } });
        continue;
      }
      let meta: unknown = null;
      try { meta = JSON.parse(readFileSync(metaPath, "utf8")); } catch { /* reported by validateMeta as missing fields */ }
      files.push({ file: f, result: importCsvPackage(readFileSync(p, "utf8"), meta, opts) });
    }
  }
  const merged = mergePackages(files.map((x) => x.result));
  return { files, records: merged.records, issues: merged.issues };
}
