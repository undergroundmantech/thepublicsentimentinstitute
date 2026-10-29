// T0 guardrails for Vote Arrival Intelligence. These run first and must pass before any other VAI code is trusted.
//
//  1. VAI never imports the placeholder or public-engine models: voteModeModel, needleModel, electoralModel.
//  2. Precincts reporting is metadata only. It may be named in types.ts and integrity.ts (to carry it through), and
//     nowhere in VAI may it enter arithmetic or a comparison.
//  3. No unseeded randomness and no wall-clock reads in VAI modules or VAI builders.
//  4. Nothing public imports VAI: no page, layout, route or component outside app/results/_vai, and no VAI output
//     under public/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VAI_DIR = path.join(ROOT, "app/results/_vai");
const VAI_SCRIPTS = path.join(ROOT, "scripts/vai");

function walk(dir: string, exts: string[], skip: (p: string) => boolean = () => false): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    if (skip(p)) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p, exts, skip));
    else if (exts.includes(path.extname(name))) out.push(p);
  }
  return out;
}

/** Drop comments so that prose about a rule never trips the rule. Strings are kept. */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1").replace(/^\s*#.*$/gm, "");
}

/** Every module specifier a TS/JS file loads: static import/export-from, dynamic import(), require(). */
export function importSpecifiers(src: string): string[] {
  const s = stripComments(src);
  const out: string[] = [];
  for (const re of [/\bfrom\s*["'`]([^"'`]+)["'`]/g, /\bimport\s*["'`]([^"'`]+)["'`]/g, /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, /\brequire\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g]) {
    for (const m of s.matchAll(re)) out.push(m[1]);
  }
  return out;
}

const FORBIDDEN_MODELS = /(^|\/)(voteModeModel|needleModel|electoralModel)(\.[a-z]+)?$/;
export const forbiddenModelImports = (src: string) => importSpecifiers(src).filter((s) => FORBIDDEN_MODELS.test(s));

const PR_NAME = /\bprecinctsReportingPct\b|\.pr\b|\bpctReporting\b|\bprecinctsPct\b/;
/** Any use of the precinct share that is not a plain pass-through (arithmetic, comparison, ordering, Math.*). */
export function precinctArithmetic(src: string): string[] {
  const s = stripComments(src);
  const bad: string[] = [];
  const name = String.raw`(?:\bprecinctsReportingPct\b|\.pr\b|\bpctReporting\b|\bprecinctsPct\b)`;
  const op = String.raw`(?:[-+*/%<>]|[=!]==?|>=|<=)`;
  const after = new RegExp(`${name}\\s*\\??\\.?\\s*${op}(?!>)`);
  const before = new RegExp(`(?<![=]|\\?\\?)${op}\\s*[\\w.?()\\[\\]]*${name}`);
  const call = new RegExp(`Math\\.\\w+\\([^)]*${name}`);
  for (const line of s.split("\n")) {
    const l = line.replace(/=>/g, "  ").replace(/\?\?/g, "  ");
    if (!PR_NAME.test(l)) continue;
    // A property declaration or an object-literal pass-through ("precinctsReportingPct: x.precinctsReportingPct") is fine.
    const body = l.replace(/\bprecinctsReportingPct\s*:/g, "  ").replace(/:\s*number\s*\|\s*null/g, "  ");
    if (after.test(body) || before.test(body) || call.test(body)) bad.push(line.trim());
  }
  return bad;
}
export const mentionsPrecincts = (src: string) => PR_NAME.test(stripComments(src));

const NONDETERMINISM = /\bMath\.random\s*\(|\bcrypto\.getRandomValues\b|\brandomUUID\s*\(|\brandomBytes\s*\(|\bDate\.now\s*\(|\bnew Date\s*\(\s*\)|\bperformance\.now\s*\(|\bnp\.random\.(?!default_rng\(\s*[^)\s])|\brandom\.(random|uniform|gauss|choice|shuffle|seed\(\s*\))\b/;
export const nondeterminism = (src: string) => stripComments(src).split("\n").filter((l) => NONDETERMINISM.test(l)).map((l) => l.trim());

const VAI_IMPORT = /(^|\/)_vai(\/|$)|(^|\/)app\/results\/_vai|(^|\/)data\/vai\//;
export const vaiImports = (src: string) => importSpecifiers(src).filter((s) => VAI_IMPORT.test(s));

// ---- the checkers catch what they are meant to catch ----------------------------------------------------------------

test("checker: forbidden model imports are found in every import form", () => {
  assert.deepEqual(forbiddenModelImports(`import { MODE_PCT_COUNTED } from "../_lib/voteModeModel";`), ["../_lib/voteModeModel"]);
  assert.deepEqual(forbiddenModelImports(`const m = await import("@/app/results/components/needleModel.ts");`), ["@/app/results/components/needleModel.ts"]);
  assert.deepEqual(forbiddenModelImports(`export * from "@/app/lib/electoralModel"`), ["@/app/lib/electoralModel"]);
  assert.deepEqual(forbiddenModelImports(`// import x from "../_lib/voteModeModel"\nimport type { Sides } from "@/app/lib/intelligence/types";`), []);
});

test("checker: precinct share in arithmetic or comparison is found; pass-through is allowed", () => {
  assert.equal(precinctArithmetic(`const done = o.precinctsReportingPct / 100;`).length, 1);
  assert.equal(precinctArithmetic(`if (o.precinctsReportingPct >= 100) complete = true;`).length, 1);
  assert.equal(precinctArithmetic(`const left = 1 - d.pr;`).length, 1);
  assert.equal(precinctArithmetic(`const w = Math.min(1, r.precinctsReportingPct);`).length, 1);
  assert.equal(precinctArithmetic(`return 100 - x.precinctsReportingPct`).length, 1);
  assert.deepEqual(precinctArithmetic(`  precinctsReportingPct: newest.precinctsReportingPct,`), []);
  assert.deepEqual(precinctArithmetic(`  precinctsReportingPct: number | null;`), []);
  assert.deepEqual(precinctArithmetic(`const p = o.precinctsReportingPct ?? null;`), []);
});

test("checker: unseeded randomness and wall-clock reads are found", () => {
  assert.equal(nondeterminism(`const u = Math.random();`).length, 1);
  assert.equal(nondeterminism(`const t = Date.now();`).length, 1);
  assert.equal(nondeterminism(`const t = new Date();`).length, 1);
  assert.equal(nondeterminism(`x = np.random.normal(0, 1)`).length, 1);
  assert.equal(nondeterminism(`rng = np.random.default_rng()`).length, 1);
  assert.deepEqual(nondeterminism(`rng = np.random.default_rng(20261103)`), []);
  assert.deepEqual(nondeterminism(`rng = np.random.default_rng(seed)`), []);
  assert.deepEqual(nondeterminism(`const t = new Date(asOf);`), []);
  assert.deepEqual(nondeterminism(`// Math.random() is banned`), []);
});

test("checker: imports of VAI code are found", () => {
  assert.deepEqual(vaiImports(`import { x } from "@/app/results/_vai/prior";`), ["@/app/results/_vai/prior"]);
  assert.deepEqual(vaiImports(`import x from "../_vai/types";`), ["../_vai/types"]);
  assert.deepEqual(vaiImports(`import { results } from "../_lib/raceState";`), []);
});

// ---- the repository obeys them ----------------------------------------------------------------------------------------

const vaiFiles = walk(VAI_DIR, [".ts", ".tsx", ".js", ".mjs"]);
const vaiScripts = walk(VAI_SCRIPTS, [".ts", ".mjs", ".js", ".py"], (p) => p.includes("__pycache__"));
const rel = (p: string) => path.relative(ROOT, p);

test("app/results/_vai exists and holds only TypeScript modules (no UI)", () => {
  assert.ok(vaiFiles.length > 0, "app/results/_vai has no modules");
  for (const f of vaiFiles) {
    assert.equal(path.extname(f), ".ts", `${rel(f)}: VAI modules are plain .ts, never components`);
    const specs = importSpecifiers(readFileSync(f, "utf8"));
    for (const s of specs) assert.ok(!/^(react|react-dom|next)(\/|$)/.test(s), `${rel(f)} imports ${s}: VAI renders nothing`);
  }
});

test("no VAI module or builder imports voteModeModel, needleModel or electoralModel", () => {
  for (const f of [...vaiFiles, ...vaiScripts.filter((p) => !p.endsWith(".py"))]) {
    assert.deepEqual(forbiddenModelImports(readFileSync(f, "utf8")), [], rel(f));
  }
  for (const f of vaiScripts.filter((p) => p.endsWith(".py"))) {
    assert.ok(!/voteModeModel|needleModel|electoralModel/.test(stripComments(readFileSync(f, "utf8"))), rel(f));
  }
});

test("precincts reporting is named only in types.ts and integrity.ts, and is never computed with", () => {
  const allowed = new Set(["types.ts", "integrity.ts"]);
  for (const f of [...vaiFiles, ...vaiScripts]) {
    const src = readFileSync(f, "utf8");
    if (path.dirname(f) === VAI_DIR && allowed.has(path.basename(f))) {
      assert.deepEqual(precinctArithmetic(src), [], `${rel(f)} uses the precinct share as a number`);
    } else {
      assert.equal(mentionsPrecincts(src), false, `${rel(f)} mentions the precinct share; only types.ts and integrity.ts may carry it`);
    }
  }
});

test("no unseeded randomness or wall-clock reads in VAI modules or builders", () => {
  for (const f of [...vaiFiles, ...vaiScripts]) assert.deepEqual(nondeterminism(readFileSync(f, "utf8")), [], rel(f));
});

test("nothing outside VAI imports it: no page, layout, route, component or middleware", () => {
  const appFiles = walk(path.join(ROOT, "app"), [".ts", ".tsx", ".js", ".jsx", ".mjs"], (p) => p === VAI_DIR);
  const extra = ["middleware.ts", "next.config.ts", "next.redirects.ts"].map((f) => path.join(ROOT, f)).filter((f) => existsSync(f));
  assert.ok(appFiles.length > 100, "the app tree was not scanned");
  const leaks = [...appFiles, ...extra].flatMap((f) => vaiImports(readFileSync(f, "utf8")).map((s) => `${rel(f)} -> ${s}`));
  assert.deepEqual(leaks, []);
});

test("no VAI artefact is served from public/", () => {
  const pub = walk(path.join(ROOT, "public"), [".json", ".js", ".csv", ".txt", ".html"]);
  assert.ok(pub.length > 0, "public/ was not scanned");
  const hits = pub.filter((f) => /(^|[/_.-])vai([/_.-]|$)/i.test(rel(f)));
  assert.deepEqual(hits.map(rel), []);
});
