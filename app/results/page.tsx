"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ForecastOutput, RaceRule } from "@/app/lib/electoralModel";
import { slugToId, idToDate, idToLabel, ELECTION_DATES, getRacesByDate, formatElectionDate, getRaceUrl } from "./_data/raceRegistry";
import ResultsLanding from "./components/ResultsLanding";

const CIVIC_BASE = "https://civicapi.org";
const POLL_MS = 30_000;

function calculateWinProbability(leaderVotes: number, runnerUpVotes: number, percentReporting: number): number {
  if (percentReporting >= 99) return 100;
  if (percentReporting <= 0 || (leaderVotes === 0 && runnerUpVotes === 0)) return 50;
  const currentTotal = leaderVotes + runnerUpVotes;
  const estimatedTotal = currentTotal / (percentReporting / 100);
  const remainingVotes = estimatedTotal - currentTotal;
  const gap = leaderVotes - runnerUpVotes;
  if (gap > remainingVotes) return 100;
  const margin = (leaderVotes - runnerUpVotes) / currentTotal;
  const certaintyWeight = Math.sqrt(percentReporting / 100);
  const z = margin * 15 * certaintyWeight;
  const prob = 1 / (1 + Math.exp(-z));
  return 50 + (prob - 0.5) * 100;
}

type RaceCandidate = { name: string; party: string; votes: number; percent: number; winner: boolean; incumbent?: boolean; major_candidate?: boolean; color: string; };
type RegionCandidate = { name: string; party: string; votes: string | number; percent: string | number; winner: boolean; color: string; incumbent?: boolean; major_candidate?: boolean; };
type RegionResult = { region: { name: string; type: string; fill?: string; percent_reporting?: number; }; candidates: RegionCandidate[]; };
type RaceDetail = { election_name: string; election_type: string; election_scope: string; election_date: string; country: string; province: string | null; district: string | null; municipality: string | null; polls_open: string | null; polls_close: string | null; last_updated: string | null; percent_reporting?: number; candidates: RaceCandidate[]; region_results?: RegionResult[] | Record<string, RegionResult>; };
type RaceType = "Democratic Primary" | "Republican Primary" | "Democratic Primary Runoff" | "Republican Primary Runoff" | "Special Election" | "General Election" | "Open Primary" | "Ballot Measure";
type FeaturedRace = { id: number; state: "AL" | "CA" | "DC" | "GA" | "IA" | "MD" | "ME" | "MT" | "ND" | "NJ" | "NM" | "NV" | "NY" | "OK" | "SC" | "SD" | "TX" | "UT"; office: string; raceType: RaceType; label: string; archived?: boolean; };

function getRaceTypeColor(raceType: RaceType): string {
  if (raceType === "Republican Primary") return "var(--rep)";
  if (raceType === "Democratic Primary") return "var(--dem)";
  if (raceType === "General Election") return "var(--purple-soft)";
  if (raceType === "Open Primary") return "var(--purple)";
  // Runoff / other variants — derive from party substring
  const rt = raceType as string;
  if (rt.includes("Republican")) return "var(--rep)";
  if (rt.includes("Democratic")) return "var(--dem)";
  return "var(--purple)";
}

function getRaceTypeShort(raceType: RaceType): string {
  if (raceType === "Republican Primary") return "R";
  if (raceType === "Democratic Primary") return "D";
  if (raceType === "General Election") return "G";
  if (raceType === "Open Primary") return "O";
  return "S";
}
function getRaceTypeLabel(raceType: RaceType): string {
  const rt = raceType as string;
  if (!rt.includes("Runoff")) return rt;
  return rt.replace("Republican", "Rep").replace("Democratic", "Dem");
}

const RACE_FORECAST_DEFAULTS: Partial<Record<number, { raceRule: RaceRule; expectedTurnout?: number; pollAvg?: Record<string, number>; overrideReporting?: number; pollsCloseIso?: string; turnoutBlendK?: number; colorOverrides?: Record<string, string>; manualCall?: string; }>> = {

  // ── CA TOP-TWO OPEN PRIMARY (June 2) ──────────────────────────────────────
  79777: { raceRule: "TOP_TWO", expectedTurnout: 9_500_000, pollAvg: { "Becerra": 29.0, "Steyer": 22.0, "Hilton": 25.0, "Bianco": 10.0 }, overrideReporting: 99.5, turnoutBlendK: 2 }, // CA Governor
// ONE-OFF DSMeridian late-VBM correction — LA Mayor June 2, 2026
// DO NOT replicate. See full rationale below.
//
// Problem: ~319k remaining ballots are exclusively late unreturned VBM,
// modeled by DSMeridian Stage 4 (n=102 LV pool). That pool runs:
//   Bass 44.9% · Raman 27.7% · Pratt 16.5%
// — the inverse of the current live trend. Standard blend extrapolates
// the live trend into the remaining pool, which is methodologically wrong.
//
// Fix: pollAvg values are NOT the projected finals. They are algebraically
// derived implied priors, back-solved so that:
//   live_share * live_weight + pollAvg * prior_weight = target_final
// at 64.2% reporting with k=0.5 (live_weight=0.801, prior_weight=0.199).
//
// This produces exactly our DSMeridian projected finals right now AND
// converges stably as VBM ballots come in — Raman holds 2nd through 100%.
//
// Derivation:
//   Target finals: Bass 38.0% · Raman 24.6% · Pratt 24.3%
//   pollAvg[c] = (target[c] - live[c] * 0.801) / 0.199
//
// Verified: model outputs Bass 38.0%, Raman 24.6%, Pratt 24.3% at current
// reporting and holds Raman 2nd by ~0.3–0.5pp through 100% reporting.
79938: {
  raceRule: "TOP_TWO",
  expectedTurnout: 891_053,
  pollAvg: {
    "Bass":   53.4,  // implied prior (not projected final — algebraically derived)
    "Raman":  31.7,  // implied prior
    "Pratt":   6.8,  // implied prior
    "Miller":  4.8,
    "Huang":   1.3,
  },
  turnoutBlendK: 0.5,
  overrideReporting: 99.5,
},
  79893: { raceRule: "TOP_TWO", overrideReporting: 0 },        // CA US House 1
  79932: { raceRule: "TOP_TWO", overrideReporting: 0 },        // CA US House 7
  79884: { raceRule: "TOP_TWO", overrideReporting: 0 },        // CA US House 11
  79916: { raceRule: "TOP_TWO", expectedTurnout: 225_000, pollAvg: { "Calvert": 32.0, "Kim": 18.0, "Kin-Varet": 15.0, "Ramirez": 10.0 }, overrideReporting: 0, turnoutBlendK: 2 },        // CA US House 40
  79924: { raceRule: "TOP_TWO", expectedTurnout: 287_500, pollAvg: { "Desmond": 28.5, "Campa-Najjar": 17.5, "von Wilpert": 14.0, "Riker": 9.0, "O'Neil": 8.5, "Chavez": 6.5, "Contreras": 4.5, "Schaefer": 3.5, "Shaw": 2.5, "Porter": 2.0, "Clemons": 1.5, "Reyna": 1.5 }, overrideReporting: 0, turnoutBlendK: 2 }, // CA US House 48
  // ── IA 35% NOMINATION THRESHOLD — convention if unmet (June 2) ───────────
  79945: { raceRule: "THRESHOLD_35_CONVENTION", expectedTurnout: 210_000, pollAvg: { "Feenstra": 52.0, "Lahn": 38.0, "Steen": 10.0 }, overrideReporting: 0, turnoutBlendK: 2 }, // IA Governor R
  80204: { raceRule: "THRESHOLD_35_CONVENTION", overrideReporting: 0 }, // IA US House 2 D
  80205: { raceRule: "THRESHOLD_35_CONVENTION", overrideReporting: 0 }, // IA US House 2 R
  80210: { raceRule: "THRESHOLD_35_CONVENTION", expectedTurnout: 122_000, pollAvg: { "Turek": 65.0, "Wahls": 32.0 }, overrideReporting: 0, turnoutBlendK: 2 }, // IA US Senate D (Turek ~90–95% nomination)
  80211: { raceRule: "THRESHOLD_35_CONVENTION", overrideReporting: 0 }, // IA US Senate R
  // ── NJ PLURALITY PRIMARIES (June 2) ──────────────────────────────────────
  81046: { raceRule: "PLURALITY", expectedTurnout: 57_500, pollAvg: { "Bennett": 62.0 }, overrideReporting: 0, turnoutBlendK: 2 }, // NJ-07 D (Bennett ~90–95%)
  // ── SD 35% RUNOFF THRESHOLD — top-2 runoff if unmet (June 2) ─────────────
  80461: { raceRule: "THRESHOLD_35_RUNOFF", expectedTurnout: 140_000, pollAvg: { "Rhoden": 30.2, "Johnson": 27.3, "Doeden": 22.5, "Hansen": 16.8 }, 
                                            overrideReporting: 99.9, 
    pollsCloseIso: "2026-06-02T21:00:00-04:00", turnoutBlendK: 2 }, // SD Governor R (LV model) — 9pm ET
  80511: { raceRule: "THRESHOLD_35_RUNOFF", overrideReporting: 99.9, 
    pollsCloseIso: "2026-06-02T21:00:00-04:00" },   // SD US House At-Large R
  80512: { raceRule: "THRESHOLD_35_RUNOFF", overrideReporting: 99.9, 
    pollsCloseIso: "2026-06-02T21:00:00-04:00" },   // SD US Senate R
  // ── NM close time override (June 2) ──────────────────────────────────────
  81014: { raceRule: "PLURALITY", overrideReporting: 99.9, pollsCloseIso: "2026-06-02T21:00:00-04:00", manualCall: "Ben Luján" }, // NM US Senate D — 9pm ET
  81015: { raceRule: "PLURALITY", overrideReporting: 0, pollsCloseIso: "2026-06-02T21:00:00-04:00" }, // NM US Senate R — 9pm ET

  // ── SOUTH CAROLINA — MAJORITY (50%+1 or runoff June 23) — June 9 ─────────
  82664: { raceRule: "MAJORITY", expectedTurnout: 400_000, pollAvg: { "Graham": 51.0, "Lynch": 26.4, "Dismukes": 6.6, "Herrmann": 5.4, "Mitchell": 4.2, "Cowen": 2.0 } }, // SC US Senate R (TPSI DSMeridian Model 02 · June 3–4 · n=388)
  82596: { raceRule: "MAJORITY", expectedTurnout: 380_000, pollAvg: { "Mace": 15.0, "Evette": 24.9, "Norman": 17.2, "Reddy": 16.4, "Wilson": 21.0 } }, // SC Governor R (pre-Trump-endorsement priors — live may diverge)
  82663: { raceRule: "MAJORITY", expectedTurnout: 130_000, pollAvg: { "Andrews": 62.0, "Brown": 24.0, "Bruce": 8.0, "Freeman": 4.0, "Giracello": 2.0 } }, // SC US Senate D (market-implied · Andrews ~99%)
  82595: { raceRule: "MAJORITY", expectedTurnout: 110_000, pollAvg: { "Johnson": 40.0, "Webster": 33.0, "McLeod": 18.0, "Bennett": 9.0 } }, // SC Governor D
  82594: { raceRule: "MAJORITY", expectedTurnout: 95_000 },   // SC Comptroller General D
  82597: { raceRule: "MAJORITY", expectedTurnout: 95_000 },   // SC Secretary of State D
  82592: { raceRule: "MAJORITY", expectedTurnout: 340_000 },  // SC Attorney General R
  82654: { raceRule: "MAJORITY", expectedTurnout: 40_000 },   // SC US House 1 D
  82655: { raceRule: "MAJORITY", expectedTurnout: 85_000 },   // SC US House 1 R
  82657: { raceRule: "MAJORITY", expectedTurnout: 75_000 },   // SC US House 2 R
  82662: { raceRule: "MAJORITY", expectedTurnout: 70_000 },   // SC US House 6 R

  // ── MAINE — PLURALITY (RCV primary; first-choice night totals only) — June 9 ──
  83063: { raceRule: "PLURALITY", expectedTurnout: 200_000, pollAvg: { "Platner": 66.0, "Mills": 20.0, "Costello": 4.0 } }, // ME US Senate D (Fox News / Pan Atlantic May 2026 · Mills suspended but on ballot)
  82693: { raceRule: "PLURALITY", expectedTurnout: 210_000, pollAvg: { "Shah": 29.0, "Jackson": 28.0, "King": 14.0, "Pingree": 12.0, "Bellows": 11.0 } }, // ME Governor D (SurveyUSA / FairVote June 3 · first-choice shares · Pingree wins RCV sim)
  82694: { raceRule: "PLURALITY", expectedTurnout: 160_000, pollAvg: { "Charles": 36.0, "Bush": 20.0, "Mason": 13.0, "Midgley": 11.0, "Jones": 7.0, "Wessels": 1.0 } }, // ME Governor R (UNH Pine Tree State Poll · May 27 · RCV · Charles dominant)
  83061: { raceRule: "PLURALITY", expectedTurnout: 55_000 },  // ME US House 2 D (API only · Baldacci + 3)

  // ── NEVADA — PLURALITY (simple plurality wins) — June 9 ─────────────────
  83111: { raceRule: "PLURALITY", expectedTurnout: 165_000, pollAvg: { "Lombardo": 78.0, "Hansen": 12.0, "Winterhawk": 6.0 } }, // NV Governor R (dominant incumbent)
  83110: { raceRule: "PLURALITY", expectedTurnout: 155_000, pollAvg: { "Ford": 68.0, "Hill": 22.0, "Other": 10.0 } }, // NV Governor D
  83081: { raceRule: "PLURALITY", expectedTurnout: 155_000 }, // NV Attorney General R
  83080: { raceRule: "PLURALITY", expectedTurnout: 145_000 }, // NV Attorney General D
  83112: { raceRule: "PLURALITY", expectedTurnout: 140_000 }, // NV Lieutenant Governor D
  83113: { raceRule: "PLURALITY", expectedTurnout: 150_000 }, // NV Secretary of State R
  83150: { raceRule: "PLURALITY", expectedTurnout: 50_000 },  // NV US House 1 R
  83149: { raceRule: "PLURALITY", expectedTurnout: 55_000 },  // NV US House 1 D

  // ── NORTH DAKOTA — PLURALITY — June 9 ───────────────────────────────────
  82403: { raceRule: "PLURALITY", expectedTurnout: 120_000 }, // ND US House At-Large R
  82384: { raceRule: "PLURALITY", expectedTurnout: 100_000 }, // ND Public Service Commissioner R

  // ── GEORGIA — PLURALITY runoffs (simple majority, no runoff threshold) — June 16 ──
  83316: { raceRule: "PLURALITY", expectedTurnout: 720_000, pollAvg: { "Collins": 58.0, "Dooley": 42.0 } }, // GA US Senate R Runoff
  83266: { raceRule: "PLURALITY", expectedTurnout: 680_000 }, // GA Governor R Runoff
  83277: { raceRule: "PLURALITY", expectedTurnout: 640_000 }, // GA Lt Governor R Runoff
  83276: { raceRule: "PLURALITY", expectedTurnout: 600_000 }, // GA Lt Governor D Runoff
  83289: { raceRule: "PLURALITY", expectedTurnout: 600_000 }, // GA Secretary of State R Runoff
  83288: { raceRule: "PLURALITY", expectedTurnout: 590_000 }, // GA Secretary of State D Runoff
  83312: { raceRule: "PLURALITY", expectedTurnout: 90_000  }, // GA US House 11 R Runoff
  83313: { raceRule: "PLURALITY", expectedTurnout: 60_000  }, // GA US House 12 D Runoff
  83314: { raceRule: "PLURALITY", expectedTurnout: 55_000  }, // GA US House 1 D Runoff
  83315: { raceRule: "PLURALITY", expectedTurnout: 65_000  }, // GA US House 7 D Runoff

  // ── WASHINGTON DC — June 16 ────────────────────────────────────────────────
  83478: { raceRule: "PLURALITY", expectedTurnout: 85_000 },   // DC US House Delegate D Primary
  83479: { raceRule: "RANKED_CHOICE", expectedTurnout: 87_500, pollsCloseIso: "2026-06-16T20:00:00-04:00", pollAvg: { "George": 43.0, "McDuffie": 38.0, "Johnson": 19.0 } },  // DC Mayor D Primary — RCV

  // ── ALABAMA — PLURALITY runoffs — June 16 ────────────────────────────────
  83428: { raceRule: "PLURALITY", expectedTurnout: 280_000, pollAvg: { "Moore": 51.0, "Hudson": 49.0 } }, // AL US Senate R Runoff
  83427: { raceRule: "PLURALITY", expectedTurnout: 130_000 }, // AL US Senate D Runoff
  83430: { raceRule: "PLURALITY", expectedTurnout: 260_000 }, // AL Lt Governor R Runoff
  83431: { raceRule: "PLURALITY", expectedTurnout: 260_000 }, // AL Attorney General R Runoff

  // ── OKLAHOMA — PLURALITY primaries + ballot measure — June 16 ────────────
  83476: { raceRule: "PLURALITY", expectedTurnout: 220_000, pollAvg: { "Yes": 54.0, "No": 46.0 } }, // OK State Question 832
  83424: { raceRule: "PLURALITY", expectedTurnout: 280_000 }, // OK US Senate R
  83423: { raceRule: "PLURALITY", expectedTurnout: 130_000 }, // OK US Senate D
  83344: { raceRule: "PLURALITY", expectedTurnout: 320_000 }, // OK Governor R
  83343: { raceRule: "PLURALITY", expectedTurnout: 150_000 }, // OK Governor D
  83415: { raceRule: "PLURALITY", expectedTurnout: 70_000  }, // OK US House 1 R

  // ── SOUTH CAROLINA — PLURALITY runoffs (June 23 — from June 9 primary) ────
  84103: { raceRule: "PLURALITY", expectedTurnout: 270_000 }, // SC Agriculture Commissioner R Runoff
  84104: { raceRule: "PLURALITY", expectedTurnout: 310_000, pollsCloseIso: "2026-06-23T19:00:00-04:00" }, // SC Attorney General R Runoff
  84105: { raceRule: "PLURALITY", expectedTurnout: 310_000, pollsCloseIso: "2026-06-23T19:00:00-04:00", pollAvg: { "Evette": 52.0, "Wilson": 48.0 } }, // SC Governor R Runoff
  84106: { raceRule: "PLURALITY", expectedTurnout: 85_000  }, // SC US House 1 R Runoff
  84110: { raceRule: "PLURALITY", expectedTurnout: 35_000  }, // SC US House 1 D Runoff
  84111: { raceRule: "PLURALITY", expectedTurnout: 40_000  }, // SC US House 2 D Runoff

  // ── MARYLAND — PLURALITY primaries — June 23 ─────────────────────────────
  83700: { raceRule: "PLURALITY", expectedTurnout: 380_000 }, // MD Governor R
  83920: { raceRule: "PLURALITY", expectedTurnout: 78_000, pollAvg: { "Elfreth": 62.0, "Cross": 15.0, "Dyches": 11.0 } }, // MD US House 3 D
  83925: { raceRule: "PLURALITY", expectedTurnout: 71_000, pollAvg: { "Trone": 56.0, "McClain Delaney": 40.0 } }, // MD US House 6 D — TPSI poll (n=154 LV, undec allocated +10 Delaney +5 Trone)
  83926: { raceRule: "PLURALITY", expectedTurnout: 100_000 }, // MD US House 6 R

  // ── NEW YORK — PLURALITY primaries — June 23 ─────────────────────────────
  84040: { raceRule: "PLURALITY", expectedTurnout: 64_000, pollAvg: { "Lander": 57.0, "Goldman": 43.0 } }, // NY US House 10 D
  84042: { raceRule: "PLURALITY", expectedTurnout: 68_000, pollAvg: { "Lasher": 46.0, "Bores": 31.0, "Conway": 13.0, "Schlossberg": 10.0 } }, // NY US House 12 D
  84043: { raceRule: "PLURALITY", expectedTurnout: 40_000 }, // NY US House 13 D
  84045: { raceRule: "PLURALITY", expectedTurnout: 35_000 }, // NY US House 15 D
  84117: { raceRule: "PLURALITY", expectedTurnout: 50_000 }, // NY US House 17 D

  // ── UTAH — PLURALITY primaries — June 23 ─────────────────────────────────
  // Utah: all-mail state — initial returns are large final mail tranches, not partial precincts.
  // turnoutBlendK: 0.5 trusts live data more quickly so the model converges on real results faster.
  84100: { raceRule: "PLURALITY", expectedTurnout: 38_000,  pollAvg: { "McAdams": 41.0, "Blouin": 38.0, "Farrell": 12.0, "Mohamed": 9.0 }, turnoutBlendK: 0.5 }, // UT US House 1 D
  84101: { raceRule: "PLURALITY", expectedTurnout: 150_000, turnoutBlendK: 0.5 }, // UT US House 2 R
  84102: { raceRule: "PLURALITY", expectedTurnout: 58_000,  pollAvg: { "Maloy": 55.0, "Lyman": 45.0 }, turnoutBlendK: 0.5 }, // UT US House 3 R
};

// ─── STATE-LEVEL POLL CLOSE OVERRIDES ────────────────────────────────────────
// When the API lacks or misreports a close time, set it here at the state level.
// Race-level pollsCloseIso in RACE_FORECAST_DEFAULTS takes precedence over this.
// Format: ISO 8601 with UTC offset. EDT = -04:00, CDT = -05:00.
const STATE_POLLS_CLOSE: Partial<Record<string, string>> = {
  GA: "2026-06-16T19:00:00-04:00", // 7:00 PM ET
  AL: "2026-06-16T20:00:00-04:00", // 8:00 PM ET
  OK: "2026-06-16T20:00:00-05:00", // 8:00 PM CT
  SC: "2026-06-23T19:00:00-04:00", // 7:00 PM ET
  MD: "2026-06-23T20:00:00-04:00", // 8:00 PM ET
  NY: "2026-06-23T21:00:00-04:00", // 9:00 PM ET
  UT: "2026-06-23T20:00:00-06:00", // 8:00 PM MT (10:00 PM ET)
};

/** Returns the effective polls-close ISO string for a race, preferring:
 *  1. Race-level override (RACE_FORECAST_DEFAULTS[id].pollsCloseIso)
 *  2. State-level override (STATE_POLLS_CLOSE[state])
 *  3. API value (apiPollsClose)
 */
function getEffectivePollsCloseIso(
  raceId: number,
  state: string | null | undefined,
  apiPollsClose: string | null | undefined,
): string | null {
  return RACE_FORECAST_DEFAULTS[raceId]?.pollsCloseIso
    ?? (state ? STATE_POLLS_CLOSE[state] ?? null : null)
    ?? apiPollsClose
    ?? null;
}

function sortCandidatesByPollData(candidates: RaceCandidate[], pollAvg?: Record<string, number>): RaceCandidate[] {
  if (!pollAvg || Object.keys(pollAvg).length === 0) return [...candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  return [...candidates].sort((a, b) => {
    const getPollScore = (name: string): number => { const lower = name.toLowerCase(); for (const [key, score] of Object.entries(pollAvg)) { if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return score; } return -1; };
    const sa = getPollScore(a.name), sb = getPollScore(b.name);
    if (sa >= 0 && sb >= 0) return sb - sa;
    if (sa >= 0) return -1; if (sb >= 0) return 1;
    return (b.percent ?? 0) - (a.percent ?? 0);
  });
}

const FEATURED: FeaturedRace[] = [
  // ── TEXAS (May 26 runoff — ARCHIVED) ──
  { id: 79766, state: "TX", office: "US Senate", raceType: "Republican Primary", label: "Texas US Senate Republican Primary Runoff", archived: true },
  { id: 79722, state: "TX", office: "Attorney General", raceType: "Republican Primary", label: "Texas Attorney General Republican Primary Runoff", archived: true },
  { id: 79736, state: "TX", office: "Lieutenant Governor", raceType: "Democratic Primary", label: "Texas Lieutenant Governor Democratic Primary Runoff", archived: true },
  { id: 79739, state: "TX", office: "Railroad Commissioner", raceType: "Republican Primary", label: "Texas Railroad Commissioner Republican Primary Runoff", archived: true },
  { id: 79755, state: "TX", office: "US House 18", raceType: "Democratic Primary", label: "Texas US House 18 Democratic Primary Runoff", archived: true },
  // ── CALIFORNIA (JUNE 2) ──
  { id: 79777, state: "CA", office: "Governor", raceType: "Open Primary", label: "California Governor Open Primary", archived: true },
  { id: 79938, state: "CA", office: "Los Angeles Mayor", raceType: "Open Primary", label: "Los Angeles Mayor Open Primary", archived: true },
  { id: 79893, state: "CA", office: "US House 1", raceType: "Open Primary", label: "California US House 1 Open Primary", archived: true },
  { id: 79932, state: "CA", office: "US House 7", raceType: "Open Primary", label: "California US House 7 Open Primary", archived: true },
  { id: 79884, state: "CA", office: "US House 11", raceType: "Open Primary", label: "California US House 11 Open Primary", archived: true },
  { id: 79916, state: "CA", office: "US House 40", raceType: "Open Primary", label: "California US House 40 Open Primary", archived: true },
  { id: 79924, state: "CA", office: "US House 48", raceType: "Open Primary", label: "California US House 48 Open Primary", archived: true },
  // ── IOWA (JUNE 2 — ARCHIVED) ──
  { id: 79945, state: "IA", office: "Governor", raceType: "Republican Primary", label: "Iowa Governor Republican Primary", archived: true },
  { id: 80210, state: "IA", office: "US Senate", raceType: "Democratic Primary", label: "Iowa US Senate Democratic Primary", archived: true },
  { id: 80211, state: "IA", office: "US Senate", raceType: "Republican Primary", label: "Iowa US Senate Republican Primary", archived: true },
  { id: 80204, state: "IA", office: "US House 2", raceType: "Democratic Primary", label: "Iowa US House 2 Democratic Primary", archived: true },
  { id: 80205, state: "IA", office: "US House 2", raceType: "Republican Primary", label: "Iowa US House 2 Republican Primary", archived: true },
  // ── MONTANA (JUNE 2 — ARCHIVED) ──
  { id: 80458, state: "MT", office: "US Senate", raceType: "Democratic Primary", label: "Montana US Senate Democratic Primary", archived: true },
  { id: 80460, state: "MT", office: "US Senate", raceType: "Republican Primary", label: "Montana US Senate Republican Primary", archived: true },
  { id: 80452, state: "MT", office: "US House 1", raceType: "Democratic Primary", label: "Montana US House 1 Democratic Primary", archived: true },
  { id: 80454, state: "MT", office: "US House 1", raceType: "Republican Primary", label: "Montana US House 1 Republican Primary", archived: true },
  { id: 80455, state: "MT", office: "US House 2", raceType: "Democratic Primary", label: "Montana US House 2 Democratic Primary", archived: true },
  { id: 80457, state: "MT", office: "US House 2", raceType: "Republican Primary", label: "Montana US House 2 Republican Primary", archived: true },
  // ── NEW JERSEY (JUNE 2 — ARCHIVED) ──
  { id: 81057, state: "NJ", office: "US Senate", raceType: "Democratic Primary", label: "New Jersey US Senate Democratic Primary", archived: true },
  { id: 81058, state: "NJ", office: "US Senate", raceType: "Republican Primary", label: "New Jersey US Senate Republican Primary", archived: true },
  { id: 81046, state: "NJ", office: "US House 7", raceType: "Democratic Primary", label: "New Jersey US House 7 Democratic Primary", archived: true },
  { id: 81047, state: "NJ", office: "US House 7", raceType: "Republican Primary", label: "New Jersey US House 7 Republican Primary", archived: true },
  { id: 81048, state: "NJ", office: "US House 8", raceType: "Democratic Primary", label: "New Jersey US House 8 Democratic Primary", archived: true },
  { id: 81055, state: "NJ", office: "US House 12", raceType: "Democratic Primary", label: "New Jersey US House 12 Democratic Primary", archived: true },
  { id: 81056, state: "NJ", office: "US House 12", raceType: "Republican Primary", label: "New Jersey US House 12 Republican Primary", archived: true },
  // ── NEW MEXICO (JUNE 2 — ARCHIVED) ──
  { id: 81014, state: "NM", office: "US Senate", raceType: "Democratic Primary", label: "New Mexico US Senate Democratic Primary", archived: true },
  { id: 81015, state: "NM", office: "US Senate", raceType: "Republican Primary", label: "New Mexico US Senate Republican Primary", archived: true },
  // ── SOUTH DAKOTA (JUNE 2 — ARCHIVED) ──
  { id: 80461, state: "SD", office: "Governor", raceType: "Republican Primary", label: "South Dakota Governor Republican Primary", archived: true },
  { id: 80511, state: "SD", office: "US House At-Large", raceType: "Republican Primary", label: "South Dakota US House At-Large Republican Primary", archived: true },
  { id: 80512, state: "SD", office: "US Senate", raceType: "Republican Primary", label: "South Dakota US Senate Republican Primary", archived: true },
  // ── SOUTH CAROLINA (JUNE 9) ──
  { id: 82664, state: "SC", office: "US Senate", raceType: "Republican Primary", label: "South Carolina US Senate Republican Primary", archived: true },
  { id: 82596, state: "SC", office: "Governor", raceType: "Republican Primary", label: "South Carolina Governor Republican Primary", archived: true },
  { id: 82663, state: "SC", office: "US Senate", raceType: "Democratic Primary", label: "South Carolina US Senate Democratic Primary", archived: true },
  { id: 82595, state: "SC", office: "Governor", raceType: "Democratic Primary", label: "South Carolina Governor Democratic Primary", archived: true },
  { id: 82594, state: "SC", office: "Comptroller General", raceType: "Democratic Primary", label: "South Carolina Comptroller General Democratic Primary", archived: true },
  { id: 82597, state: "SC", office: "Secretary of State", raceType: "Democratic Primary", label: "South Carolina Secretary of State Democratic Primary", archived: true },
  { id: 82592, state: "SC", office: "Attorney General", raceType: "Republican Primary", label: "South Carolina Attorney General Republican Primary", archived: true },
  { id: 82654, state: "SC", office: "US House 1", raceType: "Democratic Primary", label: "South Carolina US House 1 Democratic Primary", archived: true },
  { id: 82655, state: "SC", office: "US House 1", raceType: "Republican Primary", label: "South Carolina US House 1 Republican Primary", archived: true },
  { id: 82657, state: "SC", office: "US House 2", raceType: "Republican Primary", label: "South Carolina US House 2 Republican Primary", archived: true },
  { id: 82662, state: "SC", office: "US House 6", raceType: "Republican Primary", label: "South Carolina US House 6 Republican Primary", archived: true },
  // ── MAINE (JUNE 9) ──
  { id: 83063, state: "ME", office: "US Senate", raceType: "Democratic Primary", label: "Maine US Senate Democratic Primary", archived: true },
  { id: 82693, state: "ME", office: "Governor", raceType: "Democratic Primary", label: "Maine Governor Democratic Primary", archived: true },
  { id: 82694, state: "ME", office: "Governor", raceType: "Republican Primary", label: "Maine Governor Republican Primary", archived: true },
  { id: 83061, state: "ME", office: "US House 2", raceType: "Democratic Primary", label: "Maine US House 2 Democratic Primary", archived: true },
  // ── NEVADA (JUNE 9) ──
  { id: 83111, state: "NV", office: "Governor", raceType: "Republican Primary", label: "Nevada Governor Republican Primary", archived: true },
  { id: 83110, state: "NV", office: "Governor", raceType: "Democratic Primary", label: "Nevada Governor Democratic Primary", archived: true },
  { id: 83081, state: "NV", office: "Attorney General", raceType: "Republican Primary", label: "Nevada Attorney General Republican Primary", archived: true },
  { id: 83080, state: "NV", office: "Attorney General", raceType: "Democratic Primary", label: "Nevada Attorney General Democratic Primary", archived: true },
  { id: 83112, state: "NV", office: "Lieutenant Governor", raceType: "Democratic Primary", label: "Nevada Lieutenant Governor Democratic Primary", archived: true },
  { id: 83113, state: "NV", office: "Secretary of State", raceType: "Republican Primary", label: "Nevada Secretary of State Republican Primary", archived: true },
  { id: 83150, state: "NV", office: "US House 1", raceType: "Republican Primary", label: "Nevada US House 1 Republican Primary", archived: true },
  { id: 83149, state: "NV", office: "US House 1", raceType: "Democratic Primary", label: "Nevada US House 1 Democratic Primary", archived: true },
  // ── NORTH DAKOTA (JUNE 9) ──
  { id: 82403, state: "ND", office: "US House At-Large", raceType: "Republican Primary", label: "North Dakota US House At-Large Republican Primary", archived: true },
  { id: 82384, state: "ND", office: "Public Service Commissioner", raceType: "Republican Primary", label: "North Dakota Public Service Commissioner Republican Primary", archived: true },
  // ── GEORGIA (JUNE 16 — ARCHIVED) ──
  { id: 83316, state: "GA", office: "US Senate", raceType: "Republican Primary Runoff", label: "Georgia US Senate Republican Primary Runoff", archived: true },
  { id: 83266, state: "GA", office: "Governor", raceType: "Republican Primary Runoff", label: "Georgia Governor Republican Primary Runoff", archived: true },
  { id: 83277, state: "GA", office: "Lieutenant Governor", raceType: "Republican Primary Runoff", label: "Georgia Lieutenant Governor Republican Primary Runoff", archived: true },
  { id: 83276, state: "GA", office: "Lieutenant Governor", raceType: "Democratic Primary Runoff", label: "Georgia Lieutenant Governor Democratic Primary Runoff", archived: true },
  { id: 83289, state: "GA", office: "Secretary of State", raceType: "Republican Primary Runoff", label: "Georgia Secretary of State Republican Primary Runoff", archived: true },
  { id: 83288, state: "GA", office: "Secretary of State", raceType: "Democratic Primary Runoff", label: "Georgia Secretary of State Democratic Primary Runoff", archived: true },
  { id: 83312, state: "GA", office: "US House 11", raceType: "Republican Primary Runoff", label: "Georgia US House 11 Republican Primary Runoff", archived: true },
  { id: 83313, state: "GA", office: "US House 12", raceType: "Democratic Primary Runoff", label: "Georgia US House 12 Democratic Primary Runoff", archived: true },
  { id: 83314, state: "GA", office: "US House 1", raceType: "Democratic Primary Runoff", label: "Georgia US House 1 Democratic Primary Runoff", archived: true },
  { id: 83315, state: "GA", office: "US House 7", raceType: "Democratic Primary Runoff", label: "Georgia US House 7 Democratic Primary Runoff", archived: true },
  // ── ALABAMA (JUNE 16 — ARCHIVED) ──
  { id: 83428, state: "AL", office: "US Senate", raceType: "Republican Primary Runoff", label: "Alabama US Senate Republican Primary Runoff", archived: true },
  { id: 83427, state: "AL", office: "US Senate", raceType: "Democratic Primary Runoff", label: "Alabama US Senate Democratic Primary Runoff", archived: true },
  { id: 83430, state: "AL", office: "Lieutenant Governor", raceType: "Republican Primary Runoff", label: "Alabama Lieutenant Governor Republican Primary Runoff", archived: true },
  { id: 83431, state: "AL", office: "Attorney General", raceType: "Republican Primary Runoff", label: "Alabama Attorney General Republican Primary Runoff", archived: true },
  // ── OKLAHOMA (JUNE 16 — ARCHIVED) ──
  { id: 83476, state: "OK", office: "State Question 832", raceType: "Ballot Measure", label: "Oklahoma State Question 832 — $15 Minimum Wage", archived: true },
  { id: 83424, state: "OK", office: "US Senate", raceType: "Republican Primary", label: "Oklahoma US Senate Republican Primary", archived: true },
  { id: 83423, state: "OK", office: "US Senate", raceType: "Democratic Primary", label: "Oklahoma US Senate Democratic Primary", archived: true },
  { id: 83344, state: "OK", office: "Governor", raceType: "Republican Primary", label: "Oklahoma Governor Republican Primary", archived: true },
  { id: 83343, state: "OK", office: "Governor", raceType: "Democratic Primary", label: "Oklahoma Governor Democratic Primary", archived: true },
  { id: 83415, state: "OK", office: "US House 1", raceType: "Republican Primary", label: "Oklahoma US House 1 Republican Primary", archived: true },
  // ── WASHINGTON DC (JUNE 16 — ARCHIVED) ──
  { id: 83478, state: "DC", office: "US House Delegate", raceType: "Democratic Primary", label: "DC US House Delegate Democratic Primary", archived: true },
  { id: 83479, state: "DC", office: "Mayor", raceType: "Democratic Primary", label: "DC Mayor Democratic Primary", archived: true },
  // ── SOUTH CAROLINA (JUNE 23 — runoffs from June 9) ──
  { id: 84103, state: "SC", office: "Agriculture Commissioner", raceType: "Republican Primary Runoff", label: "South Carolina Agriculture Commissioner Republican Runoff" },
  { id: 84104, state: "SC", office: "Attorney General", raceType: "Republican Primary Runoff", label: "South Carolina Attorney General Republican Runoff" },
  { id: 84105, state: "SC", office: "Governor", raceType: "Republican Primary Runoff", label: "South Carolina Governor Republican Runoff" },
  { id: 84106, state: "SC", office: "US House 1", raceType: "Republican Primary Runoff", label: "South Carolina US House 1 Republican Runoff" },
  { id: 84110, state: "SC", office: "US House 1", raceType: "Democratic Primary Runoff", label: "South Carolina US House 1 Democratic Runoff" },
  { id: 84111, state: "SC", office: "US House 2", raceType: "Democratic Primary Runoff", label: "South Carolina US House 2 Democratic Runoff" },
  // ── MARYLAND (JUNE 23) ──
  { id: 83700, state: "MD", office: "Governor", raceType: "Republican Primary", label: "Maryland Governor Republican Primary" },
  { id: 83920, state: "MD", office: "US House 3", raceType: "Democratic Primary", label: "Maryland US House 3 Democratic Primary" },
  { id: 83925, state: "MD", office: "US House 6", raceType: "Democratic Primary", label: "Maryland US House 6 Democratic Primary" },
  { id: 83926, state: "MD", office: "US House 6", raceType: "Republican Primary", label: "Maryland US House 6 Republican Primary" },
  // ── NEW YORK (JUNE 23) ──
  { id: 84040, state: "NY", office: "US House 10", raceType: "Democratic Primary", label: "New York US House 10 Democratic Primary" },
  { id: 84042, state: "NY", office: "US House 12", raceType: "Democratic Primary", label: "New York US House 12 Democratic Primary" },
  { id: 84043, state: "NY", office: "US House 13", raceType: "Democratic Primary", label: "New York US House 13 Democratic Primary" },
  { id: 84045, state: "NY", office: "US House 15", raceType: "Democratic Primary", label: "New York US House 15 Democratic Primary" },
  { id: 84117, state: "NY", office: "US House 17", raceType: "Democratic Primary", label: "New York US House 17 Democratic Primary" },
  // ── UTAH (JUNE 23) ──
  { id: 84100, state: "UT", office: "US House 1", raceType: "Democratic Primary", label: "Utah US House 1 Democratic Primary" },
  { id: 84101, state: "UT", office: "US House 2", raceType: "Republican Primary", label: "Utah US House 2 Republican Primary" },
  { id: 84102, state: "UT", office: "US House 3", raceType: "Republican Primary", label: "Utah US House 3 Republican Primary" },
];

async function fetchRaceById(id: number): Promise<RaceDetail> {
  const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Race fetch failed (${id}) ${res.status}`);
  return res.json();
}
async function fetchRaceMapBlankSvg(id: number): Promise<string | null> {
  const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}?generateMap`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.text();
}

function fmtPct(x?: number) { if (typeof x !== "number") return "—"; return `${x.toFixed(1)}%`; }
function getRaceReportingPct(race?: RaceDetail) { const v = race?.percent_reporting; return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null; }
/** Returns "RCV NEXT ROUND" for ranked-choice races, "RUNOFF NEEDED" otherwise. */
function rcvTerm(rule?: RaceRule | null) { return rule === "RANKED_CHOICE" ? "RCV NEXT ROUND" : "RUNOFF NEEDED"; }
function getRaceProjectionAlways(race?: RaceDetail): { leaderName: string; prob: number } | null {
  if (!race?.candidates?.length) return null;
  const reporting = typeof race.percent_reporting === "number" ? race.percent_reporting : 0;
  const officialWinner = race.candidates.find((c) => c.winner);
  if (officialWinner) return { leaderName: officialWinner.name, prob: 100 };
  const ordered = [...race.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  const leader = ordered[0], runnerUp = ordered[1];
  if (!leader || !runnerUp) return { leaderName: leader?.name ?? "—", prob: 50 };
  const prob = calculateWinProbability(leader.votes, runnerUp.votes, reporting);
  return { leaderName: leader.name, prob };
}
function prettyTime(iso?: string | null) { if (!iso) return "—"; return new Date(iso).toLocaleString(); }
function parseIsoDate(iso?: string | null): Date | null { if (!iso) return null; const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d; }
function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "CLOSED";
  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}
function formatLocalCloseTime(d: Date): string { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }

type RaceStatusInfo = { label: string; bg: string; border: string; };
function getRaceStatusInfo(nowMs: number, pollsOpenIso: string | null | undefined, pollsCloseIso: string | null | undefined, electionDateLabel: string): RaceStatusInfo {
  const closeDate = parseIsoDate(pollsCloseIso);
  if (closeDate && nowMs >= closeDate.getTime()) {
    return { label: "CLOSED", bg: "rgba(255,255,255,0.10)", border: "rgba(255,90,90,0.55)" };
  }
  let openDate = parseIsoDate(pollsOpenIso);
  if (!openDate && closeDate) {
    const d = new Date(closeDate);
    d.setHours(7, 0, 0, 0);
    openDate = d;
  }
  if (openDate && nowMs >= openDate.getTime()) {
    return { label: "POLLS OPEN", bg: "rgba(255,255,255,0.10)", border: "rgba(255,215,70,0.60)" };
  }
  let dateStr = electionDateLabel;
  if (closeDate) {
    const m = String(closeDate.getMonth() + 1).padStart(2, "0");
    const day = String(closeDate.getDate()).padStart(2, "0");
    const y = String(closeDate.getFullYear()).slice(2);
    dateStr = `${m}/${day}/${y}`;
  }
  return { label: `SCHEDULED · ${dateStr}`, bg: "rgba(255,255,255,0.10)", border: "rgba(255,255,255,0.28)" };
}
function normalizeRegionName(s: string) { return s.toLowerCase().replace(/[_-]+/g, " ").replace(/[''"]/g, "").replace(/\./g, "").replace(/\s+county$/i, "").replace(/\s+parish$/i, "").replace(/\s+borough$/i, "").replace(/\s+/g, " ").trim(); }
function titleCaseKey(key: string) { return key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "); }
function getRegionKeyFromElement(el: Element): string | null {
  const attrs = ["data-name", "data-county", "name", "aria-label", "id"];
  for (const a of attrs) { const v = el.getAttribute(a); if (v && v.trim()) return normalizeRegionName(v.trim()); }
  const title = el.querySelector?.("title")?.textContent?.trim();
  if (title) return normalizeRegionName(title);
  return null;
}
function coerceRegionResults(input: unknown): RegionResult[] { if (Array.isArray(input)) return input as RegionResult[]; if (input && typeof input === "object") return Object.values(input as Record<string, RegionResult>); return []; }

type TooltipLine = { name: string; party: string; votes: number | null; pct: number | null; winner: boolean; color?: string; };
type TooltipState = { show: boolean; x: number; y: number; title: string; reporting: string | null; reportingPct: number | null; lines: TooltipLine[]; };

function safeNum(x: unknown): number | null { if (typeof x === "number" && Number.isFinite(x)) return x; if (typeof x === "string") { const n = Number(x.replace(/,/g, "").trim()); return Number.isFinite(n) ? n : null; } return null; }
function safePct(x: unknown): number | null { if (typeof x === "number" && Number.isFinite(x)) return x; if (typeof x === "string") { const n = parseFloat(x.replace("%", "").trim()); return Number.isFinite(n) ? n : null; } return null; }
function getCandidatesFromRR(rr: any): RegionCandidate[] { const c1 = rr?.candidates, c2 = rr?.region?.candidates, c3 = rr?.data?.candidates; const found = (Array.isArray(c1) ? c1 : null) ?? (Array.isArray(c2) ? c2 : null) ?? (Array.isArray(c3) ? c3 : null); return (found ?? []) as RegionCandidate[]; }
function applyColorOverridesToRace<T extends RaceDetail | undefined>(race: T, raceId: number): T { const overrides = RACE_FORECAST_DEFAULTS[raceId]?.colorOverrides; if (!race || !overrides || !Object.keys(overrides).length) return race; const candidates = race.candidates?.map((c) => { const lower = c.name.toLowerCase(); for (const [key, color] of Object.entries(overrides)) { if (lower.includes(key.toLowerCase())) return { ...c, color }; } return c; }); return { ...race, candidates } as T; }
function buildTooltipLines(rr: any): TooltipLine[] { return [...getCandidatesFromRR(rr)].map((c) => ({ name: String(c?.name ?? ""), party: String(c?.party ?? ""), votes: safeNum(c?.votes), pct: safePct(c?.percent), winner: !!c?.winner, color: c?.color })).filter((x) => x.name).sort((a, b) => { const av = a.votes ?? -1, bv = b.votes ?? -1; if (bv !== av) return bv - av; return (b.pct ?? -1) - (a.pct ?? -1); }); }

type MarginBucket = "tilt" | "lean" | "likely" | "safe" | "tied";
function marginBucket(absMargin: number): MarginBucket { if (absMargin < 0.0001) return "tied"; if (absMargin < 2) return "tilt"; if (absMargin < 6) return "lean"; if (absMargin < 12) return "likely"; return "safe"; }
function toShaded(hex: string, bucket: MarginBucket) {
  let r = 0, g = 0, b = 0; const h = hex.replace("#", "");
  if (h.length === 3) { r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16); }
  else { r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16); }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, saturation = 0, lightness = (max + min) / 2;
  if (max !== min) { const d = max - min; saturation = lightness > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: hue = (g - b) / d + (g < b ? 6 : 0); break; case g: hue = (b - r) / d + 2; break; case b: hue = (r - g) / d + 4; break; } hue /= 6; }
  let l = 0.5;
  switch (bucket) { case "safe": l = 0.5; break; case "likely": l = 0.65; break; case "lean": l = 0.8; break; case "tilt": l = 0.95; break; case "tied": l = 1.0; break; }
  return `hsl(${hue * 360}, ${saturation * 100}%, ${l * 100}%)`;
}
function computeCountyMargin(rr: any): { leaderName: string | null; leaderColor: string | null; absMargin: number | null; bucket: MarginBucket | null } {
  const candidates = getCandidatesFromRR(rr);
  if (!candidates.length) return { leaderName: null, leaderColor: null, absMargin: null, bucket: null };
  const rows = candidates.map((c) => ({ name: c.name, color: typeof c?.color === "string" ? c.color : null, pct: safePct(c?.percent), votes: safeNum(c?.votes) })).filter((r) => r.color);
  if (!rows.length) return { leaderName: null, leaderColor: null, absMargin: null, bucket: null };
  const hasPct = rows.some((r) => typeof r.pct === "number");
  const metric = (r: any) => (hasPct ? (r.pct ?? -1) : (r.votes ?? -1));
  rows.sort((a, b) => metric(b) - metric(a));
  const leader = rows[0], runnerUp = rows[1];
  if (!runnerUp) return { leaderName: leader.name, leaderColor: leader.color, absMargin: 100, bucket: "safe" };
  const m = Math.abs(metric(leader) - metric(runnerUp));
  return { leaderName: leader.name, leaderColor: leader.color, absMargin: m, bucket: marginBucket(m) };
}
function countyFill(rr: any): string | null { const apiFill = rr?.region?.fill; if (typeof apiFill === "string" && apiFill.trim()) return apiFill; const { leaderColor, bucket } = computeCountyMargin(rr); if (!leaderColor || !bucket) return null; return toShaded(leaderColor, bucket); }
function countyFingerprint(rr: any): string { const candidates = getCandidatesFromRR(rr); if (!candidates.length) return ""; return candidates.map((c) => `${c.name}:${safeNum(c?.votes) ?? 0}`).sort().join("|"); }

// ─── OVERLAY ────────────────────────────────────────────────────────────────
function ProjectedWinnerOverlay({ show, candidate, prob, color, reporting, onDismiss }: { show: boolean; candidate: string; prob: number; color: string; reporting: number; onDismiss: () => void; }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onDismiss} />
      <div className="res-overlay-card relative w-[min(680px,92vw)] overflow-hidden">
        <div className="res-tri-stripe" />
        <div className="p-7 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="res-eyebrow" style={{ color: "var(--rep)" }}><span className="res-live-dot" style={{ background: "var(--rep)" }} />PROJECTION ALERT</div>
              <div className="res-overlay-title mt-3">Projected<br />Winner</div>
              <div className="res-overlay-name mt-2" style={{ color: color || "var(--purple-soft)" }}>{candidate}</div>
            </div>
            <button onClick={onDismiss} className="res-close-btn">CLOSE ✕</button>
          </div>
          <div className="mt-6">
            <div className="res-stat-row mb-2"><span className="res-stat-label">WIN CONFIDENCE</span><span className="res-stat-val" style={{ color: "var(--purple-soft)" }}>{prob.toFixed(1)}%</span></div>
            <div className="res-bar-track"><div className="res-bar-fill" style={{ width: `${Math.max(0, Math.min(100, prob))}%`, background: "linear-gradient(90deg, var(--purple), var(--purple2))", boxShadow: "0 0 20px rgba(124,58,237,0.5)" }} /></div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2">
            {[["STATUS", "PROJECTED"], ["CONFIDENCE", `${prob.toFixed(1)}%`], ["REPORTING", `${reporting.toFixed(1)}%`]].map(([label, val]) => (
              <div key={label} className="res-stat-block"><div className="res-stat-block-label">{label}</div><div className="res-stat-block-val">{val}</div></div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <div className="res-note">Click outside to dismiss</div>
            <button onClick={onDismiss} className="res-btn-primary">CONTINUE →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAP ────────────────────────────────────────────────────────────────────
function countyTotalVotes(rr: any): number {
  return getCandidatesFromRR(rr).reduce((sum, c) => sum + (safeNum(c?.votes) ?? 0), 0);
}

function MapWithCountyTooltip({ svgText, regionResults }: { svgText: string; regionResults: RegionResult[] | Record<string, RegionResult> }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ show: false, x: 0, y: 0, title: "", reporting: null, reportingPct: null, lines: [] });
  const countyFingerprintsRef = useRef<Map<string, string>>(new Map());
  const countyVoteTotalsRef = useRef<Map<string, number>>(new Map());

  // Zoom/pan state
  const transformRef = useRef({ scale: 1, x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, tx: 0, ty: 0 });
  const [scale, setScale] = useState(1);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const [tooltipLocked, setTooltipLocked] = useState(false);
  const tooltipLockedRef = useRef(false);
  const tooltipLockedShapeRef = useRef<SVGGraphicsElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleLock = useCallback(() => {
    lockedRef.current = !lockedRef.current;
    setLocked(lockedRef.current);
  }, []);

  const regionResultsArr = useMemo(() => coerceRegionResults(regionResults), [regionResults]);
  const regionMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const rr of regionResultsArr as any[]) { const k = normalizeRegionName(String(rr?.region?.name ?? rr?.name ?? "")); if (!k) continue; m.set(k, rr); }
    return m;
  }, [regionResultsArr]);
  // Ref so tooltip/hover handlers (attached once per svgText load) always see latest data
  const regionMapRef = useRef(regionMap);
  useEffect(() => { regionMapRef.current = regionMap; }, [regionMap]);

  const flashCounty = useCallback((shape: SVGGraphicsElement) => {
    shape.classList.remove("county-updated");
    void (shape as any).offsetWidth;
    shape.classList.add("county-updated");
    setTimeout(() => shape.classList.remove("county-updated"), 1200);
  }, []);

  const applyTransform = useCallback(() => {
    const host = wrapRef.current; if (!host) return;
    const svg = host.querySelector("svg"); if (!svg) return;
    const { scale, x, y } = transformRef.current;
    svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    svg.style.transformOrigin = "0 0";
  }, []);

  const resetZoom = useCallback(() => {
    transformRef.current = { scale: 1, x: 0, y: 0 };
    setScale(1);
    applyTransform();
  }, [applyTransform]);

  // Wheel zoom
  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    const onWheel = (e: WheelEvent) => {
      if (lockedRef.current) return; // locked — let scroll pass through
      e.preventDefault();
      const rect = host.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { scale: s, x, y } = transformRef.current;
      const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale = Math.min(8, Math.max(1, s * delta));
      const newX = mx - (mx - x) * (newScale / s);
      const newY = my - (my - y) * (newScale / s);
      transformRef.current = { scale: newScale, x: newX, y: newY };
      setScale(newScale);
      applyTransform();
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [applyTransform]);

  // Pan via pointer drag — works everywhere including county shapes
  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    let capturedId: number | null = null;
    const onDown = (e: PointerEvent) => {
      isPanningRef.current = false;
      capturedId = e.pointerId;
      panStartRef.current = { mx: e.clientX, my: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons === 0) return;
      const dx = e.clientX - panStartRef.current.mx;
      const dy = e.clientY - panStartRef.current.my;
      if (!isPanningRef.current && Math.sqrt(dx * dx + dy * dy) > 4) {
        isPanningRef.current = true;
        setTooltip((t) => ({ ...t, show: false }));
        if (capturedId !== null) { try { host.setPointerCapture(capturedId); } catch {} }
        host.style.cursor = "grabbing";
      }
      if (!isPanningRef.current) return;
      transformRef.current.x = panStartRef.current.tx + dx;
      transformRef.current.y = panStartRef.current.ty + dy;
      applyTransform();
    };
    const onUp = () => {
      isPanningRef.current = false;
      capturedId = null;
      host.style.cursor = "crosshair";
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    return () => { host.removeEventListener("pointerdown", onDown); host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerup", onUp); };
  }, [applyTransform]);

  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    host.innerHTML = svgText;
    const svg = host.querySelector("svg"); if (!svg) return;
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";
    svg.style.transformOrigin = "0 0";
    countyFingerprintsRef.current = new Map();
    applyTransform(); // restore zoom/pan if switching back to a previously zoomed map
    // Dismiss locked tooltip when touching outside a county
    const onHostTouchDown = (ev: PointerEvent) => {
      if (ev.pointerType !== "touch") return;
      const target = ev.target as Element;
      if (target.closest("path") || target.closest("polygon")) return;
      if (tooltipLockedRef.current) {
        tooltipLockedRef.current = false; setTooltipLocked(false);
        if (tooltipLockedShapeRef.current) { tooltipLockedShapeRef.current.style.stroke = "#0a0f1e"; tooltipLockedShapeRef.current.style.strokeWidth = "0.8"; tooltipLockedShapeRef.current.style.filter = ""; tooltipLockedShapeRef.current = null; }
        setTooltip((t) => ({ ...t, show: false }));
      }
    };
    host.addEventListener("pointerdown", onHostTouchDown);
    const shapes = Array.from(svg.querySelectorAll("path, polygon")) as SVGGraphicsElement[];
    shapes.forEach((shape) => {
      const key = getRegionKeyFromElement(shape); if (!key) return;
      const prettyKey = titleCaseKey(key);
      shape.style.pointerEvents = "all"; shape.style.cursor = "crosshair";
      shape.style.stroke = "#0a0f1e"; shape.style.strokeWidth = "0.8";
      shape.style.transition = "fill 420ms ease, filter 300ms ease, stroke 200ms ease, stroke-width 200ms ease";

      const onMove = (ev: PointerEvent) => {
        if (isPanningRef.current) return; // dragging — no tooltip
        const currentRR = regionMapRef.current.get(key);
        const tw = 252, th = 260, p = 12, offset = 14;
        const rect = host.getBoundingClientRect();
        const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
        let x = px + offset, y = py + offset;
        if (x + tw > rect.width - p) x = px - tw - offset;
        if (y + th > rect.height - p) y = py - th - offset;
        x = Math.max(p, Math.min(rect.width - tw - p, x)); y = Math.max(p, Math.min(rect.height - th - p, y));
        const pct = typeof currentRR?.region?.percent_reporting === "number" ? currentRR.region.percent_reporting : typeof currentRR?.percent_reporting === "number" ? currentRR.percent_reporting : null;
        const lines = currentRR ? buildTooltipLines(currentRR) : [];
        const hasVotes = lines.some((l) => l.votes !== null && l.votes > 0);
        setTooltip({
          show: true, x, y,
          title: currentRR?.region?.name ?? (currentRR?.name ? titleCaseKey(currentRR.name) : prettyKey),
          reporting: pct !== null ? `${pct.toFixed(1)}% REPORTING` : "0% REPORTING",
          reportingPct: pct ?? 0,
          lines: hasVotes ? lines : [],
        });
      };
      const onEnter = (ev: PointerEvent) => {
        if (isPanningRef.current) return;
        if (ev.pointerType === "touch") return; // touch handled by tap
        shape.style.stroke = "rgba(255,255,255,0.9)"; shape.style.strokeWidth = "2.0"; shape.style.filter = "brightness(1.22) saturate(1.1)";
        onMove(ev);
      };
      const onLeave = (ev: PointerEvent) => {
        if (ev.pointerType === "touch") return; // touch handled by tap
        if (tooltipLockedRef.current) return;
        shape.style.stroke = "#0a0f1e"; shape.style.strokeWidth = "0.8"; shape.style.filter = "";
        setTooltip((t) => ({ ...t, show: false }));
      };
      const onTouchUp = (ev: PointerEvent) => {
        if (ev.pointerType !== "touch") return;
        if (isPanningRef.current) return;
        if (tooltipLockedRef.current && tooltipLockedShapeRef.current === shape) {
          // Tap same county — dismiss
          tooltipLockedRef.current = false; setTooltipLocked(false);
          tooltipLockedShapeRef.current = null;
          setTooltip((t) => ({ ...t, show: false }));
          shape.style.stroke = "#0a0f1e"; shape.style.strokeWidth = "0.8"; shape.style.filter = "";
        } else {
          // Tap new county — lock
          if (tooltipLockedShapeRef.current) {
            tooltipLockedShapeRef.current.style.stroke = "#0a0f1e";
            tooltipLockedShapeRef.current.style.strokeWidth = "0.8";
            tooltipLockedShapeRef.current.style.filter = "";
          }
          tooltipLockedRef.current = true; setTooltipLocked(true);
          tooltipLockedShapeRef.current = shape;
          const currentRR = regionMapRef.current.get(key);
          const tw = 252, th = 260, p = 12, offset = 14;
          const rect = host.getBoundingClientRect();
          const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
          let x = px + offset, y = py + offset;
          if (x + tw > rect.width - p) x = px - tw - offset;
          if (y + th > rect.height - p) y = py - th - offset;
          x = Math.max(p, Math.min(rect.width - tw - p, x)); y = Math.max(p, Math.min(rect.height - th - p, y));
          const pct = typeof currentRR?.region?.percent_reporting === "number" ? currentRR.region.percent_reporting : typeof currentRR?.percent_reporting === "number" ? currentRR.percent_reporting : null;
          const lines = currentRR ? buildTooltipLines(currentRR) : [];
          const hasVotes = lines.some((l) => l.votes !== null && l.votes > 0);
          setTooltip({ show: true, x, y, title: currentRR?.region?.name ?? (currentRR?.name ? titleCaseKey(currentRR.name) : prettyKey), reporting: pct !== null ? `${pct.toFixed(1)}% REPORTING` : "0% REPORTING", reportingPct: pct ?? 0, lines: hasVotes ? lines : [] });
          shape.style.stroke = "rgba(255,255,255,0.9)"; shape.style.strokeWidth = "2.0"; shape.style.filter = "brightness(1.22) saturate(1.1)";
        }
      };
      shape.addEventListener("pointerenter", onEnter); shape.addEventListener("pointermove", onMove); shape.addEventListener("pointerleave", onLeave); shape.addEventListener("pointerup", onTouchUp);

      const currentRR = regionMap.get(key);
      const fill = currentRR ? countyFill(currentRR) : null;
      shape.style.opacity = "0";
      requestAnimationFrame(() => {
        shape.style.fill = fill || "rgba(15,16,32,0.05)"; shape.style.opacity = "1";
        if (currentRR) {
          const fp = countyFingerprint(currentRR);
          const prevFp = countyFingerprintsRef.current.get(key);
          if (prevFp === undefined) { shape.classList.add("county-pop"); setTimeout(() => shape.classList.remove("county-pop"), 520); }
          countyFingerprintsRef.current.set(key, fp);
          countyVoteTotalsRef.current.set(key, countyTotalVotes(currentRR));
        }
      });
    });
  }, [svgText]); // eslint-disable-line — regionMap updates handled by the effect below

  useEffect(() => {
    const host = wrapRef.current; if (!host) return;
    const svg = host.querySelector("svg"); if (!svg) return;
    const shapes = Array.from(svg.querySelectorAll("path, polygon")) as SVGGraphicsElement[];
    shapes.forEach((shape) => {
      const key = getRegionKeyFromElement(shape); if (!key) return;
      const currentRR = regionMap.get(key); if (!currentRR) return;
      const fill = countyFill(currentRR); if (fill) shape.style.fill = fill;
      const fp = countyFingerprint(currentRR);
      const prevFp = countyFingerprintsRef.current.get(key);
      const newTotal = countyTotalVotes(currentRR);
      const prevTotal = countyVoteTotalsRef.current.get(key) ?? 0;
      const votesGrew = newTotal > prevTotal;
      if (prevFp !== undefined && fp !== prevFp) {
        if (votesGrew) { flashCounty(shape); } else { shape.classList.add("county-pop"); setTimeout(() => shape.classList.remove("county-pop"), 520); }
      }
      countyFingerprintsRef.current.set(key, fp);
      countyVoteTotalsRef.current.set(key, newTotal);
    });
  }, [regionMap, flashCounty]);

  return (
    <div className="relative h-full" style={{ overflow: "hidden" }}>
      <div ref={wrapRef} className="w-full h-full [&_svg]:w-full [&_svg]:h-full" style={{ display: "flex", alignItems: "stretch", cursor: "crosshair" }} />
      {/* Zoom controls */}
      <div style={{ position: "absolute", bottom: 10, right: 10, display: "flex", flexDirection: "column", gap: 4, zIndex: 40 }}>
        <button onClick={toggleLock} title={locked ? "Unlock zoom" : "Lock zoom"} style={{ width: 28, height: 28, background: locked ? "rgba(245,158,11,0.15)" : "var(--panel)", border: `1px solid ${locked ? "#f59e0b" : "var(--border2)"}`, color: locked ? "#f59e0b" : "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "5px" }}>
          {locked
            ? <svg height="12" strokeLinejoin="round" viewBox="0 0 16 16" width="12" style={{color:"currentColor", display:"block"}}><path fillRule="evenodd" clipRule="evenodd" d="M9.5 6V7H6.5V6C6.5 5.17157 7.17157 4.5 8 4.5C8.82843 4.5 9.5 5.17157 9.5 6ZM5 7V6C5 4.34315 6.34315 3 8 3C9.65685 3 11 4.34315 11 6V7H12V11.5C12 12.3284 11.3284 13 10.5 13H5.5C4.67157 13 4 12.3284 4 11.5V7H5Z" fill="currentColor"/></svg>
            : <svg height="12" strokeLinejoin="round" viewBox="0 0 16 16" width="12" style={{color:"currentColor", display:"block"}}><path fillRule="evenodd" clipRule="evenodd" d="M13.5 7V6C13.5 5.17157 12.8284 4.5 12 4.5C11.1716 4.5 10.5 5.17157 10.5 6V7H12V8.5V9V11.5C12 12.3284 11.3284 13 10.5 13H5.5C4.67157 13 4 12.3284 4 11.5V7H9V6C9 4.34315 10.3431 3 12 3C13.6569 3 15 4.34315 15 6V7H13.5Z" fill="currentColor"/></svg>
          }
        </button>
        {!locked && <button onClick={() => { const host = wrapRef.current; if (!host) return; const rect = host.getBoundingClientRect(); const cx = rect.width / 2, cy = rect.height / 2; const { scale: s, x, y } = transformRef.current; const ns = Math.min(8, s * 1.4); transformRef.current = { scale: ns, x: cx - (cx - x) * (ns / s), y: cy - (cy - y) * (ns / s) }; setScale(ns); applyTransform(); }} style={{ width: 28, height: 28, background: "var(--panel)", border: "1px solid var(--border2)", color: "var(--foreground)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", fontWeight: 700 }}>+</button>}
        {!locked && <button onClick={() => { const host = wrapRef.current; if (!host) return; const rect = host.getBoundingClientRect(); const cx = rect.width / 2, cy = rect.height / 2; const { scale: s, x, y } = transformRef.current; const ns = Math.max(1, s / 1.4); if (ns <= 1) { resetZoom(); return; } transformRef.current = { scale: ns, x: cx - (cx - x) * (ns / s), y: cy - (cy - y) * (ns / s) }; setScale(ns); applyTransform(); }} style={{ width: 28, height: 28, background: "var(--panel)", border: "1px solid var(--border2)", color: "var(--foreground)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", fontWeight: 700 }}>−</button>}
        {!locked && scale > 1 && <button onClick={resetZoom} style={{ width: 28, height: 28, background: "var(--panel)", border: "1px solid var(--border2)", color: "var(--muted)", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-body)", fontWeight: 700, letterSpacing: "0.05em" }}>RST</button>}
      </div>
      {tooltip.show && (
        <div
          className="res-map-tooltip absolute z-50 w-[252px]"
          style={{ left: tooltip.x, top: tooltip.y, pointerEvents: tooltipLocked ? "auto" : "none", userSelect: "none" }}
          onPointerDown={() => {
            if (!tooltipLockedRef.current) return;
            longPressTimerRef.current = setTimeout(() => {
              tooltipLockedRef.current = false; setTooltipLocked(false);
              if (tooltipLockedShapeRef.current) { tooltipLockedShapeRef.current.style.stroke = "#0a0f1e"; tooltipLockedShapeRef.current.style.strokeWidth = "0.8"; tooltipLockedShapeRef.current.style.filter = ""; tooltipLockedShapeRef.current = null; }
              setTooltip((t) => ({ ...t, show: false }));
            }, 600);
          }}
          onPointerUp={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }}
          onPointerLeave={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }}
        >
          <div className="p-2">
            <div className="flex items-baseline justify-between mb-1">
              <div className="res-tooltip-title">{tooltip.title}</div>
            </div>
            <div className="res-reporting-row"><span className="res-note">{tooltip.reporting}</span></div>
            <div className="res-bar-track mt-1" style={{ height: "2px" }}><div className="res-bar-fill" style={{ width: `${tooltip.reportingPct}%`, background: "var(--purple)", height: "2px" }} /></div>
            <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
              {tooltip.lines.length > 0 ? (
                <>
                  <div className="grid grid-cols-[1fr_36px_30px] gap-0.5 pb-1 mb-1 border-b" style={{ borderColor: "var(--border)" }}>
                    {["CANDIDATE", "VOTES", "PCT"].map((h) => (<div key={h} className={`res-th ${h !== "CANDIDATE" ? "text-right" : ""}`}>{h}</div>))}
                  </div>
                  {(() => {
                    const top5 = tooltip.lines.slice(0, 5);
                    const rest = tooltip.lines.slice(5);
                    const othersVotes = rest.reduce((s, c) => s + (c.votes ?? 0), 0);
                    const othersPct = rest.reduce((s, c) => s + (c.pct ?? 0), 0);
                    return (
                      <>
                        {top5.map((c, i) => (
                          <div key={i} className="grid grid-cols-[1fr_36px_30px] items-center gap-0.5 py-0.5 border-b" style={{ borderColor: "var(--border)" }}>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: c.color || "rgba(15,16,32,0.50)" }} />
                              <div className="min-w-0"><div className="res-cand-name truncate">{c.name}{c.winner ? " ✓" : ""}</div><div className="res-cand-party">{c.party}</div></div>
                            </div>
                            <div className="text-right res-num">{c.votes?.toLocaleString() ?? "—"}</div>
                            <div className="text-right res-pct-big">{c.pct !== null ? `${c.pct.toFixed(1)}%` : "—"}</div>
                          </div>
                        ))}
                        {rest.length > 0 && (
                          <div className="grid grid-cols-[1fr_36px_30px] items-center gap-0.5 py-0.5" style={{ opacity: 0.55 }}>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: "var(--muted2)" }} />
                              <div className="res-cand-name truncate">Others ({rest.length})</div>
                            </div>
                            <div className="text-right res-num">{othersVotes > 0 ? othersVotes.toLocaleString() : "—"}</div>
                            <div className="text-right res-pct-big">{othersPct > 0 ? `${othersPct.toFixed(1)}%` : "—"}</div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="py-5 flex flex-col items-center gap-2">
                  <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="var(--muted2)" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="8.5" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="11" r="0.8" fill="var(--muted)" /></svg>
                  </div>
                  <div className="res-note" style={{ letterSpacing: "0.18em" }}>NO RESULTS YET</div>
                  {(tooltip.reportingPct ?? 0) === 0 && <div className="res-note">AWAITING FIRST RETURNS</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CANDIDATE LIST ──────────────────────────────────────────────────────────
function CandidateList({ candidates, reporting, raceId, isMajorityRunoff, calledNames, isTopTwo }: { candidates: RaceCandidate[]; reporting: number; raceId?: number; isMajorityRunoff?: boolean; calledNames?: string[]; isTopTwo?: boolean }) {
  const defaults = raceId ? RACE_FORECAST_DEFAULTS[raceId] : undefined;
  const ordered = useMemo(() => {
    // Pre-election: use poll avg order. Once votes are coming in, sort purely by live vote share.
    if (reporting > 0) return [...candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
    return sortCandidatesByPollData(candidates, defaults?.pollAvg);
  }, [candidates, defaults?.pollAvg, reporting]);

  // Top 5 + "Other Candidates" rollup for jungle primaries
  const TOP_N = 5;
  const topCandidates = ordered.slice(0, TOP_N);
  const restCandidates = ordered.slice(TOP_N);
  const otherVotes = restCandidates.reduce((sum, c) => sum + (c.votes ?? 0), 0);
  const otherPercent = restCandidates.reduce((sum, c) => sum + (c.percent ?? 0), 0);
  const showOthers = restCandidates.length > 0;

  return (
    <div className="space-y-2">
      <div className="res-candidate-list">
        {topCandidates.map((c, idx) => {
          const isLeading = idx === 0 && !c.winner && !calledNames?.some(n => c.name.toLowerCase().includes(n.toLowerCase())) && reporting > 0;
          const isForecastCalled = !c.winner && !!calledNames?.some(n => c.name.toLowerCase().includes(n.toLowerCase()));
          const isRunoffAdvancing = isForecastCalled && !c.winner;
          return (
            <div key={`${c.name}-${c.party}`} className="res-candidate-row">
              <div className="res-cand-bar" style={{ background: c.color || "rgba(255,255,255,0.2)" }} />
              <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
              <span className="res-cand-dot" style={{ background: c.color || "rgba(15,16,32,0.50)", boxShadow: `0 0 10px ${c.color || "rgba(255,255,255,0.2)"}40` }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="res-cand-name-lg">{c.name}</span>
                      {(c.winner || isForecastCalled) && (
                        <svg viewBox="0 0 10 10" width="10" height="10" style={{ flexShrink: 0 }}><circle cx="5" cy="5" r="5" fill="#22c55e" /><path d="M2.5 5l2 2L7.5 3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                      )}
                      {c.winner && !isMajorityRunoff && <span className="res-badge res-badge-win" style={{ fontSize: "8px", padding: "2px 6px" }}>WINNER</span>}
                      {c.winner && isMajorityRunoff && <span className="res-badge" style={{ borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", color: "#f59e0b", fontSize: "8px", padding: "2px 6px" }}>ADVANCING</span>}
                      {isRunoffAdvancing && isTopTwo && <span className="res-badge res-badge-win" style={{ fontSize: "8px", padding: "2px 6px" }}>WINNER</span>}
                      {isRunoffAdvancing && !isTopTwo && <span className="res-badge" style={{ borderColor: "rgba(245,158,11,0.4)", background: "rgba(245,158,11,0.08)", color: "#f59e0b", fontSize: "8px", padding: "2px 6px" }}>ADVANCING</span>}
                      {isLeading && <span className="res-badge res-badge-purple" style={{ fontSize: "8px", padding: "2px 6px" }}>LEADING</span>}
                    </div>
                    <div className="res-cand-party">{c.party} · {c.votes.toLocaleString()} votes</div>
                  </div>
                </div>
                <div className="res-pct-topline shrink-0">{fmtPct(c.percent)}</div>
              </div>
            </div>
          );
        })}
        {showOthers && (
          <div className="res-candidate-row" style={{ opacity: 0.65 }}>
            <div className="res-cand-bar" style={{ background: "var(--muted2)" }} />
            <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="res-cand-dot" style={{ background: "var(--muted2)" }} />
                <div className="min-w-0">
                  <div className="res-cand-name-lg">Other Candidates</div>
                  <div className="res-cand-party">{restCandidates.length} candidates · {otherVotes.toLocaleString()} votes</div>
                </div>
              </div>
              <div className="res-pct-topline shrink-0">{fmtPct(otherPercent)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COUNTY TABLE ────────────────────────────────────────────────────────────
function CountyTotalsTable({ regionResults, collapsed, onToggle, maxHeight }: { regionResults: RegionResult[] | Record<string, RegionResult>; collapsed: boolean; onToggle: () => void; maxHeight?: string }) {
  const [expandedRows, setExpandedRows] = React.useState<Set<number>>(new Set());
  const toggleRow = (i: number) => setExpandedRows(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const data = useMemo(() => {
    return coerceRegionResults(regionResults).map((rr) => {
      const candidates = buildTooltipLines(rr);
      const { absMargin } = computeCountyMargin(rr);
      const rawName = (rr as any)?.region?.name || (rr as any)?.name || "Unknown";
      return { name: titleCaseKey(rawName), reporting: rr?.region?.percent_reporting ?? (rr as any)?.percent_reporting ?? 0, candidates, margin: absMargin };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [regionResults]);

  const reportedCount = data.filter(d => d.reporting > 0).length;

  return (
    <div className="res-panel" style={{ overflow: "hidden" }}>
      {/* Clickable header with toggle */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "var(--panel)",
          border: "none",
          borderBottom: collapsed ? "none" : "1px solid var(--border)",
          cursor: "pointer",
          transition: "background 140ms ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="res-panel-tag">COUNTY BREAKDOWN</span>
          {data.length > 0 && (
            <span className="res-badge">
              {reportedCount}/{data.length} REPORTING
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="res-note">
            {collapsed ? "SHOW TABLE" : "HIDE TABLE"}
          </span>
          {/* Chevron icon */}
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{
              transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
              transition: "transform 240ms cubic-bezier(0.22,1,0.36,1)",
              flexShrink: 0,
            }}
          >
            <path d="M2 4L6 8L10 4" stroke="var(--muted2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Collapsible content */}
      <div style={{
        overflow: collapsed ? "hidden" : "auto",
        maxHeight: collapsed ? "0px" : (maxHeight ?? "340px"),
        transition: "max-height 400ms cubic-bezier(0.22,1,0.36,1)",
      }}>
        {data.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center" }}>
            <span className="res-note">NO COUNTY DATA</span>
          </div>
        ) : (
          <div style={{ overflowY: "auto" }}>
            <table className="w-full border-collapse">
              <thead className="res-thead">
                <tr>{["COUNTY / RPT", "CANDIDATES", "MARGIN"].map((h, i) => (<th key={h} className={`res-th px-4 py-2.5 ${i === 2 ? "text-right" : "text-left"}`}>{h}</th>))}</tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="res-table-row">
                    <td className="px-4 py-3 align-top" style={{ width: "160px" }}>
                      <div className="res-cand-name-lg">{row.name}</div>
                      <div className="res-bar-track mt-2" style={{ width: "80px", height: "2px" }}><div className="res-bar-fill" style={{ width: `${row.reporting}%`, background: "var(--purple)", height: "2px" }} /></div>
                      <div className="res-note mt-1">{row.reporting.toFixed(1)}% RPT</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.candidates.length > 0 ? (() => {
                        const isExp = expandedRows.has(i);
                        const visible = isExp ? row.candidates.slice(0, 5) : row.candidates.slice(0, 2);
                        const rest = isExp ? row.candidates.slice(5) : row.candidates.slice(2);
                        const othersVotes = rest.reduce((s, c) => s + (c.votes ?? 0), 0);
                        const othersPct = rest.reduce((s, c) => s + (c.pct ?? 0), 0);
                        return (
                          <div className="grid grid-cols-1 gap-1">
                            {visible.map((cand, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 py-1 border-b" style={{ borderColor: "var(--border)" }}>
                                <div className="flex items-center gap-2 min-w-0"><span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: cand.color || "var(--muted2)" }} /><span className="res-cand-name truncate">{cand.name}</span></div>
                                <span className="res-cand-name shrink-0" style={{ fontWeight: 700 }}>{cand.pct !== null ? `${cand.pct.toFixed(1)}%` : "—"}</span>
                              </div>
                            ))}
                            {(isExp && rest.length > 0) && (
                              <div className="flex items-center justify-between gap-2 py-1" style={{ opacity: 0.5 }}>
                                <div className="flex items-center gap-2 min-w-0"><span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: "var(--muted2)" }} /><span className="res-note truncate">Others ({rest.length})</span></div>
                                <span className="res-cand-name shrink-0">{othersPct > 0 ? `${othersPct.toFixed(1)}%` : othersVotes > 0 ? othersVotes.toLocaleString() : "—"}</span>
                              </div>
                            )}
                            {row.candidates.length > 2 && (
                              <button onClick={() => toggleRow(i)} style={{ marginTop: 2, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                                <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 500, letterSpacing: "0.08em", color: "var(--muted2)", textTransform: "uppercase" }}>{isExp ? "▲ less" : `▼ +${row.candidates.length - 2} more`}</span>
                              </button>
                            )}
                          </div>
                        );
                      })() : <span className="res-note italic">Awaiting…</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      {row.margin !== null ? (<><div className="res-pct-xl">{row.margin >= 0 ? "+" : ""}{row.margin.toFixed(1)}%</div><div className="res-note">SPREAD</div></>) : <span className="res-note">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LEGEND ──────────────────────────────────────────────────────────────────
function Legend() {
  const stops: Array<[string, string]> = [["TIED", "#888"], ["TILT", "#aaa"], ["LEAN", "#bbb"], ["LIKELY", "#ccc"], ["SAFE", "#ddd"]];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="res-note mr-1">SHADE</span>
      {stops.map(([label]) => (<span key={label} className="res-badge">{label}</span>))}
    </div>
  );
}

// ─── SWING-O-METER ────────────────────────────────────────────────────────────
function SwingOMeter({ candidates, colors, probabilities, raceRule, reportingPct, candidateCount }: {
  candidates: [string, string, string, string]; colors: [string, string, string, string];
  probabilities: { c1: number; c2: number; c3: number; runoffNeeded?: number }; raceRule: RaceRule; reportingPct: number; candidateCount: number;
}) {
  const W = 280, H = 160, CX = W / 2, CY = H - 20;
  const R_OUTER = 110, R_INNER = 68;

  const count = Math.max(1, Math.min(3, candidateCount));
  const othersProb = Math.max(0, 1 - probabilities.c1 - probabilities.c2 - probabilities.c3);
  const showC2 = count >= 2;
  const showC3 = probabilities.c3 > 0.01;
  const showOthers = othersProb > 0.01;

  const segments = (raceRule !== "PLURALITY" && raceRule !== "TOP_TWO")
    ? (() => {
        const major = [
          { key: "c1", prob: Math.max(0, probabilities.c1), color: colors[0], name: candidates[0] },
          { key: "c2", prob: Math.max(0, probabilities.c2), color: colors[1], name: candidates[1] },
          { key: "c3", prob: Math.max(0, probabilities.c3), color: colors[2], name: candidates[2] },
        ].sort((a, b) => b.prob - a.prob);

        const topA = major[0];
        const topB = major[1] ?? { key: "c2", prob: 0, color: colors[1], name: candidates[1] };
        const runoffProb = Math.max(
          0,
          Math.min(
            1,
            typeof probabilities.runoffNeeded === "number"
              ? probabilities.runoffNeeded
              : 1 - (probabilities.c1 + probabilities.c2 + probabilities.c3),
          ),
        );

        return [
          { key: topA.key, prob: topA.prob, color: topA.color, name: topA.name },
          { key: topB.key, prob: topB.prob, color: topB.color, name: topB.name },
          { key: "others", prob: runoffProb, color: "#c0392b", name: "RUNOFF" },
        ];
      })()
    : [
        { key: "c1", prob: probabilities.c1, color: colors[0], name: candidates[0] },
        ...(showC2 ? [{ key: "c2", prob: probabilities.c2, color: colors[1], name: candidates[1] }] : []),
        ...(showC3 ? [{ key: "c3", prob: probabilities.c3, color: colors[2], name: candidates[2] }] : []),
        ...(showOthers ? [{ key: "others", prob: othersProb, color: colors[3], name: "Others" }] : []),
      ];

  const total = segments.reduce((s, seg) => s + seg.prob, 0) || 1;

  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg - 180) * (Math.PI / 180);
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }
  function describeArc(startDeg: number, endDeg: number, rOuter: number, rInner: number) {
    const s = polarToXY(startDeg, rOuter), e = polarToXY(endDeg, rOuter);
    const si = polarToXY(endDeg, rInner), ei = polarToXY(startDeg, rInner);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${e.x} ${e.y} L ${si.x} ${si.y} A ${rInner} ${rInner} 0 ${large} 0 ${ei.x} ${ei.y} Z`;
  }

  let cursor = 0;
  const arcSegments = segments.map((seg) => {
    const span = (seg.prob / total) * 180;
    const start = cursor;
    const end = cursor + span;
    cursor = end;
    const midDeg = start + span / 2;
    const midPt = polarToXY(midDeg, (R_OUTER + R_INNER) / 2);
    return { ...seg, start, end, midPt };
  });

  const leader = segments.reduce((a, b) => (b.prob > a.prob ? b : a), segments[0]);

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        {/* Track */}
        <path d={describeArc(0, 180, R_OUTER, R_INNER)} style={{ fill: "var(--border)" }} />
        {/* Colored segments — no inline labels */}
        {arcSegments.map((seg) => (
          <path key={seg.key} d={describeArc(seg.start + 0.8, seg.end - 0.8, R_OUTER, R_INNER)} fill={seg.color} />
        ))}
        {/* Center: leader name above, probability below */}
        <text x={CX} y={CY - 14} textAnchor="middle" fontSize="22" fontWeight="900" fontFamily="var(--font-numeric)" letterSpacing="-0.5" style={{ fill: leader.color }}>
          {(leader.prob * 100).toFixed(1)}%
        </text>
        <text x={CX} y={CY} textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="var(--font-body)" letterSpacing="1.5" style={{ fill: "var(--muted)" }}>
          {leader.name.split(" ").pop()?.toUpperCase()}
        </text>
      </svg>
      {/* Legend rows — one per candidate */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 2 }}>
        {arcSegments.map((seg) => (
          <div key={seg.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--foreground2)", flex: 1 }}>{seg.name.split(" ").pop()}</span>
            <span style={{ fontFamily: "var(--font-numeric)", fontSize: "12px", fontWeight: 800, color: seg.color }}>{(seg.prob * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      {/* Reporting bar */}
      <div style={{ marginTop: 12, padding: "8px 0 0", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted2)" }}>REPORTING</span>
          <span style={{ fontFamily: "var(--font-numeric)", fontSize: "11px", fontWeight: 800, color: "var(--muted)" }}>{reportingPct > 99 ? ">99" : reportingPct.toFixed(1)}%</span>
        </div>
        <div style={{ height: 3, background: "var(--border2)", overflow: "hidden", borderRadius: 99 }}>
          <div style={{ height: "100%", width: `${reportingPct}%`, background: "var(--muted)", transition: "width 800ms ease", borderRadius: 99 }} />
        </div>
      </div>
    </div>
  );
}

// ─── FORECAST PANEL TYPES ────────────────────────────────────────────────────
interface ForecastCivicCandidate { name: string; party: string; color: string; votes: number; percent: number; winner: boolean; }
interface ForecastHistoryTimestamp { timestamp: string; }
interface ForecastHistoryList { id: number; count: number; timestamps: ForecastHistoryTimestamp[]; }
interface ForecastResponse { forecast: ForecastOutput; race: { election_name: string; election_date: string; percent_reporting: number; candidates: ForecastCivicCandidate[]; }; }
const FORECAST_CANDIDATE_KEYS = ["Candidate1", "Candidate2", "Candidate3", "Others"] as const;
type FCKey = (typeof FORECAST_CANDIDATE_KEYS)[number];
function fcastPct(n: number, decimals = 1) { return (n * 100).toFixed(decimals) + "%"; }
function fcastFmt(n: number) { return n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function fcastShortDate(ts: string) { return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function getTimestamps(hl: ForecastHistoryList | null): ForecastHistoryTimestamp[] { return hl?.timestamps ?? []; }
function getEffectiveForecastCandidateCount(
  raceCandidates?: Array<{ name?: string | null; major_candidate?: boolean }> | null,
  forecastCandidateNames?: string[] | null,
): number {
  const fromRace = (raceCandidates ?? []).filter((c) => {
    const name = String(c?.name ?? "").trim();
    if (!name) return false;
    if (/^(others?|write[\s-]?in)$/i.test(name)) return false;
    return true;
  }).length;
  if (fromRace > 0) return Math.max(1, Math.min(3, fromRace));

  const fromNames = (forecastCandidateNames ?? []).slice(0, 3).filter((n) => {
    const name = String(n ?? "").trim();
    return !!name && !/^candidate\s*\d+$/i.test(name);
  }).length;
  if (fromNames > 0) return Math.max(1, Math.min(3, fromNames));

  return 2;
}
function normalizeWinProbabilitiesByCandidateCount(
  src: Partial<Record<"Candidate1" | "Candidate2" | "Candidate3", number>>,
  candidateCount: number,
): { c1: number; c2: number; c3: number } {
  const count = Math.max(1, Math.min(3, candidateCount));
  if (count === 1) return { c1: 1, c2: 0, c3: 0 };

  const raw = [Math.max(0, src.Candidate1 ?? 0), Math.max(0, src.Candidate2 ?? 0), Math.max(0, src.Candidate3 ?? 0)];
  for (let i = count; i < 3; i += 1) raw[i] = 0;

  const total = raw[0] + raw[1] + raw[2];
  if (total <= 0) {
    if (count === 2) return { c1: 0.5, c2: 0.5, c3: 0 };
    return { c1: 1 / 3, c2: 1 / 3, c3: 1 / 3 };
  }

  return { c1: raw[0] / total, c2: raw[1] / total, c3: raw[2] / total };
}

// ─── FORECAST PANEL ───────────────────────────────────────────────────────────
function ForecastPanel({ raceId, refreshTick, raceData, onForecastUpdate }: { raceId: number; refreshTick: number; raceData?: RaceDetail; onForecastUpdate?: (update: { leader: string; prob: number; runoffNeededProb: number; projectionType: "WIN" | "RUNOFF"; runoffProbs?: Record<string, number> }) => void }) {
  const defaults = RACE_FORECAST_DEFAULTS[raceId];
  const TX_RACE_IDS = [44285, 44286, 44287, 44288, 44289, 44290, 44291, 44292, 44293, 44294, 44295];
  const [raceRule, setRaceRule] = useState<RaceRule>(() => TX_RACE_IDS.includes(raceId) ? "MAJORITY" : (defaults?.raceRule ?? "PLURALITY"));
  const [expectedTurnoutOverride, setExpectedTurnoutOverride] = useState(defaults?.expectedTurnout ? String(defaults.expectedTurnout) : "");
  const [historyList, setHistoryList] = useState<ForecastHistoryList | null>(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const raceDataRef = useRef<RaceDetail | undefined>(undefined);
  const raceDataRaceIdRef = useRef<number>(-1);
  useEffect(() => {
    // Only accept raceData that belongs to the current raceId.
    // On race change, raceId updates before raceData, so we'd briefly
    // hold stale data from the previous race — guard against that here.
    if (raceData !== undefined) {
      raceDataRef.current = raceData;
      raceDataRaceIdRef.current = raceId;
    }
  }, [raceData, raceId]);
  const raceIdRef = useRef(raceId); const raceRuleRef = useRef(raceRule); const turnoutRef = useRef(expectedTurnoutOverride);
  const playingRef = useRef(playing); const historyListRef = useRef<ForecastHistoryList | null>(null); const historyIndexRef = useRef(historyIndex);
  useEffect(() => { raceIdRef.current = raceId; }, [raceId]);
  useEffect(() => { raceRuleRef.current = raceRule; }, [raceRule]);
  useEffect(() => { turnoutRef.current = expectedTurnoutOverride; }, [expectedTurnoutOverride]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { historyListRef.current = historyList; }, [historyList]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  const timestamps = useMemo(() => getTimestamps(historyList).map((t) => t.timestamp), [historyList]);

  const runForecastLive = useCallback(async (id: number, rule?: RaceRule, turnout?: string) => {
    setLoadingForecast(true); setError(null);
    try {
      const _repOverride = RACE_FORECAST_DEFAULTS[id]?.overrideReporting;
      const _effectivePct = (_repOverride && _repOverride > 0) ? _repOverride : undefined;
      const _colorOverrides = RACE_FORECAST_DEFAULTS[id]?.colorOverrides;
      // Only use cached race data if it actually belongs to this race — on initial
      // race selection, raceDataRef may still hold the previous race's data.
      let _baseRaceData = (raceDataRef.current && raceDataRaceIdRef.current === id)
        ? (_effectivePct !== undefined ? { ...raceDataRef.current, percent_reporting: _effectivePct } : raceDataRef.current)
        : null;
      if (_baseRaceData && _colorOverrides && Object.keys(_colorOverrides).length > 0) {
        _baseRaceData = {
          ..._baseRaceData,
          candidates: _baseRaceData.candidates.map((c) => {
            const lower = c.name.toLowerCase();
            for (const [key, color] of Object.entries(_colorOverrides)) {
              if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
                return { ...c, color };
              }
            }
            return c;
          }),
        };
      }
      const _raceData = _baseRaceData;
      const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(_raceData ? { type: "civic_raw", raceData: _raceData } : { type: "civic", raceId: String(id) }), race_rule: rule ?? raceRuleRef.current, expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined, poll_avg: RACE_FORECAST_DEFAULTS[id]?.pollAvg, turnout_blend_k: RACE_FORECAST_DEFAULTS[id]?.turnoutBlendK }) });
      const data = await res.json();
      if (raceIdRef.current !== id) return;
      if (data.error) throw new Error(data.details ?? data.error);
      setForecast(data);
      if (onForecastUpdate && data.forecast) {
        const candidateCount = getEffectiveForecastCandidateCount(data?.race?.candidates, data?.forecast?.candidate_names);
        const names = data.forecast.candidate_names ?? [];
        const keys = ["Candidate1", "Candidate2", "Candidate3"] as const;

        if (data.forecast.race_rule === "TOP_TWO") {
          // Top-2 advance — emit the two projected advancers as a RUNOFF call
          const mvKeys = ["Candidate1", "Candidate2", "Candidate3"] as const;
          const top2 = [...mvKeys]
            .map((k, i) => ({ name: names[i] ?? k, votes: (data.forecast.modeled_votes?.[k] ?? 0) }))
            .sort((a, b) => b.votes - a.votes)
            .slice(0, 2)
            .map(x => x.name.split(" ").pop() ?? x.name);
          const top2Prob = Math.max(
            data.forecast.runoff_prob?.Candidate1 ?? 0,
            data.forecast.runoff_prob?.Candidate2 ?? 0,
            data.forecast.runoff_prob?.Candidate3 ?? 0
          );
          const top2RunoffProbs: Record<string, number> = {};
          (["Candidate1", "Candidate2", "Candidate3"] as const).forEach((k, i) => { if (names[i]) top2RunoffProbs[names[i]] = data.forecast.runoff_prob?.[k] ?? 0; });
          onForecastUpdate({ leader: `${top2[0]} vs. ${top2[1]}`, prob: top2Prob * 100, runoffNeededProb: 0, projectionType: "RUNOFF", runoffProbs: top2RunoffProbs });
        } else if (data.forecast.race_rule === "PLURALITY") {
          const normalized = normalizeWinProbabilitiesByCandidateCount(data.forecast.plurality_odds_to_win, candidateCount);
          const best = keys.reduce((a, b) => ((normalized[a === "Candidate1" ? "c1" : a === "Candidate2" ? "c2" : "c3"] ?? 0) >= (normalized[b === "Candidate1" ? "c1" : b === "Candidate2" ? "c2" : "c3"] ?? 0) ? a : b), "Candidate1" as typeof keys[number]);
          const bestProb = best === "Candidate1" ? normalized.c1 : best === "Candidate2" ? normalized.c2 : normalized.c3;
          onForecastUpdate({ leader: names[keys.indexOf(best)] ?? "", prob: bestProb * 100, runoffNeededProb: 0, projectionType: "WIN" });
        } else {
          const runoffNeededProb = Math.max(0, Math.min(1, typeof data.forecast.runoff_needed_prob === "number" ? data.forecast.runoff_needed_prob : 0));
          const c1 = Math.max(0, data.forecast.plurality_odds_to_win?.Candidate1 ?? 0) * (1 - runoffNeededProb);
          const c2 = Math.max(0, data.forecast.plurality_odds_to_win?.Candidate2 ?? 0) * (1 - runoffNeededProb);
          const c3 = Math.max(0, data.forecast.plurality_odds_to_win?.Candidate3 ?? 0) * (1 - runoffNeededProb);
          const candidateWinProbs = [c1, c2, c3].map((p, idx) => (idx < candidateCount ? p : 0));
          const bestIdx = candidateWinProbs.reduce((best, val, idx, arr) => (val >= arr[best] ? idx : best), 0);
          const bestCandidateProb = candidateWinProbs[bestIdx] ?? 0;
          if (runoffNeededProb >= bestCandidateProb) {
            // Identify top-2 advancers by modeled votes for the call label
            const mvKeys = ["Candidate1", "Candidate2", "Candidate3"] as const;
            const top2 = [...mvKeys]
              .map((k, i) => ({ name: names[i] ?? k, votes: (data.forecast.modeled_votes?.[k] ?? 0) }))
              .sort((a, b) => b.votes - a.votes)
              .slice(0, 2)
              .map(x => x.name.split(" ").pop() ?? x.name);
            const threshRunoffProbs: Record<string, number> = {};
            (["Candidate1", "Candidate2", "Candidate3"] as const).forEach((k, i) => { if (names[i]) threshRunoffProbs[names[i]] = data.forecast.runoff_prob?.[k] ?? 0; });
            onForecastUpdate({ leader: `${top2[0]} vs. ${top2[1]}`, prob: runoffNeededProb * 100, runoffNeededProb, projectionType: "RUNOFF", runoffProbs: threshRunoffProbs });
          } else {
            onForecastUpdate({ leader: names[bestIdx] ?? "", prob: bestCandidateProb * 100, runoffNeededProb, projectionType: "WIN" });
          }
        }
      }
    } catch (e: any) { if (raceIdRef.current === id) setError(e.message); }
    finally { if (raceIdRef.current === id) setLoadingForecast(false); }
  }, []);

  const runForecastAtIndex = useCallback(async (id: number, tsList: ForecastHistoryTimestamp[], idx: number, rule?: RaceRule, turnout?: string) => {
    if (!tsList.length) return runForecastLive(id, rule, turnout);
    setLoadingForecast(true); setError(null);
    try {
      const timestamp = tsList[idx].timestamp; const priorTimestamp = idx > 0 ? tsList[0].timestamp : undefined;
      const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "civic_history", raceId: String(id), timestamp, priorTimestamp, race_rule: rule ?? raceRuleRef.current, expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined, poll_avg: RACE_FORECAST_DEFAULTS[id]?.pollAvg, turnout_blend_k: RACE_FORECAST_DEFAULTS[id]?.turnoutBlendK }) });
      const data = await res.json();
      if (raceIdRef.current !== id) return;
      if (data.error) throw new Error(data.details ?? data.error);
      setForecast(data);
    } catch (e: any) { if (raceIdRef.current === id) setError(e.message); }
    finally { if (raceIdRef.current === id) setLoadingForecast(false); }
  }, [runForecastLive]);

  useEffect(() => {
    const d = RACE_FORECAST_DEFAULTS[raceId];
    const newRule: RaceRule = TX_RACE_IDS.includes(raceId) ? "MAJORITY" : (d?.raceRule ?? "PLURALITY");
    const newTurnout = d?.expectedTurnout ? String(d.expectedTurnout) : "";
    setRaceRule(newRule); setExpectedTurnoutOverride(newTurnout);
    raceRuleRef.current = newRule; turnoutRef.current = newTurnout;
    setForecast(null); setHistoryList(null); historyListRef.current = null;
    setHistoryIndex(0); historyIndexRef.current = 0;
    setPlaying(false); setError(null); setLoadingHistory(false);
    let cancelled = false;
    // HISTORY DISABLED — skip timestamp fetch, go straight to live
    // (async () => {
    //   try {
    //     const res = await fetch(`/api/forecast?action=timestamps&raceId=${raceId}`);
    //     const data: ForecastHistoryList = await res.json();
    //     if (cancelled) return;
    //     setHistoryList(data); historyListRef.current = data;
    //     const tsList = getTimestamps(data);
    //     if (tsList.length > 0) { const last = tsList.length - 1; setHistoryIndex(last); historyIndexRef.current = last; await runForecastAtIndex(raceId, tsList, last, newRule, newTurnout); }
    //     else { await runForecastLive(raceId, newRule, newTurnout); }
    //   } catch (e: any) { if (!cancelled) setError(e.message); }
    //   finally { if (!cancelled) setLoadingHistory(false); }
    // })();
    (async () => {
      try { await runForecastLive(raceId, newRule, newTurnout); }
      catch (e: any) { if (!cancelled) setError(e.message); }
    })();
    return () => { cancelled = true; };
  }, [raceId]); // eslint-disable-line

  const prevTickRef = useRef(0);
  useEffect(() => {
    if (refreshTick === 0 || refreshTick === prevTickRef.current) return;
    prevTickRef.current = refreshTick;
    if (playingRef.current) return;
    runForecastLive(raceIdRef.current);
  }, [refreshTick]); // eslint-disable-line

  const isFirstOptionsRender = useRef(true);
  useEffect(() => {
    if (isFirstOptionsRender.current) { isFirstOptionsRender.current = false; return; }
    const timer = setTimeout(() => { const id = raceIdRef.current; /* HISTORY DISABLED */ runForecastLive(id); }, 400);
    return () => clearTimeout(timer);
  }, [raceRule, expectedTurnoutOverride]); // eslint-disable-line
  useEffect(() => { isFirstOptionsRender.current = true; }, [raceId]);

  useEffect(() => {
    if (playing && timestamps.length > 1) {
      playRef.current = setInterval(() => { setHistoryIndex((prev) => { const next = prev + 1; if (next >= timestamps.length) { setPlaying(false); return prev; } historyIndexRef.current = next; const hl = historyListRef.current; if (hl) runForecastAtIndex(raceIdRef.current, hl.timestamps, next); return next; }); }, 1800);
    } else { if (playRef.current) clearInterval(playRef.current); }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, timestamps.length]); // eslint-disable-line

  const candidateLabels: Record<FCKey, string> = useMemo(() => {
    const names = forecast?.forecast.candidate_names ?? ["Candidate 1", "Candidate 2", "Candidate 3", "Others"];
    return { Candidate1: names[0], Candidate2: names[1], Candidate3: names[2], Others: (raceRule !== "PLURALITY" && raceRule !== "TOP_TWO") ? "Runoff" : names[3] };
  }, [forecast]);

  const formatCandidateName = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return <>{name}</>;
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(" ");
    return <>{first}<br />{last}</>;
  };
  const candidateColors: Record<FCKey, string> = useMemo(() => { const colors = forecast?.forecast.candidate_colors ?? ["#3b82f6", "#ef4444", "#22c55e", "#94a3b8"]; return { Candidate1: colors[0], Candidate2: colors[1], Candidate3: colors[2], Others: (raceRule !== "PLURALITY" && raceRule !== "TOP_TWO") ? "#c0392b" : colors[3] }; }, [forecast, raceRule]);
  const isLoading = loadingHistory || loadingForecast;
  const activeCandidateCount = useMemo(() => {
    return getEffectiveForecastCandidateCount(raceData?.candidates, forecast?.forecast?.candidate_names);
  }, [raceData?.candidates, forecast?.forecast?.candidate_names]);
  const swingoProbs = useMemo(() => {
    if (!forecast) return { c1: 0.5, c2: 0.5, c3: 0, runoffNeeded: 0 };
    const f = forecast.forecast;
    if (raceRule === "TOP_TWO") {
      // runoff_prob = P(candidate finishes in top 2); sums to ~2 since 2 advance.
      // Divide by 2 so arcs represent each candidate's share of the 2 advancement slots.
      const c1 = Math.max(0, f.runoff_prob?.Candidate1 ?? 0) / 2;
      const c2 = Math.max(0, f.runoff_prob?.Candidate2 ?? 0) / 2;
      const c3 = Math.max(0, f.runoff_prob?.Candidate3 ?? 0) / 2;
      return { c1, c2, c3, runoffNeeded: 0 };
    }
    if (raceRule !== "PLURALITY") {
      const runoffNeeded = Math.max(0, Math.min(1, typeof f.runoff_needed_prob === "number" ? f.runoff_needed_prob : 0));
      const c1 = Math.max(0, f.plurality_odds_to_win.Candidate1 ?? 0) * (1 - runoffNeeded);
      const c2 = Math.max(0, f.plurality_odds_to_win.Candidate2 ?? 0) * (1 - runoffNeeded);
      const c3 = Math.max(0, f.plurality_odds_to_win.Candidate3 ?? 0) * (1 - runoffNeeded);
      return { c1, c2, c3, runoffNeeded };
    }
    return { ...normalizeWinProbabilitiesByCandidateCount(f.plurality_odds_to_win, activeCandidateCount), runoffNeeded: 0 };
  }, [forecast, raceRule, activeCandidateCount]);

  // ── SPLASH: hide forecast until 10% reporting (unless user forces it open) ──
  const SPLASH_THRESHOLD = 10; // percent
  const [forceShowForecast, setForceShowForecast] = useState(false);
  const effectiveReporting = (() => {
    const ov = defaults?.overrideReporting;
    if (typeof ov === "number" && ov > 0) return ov;
    return raceData?.percent_reporting ?? 0;
  })();
  const showForecastBody = forceShowForecast || effectiveReporting >= SPLASH_THRESHOLD;

  return (
    <div className="res-panel" style={{ padding: 0 }}>
      <div className="res-panel-header" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", width: "100%" }}>
          <span className="res-panel-tag" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>FORECAST MODEL</span>
          <div style={{ flex: 1 }} />
          <span style={{
            display: "inline-flex", alignItems: "center", padding: "2px 7px", flexShrink: 0,
            border: "1px solid rgba(124,58,237,0.45)", background: "rgba(124,58,237,0.10)",
            fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700,
            letterSpacing: "0.12em", color: "var(--purple-soft)", borderRadius: "var(--r-pill)",
          }}>FORECAST β</span>
          {isLoading && <span className="res-badge res-badge-purple" style={{ flexShrink: 0 }}><span className="res-live-dot" style={{ background: "var(--purple)", width: 4, height: 4 }} />UPDATING</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="res-btn-ghost" style={{ padding: "3px 8px" }} onClick={() => setShowOptions((v) => !v)}>{showOptions ? "HIDE OPTIONS" : "OPTIONS"}</button>
          {!isLoading && forecast && <span className="res-badge" style={{ color: "var(--muted2)", whiteSpace: "nowrap" }}>AUTO / 30s</span>}
        </div>
      </div>
      {showOptions && (
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--background2)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div><div className="res-note" style={{ marginBottom: 5 }}>RACE RULE</div><select value={raceRule} onChange={(e) => setRaceRule(e.target.value as RaceRule)} className="res-select" style={{ width: "100%" }}>              <option value="PLURALITY">Plurality (highest vote-getter wins)</option><option value="TOP_TWO">Top Two (CA open primary)</option><option value="MAJORITY">Majority ≥50% / Runoff</option><option value="MAJORITY_RUNOFF">Majority ≥50% / Municipal Runoff (LA Mayor)</option><option value="RANKED_CHOICE">Ranked Choice (RCV — majority threshold)</option><option value="THRESHOLD_35_CONVENTION">35% Threshold / Convention (Iowa)</option><option value="THRESHOLD_35_RUNOFF">35% Threshold / Runoff (S. Dakota)</option></select></div>
          <div><div className="res-note" style={{ marginBottom: 5 }}>EXPECTED TURNOUT (OPTIONAL)</div><input type="number" placeholder="e.g. 5000000" value={expectedTurnoutOverride} onChange={(e) => setExpectedTurnoutOverride(e.target.value)} className="res-input" /></div>
          <button className="res-btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={isLoading} onClick={() => { runForecastLive(raceIdRef.current); /* HISTORY DISABLED */ }}>{isLoading ? "RUNNING…" : "RERUN FORECAST"}</button>
        </div>
      )}
      <div className="res-forecast-body" style={{ padding: "10px 14px" }}>
        {error && <div style={{ border: "1px solid rgba(230,57,70,0.25)", background: "rgba(230,57,70,0.06)", color: "rgba(255,77,90,0.90)", padding: "8px 10px", fontFamily: "var(--font-body)", fontSize: "9.5px", letterSpacing: "0.10em", marginBottom: 12 }}>⚠ {error}</div>}
        {!showForecastBody && (
          <div style={{ padding: "20px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ padding: "12px 14px", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.22)", borderRadius: "var(--r-sm)", display: "flex", alignItems: "center", gap: 14 }}>
              {/* Equalizer bars */}
              <div style={{ flexShrink: 0, width: 36, height: 44, display: "flex", alignItems: "flex-end", gap: 5 }}>
                <div style={{ width: 9, borderRadius: 3, background: "rgba(239,68,68,0.70)", height: 28, animation: "fcst-eq-1 1.8s ease-in-out infinite" }} />
                <div style={{ width: 9, borderRadius: 3, background: "rgba(59,130,246,0.70)", height: 16, animation: "fcst-eq-2 2.2s ease-in-out infinite" }} />
                <div style={{ width: 9, borderRadius: 3, background: "rgba(34,197,94,0.60)", height: 38, animation: "fcst-eq-3 1.5s ease-in-out infinite" }} />
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--purple-soft)", marginBottom: 4 }}>FORECAST RUNNING</div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>
                  Waiting for early returns — results display at <strong style={{ color: "var(--foreground)" }}>{SPLASH_THRESHOLD}%</strong> reporting. Projections become more reliable as more precincts check in.
                </div>
                <div style={{ fontFamily: "var(--font-numeric)", fontSize: "12px", fontWeight: 800, color: "var(--purple-soft)", marginTop: 6 }}>
                  {effectiveReporting.toFixed(1)}% in so far
                </div>
              </div>
            </div>
            <button className="res-btn-ghost" style={{ padding: "5px 14px", fontSize: "10px", alignSelf: "center" }} onClick={() => setForceShowForecast(true)}>
              SHOW FORECAST ANYWAY
            </button>
          </div>
        )}
        {showForecastBody && isLoading && (
          <div style={{ padding: "36px 0", textAlign: "center" }}>
            <div className="res-note" style={{ color: "var(--purple-soft)", marginBottom: 10 }}>RUNNING FORECAST MODEL…</div>
            <div className="res-bar-track" style={{ width: "80%", margin: "0 auto" }}><div className="res-bar-fill" style={{ width: "60%", background: "linear-gradient(90deg,var(--purple),var(--blue2))", animation: "res-loading-pulse 1.4s ease-in-out infinite" }} /></div>
          </div>
        )}
        {showForecastBody && !isLoading && forecast && (
          /* ── NARROW LAYOUT ── */
          <div style={{ width: "100%" }}>
            {/* ── EARLY DATA DISCLAIMER ── */}
            {forceShowForecast && effectiveReporting < SPLASH_THRESHOLD && (
              <div style={{ marginBottom: 14, padding: "12px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.22)", borderRadius: "var(--r-sm)", display: "flex", alignItems: "center", gap: 14 }}>
                {/* Equalizer bars — amber tint */}
                <div style={{ flexShrink: 0, width: 36, height: 44, display: "flex", alignItems: "flex-end", gap: 5 }}>
                  <div style={{ width: 9, borderRadius: 3, background: "rgba(239,68,68,0.70)", height: 28, animation: "fcst-eq-1 1.8s ease-in-out infinite" }} />
                  <div style={{ width: 9, borderRadius: 3, background: "rgba(59,130,246,0.70)", height: 16, animation: "fcst-eq-2 2.2s ease-in-out infinite" }} />
                  <div style={{ width: 9, borderRadius: 3, background: "rgba(34,197,94,0.60)", height: 38, animation: "fcst-eq-3 1.5s ease-in-out infinite" }} />
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(245,158,11,0.9)", marginBottom: 4 }}>EARLY ESTIMATE</div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--muted)", lineHeight: 1.5 }}>
                    Based on <strong style={{ color: "var(--foreground)" }}>{effectiveReporting.toFixed(1)}%</strong> reporting. This estimate will sharpen significantly as more precincts check in — treat early projections as directional, not definitive.
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span className="res-note" style={{ color: "var(--muted2)" }}>{forecast.race.percent_reporting > 99 ? ">99" : forecast.race.percent_reporting.toFixed(1)}% REPORTING</span>
              <span className="res-badge res-badge-red">{raceRule === "PLURALITY" ? "PLURALITY" : raceRule === "TOP_TWO" ? "TOP TWO" : raceRule === "RANKED_CHOICE" ? "RANKED CHOICE" : raceRule === "MAJORITY" || raceRule === "MAJORITY_RUNOFF" ? "MAJORITY" : "THRESHOLD 35%"}</span>
            </div>
            {raceRule === "TOP_TWO" ? (
              <div style={{ marginBottom: 12, padding: "12px 12px", background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 12 }}>ADVANCEMENT PROBABILITY · TOP 2 ADVANCE</div>
                {((["Candidate1", "Candidate2", "Candidate3"] as const).filter((_, idx) => idx < activeCandidateCount).slice().sort((a, b) => (forecast.forecast.runoff_prob[b] ?? 0) - (forecast.forecast.runoff_prob[a] ?? 0))).map(k => {
                  const advProb = forecast.forecast.runoff_prob[k] ?? 0;
                  const color = candidateColors[k];
                  const isCalled = advProb >= 0.9973;
                  return (
                    <div key={k} style={{ marginBottom: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          {isCalled && (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                              <circle cx="7" cy="7" r="6.5" fill="var(--win)" opacity="0.18"/>
                              <circle cx="7" cy="7" r="6.5" stroke="var(--win)" strokeWidth="1.2"/>
                              <path d="M4 7l2 2 4-4" stroke="var(--win)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                          <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)" }}>{candidateLabels[k]}</span>
                        </div>
                        <span style={{ fontFamily: "var(--font-numeric)", fontSize: "14px", fontWeight: 800, color }}>{fcastPct(advProb)}</span>
                      </div>
                      <div style={{ height: 12, background: "var(--border2)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: fcastPct(Math.min(advProb, 1)), background: color, transition: "width 600ms ease", opacity: 0.85 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ marginBottom: 12, padding: "12px 12px", background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 10 }}>{`WIN PROBABILITY · ${raceRule === "PLURALITY" ? "MOST VOTES" : (raceRule === "THRESHOLD_35_CONVENTION" || raceRule === "THRESHOLD_35_RUNOFF") ? "THRESHOLD ≥35%" : raceRule === "RANKED_CHOICE" ? "RCV ≥50%" : "MAJORITY ≥50%"}`}</div>
                <SwingOMeter candidates={forecast.forecast.candidate_names ?? ["C1", "C2", "C3", "Others"]} colors={forecast.forecast.candidate_colors ?? ["#3b82f6", "#ef4444", "#22c55e", "#94a3b8"]} probabilities={swingoProbs} raceRule={raceRule} reportingPct={forecast.race.percent_reporting} candidateCount={activeCandidateCount} />
              </div>
            )}
            <div style={{ marginBottom: 4 }}>
              <div style={{ marginBottom: 2 }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted2)" }}>PROJECTED FINAL RESULT</span>
              </div>
              {(() => {
                const _rem = forecast.forecast.modeled_vote_remaining ?? 0;
                const _remLabel = _rem < 5000 ? "<5,000 VOTES REMAINING" : `~${(Math.round(_rem / 1000) * 1000).toLocaleString()} VOTES REMAINING`;
                const _remColor = _rem < 5000 ? "var(--win)" : _rem < 50000 ? "#f59e0b" : "var(--muted2)";
                return <div style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: _remColor, marginBottom: 8 }}>{_remLabel}</div>;
              })()}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: activeCandidateCount >= 3 ? "1fr 1fr 1fr" : activeCandidateCount === 2 ? "1fr 1fr" : "1fr", gap: 5, marginBottom: 12 }}>
              {(["Candidate1", "Candidate2", "Candidate3"] as const).filter((_, idx) => idx < activeCandidateCount).map((key) => {
                const color = candidateColors[key], share = forecast.forecast.modeled_share[key], votes = forecast.forecast.modeled_votes[key], isLeader = forecast.forecast.leader === key;
                return (
                  <div key={key} style={{ padding: "8px 8px 7px", background: "var(--panel2)", border: `1px solid ${isLeader ? color + "44" : "var(--border)"}`, borderRadius: "var(--r-sm)" }}>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: color + "cc", marginBottom: 3, lineHeight: 1.3 }}>{formatCandidateName(candidateLabels[key])}</div>
                    <div style={{ fontFamily: "var(--font-numeric)", fontSize: "18px", fontWeight: 800, color, lineHeight: 1 }}>{fcastPct(share)}</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "9px", letterSpacing: "0.06em", color: "var(--muted2)", marginTop: 2 }}>{fcastFmt(votes)}</div>
                    {isLeader && <div style={{ marginTop: 5, fontSize: "8px", color, fontWeight: 700, fontFamily: "var(--font-body)", letterSpacing: "0.12em", textTransform: "uppercase", border: `1px solid ${color}44`, padding: "1px 5px", borderRadius: "var(--r-pill)", display: "inline-block" }}>LEADER</div>}
                  </div>
                );
              })}
            </div>
            {raceRule === "TOP_TWO" && activeCandidateCount >= 3 && (() => {
              const _sorted = (["Candidate1", "Candidate2", "Candidate3"] as const)
                .filter((_, idx) => idx < activeCandidateCount)
                .map(k => ({ k, name: candidateLabels[k], votes: forecast.forecast.modeled_votes[k] ?? 0, share: (forecast.forecast.modeled_share[k] ?? 0) * 100, color: candidateColors[k] }))
                .sort((a, b) => b.votes - a.votes);
              const _2nd = _sorted[1], _3rd = _sorted[2];
              if (!_2nd || !_3rd) return null;
              const _gapVotes = Math.round(_2nd.votes - _3rd.votes);
              const _gapPct = (_2nd.share - _3rd.share).toFixed(1);
              const _remaining = forecast.forecast.modeled_vote_remaining ?? 0;
              const _needsPct = _remaining > 0 ? ((_gapVotes / _remaining) * 100).toFixed(1) : null;
              return (
                <div style={{ marginBottom: 12, padding: "9px 12px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.18)", borderRadius: "var(--r-sm)" }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(96,165,250,0.90)", marginBottom: 9 }}>2ND PLACE BUBBLE WATCH</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {[_2nd, _3rd].map((c, i) => (
                      <div key={c.k} style={{ flex: 1, padding: "7px 8px", background: "var(--panel2)", border: `1px solid ${c.color}33`, borderRadius: "var(--r-sm)" }}>
                        <div style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: c.color + "cc", marginBottom: 2 }}>{i === 0 ? "2ND" : "3RD"} · {c.name}</div>
                        <div style={{ fontFamily: "var(--font-numeric)", fontSize: "17px", fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.share.toFixed(1)}%</div>
                        <div style={{ fontFamily: "var(--font-body)", fontSize: "9px", color: "var(--muted2)", marginTop: 2 }}>{fcastFmt(c.votes)} proj</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 12px" }}>
                    {[["GAP (VOTES)", _gapVotes > 0 ? `+${_gapVotes.toLocaleString()}` : _gapVotes.toLocaleString()], ["GAP (%)", `${_gapPct}%`], ["VOTES REMAINING", fcastFmt(_remaining)], ["NEEDS TO FLIP", _needsPct ? `${_needsPct}% of rem.` : "—"]].map(([label, val]) => (
                      <div key={label} style={{ paddingBottom: 3, borderBottom: "1px solid var(--border)" }}>
                        <div style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 1 }}>{label}</div>
                        <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {(raceRule !== "PLURALITY" && raceRule !== "TOP_TWO") && (
              <div style={{ marginBottom: 12, padding: "9px 12px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.18)", borderRadius: "var(--r-sm)" }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(96,165,250,0.90)", marginBottom: 9 }}>{raceRule === "THRESHOLD_35_CONVENTION" ? "CONVENTION PROBABILITY" : raceRule === "RANKED_CHOICE" ? "RCV PROBABILITY" : "RUNOFF PROBABILITY"}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontFamily: "var(--font-body)", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>{rcvTerm(raceRule)}</span><span style={{ fontFamily: "var(--font-numeric)", fontSize: "13px", fontWeight: 800, color: "rgba(96,165,250,0.90)" }}>{fcastPct(forecast.forecast.runoff_needed_prob)}</span></div>
                <div style={{ height: 3, background: "var(--border2)", overflow: "hidden", marginBottom: 8, borderRadius: 99 }}><div style={{ height: "100%", width: fcastPct(Math.min(forecast.forecast.runoff_needed_prob, 1)), background: "rgba(96,165,250,0.75)", transition: "width 600ms ease" }} /></div>
                {FORECAST_CANDIDATE_KEYS.map(k => forecast.forecast.runoff_prob[k] > 0.005 ? (
                  <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: candidateColors[k], display: "inline-block" }} /><span style={{ fontFamily: "var(--font-body)", fontSize: "12px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)" }}>{candidateLabels[k]}</span></div>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, color: candidateColors[k] }}>{fcastPct(forecast.forecast.runoff_prob[k])}</span>
                  </div>
                ) : null)}
              </div>
            )}
            <div style={{ padding: "9px 12px", background: "var(--panel2)", border: "1px solid var(--border)", marginBottom: 12, borderRadius: "var(--r-sm)" }}>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 7 }}>MODEL STATISTICS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px" }}>
                {[["TOTAL", fcastFmt(forecast.forecast.modeled_total_vote)], ["REMAINING", fcastFmt(forecast.forecast.modeled_vote_remaining)], ["MARGIN", `${fcastFmt(forecast.forecast.projected_margin_votes)} (${fcastPct(forecast.forecast.projected_margin_pct)})`], ["STD DEV", fcastFmt(forecast.forecast.sd_race)]].map(([label, val]) => (
                  <div key={label} style={{ paddingBottom: 3, borderBottom: "1px solid var(--border)" }}>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 1 }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, color: "var(--muted)" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
            {timestamps.length > 1 && (
              <div style={{ padding: "10px 12px", background: "var(--panel2)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted2)" }}>HISTORICAL PLAYBACK</div>
                  <button className="res-btn-ghost" style={{ padding: "3px 9px" }} onClick={() => { if (playing) { setPlaying(false); return; } if (historyIndex >= timestamps.length - 1) setHistoryIndex(0); setPlaying(true); }}>{playing ? "⏹ STOP" : "▶ PLAY"}</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span className="res-note">{fcastShortDate(timestamps[0])}</span><span className="res-note">{fcastShortDate(timestamps[timestamps.length - 1])}</span></div>
                <input type="range" min={0} max={timestamps.length - 1} value={historyIndex} onChange={(e) => { const idx = Number(e.target.value); setHistoryIndex(idx); historyIndexRef.current = idx; const hl = historyListRef.current; if (hl) runForecastAtIndex(raceIdRef.current, hl.timestamps, idx); }} style={{ width: "100%", accentColor: "var(--purple)", height: "4px", cursor: "pointer" }} />
                <div className="res-note" style={{ textAlign: "center", marginTop: 6, color: "var(--purple-soft)" }}>{fcastShortDate(timestamps[historyIndex])} · {historyIndex + 1}/{timestamps.length}</div>
              </div>
            )}
            {timestamps.length === 0 && <div className="res-note" style={{ textAlign: "center", fontStyle: "italic", paddingTop: 4 }}>No history snapshots — live data only</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RACE PICKER PANEL (replaces old tab bar) ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
function RaceScrollWindow({ races, raceCache, selectedId, onSelect, search, onSearchChange, maxHeight, lockedCalls, lockedCallTypes, lockedRunoffProbs, showArchived }: {
  races: FeaturedRace[]; raceCache: Record<number, RaceDetail | undefined>; selectedId: number;
  onSelect: (id: number) => void; search: string; onSearchChange: (v: string) => void; maxHeight?: number; lockedCalls?: Record<number, string>;
  lockedCallTypes?: Record<number, "WIN" | "RUNOFF">;
  lockedRunoffProbs?: Record<number, Record<string, number>>;
  showArchived?: boolean;
}) {
  const hasSearch = search.trim().length > 0;
  const filtered = races.filter(r => {
    if (r.archived && !showArchived && !hasSearch) return false;
    if (!hasSearch) return true;
    return r.office.toLowerCase().includes(search.toLowerCase()) || r.raceType.toLowerCase().includes(search.toLowerCase()) || r.label.toLowerCase().includes(search.toLowerCase());
  });
  const groups = filtered.reduce<{ office: string; races: FeaturedRace[] }[]>((acc, r) => {
    const last = acc[acc.length - 1];
    if (last && last.office === r.office) last.races.push(r);
    else acc.push({ office: r.office, races: [r] });
    return acc;
  }, []);
  return (
    <>
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border)", background: "var(--background2)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.3 }}>
          <circle cx="6.5" cy="6.5" r="5" stroke="white" strokeWidth="1.5"/>
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input type="text" placeholder="Search races…" value={search} onChange={e => onSearchChange(e.target.value)}
          style={{ flex: 1, background: "none", border: "none", outline: "none", fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.04em", color: "var(--foreground)", caretColor: "var(--purple-soft)" }} />
        {search && <button onClick={() => onSearchChange("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted2)", fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>}
      </div>
      <div style={{ overflowY: "auto", flex: 1, maxHeight: maxHeight }}>
        {groups.map(({ office, races: groupRaces }, gi) => (
          <div key={`${office}-${gi}`}>
            <div style={{ padding: "4px 10px 2px", fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted2)", borderTop: "1px solid var(--border)", marginTop: 2 }}>{office}</div>
            {groupRaces.map(r => {
              const liveData = raceCache[r.id];
              const winner = liveData?.candidates?.find(c => c.winner);
              const isCalled = !!(winner || lockedCalls?.[r.id] || RACE_FORECAST_DEFAULTS[r.id]?.manualCall);
              const _callType = lockedCallTypes?.[r.id] ?? (lockedCalls?.[r.id]?.includes(" vs. ") ? "RUNOFF" : "WIN");
              const _callLabel = (() => {
                if (!isCalled) return null;
                if (_callType === "RUNOFF" && lockedRunoffProbs?.[r.id]) {
                  const frags = (lockedCalls?.[r.id] ?? "").split(" vs. ");
                  const rp = lockedRunoffProbs[r.id];
                  const allOk = frags.length >= 2 && frags.every(frag => Object.entries(rp).some(([n, p]) => n.toLowerCase().includes(frag.toLowerCase()) && p > 0.9973));
                  return allOk ? "✓ CALLED" : `✓ ${rcvTerm(RACE_FORECAST_DEFAULTS[r.id]?.raceRule)}`;
                }
                return "✓ CALLED";
              })();
              const _apiReporting = getRaceReportingPct(liveData);
              const _overrideReporting = RACE_FORECAST_DEFAULTS[r.id]?.overrideReporting;
              const reporting = (typeof _overrideReporting === "number" && _overrideReporting > 0) ? _overrideReporting : _apiReporting;
              const isSelected = r.id === selectedId;
              const raceTypeColor = getRaceTypeColor(r.raceType);
              const raceTypeShort = getRaceTypeShort(r.raceType);
              const hasForecast = !!(RACE_FORECAST_DEFAULTS[r.id]?.pollAvg && RACE_FORECAST_DEFAULTS[r.id]?.expectedTurnout);
              return (
                <button key={r.id} onClick={() => onSelect(r.id)} style={{ display: "flex", alignItems: "center", width: "calc(100% - 8px)", margin: "1px 4px", padding: "6px 10px", background: isSelected ? "rgba(124,58,237,0.10)" : "transparent", border: "1px solid", borderColor: isSelected ? "rgba(124,58,237,0.35)" : "transparent", borderRadius: "var(--r-sm)", cursor: "pointer", textAlign: "left", transition: "background 100ms ease" }}>
                  <span style={{ flexShrink: 0, width: 7, height: 7, borderRadius: "50%", background: raceTypeColor, boxShadow: `0 0 7px ${raceTypeColor}bb`, animation: "res-pulse 1.8s ease-in-out infinite", marginRight: 10 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: isSelected ? 800 : 600, color: isSelected ? "var(--foreground)" : "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.raceType} </span>
                      {hasForecast && <span style={{ flexShrink: 0, display: "inline-flex", padding: "2px 6px", border: "1px solid rgba(124,58,237,0.45)", background: "rgba(124,58,237,0.10)", fontFamily: "var(--font-body)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--purple-soft)", borderRadius: "var(--r-pill)" }}>FORECAST β</span>}
                    </div>
                    <div style={{ height: 2, background: "var(--border2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${reporting ?? 0}%`, background: isCalled ? "var(--win)" : raceTypeColor, opacity: 0.75, transition: "width 800ms ease" }} />
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 8 }}>
                    {isCalled ? <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, color: "var(--win)" }}>{_callLabel}</span>
                      : <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, color: isSelected ? "var(--muted)" : "var(--muted2)" }}>{reporting !== null ? `${reporting.toFixed(0)}%` : "—"}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

function RacePickerPanel({ races, raceCache, selectedId, onSelect, lockedCalls, lockedCallTypes, lockedRunoffProbs, showArchived, onToggleArchive, activeState, spotlightRaceIds }: {
  races: FeaturedRace[];
  raceCache: Record<number, RaceDetail | undefined>;
  selectedId: number;
  onSelect: (id: number) => void;
  lockedCalls?: Record<number, string>;
  lockedCallTypes?: Record<number, "WIN" | "RUNOFF">;
  lockedRunoffProbs?: Record<number, Record<string, number>>;
  showArchived?: boolean;
  onToggleArchive?: () => void;
  activeState?: string;
  spotlightRaceIds?: number[];
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const hasSearch = search.trim().length > 0;
  const hasArchivedRaces = races.some(r => r.archived);

  // Group by office
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = q
      ? races.filter(r => r.office.toLowerCase().includes(q) || r.raceType.toLowerCase().includes(q) || r.label.toLowerCase().includes(q))
      : races.filter(r => r.archived ? !!showArchived : (!activeState || r.state === activeState));
    // Active races: group by office
    // Archived races: group by "STATE · DATE" section header
    const stateArchiveLabel: Record<string, string> = {
      TX: "TEXAS · MAY 26, 2026",
      CA: "CALIFORNIA · JUNE 2, 2026",
      IA: "IOWA · JUNE 2, 2026",
      MT: "MONTANA · JUNE 2, 2026",
      NJ: "NEW JERSEY · JUNE 2, 2026",
      NM: "NEW MEXICO · JUNE 2, 2026",
      SD: "SOUTH DAKOTA · JUNE 2, 2026",
      SC: "S. CAROLINA · JUNE 9, 2026",
      ME: "MAINE · JUNE 9, 2026",
      NV: "NEVADA · JUNE 9, 2026",
      ND: "N. DAKOTA · JUNE 9, 2026",
      GA: "GEORGIA · JUNE 16, 2026",
      AL: "ALABAMA · JUNE 16, 2026",
      DC: "WASH. DC · JUNE 16, 2026",
      OK: "OKLAHOMA · JUNE 16, 2026",
    };
    // State display order for archive
    const archiveStateOrder = ["TX", "CA", "IA", "MT", "NJ", "NM", "SD", "SC", "ME", "NV", "ND", "GA", "AL", "DC", "OK"];

    const activeRaces = filtered.filter(r => !r.archived);
    const archivedRaces = filtered.filter(r => r.archived);

    const activeStateOrder = ["SC", "MD", "NY", "UT"];

    const map = new Map<string, FeaturedRace[]>();
    if (!activeState && !q) {
      // All-races mode: group by state with state headers
      for (const st of activeStateOrder) {
        const stRaces = activeRaces.filter(r => r.state === st);
        if (stRaces.length > 0) {
          map.set(`__activeState:${st}`, stRaces);
        }
      }
    } else {
      for (const r of activeRaces) {
        const g = map.get(r.office) ?? [];
        g.push(r);
        map.set(r.office, g);
      }
    }
    // Add archived grouped by state, in date order
    if (archivedRaces.length > 0) {
      for (const st of archiveStateOrder) {
        const stRaces = archivedRaces.filter(r => r.state === st);
        if (stRaces.length > 0) {
          const key = stateArchiveLabel[st] ?? st;
          map.set(key, stRaces);
        }
      }
    }
    return Array.from(map.entries());
  }, [races, search, showArchived, activeState, spotlightRaceIds]);

  const stateActiveLabel: Record<string, string> = {
    SC: "S. CAROLINA · JUNE 23, 2026",
    MD: "MARYLAND · JUNE 23, 2026",
    NY: "NEW YORK · JUNE 23, 2026",
    UT: "UTAH · JUNE 23, 2026",
    GA: "GEORGIA · JUNE 16, 2026",
    AL: "ALABAMA · JUNE 16, 2026",
    DC: "WASH. DC · JUNE 16, 2026",
    OK: "OKLAHOMA · JUNE 16, 2026",
  };

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--panel)", border: "1px solid var(--border)", overflow: "hidden", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow-sm)", position: "relative" }}>
      {/* Header */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", background: "var(--panel)", flexShrink: 0, borderRadius: "var(--r-lg) var(--r-lg) 0 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div className="res-panel-tag">ALL RACES</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {hasArchivedRaces && (
            <button
              onClick={() => onToggleArchive?.()}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "3px 9px",
                background: showArchived
                  ? "linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.03) 100%)"
                  : "linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(99,102,241,0.08) 100%)",
                border: `1px solid ${showArchived ? "rgba(124,58,237,0.22)" : "rgba(124,58,237,0.50)"}`,
                borderRadius: "var(--r-pill)",
                fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.10em",
                color: showArchived ? "rgba(160,140,220,0.65)" : "rgba(200,180,255,0.95)",
                cursor: "pointer", transition: "all 150ms ease",
                boxShadow: showArchived ? "none" : "0 0 10px rgba(124,58,237,0.30), 0 0 2px rgba(124,58,237,0.20)",
              }}
            >
              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ opacity: showArchived ? 0.45 : 0.8 }}>
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {showArchived ? "HIDE ARCHIVE" : "ARCHIVE"}
            </button>
          )}
          </div>
        </div>
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--panel2)", border: "1px solid var(--border2)", padding: "7px 12px", borderRadius: "var(--r-sm)" }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
            <circle cx="6.5" cy="6.5" r="5" stroke="white" strokeWidth="1.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter races…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", color: "var(--foreground)", caretColor: "var(--purple-soft)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted2)", padding: 0, fontSize: 11, lineHeight: 1 }}>✕</button>
          )}
        </div>
      </div>

      {/* Race list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {groups.length === 0 && (
          <div style={{ padding: "20px 12px", textAlign: "center" }}>
            <span className="res-note" style={{ color: "var(--muted2)" }}>NO RACES FOUND</span>
          </div>
        )}
        {groups.map(([office, groupRaces], gi) => {
          const isArchiveGroup = groupRaces[0]?.archived;
          const isFirstArchiveGroup = isArchiveGroup && groups.find(([, gr]) => gr[0]?.archived)?.[0] === office;
          const isActiveStateGroup = office.startsWith("__activeState:");
          const activeStateName = isActiveStateGroup ? stateActiveLabel[office.replace("__activeState:", "")] ?? office.replace("__activeState:", "") : null;
          return (
          <div key={`${office}-${gi}`} style={{ marginBottom: 2 }}>
            {/* Archive section divider — only before the first archived group */}
            {isFirstArchiveGroup && (
              <div style={{ margin: "10px 10px 6px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(180,180,220,0.25) 0%, transparent 100%)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "rgba(100,100,140,0.12)", border: "1px solid rgba(180,180,220,0.18)", borderRadius: "var(--r-pill)" }}>
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.5 }}>
                    <circle cx="8" cy="8" r="6.5" stroke="rgba(180,180,220,0.8)" strokeWidth="1.5"/>
                    <path d="M8 5v3.5l2 1.5" stroke="rgba(180,180,220,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", color: "rgba(180,180,220,0.55)" }}>ARCHIVED RACES</span>
                </div>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(180,180,220,0.25) 100%)" }} />
              </div>
            )}
            {/* State header — active races all-state view */}
            {isActiveStateGroup && (
              <div style={{ margin: gi === 0 ? "6px 10px 4px" : "10px 10px 4px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(124,58,237,0.35) 0%, transparent 100%)" }} />
                <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", color: "var(--purple-soft)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{activeStateName}</span>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.35) 100%)" }} />
              </div>
            )}
            {/* Office / state group header — archive only */}
            {isArchiveGroup && <div style={{
              padding: "5px 14px 3px",
              fontFamily: "var(--font-body)",
              fontSize: "9.5px",
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--muted2)",
              marginTop: 2,
            }}>
              {office}
            </div>}
            {/* Race buttons */}
            {groupRaces.map(r => {
              const liveData = raceCache[r.id];
              const winner = liveData?.candidates?.find(c => c.winner);
              const isCalled = !!(winner || lockedCalls?.[r.id] || RACE_FORECAST_DEFAULTS[r.id]?.manualCall);
              const _callType2 = lockedCallTypes?.[r.id] ?? (lockedCalls?.[r.id]?.includes(" vs. ") ? "RUNOFF" : "WIN");
              const _callLabel2 = (() => {
                if (!isCalled) return null;
                if (_callType2 === "RUNOFF" && lockedRunoffProbs?.[r.id]) {
                  const frags = (lockedCalls?.[r.id] ?? "").split(" vs. ");
                  const rp = lockedRunoffProbs[r.id];
                  const allOk = frags.length >= 2 && frags.every(frag => Object.entries(rp).some(([n, p]) => n.toLowerCase().includes(frag.toLowerCase()) && p > 0.9973));
                  return allOk ? "✓ CALLED" : `✓ ${rcvTerm(RACE_FORECAST_DEFAULTS[r.id]?.raceRule)}`;
                }
                return "✓ CALLED";
              })();
              const _apiReporting = getRaceReportingPct(liveData);
              const _overrideReporting = RACE_FORECAST_DEFAULTS[r.id]?.overrideReporting;
              const reporting = (typeof _overrideReporting === "number" && _overrideReporting > 0) ? _overrideReporting : _apiReporting;
              const leader = liveData?.candidates ? [...liveData.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0] : null;
              const isSelected = r.id === selectedId;
              const raceTypeColor = getRaceTypeColor(r.raceType);
              const raceTypeShort = getRaceTypeShort(r.raceType);

              return (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "calc(100% - 8px)",
                    margin: "1px 4px",
                    gap: 0,
                    padding: "7px 10px",
                    background: isSelected ? `rgba(124,58,237,0.10)` : "transparent",
                    border: "1px solid",
                    borderColor: isSelected ? "rgba(124,58,237,0.35)" : "transparent",
                    borderRadius: "var(--r-sm)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 100ms ease, border-color 100ms ease",
                    position: "relative",
                    opacity: 1,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "var(--panel2)"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  {/* Race type glow dot */}
                  <span style={{
                    flexShrink: 0,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: raceTypeColor,
                    boxShadow: `0 0 7px ${raceTypeColor}bb`,
                    animation: "res-pulse 1.8s ease-in-out infinite",
                    opacity: 1,
                    marginRight: 12,
                  }} />

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Office name */}
                    <div style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      fontWeight: isSelected ? 800 : 600,
                      letterSpacing: "0.02em",
                      color: isSelected ? "var(--foreground)" : "var(--muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: 3,
                    }}>
                      {r.office}
                    </div>
                    {/* Race type */}
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em", color: "var(--muted2)", textTransform: "uppercase", marginBottom: 4 }}>
                      {getRaceTypeLabel(r.raceType)}
                    </div>
                    {/* Progress bar + percent */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 80, flexShrink: 0, height: 2, background: "var(--border2)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${reporting ?? 0}%`, background: isCalled ? "var(--win)" : raceTypeColor, borderRadius: 99, transition: "width 800ms ease" }} />
                      </div>
                      {isCalled ? (
                        <svg width="9" height="9" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                          <circle cx="7" cy="7" r="6.5" fill="var(--win)" opacity="0.18"/>
                          <circle cx="7" cy="7" r="6.5" stroke="var(--win)" strokeWidth="1.2"/>
                          <path d="M4 7l2 2 4-4" stroke="var(--win)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <span style={{ flexShrink: 0, fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, color: "var(--muted2)", letterSpacing: "0.06em" }}>{reporting !== null ? `${reporting.toFixed(0)}% IN` : "0% IN"}</span>
                      )}
                    </div>
                  </div>

                  {/* Forecast badge */}
                  {!!(RACE_FORECAST_DEFAULTS[r.id]?.pollAvg && RACE_FORECAST_DEFAULTS[r.id]?.expectedTurnout) && (
                    <span style={{
                      flexShrink: 0,
                      marginLeft: 6,
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 7px",
                      border: "1px solid rgba(124,58,237,0.45)",
                      background: "rgba(124,58,237,0.10)",
                      fontFamily: "var(--font-body)",
                      fontSize: "9px",
                      fontWeight: 700,
                      letterSpacing: "0.10em",
                      color: "var(--purple-soft)",
                      whiteSpace: "nowrap",
                      borderRadius: "var(--r-pill)",
                    }}>FORECAST β</span>
                  )}
                </button>
              );
            })}
          </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function March3FeaturedClient() {
  const [pageTab, setPageTab] = useState<"all" | "spotlight">("spotlight");
  const [allRacesStateFilter, setAllRacesStateFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveDropdownOpen, setArchiveDropdownOpen] = useState(false);
  const [archiveDate, setArchiveDate] = useState<string | null>(null);
  const archiveDropdownRef = useRef<HTMLDivElement>(null);
  const [activeState, setActiveState] = useState<"AL" | "CA" | "DC" | "GA" | "IA" | "MD" | "ME" | "MT" | "ND" | "NJ" | "NM" | "NV" | "NY" | "OK" | "SC" | "SD" | "TX" | "UT">("SC")
  const [selectedId, setSelectedId] = useState<number>(84105);
  const LA_MAYOR_ID     = 79938; // Los Angeles Mayor Open Primary — June 2 spotlight
  const CA_GOV_ID       = 79777; // California Governor Open Primary — June 2 spotlight
  const IA_GOV_ID       = 79945; // Iowa Governor Republican Primary — June 2 spotlight
  const SD_GOV_ID       = 80461; // SD Governor Republican Primary — June 2 spotlight
  const SC_SENATE_R_ID  = 82664; // SC US Senate Republican Primary — June 9 spotlight
  const SC_GOV_R_ID     = 82596; // SC Governor Republican Primary — June 9 spotlight
  const ME_SENATE_D_ID  = 83063; // ME US Senate Democratic Primary — June 9 spotlight
  const ME_GOV_D_ID     = 82693; // ME Governor Democratic Primary — June 9 spotlight
  const GA_SENATE_R_ID  = 83316; // GA US Senate Republican Primary Runoff — June 16 spotlight
  const AL_SENATE_R_ID  = 83428; // AL US Senate Republican Primary Runoff — June 16 spotlight
  const OK_SQ832_ID     = 83476; // Oklahoma State Question 832 — June 16 spotlight
  // June 23 spotlight constants
  const SC_GOV_R_RUNOFF_ID = 84105; // SC Governor R Runoff — June 23 spotlight
  const SC_AG_R_RUNOFF_ID  = 84104; // SC Attorney General R Runoff — June 23 spotlight
  const MD_GOV_R_ID        = 83700; // MD Governor R — June 23 spotlight
  const MD_HOUSE6_D_ID     = 83925; // MD US House 6 D — June 23 spotlight
  const NY_HOUSE10_D_ID    = 84040; // NY US House 10 D — June 23 spotlight
  const ALL_SPOTLIGHT_META = [
    {
      id: SC_GOV_R_RUNOFF_ID,
      shortLabel: "SC Gov · Runoff",
      stateLabel: "S. CAROLINA",
      state: "SC" as const,
      title: "SC Governor Republican Runoff",
      subtitle: "South Carolina · June 23, 2026",
      electionDate: "JUNE 23, 2026",
      about: "Lt. Gov. Pamela Evette enters as the frontrunner after topping the June 9 primary on a late Trump endorsement. The race tightened when Trump issued a rare dual co-endorsement for both Evette and AG Alan Wilson ahead of tonight's vote. The winner becomes the heavy favorite for governor in November.",
    },
    {
      id: MD_HOUSE6_D_ID,
      shortLabel: "MD House 6 D",
      stateLabel: "MARYLAND",
      state: "MD" as const,
      title: "MD US House 6 Democratic Primary",
      subtitle: "Maryland · June 23, 2026",
      electionDate: "JUNE 23, 2026",
      about: "Incumbent Rep. April McClain Delaney faces former Rep. David Trone in a costly fight for Maryland's 6th. Both wealthy candidates have poured millions in self-funding into a race marked by sharp attacks over special interest money and reproductive rights. McClain Delaney leads in late polling, but Trone's resources keep it close.",
    },
    {
      id: NY_HOUSE10_D_ID,
      shortLabel: "NY House 10 D",
      stateLabel: "NEW YORK",
      state: "NY" as const,
      title: "NY US House 10 Democratic Primary",
      subtitle: "New York · June 23, 2026",
      electionDate: "JUNE 23, 2026",
      about: "Incumbent Rep. Dan Goldman faces progressive challenger Brad Lander, the city's former comptroller, in an ideological battle for New York's 10th. Goldman draws support from Gov. Hochul and institutional Democrats; Lander is backed by Sen. Sanders and the progressive left. Late polls favor Lander in a race seen as a referendum on the district's direction.",
    },
    // ── JUNE 16, 2026 (archived) ────────────────────────────────────────────────
    {
      id: GA_SENATE_R_ID,
      shortLabel: "GA Senate · Runoff",
      stateLabel: "GEORGIA",
      state: "GA" as const,
      title: "GA US Senate Republican Primary Runoff",
      subtitle: "Georgia · June 16, 2026",
      electionDate: "JUNE 16, 2026",
      about: "Incumbent Rep. Mike Collins enters the runoff as the clear frontrunner after leading the initial primary, but challenger Derek Dooley — son of legendary Georgia football coach Vince Dooley — has energized a grassroots coalition in a race that could reshape the GOP's direction heading into the general.",
    },
    {
      id: AL_SENATE_R_ID,
      shortLabel: "AL Senate · Runoff",
      stateLabel: "ALABAMA",
      state: "AL" as const,
      title: "AL US Senate Republican Primary Runoff",
      subtitle: "Alabama · June 16, 2026",
      electionDate: "JUNE 16, 2026",
      about: "A razor-thin race between two conservative stalwarts. Rep. Barry Moore and challenger Jared Hudson are neck-and-neck in what has become one of the most competitive Republican primaries in Alabama in years — with the winner likely headed to Washington in a deep-red state.",
    },
    {
      id: OK_SQ832_ID,
      shortLabel: "OK SQ 832 · $15 Min Wage",
      stateLabel: "OKLAHOMA",
      state: "OK" as const,
      title: "Oklahoma State Question 832 — $15 Minimum Wage",
      subtitle: "Oklahoma · June 16, 2026",
      electionDate: "JUNE 16, 2026",
      about: "Oklahoma voters decided whether to raise the state minimum wage to $15 an hour. The yes vote passed, making Oklahoma one of the more surprising states to adopt a $15 floor.",
    },
    {
      id: 83479,
      shortLabel: "DC Mayor",
      stateLabel: "WASH. DC",
      state: "DC" as const,
      title: "DC Mayoral Democratic Primary",
      subtitle: "District of Columbia · June 16, 2026",
      electionDate: "JUNE 16, 2026",
      about: "D.C.'s mayoral race was a wide-open contest with no incumbent on the ballot, drawing a crowded field of Democrats vying to lead the nation's capital. J. Lewis George and Kenyan McDuffie emerged as the frontrunners in a race defined by debates over public safety, housing, and the city's post-pandemic identity.",
    },
    // ── JUNE 9, 2026 (archived) ────────────────────────────────────────────────
    {
      id: SC_GOV_R_ID,
      shortLabel: "SC Governor",
      stateLabel: "S. CAROLINA",
      state: "SC" as const,
      title: "SC Governor Republican Primary",
      subtitle: "South Carolina · June 9, 2026",
      electionDate: "JUNE 9, 2026",
      about: "South Carolina Republicans selected a nominee for governor in one of the most competitive open-seat primaries in the South, with Lt. Gov. Pamela Evette, Attorney General Alan Wilson, Rep. Nancy Mace, Rep. Ralph Norman, and businessman Rom Reddy all in contention. TPSI's Meridian CV model (June 3–4) showed Mace leading at 30% ahead of Trump's late endorsement of Evette, which moved prediction markets heavily in her favor. A June 23 runoff was triggered.",
    },
    {
      id: SC_SENATE_R_ID,
      shortLabel: "SC Senate",
      stateLabel: "S. CAROLINA",
      state: "SC" as const,
      title: "SC US Senate Republican Primary",
      subtitle: "South Carolina · June 9, 2026",
      electionDate: "JUNE 9, 2026",
      about: "South Carolina Republicans chose a nominee for U.S. Senate as four-term incumbent Lindsey Graham, backed by President Trump, faced a crowded field led by MAGA challenger Mark Lynch. Graham cleared 50% and avoided a runoff.",
    },
    {
      id: ME_SENATE_D_ID,
      shortLabel: "ME Senate",
      stateLabel: "MAINE",
      state: "ME" as const,
      title: "ME US Senate Democratic Primary",
      subtitle: "Maine · June 9, 2026",
      electionDate: "JUNE 9, 2026",
      about: "Maine Democrats chose a nominee to challenge incumbent Republican Susan Collins in November, with Chloe Platner winning a commanding victory over the field.",
    },
    {
      id: ME_GOV_D_ID,
      shortLabel: "ME Governor",
      stateLabel: "MAINE",
      state: "ME" as const,
      title: "ME Governor Democratic Primary",
      subtitle: "Maine · June 9, 2026",
      electionDate: "JUNE 9, 2026",
      about: "Maine Democrats selected a nominee for governor in a wide-open ranked-choice primary, with former Maine CDC Director Nirav Shah, former Senate President Troy Jackson, former House Speaker Hannah Pingree, and others competing. RCV tabulation followed the June 9 first-choice count.",
    },
    // ── JUNE 2, 2026 (archived) ────────────────────────────────────────────────
    {
      id: LA_MAYOR_ID,
      shortLabel: "LA Mayor",
      stateLabel: "CALIFORNIA",
      state: "CA" as const,
      title: "Los Angeles Mayor Open Primary",
      subtitle: "Los Angeles · June 2, 2026",
      electionDate: "JUNE 2, 2026",
      about: "Los Angeles voters chose from a crowded field in the city's mayoral open primary, with incumbent Karen Bass seeking to hold off several competitive challengers, including Nithya Raman and Spencer Pratt. If no candidate wins a majority, the top two finishers will advance to a runoff.",
    },
    {
      id: SD_GOV_ID,
      shortLabel: "SD Governor",
      stateLabel: "SOUTH DAKOTA",
      state: "SD" as const,
      title: "SD Governor Republican Primary",
      subtitle: "South Dakota Governor · June 2, 2026",
      electionDate: "JUNE 2, 2026",
      about: "South Dakota Republicans voted in a closely watched governor's primary that tested the balance of power inside the state's conservative electorate.",
    },
    {
      id: CA_GOV_ID,
      shortLabel: "CA Governor",
      stateLabel: "CALIFORNIA",
      state: "CA" as const,
      title: "California Governor Open Primary",
      subtitle: "California Governor · June 2, 2026",
      electionDate: "JUNE 2, 2026",
      about: "California's open primary for governor featured a large and ideologically diverse field competing for two spots in the November election under the state's top-two primary system.",
    },
    {
      id: IA_GOV_ID,
      shortLabel: "IA Governor",
      stateLabel: "IOWA",
      state: "IA" as const,
      title: "Iowa Governor Republican Primary",
      subtitle: "Iowa Governor · June 2, 2026",
      electionDate: "JUNE 2, 2026",
      about: "Iowa Republicans chose their nominee for governor in a primary shaped by an open-seat contest and competing claims to the party's conservative base. State rules require the winner to receive at least 35 percent of the vote, or the nomination could be decided at convention.",
    },
  ] as const;
  // Only active (non-archived) races appear as spotlight tabs
  const SPOTLIGHT_RACES = ALL_SPOTLIGHT_META.filter(s => !FEATURED.find(r => r.id === s.id)?.archived);
  const [spotlightTab, setSpotlightTab] = useState<number>(SPOTLIGHT_RACES[0]?.id ?? SC_GOV_R_RUNOFF_ID);
  const [error, setError] = useState<string | null>(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const [raceCache, setRaceCache] = useState<Record<number, RaceDetail | undefined>>({});
  const patchedRaceCache = useMemo(() => Object.fromEntries(Object.entries(raceCache).map(([id, data]) => [id, applyColorOverridesToRace(data, Number(id))])) as Record<number, RaceDetail | undefined>, [raceCache]);
  const [mapBlankSvg, setMapBlankSvg] = useState<string | null>(null);
  const [mapLoadPct, setMapLoadPct] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  const [countyCollapsed, setCountyCollapsed] = useState(false);
  const [scrollWindowSearch, setScrollWindowSearch] = useState("");
  useEffect(() => { setNowMs(Date.now()); }, []);

  const [refreshTick, setRefreshTick] = useState(0);
  const [overlay, setOverlay] = useState<null | { id: number; name: string; prob: number; color: string; reporting: number }>(null);
  const lastProjectedKeyRef = useRef<string>("");

  const featuredByState = useMemo(() => ({
  AL: FEATURED.filter((r) => r.state === "AL"),
  CA: FEATURED.filter((r) => r.state === "CA"),
  DC: FEATURED.filter((r) => r.state === "DC"),
  GA: FEATURED.filter((r) => r.state === "GA"),
  IA: FEATURED.filter((r) => r.state === "IA"),
  MD: FEATURED.filter((r) => r.state === "MD"),
  ME: FEATURED.filter((r) => r.state === "ME"),
  MT: FEATURED.filter((r) => r.state === "MT"),
  ND: FEATURED.filter((r) => r.state === "ND"),
  NJ: FEATURED.filter((r) => r.state === "NJ"),
  NM: FEATURED.filter((r) => r.state === "NM"),
  NV: FEATURED.filter((r) => r.state === "NV"),
  NY: FEATURED.filter((r) => r.state === "NY"),
  OK: FEATURED.filter((r) => r.state === "OK"),
  SC: FEATURED.filter((r) => r.state === "SC"),
  SD: FEATURED.filter((r) => r.state === "SD"),
  TX: FEATURED.filter((r) => r.state === "TX"),
  UT: FEATURED.filter((r) => r.state === "UT"),
  }), []);

  const selectedRace = patchedRaceCache[selectedId];
  const selectedMeta = useMemo(() => FEATURED.find((r) => r.id === selectedId), [selectedId]);
  const hasForecastForSelected = !!(RACE_FORECAST_DEFAULTS[selectedId]?.pollAvg && RACE_FORECAST_DEFAULTS[selectedId]?.expectedTurnout);

  async function refreshFeatured() {
    try {
      const results = await Promise.all(FEATURED.map((r) => fetchRaceById(r.id).then((d) => [r.id, d] as const)));
      setRaceCache(Object.fromEntries(results));
      setRefreshTick((t) => t + 1);
    } catch (e: any) { setError(e?.message ?? "Error refreshing."); }
  }

  useEffect(() => { refreshFeatured(); const t = setInterval(refreshFeatured, POLL_MS); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setNowMs(Date.now()), 1000); return () => clearInterval(t); }, []);
  useLayoutEffect(() => { setLoadingMap(true); setMapBlankSvg(null); setMapLoadPct(0); }, [selectedId]);

  useEffect(() => {
    let cancelled = false, raf: number | null = null, interval: any = null;
    async function loadMap() {
      const start = performance.now();
      interval = setInterval(() => { const elapsed = performance.now() - start; const eased = Math.min(92, 10 + (elapsed / 1200) * 82); setMapLoadPct((p) => (p < eased ? eased : p)); }, 60);
      const svg = await fetchRaceMapBlankSvg(selectedId);
      if (cancelled) return;
      if (interval) clearInterval(interval);
      setMapBlankSvg(svg); setMapLoadPct(100);
      raf = requestAnimationFrame(() => { if (!cancelled) setLoadingMap(false); });
    }
    loadMap();
    return () => { cancelled = true; if (interval) clearInterval(interval); if (raf) cancelAnimationFrame(raf); };
  }, [selectedId]);

  useEffect(() => {
    const first = featuredByState[activeState as keyof typeof featuredByState]?.[0];
    if (first && !FEATURED.some((r) => r.id === selectedId && r.state === activeState)) setSelectedId(first.id);
  }, [activeState, featuredByState, selectedId]);

  // Deep-link: support /results?race=<id>, /results?tab=spotlight,
  // active slug: /results/2026-06-09/south-carolina-us-senate-republican-primary
  // archived slug: /results/archive/2026-06-09/south-carolina-...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    const activeMatch = path.match(/^\/results\/([\d-]+)\/([^/]+)$/);
    const archiveMatch = path.match(/^\/results\/archive\/([\d-]+)\/([^/]+)$/);
    const slug = activeMatch?.[2] ?? archiveMatch?.[2] ?? null;
    if (slug) {
      const idFromSlug = slugToId[slug];
      if (idFromSlug) {
        if (SPOTLIGHT_RACES.some(s => s.id === idFromSlug)) { setPageTab("spotlight"); setSpotlightTab(idFromSlug); return; }
        const match = FEATURED.find(r => r.id === idFromSlug);
        if (match) { setPageTab("all"); setActiveState(match.state as any); setSelectedId(idFromSlug); return; }
      }
    }
    // Fall back to query params
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    const raceParam = params.get("race");
    if (tabParam === "spotlight" || tabParam === "ky04") { setPageTab("spotlight"); return; }
    if (raceParam) {
      const id = Number(raceParam);
      if (SPOTLIGHT_RACES.some(s => s.id === id)) { setPageTab("spotlight"); setSpotlightTab(id); return; }
      const match = FEATURED.find((r) => r.id === id);
      if (match) {
        setPageTab("all");
        setActiveState(match.state as any);
        setSelectedId(id);
      }
    }
  }, []);

  // Push URL & document.title whenever the selected race/tab changes
  const isInitialUrlRead = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isInitialUrlRead.current) { isInitialUrlRead.current = false; return; }
    const activeRaceId = pageTab === "spotlight" ? spotlightTab : selectedId;
    const raceUrl = getRaceUrl(activeRaceId);
    if (raceUrl) {
      window.history.replaceState(null, "", raceUrl);
    } else {
      const params = new URLSearchParams();
      if (pageTab === "spotlight") { params.set("tab", "spotlight"); params.set("race", String(spotlightTab)); }
      else { params.set("race", String(selectedId)); }
      window.history.replaceState(null, "", `?${params.toString()}`);
    }
    // Update document title
    const activeId = pageTab === "spotlight" ? spotlightTab : selectedId;
    const featuredMeta = FEATURED.find(r => r.id === activeId);
    const spotMeta = ALL_SPOTLIGHT_META.find(s => s.id === activeId);
    const raceName = idToLabel[activeId] ?? featuredMeta?.label ?? spotMeta?.title ?? "Election Results";
    document.title = `${raceName} · TPSI Results`;
  }, [pageTab, spotlightTab, selectedId]);

  // OVERLAY DISABLED — projection winner popup turned off
  // useEffect(() => {
  //   const race = selectedRace; if (!race?.candidates?.length) return;
  //   const reporting = race.percent_reporting ?? 0;
  //   if (race.candidates.find((c) => c.winner)) return; if (reporting < 5) return;
  //   const ordered = [...race.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
  //   if (ordered.length < 2) return;
  //   const leader = ordered[0], runnerUp = ordered[1];
  //   const prob = calculateWinProbability(leader.votes, runnerUp.votes, reporting);
  //   if (prob < 90) return;
  //   const key = `${selectedId}:${leader.name}:${Math.floor(prob)}:${Math.floor(reporting)}`;
  //   if (key === lastProjectedKeyRef.current) return;
  //   lastProjectedKeyRef.current = key;
  //   setOverlay({ id: selectedId, name: leader.name, prob, color: leader.color || "var(--purple-soft)", reporting });
  //   const t = setTimeout(() => setOverlay(null), 5200);
  //   return () => clearTimeout(t);
  // }, [selectedRace, selectedId]);

  const stateLabels: Record<string, string> = { AL: "ALABAMA", CA: "CALIFORNIA", DC: "WASH. DC", GA: "GEORGIA", IA: "IOWA", MD: "MARYLAND", ME: "MAINE", MT: "MONTANA", ND: "N. DAKOTA", NJ: "NEW JERSEY", NM: "NEW MEXICO", NV: "NEVADA", NY: "NEW YORK", OK: "OKLAHOMA", SC: "S. CAROLINA", SD: "S. DAKOTA", TX: "TEXAS", UT: "UTAH" };
  const activeStates = (["SC", "MD", "NY", "UT", "GA", "AL", "DC", "OK", "ME", "NV", "ND", "CA", "IA", "MT", "NJ", "NM", "SD", "TX"] as const).filter(
    st => FEATURED.some(r => r.state === st && !r.archived)
  );

  // Archive date → states mapping
  const ARCHIVE_DATES: { label: string; date: string; states: string[] }[] = [
    { label: "MAY 26, 2026", date: "2026-05-26", states: ["TX"] },
    { label: "JUNE 2, 2026", date: "2026-06-02", states: ["CA", "IA", "MT", "NJ", "NM", "SD"] },
    { label: "JUNE 9, 2026", date: "2026-06-09", states: ["SC", "ME", "NV", "ND"] },
    { label: "JUNE 16, 2026", date: "2026-06-16", states: ["GA", "AL", "DC", "OK"] },
  ];
  const archiveDateStates = ARCHIVE_DATES.find(d => d.date === archiveDate)?.states ?? [];

  // Close archive dropdown on outside click
  useEffect(() => {
    if (!archiveDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (archiveDropdownRef.current && !archiveDropdownRef.current.contains(e.target as Node)) {
        setArchiveDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [archiveDropdownOpen]);
  // When switching to spotlight tab (or changing spotlight sub-tab), sync selectedId + activeState
  useEffect(() => {
    if (pageTab === "spotlight") {
      const meta = ALL_SPOTLIGHT_META.find(s => s.id === spotlightTab);
      setSelectedId(spotlightTab);
      if (meta) setActiveState(meta.state);
    }
  }, [pageTab, spotlightTab]);

  const racesForState = pageTab === "all"
    ? (allRacesStateFilter ? (featuredByState[allRacesStateFilter as keyof typeof featuredByState] ?? []) : FEATURED)
    : (featuredByState[activeState as keyof typeof featuredByState] ?? []);

  const selectedReporting = selectedRace?.percent_reporting ?? 0;
  const selectedCloseDate = parseIsoDate(selectedRace?.polls_close ?? null);
  const selectedCloseLocal = selectedCloseDate ? formatLocalCloseTime(selectedCloseDate) : "—";
  const selectedMsLeft = selectedCloseDate ? selectedCloseDate.getTime() - nowMs : null;
  const selectedProj = useMemo(() => {
    if (!selectedRace) return null;
    const reporting = selectedRace.percent_reporting ?? 0;
    if (reporting < 5) return null;
    return getRaceProjectionAlways(selectedRace);
  }, [selectedRace]);
  const selectedWinner = selectedRace?.candidates?.find((c) => c.winner);
  const selectedRaceIsMajority = (RACE_FORECAST_DEFAULTS[selectedId]?.raceRule !== undefined &&
    RACE_FORECAST_DEFAULTS[selectedId]?.raceRule !== "PLURALITY" &&
    RACE_FORECAST_DEFAULTS[selectedId]?.raceRule !== "TOP_TWO") ||
    [44285,44286,44287,44288,44289,44290,44291,44292,44293,44295,44344,44729,44730,44209,44208].includes(selectedId);
  const selectedRaceIsTopTwo = RACE_FORECAST_DEFAULTS[selectedId]?.raceRule === "TOP_TWO";
  const selectedWinners = selectedRace?.candidates?.filter((c) => c.winner) ?? [];
  const isRunoffConfirmed = selectedRaceIsMajority && selectedWinners.length >= 2;
  const [forecastProj, setForecastProj] = useState<{ raceId: number; leader: string; prob: number; runoffNeededProb: number; projectionType: "WIN" | "RUNOFF"; runoffProbs?: Record<string, number> } | null>(null);
  useEffect(() => { setForecastProj(null); }, [selectedId]);
  // Locked forecast calls — once set at >99.73%, never retracted for that race
  const [lockedCalls, setLockedCalls] = useState<Record<number, string>>({});
  const [lockedCallTypes, setLockedCallTypes] = useState<Record<number, "WIN" | "RUNOFF">>({}); 
  const [lockedRunoffProbs, setLockedRunoffProbs] = useState<Record<number, Record<string, number>>>({});
  const showProjectionDebug = process.env.NODE_ENV !== "production";
  // Spotlight meta for the currently selected race (null when not a spotlight race)
  const spotlightMeta = SPOTLIGHT_RACES.find(s => s.id === selectedId) ?? null;
  const selectedStatusInfo = getRaceStatusInfo(nowMs, selectedRace?.polls_open, getEffectivePollsCloseIso(selectedId, selectedRace?.province, selectedRace?.polls_close), spotlightMeta?.electionDate ?? "");
  // Close time: prefer race-level override → state-level override → API
  const _closeIsoOverride = getEffectivePollsCloseIso(selectedId, selectedRace?.province, selectedRace?.polls_close);
  const effectiveCloseDate = _closeIsoOverride ? parseIsoDate(_closeIsoOverride) : selectedCloseDate;
  const effectiveCloseLocal = effectiveCloseDate ? formatLocalCloseTime(effectiveCloseDate) : selectedCloseLocal;
  const effectiveMsLeft = effectiveCloseDate ? effectiveCloseDate.getTime() - nowMs : selectedMsLeft;
  // Reporting: prefer code override if set, then API
  const _reportingOverride = RACE_FORECAST_DEFAULTS[selectedId]?.overrideReporting;
  const effectiveReporting = (typeof _reportingOverride === "number" && _reportingOverride > 0) ? _reportingOverride : selectedReporting;
  // Display-only: cap at "99" when > 99 to avoid showing 100%
  const displayReportingStr = effectiveReporting > 99 ? ">99" : effectiveReporting.toFixed(1);
  // Total votes reported
  const selectedTotalVotes = selectedRace?.candidates?.reduce((s, c) => s + (c.votes ?? 0), 0) ?? 0;
  // API-based projection fallback (used when ForecastPanel has not produced a result)
  const selectedApiProj = selectedProj ? { leader: selectedProj.leaderName, prob: selectedProj.prob, runoffNeededProb: 0, projectionType: "WIN" as const } : null;
  const effectiveProj = (forecastProj?.raceId === selectedId ? forecastProj : null) ?? selectedApiProj;
  // Don't show a lean/projection until precincts start reporting
  const displayProj = selectedReporting > 0 ? effectiveProj : null;
  // Auto-call: forecast races called at >99.73% (3σ); once locked, never retracted
  const liveForecastCalled = hasForecastForSelected && forecastProj?.raceId === selectedId && effectiveReporting > 0 && (forecastProj?.prob ?? 0) > 99.73 ? forecastProj!.leader : null;
  useEffect(() => {
    if (liveForecastCalled && selectedId && !lockedCalls[selectedId]) {
      setLockedCalls(prev => ({ ...prev, [selectedId]: liveForecastCalled }));
      setLockedCallTypes(prev => ({ ...prev, [selectedId]: forecastProj?.projectionType ?? "WIN" }));
    }
  }, [liveForecastCalled, selectedId]);
  const manualWinner = RACE_FORECAST_DEFAULTS[selectedId]?.manualCall ?? null;
  const forecastCalled = lockedCalls[selectedId] ?? liveForecastCalled;
  // If a MAJORITY race has a single outright winner (>50%), override any locked runoff call
  const _singleOfficialWinner = selectedRace?.candidates?.find(c => c.winner);
  const _outright = selectedRaceIsMajority && _singleOfficialWinner && !isRunoffConfirmed;
  const effectiveForecastCalled = _outright ? (_singleOfficialWinner?.name ?? forecastCalled) : forecastCalled;
  const effectiveForecastCalledType = _outright ? "WIN" : (lockedCallTypes[selectedId] ?? forecastProj?.projectionType ?? "WIN");

  const timeStr = nowMs > 0
    ? new Date(nowMs).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  return (
    <>
      <style>{`
        .res-root {
          --rep: #e63946; --dem: #3b82f6; --win: #4ade80;
        }
        html, body { overflow-x: hidden; max-width: 100%; }
        @keyframes res-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes res-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.35; transform:scale(0.82); } }
        @keyframes county-pop { 0% { filter:brightness(1); } 40% { filter:brightness(2.2) saturate(1.4); } 100% { filter:brightness(1); } }
        @keyframes res-loading-pulse { 0%,100% { opacity:0.4; } 50% { opacity:1; } }
        @keyframes fcst-pie-think { 0%,100% { transform: rotate(-12deg); } 50% { transform: rotate(12deg); } }
        @keyframes fcst-pie-ring { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes fcst-eq-1 { 0%,100% { height: 28px; } 50% { height: 10px; } }
        @keyframes fcst-eq-2 { 0%,100% { height: 16px; } 50% { height: 38px; } }
        @keyframes fcst-eq-3 { 0%,100% { height: 38px; } 33% { height: 12px; } 66% { height: 30px; } }
        .county-pop { animation: county-pop 520ms ease-out; }
        @keyframes county-updated { 0% { filter:brightness(1) saturate(1); } 12% { filter:brightness(3.2) saturate(2.0); } 35% { filter:brightness(2.0) saturate(1.4); } 100% { filter:brightness(1) saturate(1); } }
        .county-updated { animation: county-updated 1200ms cubic-bezier(0.22,1,0.36,1); }
        .res-tri-stripe { height:3px; width:100%; background:linear-gradient(90deg,var(--red) 0%,var(--purple) 50%,var(--blue) 100%); flex-shrink:0; box-shadow:0 4px 18px -2px rgba(124,58,237,0.28); }
        .res-live-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--rep); box-shadow:0 0 8px rgba(230,57,70,0.7); animation:res-pulse 1.8s ease-in-out infinite; flex-shrink:0; }
        .res-eyebrow { display:flex; align-items:center; gap:7px; font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--muted); }
        .res-note { font-family:var(--font-body); font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:var(--muted2); }
        .res-th { font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:var(--muted2); }
        .res-num { font-family:var(--font-body); font-size:10.5px; color:var(--muted); font-variant-numeric:tabular-nums; }
        .res-pct-big { font-family:var(--font-numeric); font-size:13px; font-weight:800; color:var(--foreground); font-variant-numeric:tabular-nums; }
        .res-pct-xl { font-family:var(--font-numeric); font-size:15px; font-weight:800; color:var(--foreground); font-variant-numeric:tabular-nums; line-height:1; }
        .res-pct-topline { font-family:var(--font-numeric); font-size:clamp(16px,1.8vw,22px); font-weight:800; color:var(--foreground); font-variant-numeric:tabular-nums; line-height:1; }
        .res-stat-label { font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; color:var(--muted2); }
        .res-stat-val { font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.14em; color:var(--muted); }
        .res-stat-row { display:flex; align-items:center; justify-content:space-between; }
        .res-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.10em; text-transform:uppercase; border:1px solid var(--border2); background:var(--panel2); color:var(--muted); border-radius:var(--r-pill); }
        .res-badge-purple { border-color:rgba(124,58,237,0.40); background:rgba(124,58,237,0.08); color:var(--purple-soft); }
        .res-badge-win { border-color:rgba(74,222,128,0.28); background:rgba(74,222,128,0.08); color:var(--win); }
        .res-badge-red { border-color:rgba(230,57,70,0.30); background:rgba(230,57,70,0.08); color:var(--rep); }
        .res-badge-blue { border-color:rgba(59,130,246,0.30); background:rgba(59,130,246,0.08); color:var(--dem); }
        .res-bar-track { width:100%; height:3px; background:var(--border2); position:relative; overflow:hidden; }
        .res-bar-fill { position:absolute; top:0; left:0; bottom:0; background:var(--purple); transition:width 600ms cubic-bezier(0.22,1,0.36,1); }
        .res-panel { background:var(--panel); border:1px solid var(--border); overflow:hidden; animation:res-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both; border-radius:var(--r-lg); box-shadow:var(--shadow-sm); position:relative; }
        .res-panel::before { content:''; position:absolute; top:0; left:0; right:0; height:22px; background:linear-gradient(90deg,var(--red) 0%,var(--purple) 50%,var(--blue) 100%); border-radius:var(--r-lg) var(--r-lg) 0 0; -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; padding:2.5px 2.5px 0 2.5px; pointer-events:none; z-index:2; }
        .res-panel-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--border); background:var(--panel2); border-radius:var(--r-lg) var(--r-lg) 0 0; }
        .res-panel-tag { font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.20em; text-transform:uppercase; color:var(--purple-soft); }
        .res-stat-block { background:var(--panel2); border:1px solid var(--border); padding:10px 12px; border-radius:var(--r-sm); }
        :root:not([data-theme="dark"]) .res-stat-block { background:#f2f2f2; border-color:#e0e0e0; }
        .res-stat-block-label { font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:var(--muted2); margin-bottom:4px; }
        .res-stat-block-val { font-family:var(--font-numeric); font-size:clamp(20px,2.5vw,28px); font-weight:800; color:var(--foreground); line-height:1; font-variant-numeric:tabular-nums; }
        .res-btn-primary { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; background:var(--gradient-purple); border:1px solid rgba(124,58,237,0.65); color:#fff; font-family:var(--font-numeric); font-size:13px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; cursor:pointer; box-shadow:var(--shadow-purple); transition:background 140ms ease,transform 140ms ease; border-radius:var(--r-pill); }
        .res-btn-primary:hover { background:var(--gradient-purple-soft); transform:translateY(-1px); }
        .res-btn-ghost { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; background:transparent; border:1px solid var(--border); color:var(--muted2); font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; cursor:pointer; transition:all 140ms ease; border-radius:var(--r-pill); }
        .res-btn-ghost:hover { border-color:var(--border2); color:var(--muted); }
        .res-btn-state { display:inline-flex; align-items:center; justify-content:center; text-align:center; padding:4px 13px; background:linear-gradient(135deg,rgba(124,58,237,0.12) 0%,rgba(99,102,241,0.07) 100%); border:1px solid rgba(124,58,237,0.35); color:rgba(180,160,235,0.80); font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; cursor:pointer; transition:all 150ms ease; position:relative; border-radius:var(--r-pill); box-shadow:none; }
        .res-btn-state:hover { color:rgba(200,180,255,0.85); border-color:rgba(124,58,237,0.38); background:linear-gradient(135deg,rgba(124,58,237,0.16) 0%,rgba(99,102,241,0.10) 100%); box-shadow:0 0 8px rgba(124,58,237,0.18); transform:translateY(-1px); }
        .res-btn-state:active { transform:translateY(0px) scale(0.97); box-shadow:0 0 4px rgba(124,58,237,0.15); }
        .res-btn-state:hover::before { transform:scaleX(1); }
        .res-btn-state.active { background:linear-gradient(135deg,rgba(124,58,237,0.28) 0%,rgba(99,102,241,0.18) 100%); border-color:rgba(124,58,237,0.55); color:rgba(200,180,255,0.95); box-shadow:0 0 12px rgba(124,58,237,0.35),0 0 3px rgba(124,58,237,0.22); }
        .res-btn-state.active::before { display:none; }
        .res-btn-state.active:active { transform:scale(0.97); }
        .res-close-btn { display:inline-flex; align-items:center; padding:7px 12px; background:var(--panel2); border:1px solid var(--border); color:var(--muted2); font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; cursor:pointer; flex-shrink:0; transition:all 120ms ease; border-radius:var(--r-sm); }
        .res-close-btn:hover { border-color:var(--border2); color:var(--foreground); }
        .res-overlay-card { background:var(--panel); border:1px solid rgba(124,58,237,0.45); box-shadow:0 0 80px rgba(124,58,237,0.25),0 30px 80px rgba(0,0,0,0.8); }
        .res-overlay-title { font-family:var(--font-body); font-size:clamp(32px,4vw,48px); font-weight:900; text-transform:uppercase; letter-spacing:0.02em; color:var(--foreground); line-height:0.92; }
        .res-overlay-name { font-family:var(--font-body); font-size:clamp(18px,2.5vw,26px); font-weight:700; text-transform:uppercase; letter-spacing:0.06em; }
        .res-map-tooltip { background:var(--panel); border:1px solid rgba(124,58,237,0.45); box-shadow:var(--shadow-md); border-radius:var(--r-md); }
        .res-map-tooltip .res-tooltip-title { font-size:12.6px; }
        .res-map-tooltip .res-th { font-size:9.8px; }
        .res-map-tooltip .res-num { font-size:9.8px; }
        .res-map-tooltip .res-pct-big { font-size:11.2px; }
        .res-map-tooltip .res-cand-name { font-size:9.8px; }
        .res-map-tooltip .res-cand-party { font-size:8.4px; }
        .res-map-tooltip .res-note { font-size:9.8px; }
        .res-tooltip-title { font-family:var(--font-body); font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--foreground); }
        .res-reporting-row { display:flex; align-items:center; justify-content:space-between; }
        .res-candidate-list { background:transparent; overflow:visible; }
        .res-candidate-row { display:flex; align-items:center; gap:0; border-bottom:1px solid var(--border); padding:10px 14px; transition:background 120ms ease; position:relative; }
        .res-candidate-row:last-child { border-bottom:none; }
        .res-candidate-row:hover { background:rgba(124,58,237,0.04); }
        .res-cand-bar { width:3px; position:absolute; left:0; top:8px; bottom:8px; opacity:0.7; border-radius:2px; }
        .res-cand-dot { display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .res-cand-name { font-family:var(--font-body); font-size:12px; font-weight:700; letter-spacing:0.06em; color:var(--foreground); }
        .res-cand-name-lg { font-family:var(--font-body); font-size:13px; font-weight:900; letter-spacing:0.06em; text-transform:uppercase; color:var(--foreground); }
        .res-cand-party { font-family:var(--font-body); font-size:9px; letter-spacing:0.10em; text-transform:uppercase; color:var(--muted2); margin-top:1px; }
        .res-thead { position:sticky; top:0; background:var(--panel2); border-bottom:1px solid var(--border); }
        .res-table-row { border-bottom:1px solid var(--border); transition:background 100ms ease; }
        .res-table-row:hover { background:rgba(124,58,237,0.04); }
        .res-input { width:100%; background:var(--panel2); border:1px solid var(--border2); color:var(--foreground); padding:8px 12px; font-family:var(--font-body); font-size:12px; letter-spacing:0.04em; outline:none; transition:border-color 140ms ease; border-radius:var(--r-sm); }
        .res-input:focus { border-color:rgba(124,58,237,0.40); }
        .res-input::placeholder { color:var(--muted2); }
        .res-select { background:var(--panel2); border:1px solid var(--border); color:var(--muted2); padding:8px 12px; font-family:var(--font-body); font-size:11px; letter-spacing:0.08em; outline:none; border-radius:var(--r-sm); }
        .res-error { border:1px solid rgba(230,57,70,0.25); background:rgba(230,57,70,0.06); color:rgba(255,77,90,0.90); padding:12px 16px; font-family:var(--font-body); font-size:10.5px; letter-spacing:0.12em; }
        .res-map-loading { display:flex; align-items:center; justify-content:center; aspect-ratio:4/3; background:rgba(255,255,255,0.30); border:1px solid var(--border); }
        .res-map-wrap { background:rgba(0,0,0,0.20); border:1px solid var(--border); padding:6px; }

        /* ── STATUS BAR ── */
        .res-status-bar { background:transparent; padding:7px 0; }
        .res-status-bar-inner { max-width:1240px; margin:0 auto; padding:0 10px; display:flex; align-items:center; justify-content:space-between; gap:12px; }

        /* ── PAGE HEADER ── */
        .res-page-header { background:transparent; position:relative; }
        .res-page-header-inner { max-width:1240px; margin:0 auto; padding:16px 10px; position:relative; }
        .res-page-title { font-family:var(--font-display); font-size:clamp(22px,2.8vw,44px); font-weight:900; text-transform:uppercase; letter-spacing:-0.01em; color:var(--foreground); line-height:0.92; margin:0; }
        .res-page-title em { font-style:normal; background:linear-gradient(100deg,var(--red2) 0%,var(--purple-soft) 50%,var(--blue2) 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .res-page-sub { font-family:var(--font-body); font-size:10px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase; color:var(--purple-soft); margin-bottom:8px; }

        /* ════════════════════════════════════════
           LAYOUT — desktop / tablet / mobile
        ════════════════════════════════════════ */

        /* ── MAIN BODY ── */
        .res-body {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 300px minmax(0, 590px) 320px;
          grid-template-rows: auto;
          align-items: stretch;
          gap: 8px;
          padding: 8px 10px;
          box-sizing: border-box;
        }

        /* ── LEFT RACE PICKER (desktop only) ── */
        .res-race-picker {
          display: flex;
          flex-direction: column;
          min-height: 400px;
          max-height: 1616px;
          overflow: hidden;
        }
        .res-race-picker > .res-panel {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* ── CENTER SPLIT: map + county ── */
        .res-center-split {
          display: flex;
          flex-direction: column;
          min-height: 600px;
          max-height: 1616px;
          overflow: hidden;
        }
        .res-center-split > .res-map-panel {
          height: 500px;
          min-height: 500px;
          max-height: 500px;
          flex: none;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .res-center-split > .res-map-panel .res-map-body {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 0 !important;
        }
        .res-map-wrap {
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: stretch;
          background: var(--background2);
        }
        .res-map-wrap svg, .res-map-wrap > div {
          width: 100% !important;
          height: 100% !important;
        }
        /* County fills all remaining space below map */
        .res-inline-county {
          flex: 1;
          min-height: 200px;
          overflow: hidden;
        }
        .res-inline-county .res-county-table-wrap { max-height: none !important; }
        .res-center-split > .res-map-panel { border-bottom-left-radius: 0 !important; border-bottom-right-radius: 0 !important; }
        .res-inline-county > .res-panel { height: 100% !important; display: flex !important; flex-direction: column; overflow: hidden; border-top: none; border-radius: 0 0 var(--r-lg) var(--r-lg); }
        .res-inline-county > .res-panel::before { content: none; }
        .res-inline-county > .res-panel > div:last-child { flex: 1; overflow-y: auto !important; max-height: none !important; min-height: 0; }
        /* ── RIGHT RAIL ── */
        .res-right-rail {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow: hidden;
          max-height: 1616px;
          align-self: start;
        }
        /* Race status: fixed 300px */
        .res-right-rail > .res-race-status-panel {
          flex: none;
          height: auto;
          overflow: visible;
          display: flex;
          flex-direction: column;
        }
        /* Topline: natural height, scrolls if content exceeds cap */
        .res-right-rail > .res-topline-panel {
          flex: none;
          min-height: 180px;
          max-height: 520px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        /* Forecast: natural height (shrinks when no data), capped for scroll */
        .res-forecast-wrap {
          flex: none;
          height: auto;
          max-height: 560px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .res-forecast-wrap > .res-panel {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .res-forecast-wrap > .res-panel .res-forecast-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          scrollbar-gutter: stable both-edges;
        }

        /* ── THIN SCROLLBAR — topline + forecast ── */
        .res-topline-body::-webkit-scrollbar,
        .res-forecast-body::-webkit-scrollbar { width: 4px; }
        .res-topline-body::-webkit-scrollbar-track,
        .res-forecast-body::-webkit-scrollbar-track { background: transparent; }
        .res-topline-body::-webkit-scrollbar-thumb,
        .res-forecast-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

        /* ── COMPACT RACE SCROLL (tablet only, hidden by default) ── */
        .res-race-scroll-window {
          display: none;
          flex-direction: column;
          background: var(--panel);
          border: 1px solid var(--border);
          overflow: hidden;
          max-height: 240px;
          flex-shrink: 0;
        }

        /* ── MOBILE RACE SELECTOR BAR (hidden by default) ── */
        .res-mobile-race-strip {
          display: none;
          background: var(--background2);
          border-bottom: 1px solid var(--border);
          padding: 8px 14px;
          align-items: center;
          gap: 10px;
        }

        /* ── FULL-WIDTH BOTTOM ── */
        .res-bottom { display: none; }

        /* ── TABLET INLINE COUNTY TABLE ── */
        .res-tablet-county { display: none; }

        /* ════ TABLET 641px–900px ════ */
        @media (min-width: 641px) and (max-width: 1080px) {
          .res-body {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            align-items: start !important;
            column-gap: 10px !important;
            row-gap: 0 !important;
            padding: 10px 14px !important;
            height: auto !important;
          }

          /* LEFT COLUMN — race picker is the left col container */
          .res-race-picker {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            grid-column: 1 !important;
            grid-row: 1 !important;
            height: auto !important;
            overflow: visible !important;
            max-height: none !important;
            padding-bottom: 10px !important;
          }

          /* RIGHT COLUMN — right rail spans both rows */
          .res-right-rail {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            grid-column: 2 !important;
            grid-row: 1 / 3 !important;
            height: auto !important;
            overflow: visible !important;
            max-height: none !important;
            align-self: start !important;
          }

          /* Map+county — left col, row 2 (directly below race picker) */
          .res-center-split {
            grid-column: 1 !important;
            grid-row: 2 !important;
            width: 100% !important;
            flex-shrink: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }

          /* Left col items — stack naturally */
          .res-spotlight-hero   { width: 100% !important; flex-shrink: 0 !important; }
          .res-race-picker-list { width: 100% !important; flex-shrink: 0 !important; height: 420px !important; overflow: hidden !important; }
          .res-forecast-wrap    { width: 100% !important; flex-shrink: 0 !important; height: auto !important; max-height: none !important; overflow: visible !important; }
          .res-topline-panel    { width: 100% !important; flex-shrink: 0 !important; height: auto !important; max-height: none !important; overflow: visible !important; }
          .res-spotlight-about  { width: 100% !important; flex-shrink: 0 !important; }

          /* Right col items — stack naturally inside rail */
          .res-race-status-panel { width: 100% !important; flex-shrink: 0 !important; height: auto !important; overflow: visible !important; }

          /* Map fixed height on tablet */
          .res-center-split > .res-map-panel {
            height: 380px !important;
            min-height: 380px !important;
            max-height: 380px !important;
          }

          /* Hide mobile/desktop-only chrome */
          .res-race-scroll-window { display: none !important; }
          .res-mobile-race-strip  { display: none !important; }
          .res-bottom             { display: none !important; }
        }

        /* ════ MOBILE ≤640px ════ */
        @media (max-width: 640px) {
          .res-root { display: flex; flex-direction: column; }
          .res-body {
            order: 2;
            display: flex !important;
            flex-direction: column;
            grid-template-columns: unset;
            grid-template-rows: unset;
            height: auto !important;
            min-height: unset !important;
            padding: 8px 10px;
            gap: 10px;
          }
          /* Reset all fixed desktop heights */
          .res-race-picker { display: contents !important; }
          .res-spotlight-hero { order: 0; width: 100%; box-sizing: border-box; }
          .res-spotlight-about { order: 20; width: 100%; box-sizing: border-box; }
          .res-race-picker-list { display: flex !important; flex-direction: column; order: 0; height: 300px; overflow: hidden; width: 100%; box-sizing: border-box; }
          /* Break rail apart so forecast can be ordered between race-status and topline */
          .res-right-rail { display: contents !important; }
          .res-right-rail > .res-race-scroll-window { display: none !important; }
          .res-right-rail > .res-race-status-panel { order: 1; height: auto !important; min-height: unset !important; max-height: unset !important; overflow: visible !important; flex: none; width: 100%; box-sizing: border-box; }
          .res-forecast-wrap { order: 2; height: auto !important; min-height: unset !important; max-height: unset !important; flex: none !important; overflow: visible; width: 100%; box-sizing: border-box; }
          .res-forecast-wrap > .res-panel { overflow: visible; height: auto !important; width: 100%; }
          .res-forecast-wrap > .res-panel .res-forecast-body { overflow-y: visible; max-height: none; height: auto !important; }
          .res-right-rail > .res-topline-panel { order: 3; height: auto !important; min-height: unset !important; max-height: unset !important; overflow: visible !important; flex: none; width: 100%; box-sizing: border-box; }
          .res-race-status-panel { flex: none !important; overflow: visible !important; }
          /* Center: map + county wrapped as one card, clearly separated from sections above */
          .res-center-split { order: 4 !important; height: auto !important; min-height: unset !important; width: 100%; box-sizing: border-box; margin-top: 6px; border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden; display: flex; flex-direction: column; position: relative; }
          .res-center-split::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 22px; background: linear-gradient(90deg,var(--red) 0%,var(--purple) 50%,var(--blue) 100%); border-radius: var(--r-lg) var(--r-lg) 0 0; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; padding: 2.5px 2.5px 0 2.5px; pointer-events: none; z-index: 2; }
          .res-center-split > .res-map-panel { height: auto !important; min-height: unset !important; max-height: unset !important; overflow: hidden; width: 100%; box-sizing: border-box; border: none !important; border-radius: 0 !important; box-shadow: none !important; }
          .res-center-split > .res-map-panel .res-map-body { flex: none; padding: 6px 10px !important; }
          .res-center-split > .res-map-panel::before { content: none !important; }
          .res-map-wrap { height: auto !important; width: 100%; }
          .res-map-wrap svg, .res-map-wrap > div { width: 100% !important; height: auto !important; }
          .res-inline-county { display: block !important; height: auto !important; overflow: visible !important; border-top: 1px solid var(--border) !important; }
          .res-inline-county > .res-panel { height: auto !important; max-height: none !important; overflow: visible !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; }
          .res-inline-county > .res-panel > div:last-child { overflow-y: visible !important; max-height: none !important; }
          /* County shown inline — hide res-bottom on mobile */
          .res-bottom { display: none !important; }
          .res-race-scroll-window { display: flex; max-height: 190px; flex-shrink: 0; }
          .res-mobile-race-search { order: 1; }
          /* Prevent horizontal overflow on mobile */
          .res-root { overflow-x: hidden; max-width: 100vw; }
          .res-page-tabs-wrap { overflow-x: visible; }
          .res-page-tabs { overflow-x: visible; flex-wrap: wrap; gap: 2px; padding: 4px 6px; }
          .res-page-tab { flex-shrink: 0; font-size: 10px; padding: 6px 10px; }
          .res-page-tab.ky04-tab { font-size: 9px; padding: 5px 9px; }
          .res-page-tab .tab-dot { width: 5px; height: 5px; }
          .res-state-btns { flex-wrap: wrap; overflow-x: visible; flex-shrink: unset; max-width: 100%; }
          .res-state-btns .res-btn-state { flex: 0 0 calc(33.333% - 1px); min-width: 0; justify-content: center; white-space: normal; overflow: visible; word-break: break-word; }
          .res-race-status-panel > .res-panel-header { border-bottom: none; }
          .res-mobile-race-strip { display: none !important; }
          .res-mobile-race-search { display: none !important; }
          .res-page-header-inner > div { flex-wrap: wrap; }
        }

        /* ── TABLET RACE SEARCH (top of right rail, tablet only) ── */
        .res-tablet-race-search { display: none !important; }

        /* ── MOBILE RACE LIST (phones only, above map) ── */
        .res-mobile-race-search { display: none; }
        @media (max-width: 640px) {
          .res-mobile-race-search { display: block; }
          .res-mobile-race-search .res-race-scroll-window { display: flex !important; margin: 8px 10px 0; }
        }


        .res-race-select {
          flex: 1; appearance: none; -webkit-appearance: none;
          background: var(--panel); border: 1px solid var(--border); color: var(--foreground);
          padding: 8px 32px 8px 12px; font-family: var(--font-body); font-size: 10px;
          font-weight: 700; letter-spacing: 0.06em; outline: none; cursor: pointer;
          transition: border-color 140ms ease; min-width: 0;
          background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(15,16,32,0.50)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 10px center;
        }
        .res-race-select:focus { border-color: rgba(124,58,237,0.5); }
        .res-race-select option { background: #ffffff; color: #0b0d1c; font-weight: 600; }
        .res-race-select optgroup { color: rgba(15,16,32,0.50); font-size: 9px; }

        * { scrollbar-width:thin; scrollbar-color:rgba(15,16,32,0.12) transparent; }
        *::-webkit-scrollbar { width:3px; height:3px; }
        *::-webkit-scrollbar-thumb { background:rgba(15,16,32,0.12); }
        *::-webkit-scrollbar-thumb:hover { background:rgba(124,58,237,0.4); }
        @media (prefers-reduced-motion:reduce) { .res-bar-fill,.res-btn-primary,.res-btn-ghost,.res-btn-state { transition:none !important; } .res-live-dot { animation:none !important; } }
        input[type=range] { height:4px; cursor:pointer; }

        /* ── PAGE TABS ── */
        .res-page-tabs { display:flex; align-items:center; background:transparent; border-bottom:1px solid var(--border); padding:0 10px; gap:4px; max-width:1240px; margin:0 auto; width:100%; box-sizing:border-box; }
        .res-page-tabs-wrap { border-bottom:1px solid var(--border); }
        .res-page-tabs { border-bottom:none; }
        .res-page-tab { display:flex; align-items:center; gap:7px; padding:8px 14px; background:transparent; border:1px solid transparent; border-radius:var(--r-sm); color:var(--muted); font-family:var(--font-body); font-size:12px; font-weight:700; letter-spacing:0.10em; text-transform:uppercase; cursor:pointer; transition:color 140ms ease,background 140ms ease,border-color 140ms ease; white-space:nowrap; margin:6px 0; }
        .res-page-tab:hover { color:var(--foreground); background:var(--panel2); }
        .res-page-tab.active { color:var(--foreground); background:var(--panel); border-color:var(--border2); box-shadow:var(--shadow-sm); }
        .res-all-tab { color:var(--foreground); border-color:var(--border2); background:var(--panel); }
        .res-all-tab:hover { border-color:var(--purple); background:var(--panel2); }
        .res-all-tab.active { background:rgba(124,58,237,0.08); border-color:var(--purple); color:var(--purple); box-shadow:var(--shadow-sm); }
        .res-page-tab.ky04-tab.active { background:rgba(124,58,237,0.08); border-color:rgba(124,58,237,0.30); color:var(--purple); }
        .res-page-tab .tab-dot { width:6px; height:6px; border-radius:50%; background:var(--rep); flex-shrink:0; animation:res-pulse 1.8s ease-in-out infinite; }
        .res-page-tab.ky04-tab .tab-dot { background:var(--purple); }
        @keyframes spotlight-flash { 0%,100%{box-shadow:0 0 0 rgba(124,58,237,0);} 50%{box-shadow:0 0 18px rgba(124,58,237,0.30);} }
        .ky04-tab.active { animation: spotlight-flash 2.8s ease-in-out infinite; }

        /* ── SPOTLIGHT ── */
        .ky04-hero-strip { max-width:1240px; margin:0 auto; padding:0 10px 8px; display:flex; gap:8px; box-sizing:border-box; }
        .ky04-hero-card { background:linear-gradient(135deg,var(--red) 0%,var(--purple) 55%,var(--blue) 100%); border-radius:var(--r-lg); border:none; flex-shrink:0; width:280px; padding:18px 16px 16px; position:relative; overflow:hidden; box-shadow:var(--shadow-md); }
        .ky04-hero-card::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 80% 120% at 105% 50%,rgba(255,255,255,0.12) 0%,transparent 65%); pointer-events:none; }
        :root:not([data-theme="dark"]) .ky04-hero-card { opacity: 0.8; }
        @media (max-width:900px) { .ky04-hero-strip { flex-direction:column; } .ky04-hero-card { width:100%; } }
      `}</style>

      <main className="res-root" style={{ minHeight: "100vh", background: "transparent", color: "var(--foreground)" }}>
        {/* OVERLAY DISABLED — {overlay && <ProjectedWinnerOverlay show={!!overlay} candidate={overlay.name} prob={overlay.prob} color={overlay.color} reporting={overlay.reporting} onDismiss={() => setOverlay(null)} />} */}

        {/* STATUS BAR */}
        <div className="res-status-bar">
          <div className="res-status-bar-inner">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="res-live-dot" />
              <span className="res-eyebrow">LIVE ELECTION RESULTS<span style={{ color: "var(--border3)", margin: "0 4px" }}>·</span>POWERED BY CIVICAPI.ORG</span>
            </div>
            <div className="res-note" style={{ letterSpacing: "0.22em", color: "var(--foreground2)", background: "var(--panel)", border: "1px solid var(--border3)", borderRadius: "var(--r-pill)", padding: "5px 14px", boxShadow: "var(--shadow-sm)", fontWeight: 700 }} suppressHydrationWarning>{timeStr}</div>
          </div>
        </div>

        {/* PAGE HEADER */}
        <div className="res-page-header">
          <div className="res-page-header-inner">
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {/* Row 1: title */}
              <div>
                <div className="res-page-sub">JUNE 23RD PRIMARIES · 2026</div>
                <h1 className="res-page-title">Election <em>Night</em></h1>
              </div>
              {/* Row 2: archive + badges + state buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                {/* Archive toggle with dropdown — leftmost */}
                <div ref={archiveDropdownRef} style={{ position: "relative" }}>
                  <button
                    onClick={() => {
                      if (!showArchived) { setShowArchived(true); setArchiveDropdownOpen(true); }
                      else { setArchiveDropdownOpen(v => !v); }
                    }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px",
                      background: showArchived
                        ? "linear-gradient(135deg, rgba(124,58,237,0.14) 0%, rgba(99,102,241,0.08) 100%)"
                        : "linear-gradient(135deg, rgba(124,58,237,0.06) 0%, rgba(99,102,241,0.03) 100%)",
                      border: `1px solid ${showArchived ? "rgba(124,58,237,0.50)" : "rgba(124,58,237,0.22)"}`,
                      borderRadius: "var(--r-pill)",
                      fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      color: showArchived ? "rgba(200,180,255,0.95)" : "rgba(160,140,220,0.65)",
                      cursor: "pointer",
                      boxShadow: showArchived ? "0 0 10px rgba(124,58,237,0.30), 0 0 2px rgba(124,58,237,0.20)" : "none",
                      transition: "all 150ms ease",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = showArchived ? "0 0 14px rgba(124,58,237,0.40), 0 0 4px rgba(124,58,237,0.25)" : "0 0 8px rgba(124,58,237,0.18)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = showArchived ? "0 0 10px rgba(124,58,237,0.30), 0 0 2px rgba(124,58,237,0.20)" : "none"; }}
                    onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
                    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: showArchived ? 0.8 : 0.45 }}>
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    ARCHIVE
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.4, transform: archiveDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }}>
                      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  {/* Archive dropdown */}
                  {archiveDropdownOpen && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 100,
                      background: "var(--panel)", border: "1px solid var(--border2)",
                      borderRadius: "var(--r-lg)", padding: "12px 14px", minWidth: 220,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(124,58,237,0.15)",
                    }}>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", color: "var(--muted2)", marginBottom: 8 }}>ELECTION DATE</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                        {ARCHIVE_DATES.map(d => (
                          <button key={d.date} onClick={() => setArchiveDate(d.date)} style={{
                            padding: "4px 10px", fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
                            background: archiveDate === d.date ? "linear-gradient(135deg, rgba(230,57,70,0.20), rgba(124,58,237,0.20))" : "var(--panel2)",
                            border: `1px solid ${archiveDate === d.date ? "rgba(124,58,237,0.50)" : "var(--border2)"}`,
                            borderRadius: "var(--r-pill)", color: archiveDate === d.date ? "rgba(210,200,255,0.95)" : "var(--muted)",
                            cursor: "pointer", transition: "all 120ms ease",
                            boxShadow: archiveDate === d.date ? "0 0 10px rgba(124,58,237,0.20)" : "none",
                          }}>{d.label}</button>
                        ))}
                      </div>
                      {archiveDate && (
                        <>
                          <div style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", color: "var(--muted2)", marginBottom: 8 }}>STATE</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {archiveDateStates.map(st => (
                              <button key={st} onClick={() => {
                                setActiveState(st as any);
                                setArchiveDropdownOpen(false);
                                setPageTab("all");
                              }} style={{
                                padding: "4px 10px", fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
                                background: activeState === st ? "linear-gradient(135deg, rgba(230,57,70,0.20), rgba(124,58,237,0.20))" : "var(--panel2)",
                                border: `1px solid ${activeState === st ? "rgba(124,58,237,0.50)" : "var(--border2)"}`,
                                borderRadius: "var(--r-pill)", color: activeState === st ? "rgba(210,200,255,0.95)" : "var(--muted)",
                                cursor: "pointer", transition: "all 120ms ease",
                                boxShadow: activeState === st ? "0 0 10px rgba(124,58,237,0.20)" : "none",
                              }}>{stateLabels[st] ?? st}</button>
                            ))}
                          </div>
                        </>
                      )}
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                        <button onClick={() => { setShowArchived(false); setArchiveDropdownOpen(false); setArchiveDate(null); }} style={{
                          width: "100%", padding: "5px 0", fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em",
                          background: "transparent", border: "1px solid var(--border2)", borderRadius: "var(--r-sm)",
                          color: "var(--muted2)", cursor: "pointer",
                        }}>HIDE ARCHIVE</button>
                      </div>
                    </div>
                  )}
                </div>
                {/* Divider */}
                <span style={{ width: 1, height: 16, background: "var(--border2)", margin: "0 2px", flexShrink: 0 }} />
                <span className="res-badge res-badge-red"><span className="res-live-dot" style={{ background: "var(--rep)" }} />LIVE</span>
                <span className="res-badge res-badge-purple">RESULTS + FORECAST / 30s</span>
                {selectedRace?.last_updated && <span className="res-badge">UPDATED {prettyTime(selectedRace.last_updated)}</span>}
                {/* State switcher */}
                {activeStates.length > 0 && (
                  <>
                    <span style={{ width: 1, height: 16, background: "var(--border2)", margin: "0 2px", flexShrink: 0 }} />
                    <div className="res-state-btns" style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                      {/* ALL chip */}
                      <button
                        className={`res-btn-state res-all-tab ${pageTab === "all" && !allRacesStateFilter ? "active" : ""}`}
                        onClick={() => { setPageTab("all"); setAllRacesStateFilter(null); }}
                      >ALL</button>
                      {activeStates.map((st) => (
                        <button key={st} className={`res-btn-state ${
                          pageTab === "all" ? (allRacesStateFilter === st ? "active" : "") : (activeState === st ? "active" : "")
                        }`} onClick={() => {
                          if (pageTab === "all") {
                            setAllRacesStateFilter(prev => prev === st ? null : st);
                          } else {
                            setActiveState(st);
                            const firstSpotlight = SPOTLIGHT_RACES.find(s => s.state === st);
                            if (firstSpotlight) { setSpotlightTab(firstSpotlight.id); setSelectedId(firstSpotlight.id); }
                          }
                        }}>{stateLabels[st]}</button>
                      ))}

                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PAGE TABS — spotlight race tabs only; All Races is in the state chip strip */}
        {SPOTLIGHT_RACES.length > 0 && (
        <div className="res-page-tabs-wrap">
          <div className="res-page-tabs">
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 10px",
            background: "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(99,102,241,0.10) 100%)",
            border: "1px solid rgba(124,58,237,0.50)",
            borderRadius: "var(--r-pill)",
            boxShadow: "0 0 12px rgba(124,58,237,0.35), 0 0 3px rgba(124,58,237,0.20)",
            fontFamily: "var(--font-body)", fontSize: "8px", fontWeight: 900,
            letterSpacing: "0.22em", color: "var(--purple-soft)", textTransform: "uppercase",
            flexShrink: 0, marginRight: 6, whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: "10px", lineHeight: 1, animation: "res-pulse 2s ease-in-out infinite" }}>&#9733;</span>
            SPOTLIGHT
          </span>
          {SPOTLIGHT_RACES.map((s) => {
            const isActive = pageTab === "spotlight" && spotlightTab === s.id;
            const tabLive = patchedRaceCache[s.id];
            const tabOv = RACE_FORECAST_DEFAULTS[s.id]?.overrideReporting;
            const tabRep = typeof tabOv === "number" && tabOv > 0 ? tabOv : (tabLive?.percent_reporting ?? 0);
            const tabWinner = tabLive?.candidates?.find(c => c.winner);
            const tabLeader = tabWinner ?? [...(tabLive?.candidates ?? [])].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))[0];
            const tabManualCall = RACE_FORECAST_DEFAULTS[s.id]?.manualCall;
            const tabCalled = tabManualCall || tabWinner?.name;
            const tabLeaderName = tabCalled ?? (tabLeader ? tabLeader.name.split(" ").slice(-1)[0] : null);
            return (
            <button
              key={s.id}
              className={`res-page-tab ky04-tab ${isActive ? "active" : ""}`}
              onClick={() => { setPageTab("spotlight"); setSpotlightTab(s.id); setActiveState(s.state); setSelectedId(s.id); }}
            >
              <span className="tab-dot" />
              {s.shortLabel}
              {isActive && tabLeaderName && tabRep > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 6, opacity: 0.8 }}>
                  <span style={{ width: 1, height: 10, background: "rgba(124,58,237,0.35)", display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-numeric)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.04em", color: tabCalled ? "var(--win)" : "var(--purple-soft)" }}>
                    {tabLeaderName}
                  </span>
                  <span style={{ color: "rgba(124,58,237,0.45)", fontSize: 8 }}>·</span>
                  <span style={{ fontFamily: "var(--font-numeric)", fontWeight: 600, fontSize: "10px", color: "var(--muted)", letterSpacing: "0.04em" }}>
                    {tabRep.toFixed(1)}% in
                  </span>
                </span>
              )}
            </button>
            );
          })}
          </div>
        </div>
        )}

        {/* ── ALL RACES + SPOTLIGHT TABS ── */}
        {(pageTab === "all" || pageTab === "spotlight") && <>

        {/* ── MOBILE RACE SELECTOR (visible below 768px) ── */}
        <div className="res-mobile-race-strip">
          {/* Live indicator */}
          <span className="res-live-dot" style={{ flexShrink: 0 }} />
          {/* Dropdown */}
          <select
            className="res-race-select"
            value={selectedId}
            onChange={e => setSelectedId(Number(e.target.value))}
          >
            {racesForState.reduce<{ office: string; races: FeaturedRace[] }[]>((groups, r) => {
              const last = groups[groups.length - 1];
              if (last && last.office === r.office) { last.races.push(r); }
              else { groups.push({ office: r.office, races: [r] }); }
              return groups;
            }, []).map(({ office, races }: { office: string; races: FeaturedRace[] }, gi: number) => (
              <optgroup key={`${office}-${gi}`} label={`── ${office.toUpperCase()} ──`}>
                {races.map(r => {
                  const liveData = patchedRaceCache[r.id];
                  const winner = liveData?.candidates?.find(c => c.winner);
                  const _apiReporting = getRaceReportingPct(liveData);
                  const _ov = RACE_FORECAST_DEFAULTS[r.id]?.overrideReporting;
                  const reporting = (typeof _ov === "number" && _ov > 0) ? _ov : _apiReporting;
                  const raceTypeShort = getRaceTypeShort(r.raceType);
                  const isMobileCalled = !!(winner || lockedCalls[r.id] || RACE_FORECAST_DEFAULTS[r.id]?.manualCall);
                  const _mCallType = lockedCallTypes[r.id] ?? (lockedCalls[r.id]?.includes(" vs. ") ? "RUNOFF" : "WIN");
                  const _mCallLabel = (() => {
                    if (!isMobileCalled) return null;
                    if (_mCallType === "RUNOFF" && lockedRunoffProbs[r.id]) {
                      const frags = (lockedCalls[r.id] ?? "").split(" vs. ");
                      const rp = lockedRunoffProbs[r.id];
                      const allOk = frags.length >= 2 && frags.every(frag => Object.entries(rp).some(([n, p]) => n.toLowerCase().includes(frag.toLowerCase()) && p > 0.9973));
                      return allOk ? "✓ CALLED" : `✓ ${rcvTerm(RACE_FORECAST_DEFAULTS[r.id]?.raceRule)}`;
                    }
                    return "✓ CALLED";
                  })();
                  const statusStr = isMobileCalled ? ` ${_mCallLabel}` : reporting !== null && reporting > 0 ? ` · ${reporting.toFixed(0)}% IN` : "";
                  return (
                    <option key={r.id} value={r.id}>
                      [{raceTypeShort}] {r.office}{statusStr}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          {/* Selected race quick-status */}
          {(() => {
            const meta = FEATURED.find(r => r.id === selectedId);
            const liveData = patchedRaceCache[selectedId];
            const winner = liveData?.candidates?.find(c => c.winner);
            const _apiRpt = getRaceReportingPct(liveData);
            const _ovRpt = RACE_FORECAST_DEFAULTS[selectedId]?.overrideReporting;
            const reporting = (typeof _ovRpt === "number" && _ovRpt > 0) ? _ovRpt : _apiRpt;
            const raceTypeColor = meta ? getRaceTypeColor(meta.raceType) : "rgba(255,255,255,0.4)";
            const isMobileQuickCalled = !!(winner || lockedCalls[selectedId] || RACE_FORECAST_DEFAULTS[selectedId]?.manualCall);
            const _mqCallType = lockedCallTypes[selectedId] ?? (lockedCalls[selectedId]?.includes(" vs. ") ? "RUNOFF" : "WIN");
            const _mqCallLabel = (() => {
              if (!isMobileQuickCalled) return null;
              if (_mqCallType === "RUNOFF" && lockedRunoffProbs[selectedId]) {
                const frags = (lockedCalls[selectedId] ?? "").split(" vs. ");
                const rp = lockedRunoffProbs[selectedId];
                const allOk = frags.length >= 2 && frags.every(frag => Object.entries(rp).some(([n, p]) => n.toLowerCase().includes(frag.toLowerCase()) && p > 0.9973));
                return allOk ? "✓ CALLED" : `✓ ${rcvTerm(RACE_FORECAST_DEFAULTS[selectedId]?.raceRule)}`;
              }
              return "✓ CALLED";
            })();
            return (
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                {isMobileQuickCalled
                  ? <span className="res-badge res-badge-win">{_mqCallLabel}</span>
                  : <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, color: raceTypeColor }}>{reporting !== null ? `${reporting.toFixed(0)}%` : "—"}</span>
                }
              </div>
            );
          })()}
        </div>


        {/* ── MOBILE RACE LIST — phones only, above map ── */}
        <div className="res-mobile-race-search">
          <div style={{ margin: "8px 10px 0", border: "1px solid var(--border)" }}>
            <RaceScrollWindow races={racesForState} raceCache={patchedRaceCache} selectedId={selectedId} onSelect={setSelectedId} search={scrollWindowSearch} onSearchChange={setScrollWindowSearch} maxHeight={200} lockedCalls={lockedCalls} lockedCallTypes={lockedCallTypes} lockedRunoffProbs={lockedRunoffProbs} />
          </div>
        </div>


        {/* ── MAIN BODY ── */}
        <div className="res-body">

          {/* LEFT: [Spotlight: Hero Card + About] + Race Picker Panel */}
          <div className="res-race-picker" style={spotlightMeta ? { display: "flex", flexDirection: "column", gap: 8 } : undefined}>
            {spotlightMeta && (
              <>
                <div className="ky04-hero-card res-spotlight-hero" style={{ width: "100%", boxSizing: "border-box", flexShrink: 0, background: "linear-gradient(135deg, var(--red) 0%, var(--purple) 55%, var(--blue) 100%)" }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", border: "1px solid rgba(255,255,255,0.30)", borderRadius: "var(--r-pill)", background: "rgba(255,255,255,0.15)", fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.20em", color: "#fff", textTransform: "uppercase" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", boxShadow: "0 0 0 3px rgba(255,255,255,0.28)", display: "inline-block", flexShrink: 0 }} />
                      SPOTLIGHT RACE · {spotlightMeta.stateLabel}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(12px,1.15vw,17px)", fontWeight: 900, color: "#fff", lineHeight: 1.0, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.01em" }}>
                    {spotlightMeta.title}
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: "rgba(255,255,255,0.60)", marginBottom: 16 }}>
                    {spotlightMeta.subtitle}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 2 }}>REPORTING</div>
                      <div style={{ fontFamily: "var(--font-numeric)", fontSize: "30px", fontWeight: 900, color: "#fff", lineHeight: 1 }}>{displayReportingStr}%</div>
                    </div>
                    <div style={{ marginBottom: 5 }}>
                      <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "var(--r-pill)", background: selectedStatusInfo.bg, border: `1px solid ${selectedStatusInfo.border}`, fontFamily: "var(--font-body)", fontSize: "8px", fontWeight: 700, letterSpacing: "0.14em", color: "#fff", textTransform: "uppercase" }}>
                        {selectedStatusInfo.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.18)", display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", border: "1px solid rgba(255,255,255,0.22)", borderRadius: "var(--r-pill)", background: "rgba(255,255,255,0.10)", fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.16em", color: "rgba(255,255,255,0.75)", textTransform: "uppercase" }}>AUTO-REFRESH / 30s</span>
                    {selectedRace?.last_updated && <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", border: "1px solid rgba(255,255,255,0.16)", borderRadius: "var(--r-pill)", background: "rgba(255,255,255,0.07)", fontFamily: "var(--font-body)", fontSize: "7px", fontWeight: 700, letterSpacing: "0.16em", color: "rgba(255,255,255,0.50)", textTransform: "uppercase" }}>UPDATED {prettyTime(selectedRace.last_updated)}</span>}
                  </div>
                </div>
              </>
            )}
            <div className="res-race-picker-list" style={spotlightMeta ? { flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" } : undefined}>
              <RacePickerPanel
                races={FEATURED}
                raceCache={patchedRaceCache}
                selectedId={selectedId}
                onSelect={setSelectedId}
                lockedCalls={lockedCalls}
                lockedCallTypes={lockedCallTypes}
                lockedRunoffProbs={lockedRunoffProbs}
                showArchived={showArchived}
                onToggleArchive={() => setShowArchived(v => !v)}
                activeState={pageTab === "all" ? (allRacesStateFilter ?? undefined) : activeState}
                spotlightRaceIds={SPOTLIGHT_RACES.map(s => s.id)}
              />
            </div>

            {/* ABOUT THIS RACE — bottom of left col */}
            {spotlightMeta && (
              <div className="res-panel res-spotlight-about" style={{ flex: "none" }}>
                <div className="res-panel-header"><span className="res-panel-tag">ABOUT THIS RACE</span></div>
                <div style={{ padding: "12px 16px", fontFamily: "var(--font-body)", fontSize: "11px", lineHeight: 1.7, color: "var(--muted)", letterSpacing: "0.02em" }}>
                  {spotlightMeta.about}
                </div>
              </div>
            )}

          </div>

          {/* CENTER SPLIT: map + county */}
          <div className={`res-center-split${hasForecastForSelected ? "" : " no-forecast"}`}>

            {/* MAP PANEL */}
            <div className="res-panel res-map-panel">
              <div className="res-tri-stripe" />
              <div className="res-panel-header" style={{ flexWrap: "wrap", gap: "8px" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="res-panel-tag">{selectedMeta?.label ?? "—"}</div>
                  <div className="res-note" style={{ marginTop: "2px" }}>{displayReportingStr}% REPORTING · {prettyTime(selectedRace?.last_updated)}</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
                  <span className="res-badge">{selectedCloseLocal}</span>
                  <span className={`res-badge ${selectedMsLeft && selectedMsLeft > 0 ? "" : "res-badge-red"}`}>{selectedMsLeft === null ? "—" : formatCountdown(selectedMsLeft)}</span>
                  <span className="res-badge res-badge-purple">{loadingMap ? `SYNCING ${Math.round(mapLoadPct)}%` : "● LIVE"}</span>
                </div>
              </div>
              <div className="res-map-body" style={{ padding: "6px 10px 0", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "6px", flexShrink: 0 }}>
                  <Legend />
                  <span className="res-note" style={{ color: "var(--muted2)" }}>HOVER COUNTIES</span>
                </div>
                {loadingMap ? (
                  <div className="res-map-loading" style={{ flex: 1 }}>
                    <div style={{ width: "min(300px, 90%)" }}>
                      <div className="res-note" style={{ textAlign: "center", marginBottom: "8px" }}>LOADING MAP</div>
                      <div className="res-bar-track"><div className="res-bar-fill" style={{ width: `${mapLoadPct}%`, background: "linear-gradient(90deg,var(--purple),var(--blue2))" }} /></div>
                      <div className="res-note" style={{ textAlign: "center", marginTop: "6px", color: "var(--purple-soft)", fontWeight: 700 }}>{Math.round(mapLoadPct)}%</div>
                    </div>
                  </div>
                ) : mapBlankSvg ? (
                  <div className="res-map-wrap" style={{ flex: 1, minHeight: 0 }}>
                    <MapWithCountyTooltip svgText={mapBlankSvg} regionResults={selectedRace?.region_results ?? []} />
                  </div>
                ) : (
                  <div className="res-map-loading" style={{ flex: 1 }}><span className="res-note" style={{ color: "var(--muted2)" }}>NO MAP DATA</span></div>
                )}
              </div>
            </div>{/* end map panel */}

            {/* COUNTY TABLE */}
            <div className="res-inline-county">
              <CountyTotalsTable
                regionResults={selectedRace?.region_results ?? []}
                collapsed={countyCollapsed}
                onToggle={() => setCountyCollapsed(v => !v)}
                maxHeight="9999px"
              />
            </div>

          </div>{/* end res-center-split */}

          {/* RIGHT RAIL: Race Status + Forecast + Topline */}
          <aside className="res-right-rail">

            {/* TABLET RACE SCROLL — hidden on desktop, shown on tablet */}
            <div className="res-race-scroll-window">
              <RaceScrollWindow races={racesForState} raceCache={patchedRaceCache} selectedId={selectedId} onSelect={setSelectedId} search={scrollWindowSearch} onSearchChange={setScrollWindowSearch} lockedCalls={lockedCalls} lockedCallTypes={lockedCallTypes} lockedRunoffProbs={lockedRunoffProbs} showArchived={false} />
            </div>

            {/* RACE STATUS — top */}
            <div className="res-panel res-race-status-panel" style={{ display: "flex", flexDirection: "column" }}>
              <div className="res-panel-header"><span className="res-panel-tag">RACE STATUS</span></div>
              <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div className="res-stat-block">
                    <div className="res-stat-block-label">REPORTING</div>
                    <div className="res-stat-block-val">{displayReportingStr}%</div>
                    {selectedTotalVotes > 0 && <div className="res-note" style={{ marginTop: "3px" }}>{selectedTotalVotes.toLocaleString()} votes</div>}
                    <div className="res-bar-track" style={{ marginTop: "6px" }}><div className="res-bar-fill" style={{ width: `${effectiveReporting}%`, background: "var(--purple)" }} /></div>
                  </div>
                  <div className="res-stat-block">
                    <div className="res-stat-block-label">CLOSES</div>
                    <div className="res-stat-block-val" style={{ fontSize: "clamp(13px,1.6vw,18px)" }}>{effectiveCloseLocal}</div>
                    <div className="res-note" style={{ marginTop: "4px", color: effectiveMsLeft && effectiveMsLeft > 0 ? "var(--muted2)" : "var(--rep)", fontWeight: 700 }}>{effectiveMsLeft === null ? "—" : formatCountdown(effectiveMsLeft)}</div>
                  </div>
                </div>
                <div className="res-stat-block">
                  {(() => {
                    const _ns = { fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "var(--muted)", lineHeight: "1.6" };
                    const _last = (n: string) => { const p = n.trim().split(/\s+/); return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : n.trim(); };

                    const _runoffProbs = lockedRunoffProbs[selectedId] ??
                      (forecastProj?.raceId === selectedId ? forecastProj?.runoffProbs : undefined);

                    const _top2Entries: [string, number][] = _runoffProbs
                      ? (Object.entries(_runoffProbs) as [string, number][])
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 2)
                      : [];

                    const _combinedProb = _top2Entries.length === 2
                      ? _top2Entries[0][1] * _top2Entries[1][1] * 100
                      : 0;

                    const _isRunoffProjected = forecastProj?.raceId === selectedId &&
                      forecastProj?.projectionType === "RUNOFF" &&
                      _top2Entries.length >= 2;

                    const _bothConfirmed = _top2Entries.length === 2 &&
                      _top2Entries.every(([, p]) => p > 0.9973);

                    const _localDisplayProb = (() => {
                      if (!selectedRace?.candidates?.length) return null;
                      const ordered = [...selectedRace.candidates]
                        .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
                      const leader = ordered[0];
                      const runnerUp = ordered[1];
                      if (!leader || !runnerUp) return null;
                      // Use votes if available, otherwise synthesise from percent
                      const lv = (leader.votes > 0 || runnerUp.votes > 0) ? leader.votes : Math.round((leader.percent ?? 0) * 10000 / 100);
                      const rv = (leader.votes > 0 || runnerUp.votes > 0) ? runnerUp.votes : Math.round((runnerUp.percent ?? 0) * 10000 / 100);
                      if (lv === 0 && rv === 0) return null;
                      return calculateWinProbability(lv, rv, effectiveReporting);
                    })();

                    const _localLeadMargin = (() => {
                      if (!selectedRace?.candidates?.length) return null;
                      const ordered = [...selectedRace.candidates]
                        .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
                      const lp = ordered[0]?.percent ?? 0;
                      const rp = ordered[1]?.percent ?? 0;
                      if (lp === 0 && rp === 0) return null;
                      return lp - rp;
                    })();

                    const _localLeaderLastName = (() => {
                      if (!selectedRace?.candidates?.length) return null;
                      const ordered = [...selectedRace.candidates]
                        .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
                      const p0 = ordered[0]?.name.trim().split(/\s+/) ?? [];
                      return p0.length > 2 ? `${p0[0]} ${p0[p0.length - 1]}` : (p0.join(" ") || null);
                    })();

                    const _localRunnerUpLastName = (() => {
                      if (!selectedRace?.candidates?.length) return null;
                      const ordered = [...selectedRace.candidates]
                        .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
                      const p1 = ordered[1]?.name.trim().split(/\s+/) ?? [];
                      return p1.length > 2 ? `${p1[0]} ${p1[p1.length - 1]}` : (p1.join(" ") || null);
                    })();

                    const checkSvg = (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="7" cy="7" r="6.5" fill="var(--win)" opacity="0.18"/>
                        <circle cx="7" cy="7" r="6.5" stroke="var(--win)" strokeWidth="1.2"/>
                        <path d="M4 7l2 2 4-4" stroke="var(--win)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    );

                    const gradientBar = (widthPct: number, suffix?: string) => (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ flex: 1, height: 3, background: "var(--border2)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${widthPct}%`, background: "linear-gradient(90deg,var(--purple),var(--blue2))", transition: "width 600ms ease" }} />
                          </div>
                          <span style={{ fontFamily: "var(--font-numeric)", fontSize: "11px", fontWeight: 700, color: "var(--muted)", flexShrink: 0 }}>
                            {widthPct.toFixed(1)}%{suffix && <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.04em", marginLeft: 3, color: "var(--muted2)" }}>{suffix}</span>}
                          </span>
                        </div>
                      </div>
                    );

                    const headerRow = (label: string, color: string, fontSize = "10px") => (
                      <div className="res-stat-row" style={{ marginBottom: "5px" }}>
                        <span className="res-stat-block-label">PROJECTION</span>
                        <span className="res-note" style={{ color, fontWeight: 700, fontSize }}>{label}</span>
                      </div>
                    );

                    const nameRow = (content: React.ReactNode) => (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {content}
                      </div>
                    );

                    // ── STATE 1 — API Official or manual override, single winner ──
                    const _officialWinnerName = selectedWinner?.name ?? manualWinner ?? null;
                    if (_officialWinnerName && !isRunoffConfirmed && !_isRunoffProjected) return (
                      <>
                        {headerRow("OFFICIAL", "var(--win)")}
                        {nameRow(<>{checkSvg}<span style={_ns}>{_last(_officialWinnerName)}</span></>)}
                      </>
                    );

                    // ── STATE 2 — API Official, runoff ────────────────────────────
                    if (isRunoffConfirmed) {
                      const _names = (selectedRace?.candidates ?? []).filter(c => c.winner).map(c => _last(c.name));
                      return (
                        <>
                          {headerRow("OFFICIAL", "var(--win)")}
                          {nameRow(<>{checkSvg}<span style={_ns}>{_names[0]} vs. {_names[1] ?? ""}</span></>)}
                        </>
                      );
                    }

                    // ── STATE 3 — Forecast Call, single winner ────────────────────
                    if (effectiveForecastCalled && !_isRunoffProjected) return (
                      <>
                        {headerRow("FORECAST CALL", "var(--win)")}
                        {nameRow(<>{checkSvg}<span style={_ns}>{_last(effectiveForecastCalled)}</span></>)}
                      </>
                    );

                    // ── STATE 4 — Runoff, both confirmed ──────────────────────────
                    if (_isRunoffProjected && _bothConfirmed) {
                      const [e1, e2] = _top2Entries;
                      return (
                        <>
                          {headerRow(RACE_FORECAST_DEFAULTS[selectedId]?.raceRule === "RANKED_CHOICE" ? "RCV ROUND 2" : "RUNOFF SET", "var(--win)")}
                          {nameRow(<>{checkSvg}<span style={_ns}>{_last(e1[0])} vs. {_last(e2[0])}</span></>)}
                          {gradientBar(100, RACE_FORECAST_DEFAULTS[selectedId]?.raceRule === "RANKED_CHOICE" ? "RCV ADV. PROB" : "RUNOFF PROB")}
                        </>
                      );
                    }

                    // ── STATE 5 — Runoff, one confirmed ───────────────────────────
                    if (_isRunoffProjected && _top2Entries.some(([, p]) => p > 0.9973)) {
                      const sorted = _top2Entries.slice().sort(([, a], [, b]) => b - a);
                      const [[n1, p1], [n2]] = sorted;
                      return (
                        <>
                          {headerRow(RACE_FORECAST_DEFAULTS[selectedId]?.raceRule === "RANKED_CHOICE" ? "TOP 2 ADVANCE TO NEXT ROUND" : "TOP 2 ADVANCE TO RUNOFF", "var(--purple-soft)", "9px")}
                          {nameRow(<>
                            {p1 > 0.9973 && checkSvg}
                            <span style={_ns}>
                              <span style={{ color: "var(--muted)" }}>{_last(n1)}</span>
                              <span style={{ color: "var(--muted2)", fontWeight: 400, opacity: 0.7 }}>{" vs. "}{_last(n2)}</span>
                            </span>
                          </>)}
                          {gradientBar(_combinedProb, RACE_FORECAST_DEFAULTS[selectedId]?.raceRule === "RANKED_CHOICE" ? "RCV ADV. PROB" : "RUNOFF PROB")}
                        </>
                      );
                    }

                    // ── STATE 6 — Runoff projected, none confirmed ────────────────
                    if (_isRunoffProjected) {
                      const [e1, e2] = _top2Entries;
                      return (
                        <>
                          {headerRow(RACE_FORECAST_DEFAULTS[selectedId]?.raceRule === "RANKED_CHOICE" ? "TOP 2 ADVANCE TO NEXT ROUND" : "TOP 2 ADVANCE TO RUNOFF", "var(--purple-soft)", "9px")}
                          {nameRow(<span style={_ns}>{_last(e1[0])} vs. {_last(e2[0])}</span>)}
                          {gradientBar(_combinedProb, RACE_FORECAST_DEFAULTS[selectedId]?.raceRule === "RANKED_CHOICE" ? "RCV ADV. PROB" : "RUNOFF PROB")}
                        </>
                      );
                    }

                    // ── STATE 7a — Live data (reporting ≥ 5%) → TOO CLOSE TO CALL ─
                    if (_localDisplayProb !== null && effectiveReporting >= 5) return (
                      <>
                        {headerRow("TOO CLOSE TO CALL", "var(--muted2)", "9px")}
                        {nameRow(
                          <span style={_ns}>
                            <span style={{ color: "var(--muted)", opacity: 1 }}>{_localLeaderLastName ?? "—"}</span>
                            {_localRunnerUpLastName && (
                              <span style={{ color: "var(--muted2)", opacity: 0.5 }}>{" vs. "}{_localRunnerUpLastName}</span>
                            )}
                          </span>
                        )}
                        {gradientBar(_localDisplayProb, "PROB")}
                      </>
                    );

                    // ── STATE 7b — Too early to call ─────────────────────────────
                    const _pendingName = (!_localLeaderLastName || effectiveReporting < 0.1)
                      ? "PENDING"
                      : _localLeaderLastName;
                    return (
                      <>
                        {headerRow("TOO EARLY TO CALL", "var(--muted2)", "9px")}
                        {nameRow(<span style={_ns}>{_pendingName}</span>)}
                      </>
                    );
                  })()}
                </div>
                {selectedRace?.candidates && selectedRace.candidates.length > 0 && (() => {
                  const reporting = selectedRace.percent_reporting ?? 0;
                  const vsDefs = RACE_FORECAST_DEFAULTS[selectedId];
                  const vsOrdered = reporting > 0
                    ? [...selectedRace.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
                    : sortCandidatesByPollData(selectedRace.candidates, vsDefs?.pollAvg);
                  const vsTop = vsOrdered.slice(0, 5);
                  const vsRest = vsOrdered.slice(5);
                  const vsOtherPct = vsRest.reduce((s, c) => s + (c.percent ?? 0), 0);
                  return (
                    <div style={{ marginTop: 4 }}>
                      <div className="res-note" style={{ marginBottom: 8 }}>VOTE SHARE</div>
                      {vsTop.map((c) => {
                        const vsCalledNames = effectiveForecastCalled ? (() => {
                          if (!_outright && forecastProj?.raceId === selectedId && forecastProj.projectionType === "RUNOFF" && forecastProj.runoffProbs) {
                            // Use per-candidate threshold — don't fall back if nobody qualifies yet
                            return Object.entries(forecastProj.runoffProbs).filter(([, p]) => p > 0.9973).map(([n]) => n);
                          }
                          return effectiveForecastCalled.split(" vs. ");
                        })() : null;
                        const vsIsCalled = c.winner || !!(vsCalledNames?.some(n => c.name.toLowerCase().includes(n.toLowerCase())));
                        return (
                        <div key={c.name} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
                              {c.name}
                              {vsIsCalled && (
                                <svg viewBox="0 0 10 10" width="9" height="9" style={{ flexShrink: 0 }}><circle cx="5" cy="5" r="5" fill="#22c55e" /><path d="M2.5 5l2 2L7.5 3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                              )}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {c.votes > 0 && <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 700, color: "var(--muted2)" }}>{c.votes.toLocaleString()} VOTES</span>}
                              <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 900, color: c.color }}>{fmtPct(c.percent)}</span>
                            </span>
                          </div>
                          <div style={{ height: 3, background: "var(--border2)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${c.percent ?? 0}%`, background: c.color, transition: "width 600ms ease" }} />
                          </div>
                        </div>
                        );
                      })}
                      {vsRest.length > 0 && (
                        <div style={{ marginBottom: 8, opacity: 0.6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", color: "var(--muted)", display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--muted2)", display: "inline-block", flexShrink: 0 }} />
                              Others ({vsRest.length})
                            </span>
                            <span style={{ fontFamily: "var(--font-body)", fontSize: "9px", fontWeight: 900, color: "var(--muted2)" }}>{fmtPct(vsOtherPct)}</span>
                          </div>
                          <div style={{ height: 3, background: "var(--border2)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${vsOtherPct}%`, background: "var(--muted2)", transition: "width 600ms ease" }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* FORECAST */}
            <div className="res-forecast-wrap">
              {hasForecastForSelected ? (
                <ForecastPanel key={selectedId} raceId={selectedId} refreshTick={refreshTick} raceData={selectedRace} onForecastUpdate={(update) => {
                  setForecastProj({ ...update, raceId: selectedId });
                  if (effectiveReporting > 0 && update.projectionType === "RUNOFF" && update.runoffProbs) {
                    setLockedRunoffProbs(prev => ({ ...prev, [selectedId]: update.runoffProbs! }));
                  }
                }} />
              ) : (
              <div className="res-panel" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div className="res-panel-header">
                  <span className="res-panel-tag">FORECAST MODEL</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", color: "var(--muted2)", textTransform: "uppercase" }}>NOT AVAILABLE</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "20px 18px 18px" }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 900, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10, lineHeight: 1.4 }}>No Forecast<br />for This Race</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "8.5px", fontWeight: 500, color: "var(--muted2)", lineHeight: 1.7, letterSpacing: "0.04em" }}>Our forecast model requires reliable poll averages and turnout baselines. For this race, we don&#39;t have enough data to model outcomes responsibly.</div>
                  </div>
                  <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted2)", marginBottom: 8 }}>WHAT WE&#39;RE WATCHING</div>
                    <div style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--muted2)", lineHeight: 1.6 }}>Live results and county-level returns will update automatically.</div>
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* TOPLINE */}
            <div className="res-panel res-topline-panel" style={{ display: "flex", flexDirection: "column" }}>
              <div className="res-panel-header" style={{ flexShrink: 0 }}>
                <span className="res-panel-tag">TOPLINE RESULTS</span>
                {selectedRace !== undefined && (
                  <span style={{ fontFamily: "var(--font-body)", fontSize: "10px", fontWeight: 700, color: "var(--muted2)", letterSpacing: "0.08em" }}>{displayReportingStr}% IN</span>
                )}
              </div>
              <div className="res-topline-body" style={{ overflowY: "auto", flex: 1, minHeight: 0, scrollbarGutter: "stable", padding: "6px 6px 6px 12px" }}>
                {selectedRace?.candidates
                  ? <CandidateList candidates={selectedRace.candidates} reporting={effectiveReporting} raceId={selectedId} isMajorityRunoff={isRunoffConfirmed} isTopTwo={selectedRaceIsTopTwo} calledNames={(() => {
                      if (!effectiveForecastCalled) return undefined;
                      if (!_outright && forecastProj?.raceId === selectedId && forecastProj.projectionType === "RUNOFF" && forecastProj.runoffProbs) {
                        // Only show runoff-advancing checkmarks when a runoff is actually confirmed
                        // (i.e. no single candidate has crossed 50% in a MAJORITY race)
                        if (selectedRaceIsMajority && !isRunoffConfirmed) return undefined;
                        return Object.entries(forecastProj.runoffProbs).filter(([, p]) => p > 0.9973).map(([n]) => n);
                      }
                      return effectiveForecastCalled.split(" vs. ");
                    })()} />
                  : <div style={{ padding: "32px 0", textAlign: "center" }} className="res-note">LOADING…</div>
                }
              </div>
            </div>

          </aside>

        </div>

        {/* ── FULL-WIDTH COUNTY BREAKDOWN — hidden on tablet, shown on desktop + mobile ── */}
        <div className="res-bottom">
          <CountyTotalsTable
            regionResults={selectedRace?.region_results ?? []}
            collapsed={countyCollapsed}
            onToggle={() => setCountyCollapsed(v => !v)}
          />
          {error && <div className="res-error" style={{ marginTop: 10 }}>ERROR: {error}</div>}
        </div>
        </>}
      </main>
    </>
  );
}