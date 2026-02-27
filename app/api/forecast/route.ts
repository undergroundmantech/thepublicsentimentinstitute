// app/api/forecast/route.ts
import { NextResponse } from "next/server";
import { forecastRace, civicToForecastInput, ForecastInput, CivicRace, RaceRule } from "@/app/lib/electoralModel";

const CIVIC_BASE = "https://civicapi.org/api/v2";

// POST /api/forecast
// Body can be either:
//   { type: "manual", input: ForecastInput }
//   { type: "civic", raceId: string, race_rule?: RaceRule, expected_turnout?: number }
//   { type: "civic_history", raceId: string, timestamp: string, priorTimestamp?: string, race_rule?: RaceRule, expected_turnout?: number }
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
      const { raceId, race_rule = "PLURALITY", expected_turnout } = body;
      const race = await fetchCivicRace(raceId);
      const input = civicToForecastInput(race, undefined, race_rule, expected_turnout);
      const names = race.candidates.sort((a, b) => b.votes - a.votes).slice(0, 3).map((c) => c.name);
      const colors = race.candidates.sort((a, b) => b.votes - a.votes).slice(0, 3).map((c) => c.color);
      const result = forecastRace(input, names, colors);
      return NextResponse.json({ forecast: result, race });
    }

    if (body.type === "civic_history") {
      const { raceId, timestamp, priorTimestamp, race_rule = "PLURALITY", expected_turnout } = body;
      const [current, prior] = await Promise.all([
        fetchCivicRaceHistory(raceId, timestamp),
        priorTimestamp ? fetchCivicRaceHistory(raceId, priorTimestamp) : Promise.resolve(undefined),
      ]);
      const names = current.candidates.sort((a, b) => b.votes - a.votes).slice(0, 3).map((c) => c.name);
      const colors = current.candidates.sort((a, b) => b.votes - a.votes).slice(0, 3).map((c) => c.color);
      const input = civicToForecastInput(current, prior, race_rule, expected_turnout);
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