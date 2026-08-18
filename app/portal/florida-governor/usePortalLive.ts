"use client";

/**
 * Live feeds for the internal Florida board.
 *
 * These duplicate the fetch logic inside FloridaBoard rather than importing it.
 * That is deliberate and temporary: the public board is serving an election in
 * progress, and the portal is not worth the risk of refactoring it mid-count.
 * Fold the two together once the race is certified.
 */

import { useEffect, useState } from "react";
import {
  CANDIDATE_ORDER,
  CANDIDATE_MATCH,
  type CandidateKey,
} from "../../results/_data/flCountyForecast";
import type { LiveCounty } from "../../results/2026-08-18/countyForecast";
import type { FreshtakePayload } from "../../api/freshtake/route";

export const FL_GOV_R = 86349;
const REFRESH_MS = 30_000;

export type Cand = { name?: string; party?: string; votes?: number; winner?: boolean };
export type Race = { id: number; candidates?: Cand[]; percent_reporting?: number };

const emptyVotes = (): Record<CandidateKey, number> =>
  ({ donalds: 0, fishback: 0, collins: 0, renner: 0, other: 0 });

/** Maps a feed candidate name onto a model key; unmatched names bucket to other. */
export const keyOf = (name?: string): CandidateKey =>
  CANDIDATE_ORDER.find((k) => String(name || "").toLowerCase().includes(CANDIDATE_MATCH[k])) ??
  "other";

/** County returns plus the full candidate field, uncached. */
export function useRaceDetail(raceId: number) {
  const [counties, setCounties] = useState<Record<string, LiveCounty>>({});
  const [detail, setDetail] = useState<Race | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();

    const pull = async () => {
      try {
        const res = await fetch(`https://civicapi.org/api/v2/race/${raceId}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (!alive) return;

        setDetail(body?.candidates?.length ? (body as Race) : null);

        const regions = body?.region_results || {};
        const out: Record<string, LiveCounty> = {};
        for (const key of Object.keys(regions)) {
          const r = regions[key];
          const name = String(r?.name || key).replace(/\s+county$/i, "").trim().toUpperCase();
          if (!name) continue;
          const votes = emptyVotes();
          let total = 0;
          for (const c of r?.candidates || []) {
            const v = Number(c?.votes) || 0;
            votes[keyOf(c?.name)] += v;
            total += v;
          }
          out[name] = { votes, total, reporting: Number(r?.percent_reporting) || 0 };
        }
        setCounties(out);
        setUpdated(new Date());
        setStale(false);
      } catch {
        // A failed refresh never blanks the board — keep the last good payload.
        if (alive) setStale(true);
      }
    };

    pull();
    const t = setInterval(pull, REFRESH_MS);
    return () => {
      alive = false;
      ac.abort();
      clearInterval(t);
    };
  }, [raceId]);

  return { counties, detail, updated, stale };
}

/** Banked pre-election ballots, via our own gated proxy. */
export function useFreshtake() {
  const [data, setData] = useState<FreshtakePayload | null>(null);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    const pull = async () => {
      try {
        const r = await fetch("/api/freshtake", { cache: "no-store", signal: ac.signal });
        const j = (await r.json()) as FreshtakePayload;
        if (alive) setData(j);
      } catch {
        // Keep the last good payload; the panel renders its own notice.
      }
    };
    pull();
    // Banked turnout moves in daily batches, not by the minute.
    const t = setInterval(pull, 5 * 60_000);
    return () => {
      alive = false;
      ac.abort();
      clearInterval(t);
    };
  }, []);

  return data;
}
