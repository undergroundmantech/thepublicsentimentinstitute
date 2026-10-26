// Server-only inputs for the diagnostics page: the expected-results index, the forecast's county file for a state,
// and one race's civicAPI returns. Every read fails soft: a missing input becomes a null the pipeline reports.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { matchCivic, type CDetail, type CRace, type Exp, type StFile, type XIndex, type XRace } from "@/app/results/2026/live";

const PUB = path.join(process.cwd(), "public", "results", "2026");
const CIVIC = "https://civicapi.org/api/v2";

export async function readIndex(): Promise<XIndex | null> {
  try { return JSON.parse(await readFile(path.join(PUB, "index.json"), "utf8")) as XIndex; } catch { return null; }
}

export async function readCountyExpectations(st: string, raceId: string): Promise<Record<string, Exp> | null> {
  if (!/^[A-Z]{2}$/.test(st)) return null;
  try { return (JSON.parse(await readFile(path.join(PUB, "st", `${st}.json`), "utf8")) as StFile).counties[raceId] ?? null; } catch { return null; }
}

type Cand = { name: string; party: string; votes?: number; percent?: number; winner?: boolean; seats?: number };
type SearchRace = { id: number; type: string; province: string; district: string | null; election_name: string; percent_reporting?: number; seats?: number; candidates?: Cand[] };
type Region = { name: string; type?: string; fips?: string; percent_reporting?: number; candidates?: Cand[] };
const cands = (cs: Cand[] | undefined) => (cs || []).map((c) => [c.name, c.party, c.votes ?? 0, c.percent ?? 0, c.winner ? 1 : 0, c.seats ?? null] as CRace["c"][number]);

/** The civicAPI race matching a forecast race, trimmed the way /api/civic trims it. */
export async function fetchCivicDetail(race: XRace): Promise<{ detail: CDetail | null; url: string | null; error: string | null; raw?: unknown }> {
  try {
    const civ: CRace[] = [];
    for (const type of race.civ.t ?? []) {
      const r = await fetch(`${CIVIC}/race/search?startDate=2026-11-03&endDate=2026-11-03&limit=20000&type=${encodeURIComponent(type)}`, { next: { revalidate: 30 }, headers: { accept: "application/json" } });
      if (!r.ok) return { detail: null, url: null, error: `civicAPI search ${r.status}` };
      const j = (await r.json()) as { races?: SearchRace[] };
      for (const x of j.races || []) civ.push({ id: x.id, type: x.type, province: x.province, district: x.district, name: x.election_name, pr: x.percent_reporting ?? 0, seats: x.seats, c: cands(x.candidates) });
    }
    const hit = matchCivic([race], civ)[race.id];
    if (!hit) return { detail: null, url: null, error: "no civicAPI race matches this forecast race" };
    if (!Number.isInteger(hit.id)) return { detail: null, url: null, error: "civicAPI returned a non-numeric race id" };
    const url = `${CIVIC}/race/${hit.id}`;
    const r = await fetch(url, { next: { revalidate: 30 }, headers: { accept: "application/json" } });
    if (!r.ok) return { detail: null, url, error: `civicAPI race ${r.status}` };
    const j = await r.json();
    const regions: CDetail["regions"] = {};
    for (const [k, v] of Object.entries((j.region_results || {}) as Record<string, Region>)) regions[v.fips || k] = { n: v.name, t: v.type, pr: v.percent_reporting ?? 0, c: cands(v.candidates) };
    return {
      detail: { id: hit.id, name: j.election_name, type: j.election_type, province: j.province, district: j.district, pr: j.percent_reporting ?? 0, close: j.polls_close ?? null, updated: j.last_updated ?? null, test: !!j.test_data, c: cands(j.candidates), regions },
      url, error: null, raw: j,
    };
  } catch {
    return { detail: null, url: null, error: "civicAPI unreachable" };
  }
}
