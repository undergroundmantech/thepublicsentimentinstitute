// Server-side reads of civicAPI for the engine. They use exactly the URLs and cache lifetime of the /api/civic
// proxies, so the provider sees no more requests than the pages already make.
import { TYPE_SETS } from "../../results/2026/live";
import { PROXY_CACHE_MS } from "../../results/2026/liveFeed";
import type { CivicRawRace } from "./snapshot";

const SEARCH = "https://civicapi.org/api/v2/race/search";
export const REVAL = PROXY_CACHE_MS / 1000;
type NextInit = RequestInit & { next?: { revalidate: number } };

/** Every race type the site follows, one type at a time. Types that fail are listed, never silently dropped. */
export const ALL_SETS = ["fed", "state", "ballot", "leg"] as const;
export type TypeSet = (typeof ALL_SETS)[number];
export function typesFor(sets: readonly TypeSet[]): string[] {
  for (const s of sets) if (!TYPE_SETS[s]?.length) throw new Error(`unknown race-type group "${s}"`);   // never a silent empty read
  return [...new Set(sets.flatMap((s) => TYPE_SETS[s]))];
}
export async function fetchCivicRaces(sets: readonly TypeSet[] = ALL_SETS): Promise<{ raws: CivicRawRace[]; failed: string[]; bodies: Record<string, string> }> {
  const types = typesFor(sets); const raws: CivicRawRace[] = []; const failed: string[] = []; const bodies: Record<string, string> = {};
  for (const t of types) {
    try {
      const r = await fetch(`${SEARCH}?startDate=2026-11-03&endDate=2026-11-03&limit=20000&type=${encodeURIComponent(t)}`, { next: { revalidate: REVAL }, headers: { accept: "application/json" } } as NextInit);
      if (!r.ok) throw new Error(`civicAPI ${r.status}`);
      const text = await r.text(); bodies[t] = text; raws.push(...((JSON.parse(text) as { races?: CivicRawRace[] }).races ?? []));
    } catch { failed.push(t); }
  }
  return { raws, failed, bodies };
}
