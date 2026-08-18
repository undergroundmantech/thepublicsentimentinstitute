import { NextResponse } from "next/server";

/**
 * Florida turnout by party and county, from Fresh Take Florida (UF College of
 * Journalism).
 *
 * This counts BALLOTS CAST — vote-by-mail and early in-person before today,
 * plus election-day in-person once polls open. It is a turnout figure, not a
 * result: it says how many Republicans have voted, never who they voted for.
 *
 * Why it matters on our board: Florida runs closed primaries, so the Republican
 * column is the universe eligible to vote in the governor's race. It gives us a
 * measured denominator for how much of the expected vote is already in the box
 * and where, which is the weakest input in the county model — our own
 * `projectedTurnout` is a registration-and-history prior with nothing observed
 * in it. It is also a direct live check on the 1,635,000 turnout assumption
 * behind the statewide forecast.
 *
 * The source has no robots.txt and no public API, so this scrapes the rendered
 * table. That makes it fragile by construction: any markup change breaks the
 * parse. Every failure path here returns `ok: false` and the board falls back to
 * its own prior rather than showing a partial or stale number as if it were
 * fresh.
 */

const SRC = "https://www.freshtake.vote/2026P/countydata.php";

export const revalidate = 0;

export interface CountyTurnout {
  county: string;
  rep: number;
  dem: number;
  oth: number;
  total: number;
  /** Share of registered voters who have already voted, by party. 0–100. */
  repPct: number | null;
  totalPct: number | null;
}

export interface FreshtakePayload {
  ok: boolean;
  fetchedAt: string;
  source: string;
  counties: CountyTurnout[];
  statewide: { rep: number; dem: number; oth: number; total: number } | null;
  error?: string;
}

const num = (s: string): number => {
  const n = Number(String(s).replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const pct = (s: string): number | null => {
  if (!/%/.test(s)) return null;
  const n = Number(s.replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const strip = (s: string) =>
  s.replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export function parseCountyTable(html: string): { counties: CountyTurnout[]; statewide: CountyTurnout | null } {
  const table = html.match(/<table[^>]*class="[^"]*data-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!table) return { counties: [], statewide: null };

  const rows = [...table[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => strip(c[1])),
  );

  // Each county occupies two consecutive rows: raw counts, then the same
  // figures as a share of registration. Pair them by name.
  const out = new Map<string, CountyTurnout>();
  for (const cells of rows) {
    if (cells.length < 5) continue;
    const [name, rep, dem, oth, total] = cells;
    if (!name || /^county$/i.test(name)) continue;

    const isPctRow = /%/.test(rep) || /%/.test(total);
    const existing = out.get(name);

    if (isPctRow) {
      if (!existing) continue;
      existing.repPct = pct(rep);
      existing.totalPct = pct(total);
    } else if (!existing) {
      out.set(name, {
        county: name,
        rep: num(rep),
        dem: num(dem),
        oth: num(oth),
        total: num(total),
        repPct: null,
        totalPct: null,
      });
    }
  }

  // The table carries its own "Statewide" total as a row. Keeping it in the
  // county list would double every statewide sum computed from that list.
  const all = [...out.values()];
  const isAggregate = (c: CountyTurnout) => /^(statewide|total|florida)$/i.test(c.county);
  return {
    counties: all.filter((c) => !isAggregate(c)),
    statewide: all.find(isAggregate) ?? null,
  };
}

export async function GET() {
  const empty = (error: string): FreshtakePayload => ({
    ok: false,
    fetchedAt: new Date().toISOString(),
    source: SRC,
    counties: [],
    statewide: null,
    error,
  });

  try {
    const ac = AbortSignal.timeout(8000);
    const res = await fetch(SRC, {
      cache: "no-store",
      signal: ac,
      headers: { "User-Agent": "TPSI election desk (thepublicsentimentinstitute.com)" },
    });
    if (!res.ok) {
      return NextResponse.json(empty(`upstream ${res.status}`), {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const { counties, statewide: reported } = parseCountyTable(await res.text());
    if (counties.length < 60) {
      // Florida has 67 counties. A short parse means the markup moved, not that
      // turnout collapsed — refuse rather than publish a truncated denominator.
      return NextResponse.json(empty(`parsed only ${counties.length} counties`), {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Prefer the source's own statewide row; fall back to summing counties.
    const statewide = reported
      ? { rep: reported.rep, dem: reported.dem, oth: reported.oth, total: reported.total }
      : counties.reduce(
          (a, c) => ({
            rep: a.rep + c.rep,
            dem: a.dem + c.dem,
            oth: a.oth + c.oth,
            total: a.total + c.total,
          }),
          { rep: 0, dem: 0, oth: 0, total: 0 },
        );

    const payload: FreshtakePayload = {
      ok: true,
      fetchedAt: new Date().toISOString(),
      source: SRC,
      counties,
      statewide,
    };

    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(empty(err instanceof Error ? err.message : "fetch failed"), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
