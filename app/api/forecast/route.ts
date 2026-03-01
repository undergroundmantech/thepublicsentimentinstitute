// app/api/forecast/route.ts
import { NextResponse } from "next/server";
import { forecastRace, civicToForecastInput, ForecastInput, CivicRace, RaceRule } from "@/app/lib/electoralModel";

const CIVIC_BASE = "https://civicapi.org/api/v2";

// ─── POLL-ORDER HELPER ────────────────────────────────────────────────────────
// Sorts candidates by poll_avg match first (descending), then live votes.
// This ensures Candidate1/2/3 slots in the model reflect real contenders,
// not whoever comes first alphabetically when votes are at 0.
function sortCandidatesByPollAvg(
  candidates: CivicRace["candidates"],
  pollAvg?: Record<string, number>
): CivicRace["candidates"] {
  if (!pollAvg || Object.keys(pollAvg).length === 0) {
    // No poll data — fall back to live votes descending
    return [...candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  }

  return [...candidates].sort((a, b) => {
    const getScore = (name: string): number => {
      const lower = name.toLowerCase();
      for (const [key, score] of Object.entries(pollAvg)) {
        if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
          return score;
        }
      }
      return -1; // Not in poll data — push to bottom
    };

    const sa = getScore(a.name), sb = getScore(b.name);
    if (sa >= 0 && sb >= 0) return sb - sa;   // Both polled — higher poll % first
    if (sa >= 0) return -1;                    // Only a polled — a goes first
    if (sb >= 0) return 1;                     // Only b polled — b goes first
    return (b.votes ?? 0) - (a.votes ?? 0);   // Neither polled — live votes
  });
}

// POST /api/forecast
// Body can be either:
//   { type: "manual", input: ForecastInput }
//   { type: "civic", raceId: string, race_rule?: RaceRule, expected_turnout?: number, poll_avg?: Record<string, number> }
//   { type: "civic_history", raceId: string, timestamp: string, priorTimestamp?: string, race_rule?: RaceRule, expected_turnout?: number, poll_avg?: Record<string, number> }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.type || body.type === "manual") {
      // Legacy: raw ForecastInput passed directly
      const input = (body.input ?? body) as ForecastInput;
      const result = forecastRace(input);
      return NextResponse.json(result);
    }

    if (body.type === "civic") {
      const { raceId, race_rule = "PLURALITY", expected_turnout, poll_avg } = body;
      const race = await fetchCivicRace(raceId);

      // Sort by poll_avg if provided, otherwise by live votes
      const sorted = sortCandidatesByPollAvg(race.candidates, poll_avg);
      const top3 = sorted.slice(0, 3);
      const names = top3.map((c) => c.name);
      const colors = top3.map((c) => c.color);

      const input = civicToForecastInput(race, undefined, race_rule, expected_turnout, poll_avg);
      const result = forecastRace(input, names, colors);
      return NextResponse.json({ forecast: result, race });
    }

    if (body.type === "civic_history") {
      const { raceId, timestamp, priorTimestamp, race_rule = "PLURALITY", expected_turnout, poll_avg } = body;
      const [current, prior] = await Promise.all([
        fetchCivicRaceHistory(raceId, timestamp),
        priorTimestamp ? fetchCivicRaceHistory(raceId, priorTimestamp) : Promise.resolve(undefined),
      ]);

      // Sort by poll_avg if provided, otherwise by live votes
      const sorted = sortCandidatesByPollAvg(current.candidates, poll_avg);
      const top3 = sorted.slice(0, 3);
      const names = top3.map((c) => c.name);
      const colors = top3.map((c) => c.color);

      const input = civicToForecastInput(current, prior, race_rule, expected_turnout, poll_avg);
      const result = forecastRace(input, names, colors);
      return NextResponse.json({ forecast: result, race: current });
    }

    return NextResponse.json({ error: "Unknown request type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: "Request failed", details: String(err?.message ?? err) }, { status: 400 });
  }
}

// GET /api/forecast?action=search&...
// GET /api/forecast?action=history&raceId=...
// GET /api/forecast?action=timestamps&raceId=...
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "search") {
      const params = new URLSearchParams();
      for (const [k, v] of url.searchParams.entries()) {
        if (k !== "action") params.set(k, v);
      }
      const res = await fetch(`${CIVIC_BASE}/race/search?${params}`);
      if (!res.ok) throw new Error(`CivicAPI error: ${res.status}`);
      return NextResponse.json(await res.json());
    }

    if (action === "timestamps") {
      const raceId = url.searchParams.get("raceId");
      if (!raceId) return NextResponse.json({ error: "raceId required" }, { status: 400 });
      const res = await fetch(`${CIVIC_BASE}/race/${raceId}/history`);
      if (!res.ok) throw new Error(`CivicAPI error: ${res.status}`);
      return NextResponse.json(await res.json());
    }

    if (action === "race") {
      const raceId = url.searchParams.get("raceId");
      if (!raceId) return NextResponse.json({ error: "raceId required" }, { status: 400 });
      const race = await fetchCivicRace(raceId);
      return NextResponse.json(race);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: "Request failed", details: String(err?.message ?? err) }, { status: 400 });
  }
}

async function fetchCivicRace(raceId: string): Promise<CivicRace> {
  const res = await fetch(`${CIVIC_BASE}/race/${raceId}`);
  if (!res.ok) throw new Error(`CivicAPI error ${res.status} fetching race ${raceId}`);
  return res.json();
}

async function fetchCivicRaceHistory(raceId: string, timestamp: string): Promise<CivicRace> {
  const encoded = encodeURIComponent(timestamp);
  const res = await fetch(`${CIVIC_BASE}/race/${raceId}/history/${encoded}?light`);
  if (!res.ok) throw new Error(`CivicAPI error ${res.status} fetching history for ${raceId} at ${timestamp}`);
  return res.json();
}