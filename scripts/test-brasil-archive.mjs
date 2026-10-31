// Brazil 2026 is an archive: saved count with hashes, no polling, out of the live nav, forecast untouched.
// Run: node --test scripts/test-brasil-archive.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const DIR = "data/brasil-archive/2026-runoff";
const manifest = JSON.parse(read(`${DIR}/manifest.json`));
const results = JSON.parse(read("public/brasil/archive/results.json"));

test("every saved civicAPI record matches its manifest hash and is not test data", () => {
  assert.equal(manifest.records.length, 28);
  for (const r of manifest.records) {
    const raw = gunzipSync(readFileSync(join(ROOT, DIR, r.file)));
    assert.equal(createHash("sha256").update(raw).digest("hex"), r.sha256, r.file);
    assert.equal(raw.length, r.bytes, r.file);
    assert.equal(r.test_data, false, r.file);
    assert.equal(JSON.parse(raw.toString("utf8")).test_data, false, r.file);
  }
});

test("the archived payload is labelled unofficial and dated, and its totals match the results FAQ", () => {
  const a = results.archive;
  assert.equal(a.official, false);
  assert.equal(a.source, "civicAPI");
  assert.equal(a.capturedAt, manifest.capturedAt);
  assert.equal(a.providerUpdated, manifest.records.find((r) => r.uf === "BR").last_updated);
  assert.match(a.note, /not the TSE's certified result/);
  assert.equal(results.test, false);
  assert.equal(Object.keys(results.st).length, 27 + 1);
  const { lv, fv, pr } = results.nat;
  const lula = (100 * lv / (lv + fv)).toFixed(2), flavio = (100 * fv / (lv + fv)).toFixed(2);
  const faq = read("app/brasil/resultados/page.tsx");
  assert.ok(faq.includes(`${pr}% of sections counted, Lula had ${lula}% of the valid vote and Flávio Bolsonaro ${flavio}%`), `${lula}/${flavio} at ${pr}`);
  assert.ok(read("app/lib/llms.ts").includes(`${lula} to ${flavio} percent at ${pr} percent`));
});

test("the forecast files are byte-identical to the published pre-election forecast", () => {
  // SHA-256 of both files at 955eecd5, the last commit before the archive
  const PUBLISHED = {
    "public/brasil/br.json": "37692480e80f74aad3dbc3951943b5e82640067f1c79f988dc02ad219f41aaa1",
    "app/brasil/exp.json": "a314511f9d495f6d350b8df95a362ec97f800669c949dbb43e0028aac8470c29",
  };
  for (const [f, h] of Object.entries(PUBLISHED)) assert.equal(createHash("sha256").update(readFileSync(join(ROOT, f))).digest("hex"), h, f);
});

test("the client reads the archive once: no polling and no live API", () => {
  const src = read("app/brasil/useBrLive.ts");
  assert.match(src, /ARCHIVE_URL = "\/brasil\/archive\/results\.json"/);
  assert.doesNotMatch(src, /setInterval|\/api\/brasil\/live|useCountdown/);
  const route = read("app/api/brasil/live/route.ts");
  assert.match(route, /dynamic = "force-static"/);
  assert.doesNotMatch(route, /civicapi\.org|fetch\(/);
});

test("Brazil is out of the Forecast and Results menus and the home deck, with an archive link", () => {
  const nav = read("app/components/navMenu.ts");
  const brLinks = [...nav.matchAll(/href: "(\/brasil[^"]*)"[^}]*/g)];
  assert.deepEqual(brLinks.map((m) => m[1]), ["/brasil/arquivo"]);
  assert.doesNotMatch(brLinks[0][0], /badge/);
  assert.doesNotMatch(nav, /Brazil runoff|Around the world/);
  const deck = read("app/components/home/HomeDeck.tsx");
  assert.doesNotMatch(deck, /hd-br|getBr|href=\{?["`]?\/brasil/);
  assert.doesNotMatch(read("app/components/home/home-deck.css"), /hd-br/);
  assert.match(read("app/results/archive/page.tsx"), /href="\/brasil\/arquivo"/);
});

test("metadata says archive: no hourly or always sitemap entries, no scheduled event, no live keywords", () => {
  const sm = read("app/sitemap.ts");
  for (const line of sm.split("\n").filter((l) => l.includes("/brasil"))) assert.doesNotMatch(line, /"(always|hourly|daily)"/, line);
  assert.match(sm, /u\("\/brasil\/arquivo", BR_ARCHIVED, "yearly"/);
  const data = read("app/brasil/data.ts");
  assert.doesNotMatch(data, /EventScheduled|eventStatus|ao vivo/);
  assert.match(data, /export const BR_ARCHIVED = "2026-10-31"/);
  assert.doesNotMatch(read("app/lib/llms.ts"), /Brazil 2026 live/);
});

test("every Brazil route still exists, plus the archive landing", () => {
  for (const p of ["page.tsx", "[slug]/page.tsx", "estados/page.tsx", "resultados/page.tsx", "resultados/[slug]/page.tsx", "monitor/page.tsx", "arquivo/page.tsx"])
    assert.ok(existsSync(join(ROOT, "app/brasil", p)), p);
});
