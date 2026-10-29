// Shared file helpers for the VAI builders. Builders read repository files only; every input is hashed and the hash is
// written into the output, so a committed artefact can be checked against the files it claims to come from.
//
// Input root: --root <dir>, else $VAI_INPUT_ROOT, else the repository root. Output: --out <file>, else the default.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

export const inputRoot = () => path.resolve(arg("root") ?? process.env.VAI_INPUT_ROOT ?? REPO_ROOT);

export const sha256 = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");

/** Read a file under `root`; return its parsed JSON, its repository-relative path and its sha256. */
export function readInput<T>(root: string, rel: string): { path: string; sha256: string; json: T } {
  const buf = readFileSync(path.join(root, rel));
  return { path: rel, sha256: sha256(buf), json: JSON.parse(buf.toString("utf8")) as T };
}

/** JSON with one array element per line for the named arrays, so diffs stay readable and files stay small. */
export function stableJson(obj: unknown, rowArrays: string[] = []): string {
  const top = obj as Record<string, unknown>;
  const lines = Object.entries(top).map(([k, v]) => {
    if (rowArrays.includes(k) && Array.isArray(v)) {
      return `  ${JSON.stringify(k)}: [\n${v.map((x) => `    ${JSON.stringify(x)}`).join(",\n")}\n  ]`;
    }
    return `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
  });
  return `{\n${lines.join(",\n")}\n}\n`;
}

export function writeOutput(file: string, text: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

export const isMain = (metaUrl: string) => process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
