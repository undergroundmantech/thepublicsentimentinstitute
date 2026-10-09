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

// ─── COLOR VIBRANCY BOOSTER ───────────────────────────────────────────────────
// Turns muted API-sourced candidate colors (dull gold, dusty pink, etc.) into
// vivid neon versions. Yellow/orange hues need higher lightness to pop; all
// hues get saturation pushed to ≥92%.
function vibrateColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
  }
  // Aggressively boost saturation
  const ns = Math.min(1, Math.max(s, 0.92));
  // Yellow/orange hues (20–70°) need higher lightness to look vibrant
  const hueDeg = h * 360;
  const isWarm = hueDeg >= 20 && hueDeg <= 70;
  const nl = isWarm
    ? Math.min(0.65, Math.max(0.55, l))
    : Math.min(0.62, Math.max(0.50, l));
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns;
  const p = 2 * nl - q;
  const nr = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const ng = Math.round(hue2rgb(p, q, h) * 255);
  const nb = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  return '#' + [nr, ng, nb].map(x => x.toString(16).padStart(2, '0')).join('');
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
  poll_avg: Record<string, number> | undefined,
  turnout_blend_k?: number
) {
  const sorted = sortCandidatesByPollAvg(race.candidates, poll_avg);
  const top3 = sorted.slice(0, 3);
  const names = top3.map((c) => c.name);
  const colors = top3.map((c) => vibrateColor(c.color));

  // Pass pre-sorted top3 into civicToForecastInput so it uses the identical
  // candidate ordering as `names` — eliminates dual-sort divergence where two
  // independent sort calls on the same data could produce different orderings.
  const input = civicToForecastInput(race, prior, race_rule, expected_turnout, poll_avg, turnout_blend_k, top3);

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
      const { raceData, race_rule = "PLURALITY", expected_turnout, poll_avg, turnout_blend_k } = body;
      if (!raceData) {
        return NextResponse.json({ error: "raceData is required for type civic_raw" }, { status: 400 });
      }
      return runForecastFromCivicRace(raceData as CivicRace, undefined, race_rule, expected_turnout, poll_avg, turnout_blend_k);
    }

    if (body.type === "civic") {
      const { raceId, race_rule = "PLURALITY", expected_turnout, poll_avg, turnout_blend_k } = body;
      const race = await fetchCivicRace(raceId);
      return runForecastFromCivicRace(race, undefined, race_rule, expected_turnout, poll_avg, turnout_blend_k);
    }

    if (body.type === "civic_history") {
      const { raceId, timestamp, priorTimestamp, race_rule = "PLURALITY", expected_turnout, poll_avg, turnout_blend_k } = body;
      const [current, prior] = await Promise.all([
        fetchCivicRaceHistory(raceId, timestamp),
        priorTimestamp ? fetchCivicRaceHistory(raceId, priorTimestamp) : Promise.resolve(undefined),
      ]);
      return runForecastFromCivicRace(current, prior, race_rule, expected_turnout, poll_avg, turnout_blend_k);
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