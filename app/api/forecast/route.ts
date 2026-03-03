// app/api/forecast/route.ts
import { NextResponse } from "next/server";
import { forecastRace, civicToForecastInput, ForecastInput, CivicRace, RaceRule } from "@/app/lib/electoralModel";

const CIVIC_BASE = "https://civicapi.org/api/v2";

// ─── POLL-ORDER HELPER ────────────────────────────────────────────────────────
function sortCandidatesByPollAvg(
  candidates: CivicRace["candidates"],
  pollAvg?: Record<string, number>
): CivicRace["candidates"] {
  if (!pollAvg || Object.keys(pollAvg).length === 0) {
    return [...candidates].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  }
  return [...candidates].sort((a, b) => {
    const getScore = (name: string): number => {
      const lower = name.toLowerCase();
      for (const [key, score] of Object.entries(pollAvg)) {
        if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return score;
      }
      return -1;
    };
    const sa = getScore(a.name), sb = getScore(b.name);
    if (sa >= 0 && sb >= 0) return sb - sa;
    if (sa >= 0) return -1;
    if (sb >= 0) return 1;
    return (b.votes ?? 0) - (a.votes ?? 0);
  });
}

// ─── SHARED FORECAST RUNNER ───────────────────────────────────────────────────
// All turnout estimation and prior logic lives in civicToForecastInput.
// This function passes through only what the caller explicitly provided —
// undefined means "let the model figure it out via back-calculation fallback."
// No duplicate estimation here; every race uses the same code path.
function runForecastFromCivicRace(
  race: CivicRace,
  prior: CivicRace | undefined,
  race_rule: RaceRule,
  expected_turnout: number | undefined,
  poll_avg: Record<string, number> | undefined
) {
  const sorted = sortCandidatesByPollAvg(race.candidates, poll_avg);
  const top3 = sorted.slice(0, 3);
  const names = top3.map((c) => c.name);
  const colors = top3.map((c) => c.color);

  const input = civicToForecastInput(race, prior, race_rule, expected_turnout, poll_avg);
  const result = forecastRace(input, names, colors);
  return NextResponse.json({ forecast: result, race });
}

// POST /api/forecast
// Body types:
//   { type: "manual", input: ForecastInput }
//   { type: "civic", raceId: string, race_rule?, expected_turnout?, poll_avg? }
//   { type: "civic_raw", raceData: CivicRace, race_rule?, expected_turnout?, poll_avg? }
//   { type: "civic_history", raceId: string, timestamp: string, priorTimestamp?, race_rule?, expected_turnout?, poll_avg? }
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.type || body.type === "manual") {
      const input = (body.input ?? body) as ForecastInput;
      const result = forecastRace(input);
      return NextResponse.json(result);
    }

    if (body.type === "civic_raw") {
      const { raceData, race_rule = "PLURALITY", expected_turnout, poll_avg } = body;
      if (!raceData) {
        return NextResponse.json({ error: "raceData is required for type civic_raw" }, { status: 400 });
      }
      return runForecastFromCivicRace(raceData as CivicRace, undefined, race_rule, expected_turnout, poll_avg);
    }

    if (body.type === "civic") {
      const { raceId, race_rule = "PLURALITY", expected_turnout, poll_avg } = body;
      const race = await fetchCivicRace(raceId);
      return runForecastFromCivicRace(race, undefined, race_rule, expected_turnout, poll_avg);
    }

    if (body.type === "civic_history") {
      const { raceId, timestamp, priorTimestamp, race_rule = "PLURALITY", expected_turnout, poll_avg } = body;
      const [current, prior] = await Promise.all([
        fetchCivicRaceHistory(raceId, timestamp),
        priorTimestamp ? fetchCivicRaceHistory(raceId, priorTimestamp) : Promise.resolve(undefined),
      ]);
      return runForecastFromCivicRace(current, prior, race_rule, expected_turnout, poll_avg);
    }

    return NextResponse.json({ error: "Unknown request type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: "Request failed", details: String(err?.message ?? err) }, { status: 400 });
  }
}

// GET /api/forecast?action=search&...
// GET /api/forecast?action=timestamps&raceId=...
// GET /api/forecast?action=race&raceId=...
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
  const res = await fetch(`${CIVIC_BASE}/race/${raceId}?testdata`);
  if (!res.ok) throw new Error(`CivicAPI error ${res.status} fetching race ${raceId}`);
  return res.json();
}

async function fetchCivicRaceHistory(raceId: string, timestamp: string): Promise<CivicRace> {
  const encoded = encodeURIComponent(timestamp);
  const res = await fetch(`${CIVIC_BASE}/race/${raceId}/history/${encoded}?light`);
  if (!res.ok) throw new Error(`CivicAPI error ${res.status} fetching history for ${raceId} at ${timestamp}`);
  return res.json();
}