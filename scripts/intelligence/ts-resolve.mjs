// Lets Node run the TypeScript intelligence module and its tests directly (Node 22.18+ strips types natively).
// The app's sources import without file extensions and use the "@/" alias, as Next and tsc expect; Node's ESM
// resolver needs exact paths. This hook tries the ".ts" file when the bare path does not resolve. Test and script
// tooling only: the Next build never loads it.
//
//   node --import ./scripts/intelligence/ts-resolve.mjs --test tests/intelligence/*.test.ts

import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    let spec = specifier;
    if (spec.startsWith("@/")) spec = pathToFileURL(path.join(ROOT, spec.slice(2))).href;
    const relative = spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("file:");
    if (relative && !path.extname(spec.startsWith("file:") ? fileURLToPath(spec) : spec)) {
      const base = new URL(spec, context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(spec, context);
  },
});
