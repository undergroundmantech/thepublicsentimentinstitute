// Brazil 2026 runoff archive: saves civicAPI's records for the national race and the 27 state races, then builds the
// archived results payload the Brazil results pages read, using the same code election night used.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/intelligence/ts-resolve.mjs \
//     scripts/brasil/archive-results.ts [--fetch]
//
// --fetch downloads the records again into data/brasil-archive/2026-runoff/civicapi/ (gzipped, with a SHA-256 of each
// record in manifest.json). Without it the saved records are reprocessed, and every hash is checked first.
// The provider's count is not the TSE's certified result, and the payload says so.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { join } from "node:path";
import { liveFromCivic, type CivicRace } from "../../app/brasil/civic";
import type { ArchiveMeta, Exp } from "../../app/brasil/project";

const ROOT = new URL("../../", import.meta.url).pathname;
const DIR = join(ROOT, "data/brasil-archive/2026-runoff");
const RAW = join(DIR, "civicapi");
const OUT = join(ROOT, "public/brasil/archive/results.json");
const civic = (JSON.parse(readFileSync(join(ROOT, "public/brasil/br.json"), "utf8")) as { civic: Record<string, number> }).civic;
const exp = JSON.parse(readFileSync(join(ROOT, "app/brasil/exp.json"), "utf8")) as Exp;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const file = (uf: string) => join(RAW, `${uf}-${civic[uf]}.json.gz`);

type Entry = { uf: string; id: number; file: string; sha256: string; bytes: number; last_updated: string | null; percent_reporting: number | null; test_data: boolean | null };
type Manifest = { source: string; url: string; capturedAt: string; records: Entry[] };

if (process.argv.includes("--fetch")) {
  mkdirSync(RAW, { recursive: true });
  const capturedAt = new Date().toISOString();
  const records: Entry[] = [];
  for (const [uf, id] of Object.entries(civic)) {
    const r = await fetch(`https://civicapi.org/api/v2/race/${id}`, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(`civicAPI ${uf} ${id}: HTTP ${r.status}`);
    const body = Buffer.from(await r.arrayBuffer());
    const j = JSON.parse(body.toString("utf8")) as CivicRace;
    writeFileSync(file(uf), gzipSync(body, { level: 9 }));
    records.push({ uf, id, file: `civicapi/${uf}-${id}.json.gz`, sha256: sha(body), bytes: body.length, last_updated: j.last_updated ?? null, percent_reporting: j.percent_reporting ?? null, test_data: j.test_data ?? null });
  }
  const m: Manifest = { source: "civicAPI", url: "https://civicapi.org/api/v2/race/{id}", capturedAt, records };
  writeFileSync(join(DIR, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
}

const man = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) as Manifest;
const recs: Record<string, CivicRace> = {};
for (const e of man.records) {
  if (!existsSync(join(DIR, e.file))) throw new Error(`missing ${e.file}`);
  const body = gunzipSync(readFileSync(join(DIR, e.file)));
  if (sha(body) !== e.sha256) throw new Error(`hash mismatch ${e.file}`);
  const j = JSON.parse(body.toString("utf8")) as CivicRace;
  if (j.test_data) throw new Error(`${e.uf} is marked as test data`);
  recs[e.uf] = j;
}
if (!recs.BR) throw new Error("national record missing");
const states = Object.fromEntries(Object.keys(civic).filter((k) => k !== "BR").map((uf) => [uf, recs[uf] ?? null]));
const live = liveFromCivic(exp, recs.BR, states, man.capturedAt);
const archive: ArchiveMeta = {
  source: "civicAPI",
  raceIds: civic,
  providerUpdated: recs.BR.last_updated ?? man.capturedAt,
  capturedAt: man.capturedAt,
  reporting: recs.BR.percent_reporting ?? 0,
  official: false,
  note: "The provider's last count of the October 25, 2026 runoff, saved by On Point Politics. It is not the TSE's certified result.",
};
mkdirSync(join(ROOT, "public/brasil/archive"), { recursive: true });
writeFileSync(OUT, JSON.stringify({ ...live, archive }));
const n = live.nat;
console.log(JSON.stringify({ out: OUT.replace(ROOT, ""), bytes: readFileSync(OUT).length, providerUpdated: archive.providerUpdated, capturedAt: archive.capturedAt, reporting: n.pr, lula: n.lv, flavio: n.fv, call: n.proj.call, states: Object.keys(live.st).length, municipalities: Object.values(live.st).reduce((s, x) => s + Object.keys(x.m).length, 0) }));
