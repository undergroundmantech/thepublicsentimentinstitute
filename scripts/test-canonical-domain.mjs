// Canonical URLs resolve against metadataBase (SITE.url in app/lib/seo.ts). A page that hard-codes another host
// points search engines at an address that may not serve the site, so canonicals must be relative or SITE.url.
// Run: node --test scripts/test-canonical-domain.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.env.REPO || process.cwd();
const site = readFileSync(join(root, "app/lib/seo.ts"), "utf8").match(/url:\s*"(https:\/\/[^"]+)"/)[1];
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|mjs)$/.test(f)) files.push(p); } };
walk(join(root, "app"));

test("SITE.url is the production address", () => {
  assert.equal(site, "https://onpointpolitics.us");
});

test("no canonical hard-codes a host other than SITE.url", () => {
  const bad = [];
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/canonical:\s*[`"'](https?:\/\/[^/`"']+)/g)) if (m[1] !== site) bad.push(`${f.slice(root.length + 1)} ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});

test("nothing links to the retired onpointpolitics.com host", () => {
  const bad = [];
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/(?:https?:\/\/|\+https?:\/\/|\s)(?:www\.)?onpointpolitics\.com\/\S*/g)) bad.push(`${f.slice(root.length + 1)} ${m[0].trim().slice(0, 60)}`);
  }
  assert.deepEqual(bad, []);
});
