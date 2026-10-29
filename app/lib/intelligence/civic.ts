// civicAPI payloads read into the trimmed shapes the results pages use. Pure; shared by the diagnostics page and the recorder.

import type { CDetail, CRace } from "@/app/results/2026/live";

type Cand = { name: string; party: string; votes?: number; percent?: number; winner?: boolean; seats?: number };
type SearchRace = { id: number; type: string; province: string; district: string | null; election_name: string; percent_reporting?: number; seats?: number; candidates?: Cand[] };
type Region = { name: string; type?: string; fips?: string; percent_reporting?: number; candidates?: Cand[] };

const cands = (cs: Cand[] | undefined) => (cs || []).map((c) => [c.name, c.party, c.votes ?? 0, c.percent ?? 0, c.winner ? 1 : 0, c.seats ?? null] as CRace["c"][number]);

export function searchRows(json: unknown): CRace[] {
  const races = (json as { races?: SearchRace[] } | null)?.races;
  if (!Array.isArray(races)) return [];
  return races.map((x) => ({ id: x.id, type: x.type, province: x.province, district: x.district, name: x.election_name, pr: x.percent_reporting ?? 0, seats: x.seats, c: cands(x.candidates) }));
}

/** One civicAPI race with its county results. Throws when the payload is not an object. */
export function trimDetail(j: unknown, id: number): CDetail {
  if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("race payload is not an object");
  const o = j as Record<string, unknown> & { region_results?: Record<string, Region>; candidates?: Cand[] };
  const regions: CDetail["regions"] = {};
  for (const [k, v] of Object.entries(o.region_results || {})) regions[v.fips || k] = { n: v.name, t: v.type, pr: v.percent_reporting ?? 0, c: cands(v.candidates) };
  return {
    id, name: o.election_name as string, type: o.election_type as string, province: o.province as string, district: o.district as string | null, pr: (o.percent_reporting as number | undefined) ?? 0,
    close: (o.polls_close as string | undefined) ?? null, updated: (o.last_updated as string | undefined) ?? null, test: !!o.test_data, c: cands(o.candidates), regions,
  };
}
