"use client";

// The needle's numbers come from THE site forecast engine
// (app/lib/electoralModel.ts — Dustin's model, same file main ships and the
// same methodology the /results/forecast page and the precinct app's
// ForecastNeedle run). This adapter mirrors the precinct app's
// projectFromCivic: sort by votes, tonePalette the colors, run
// civicToForecastInput + forecastRace, and read the two-way win odds +
// projected margin off the output. No hand-rolled math.

import { civicToForecastInput, forecastRace, type CivicRace } from "@/app/lib/electoralModel";
import { tonePalette } from "../onpoint/electionLib.js";

const KEY_IDX: Record<string, number> = { Candidate1: 0, Candidate2: 1, Candidate3: 2 };

export interface NeedleProjection {
  leaderName: string;
  runnerName: string;
  leaderColor: string;
  runnerColor: string;
  /** P(leader wins the two-way), 0..1 — from plurality_odds_to_win. */
  pLeader: number;
  pRunner: number;
  /** PROJECTED margin (pp) from the engine — not the raw current margin. */
  marginPp: number;
  reporting: number;
}

export function needleFromRace(race: any): NeedleProjection | null {
  if (!race || !Array.isArray(race.candidates)) return null;
  const cands = race.candidates.filter((c: any) => c && c.name);
  if (cands.length < 2) return null;

  const sorted = [...cands].sort((a: any, b: any) => (Number(b.votes) || 0) - (Number(a.votes) || 0));
  const colors = tonePalette(sorted as any) as string[];
  const pctReporting = Number(race.percent_reporting) || 0;

  const cr: CivicRace = {
    election_name: String(race.election_name || ""),
    election_type: String(race.election_type || ""),
    election_date: String(race.election_date || ""),
    country: String(race.country || "US"),
    province: race.province ?? null,
    district: race.district ?? null,
    municipality: race.municipality ?? null,
    percent_reporting: pctReporting,
    registered_voters: Number(race.registered_voters) || 0,
    last_updated: String(race.last_updated || ""),
    candidates: sorted.map((c: any) => ({
      name: String(c.name),
      party: String(c.party || ""),
      color: String(c.color || ""),
      votes: Number(c.votes) || 0,
      percent: Number(c.percent) || 0,
      winner: !!c.winner,
    })),
  };

  try {
    const names = sorted.slice(0, 3).map((c: any) => String(c.name));
    const out = forecastRace(civicToForecastInput(cr), names, colors.slice(0, 3));
    const li = KEY_IDX[out.leader] ?? 0;
    const ri = KEY_IDX[out.runner_up] ?? 1;
    const oddsL = out.plurality_odds_to_win[out.leader] ?? 0;
    const oddsR = out.plurality_odds_to_win[out.runner_up] ?? 0;
    const twoWay = oddsL + oddsR;
    const pLeader = twoWay > 0 ? oddsL / twoWay : 0.5;
    return {
      leaderName: String(cr.candidates[li]?.name || "Leader"),
      runnerName: String(cr.candidates[ri]?.name || "Runner-up"),
      leaderColor: colors[li] || "#dc2626",
      runnerColor: colors[ri] || "#8e6df0",
      pLeader,
      pRunner: 1 - pLeader,
      marginPp: Math.abs(out.projected_margin_pct) * 100,
      reporting: pctReporting,
    };
  } catch {
    return null;
  }
}
