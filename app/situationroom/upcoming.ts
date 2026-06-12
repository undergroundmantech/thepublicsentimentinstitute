import { useEffect, useState } from "react";

// Forward calendar for the situation room — what's actually next on the wire.
// The results-hub index only spans the season already played (Feb → Jun), so
// it can't answer "when is the next election?". This loader walks month
// windows FORWARD from today against the same civicapi endpoint, stops once
// it has a few distinct upcoming election days, and caches per session.

export type UpcomingDay = {
  date: string;        // ISO yyyy-mm-dd
  count: number;       // contests on that day
  sample: string[];    // a few contest names, biggest first as returned
};

const API = "https://civicapi.org/api/v2/race/search";
const CACHE_KEY = "psi-upcoming-v1";
const CACHE_TTL = 30 * 60 * 1000;
const HORIZON = "2026-12-31";
const WANT_DAYS = 5;

const pad = (n: number) => String(n).padStart(2, "0");

function monthWindows(fromIso: string): [string, string][] {
  const [y0, m0] = fromIso.split("-").map(Number);
  const [yH, mH] = HORIZON.split("-").map(Number);
  const out: [string, string][] = [];
  let y = y0, m = m0;
  while (y < yH || (y === yH && m <= mH)) {
    const last = new Date(y, m, 0).getDate();
    out.push([`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(last)}`]);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

function cleanName(s: unknown) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

let _promise: Promise<UpcomingDay[]> | null = null;

export function loadUpcoming(todayIso: string): Promise<UpcomingDay[]> {
  if (_promise) return _promise;
  _promise = (async () => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw);
        if (c && c.today === todayIso && Date.now() - c.at < CACHE_TTL && Array.isArray(c.days)) return c.days;
      }
    } catch { /* no session cache — fetch */ }

    const byDate = new Map<string, { count: number; sample: string[] }>();
    for (const [s, e] of monthWindows(todayIso)) {
      let races: { election_date?: string; election_name?: string }[] = [];
      try {
        const res = await fetch(`${API}?startDate=${s}&endDate=${e}&limit=50000`);
        if (res.ok) races = (await res.json()).races || [];
      } catch { /* window unreachable — keep walking */ }
      for (const r of races) {
        const date = String(r.election_date || "").slice(0, 10);
        if (!date || date <= todayIso) continue;
        const cur = byDate.get(date) || { count: 0, sample: [] };
        cur.count += 1;
        const nm = cleanName(r.election_name);
        if (nm && cur.sample.length < 8 && !cur.sample.includes(nm)) cur.sample.push(nm);
        byDate.set(date, cur);
      }
      if (byDate.size >= WANT_DAYS) break;
    }

    const marquee = (s: string) => /governor|senate|senator|congress|president|mayor/i.test(s);
    const days: UpcomingDay[] = [...byDate.entries()]
      .map(([date, v]) => ({
        date,
        count: v.count,
        sample: [...v.sample].sort((a, b) => Number(marquee(b)) - Number(marquee(a))).slice(0, 3),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, WANT_DAYS);

    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), today: todayIso, days })); } catch { /* quota */ }
    return days;
  })();
  return _promise;
}

export function useUpcomingDays(todayIso: string) {
  const [days, setDays] = useState<UpcomingDay[] | null>(null);
  useEffect(() => {
    let on = true;
    loadUpcoming(todayIso).then((d) => { if (on) setDays(d); }).catch(() => { if (on) setDays([]); });
    return () => { on = false; };
  }, [todayIso]);
  return days;
}
