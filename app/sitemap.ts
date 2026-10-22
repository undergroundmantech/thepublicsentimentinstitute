// Every public page on the site, built from the same data the pages are built from, so a new
// race, chamber, measure or polling average is listed the moment it has a page.
import type { MetadataRoute } from "next";
import { getModel } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import { SITE } from "@/app/lib/seo";
import { getEarlyVote } from "@/app/maps/early-vote/server";
import { SHOW_SITUATION_ROOM } from "@/app/lib/flags";
import { AGGREGATES } from "@/app/_polling/lib/aggregates";
import { pollHref, stateRaceParams } from "@/app/polls/registry";
import { dbHref, getDownballot } from "@/app/forecast/statewide/data";
import { getStatehouse, slHref } from "@/app/forecast/legislatures/data";
import { bmHref, getMeasures } from "@/app/forecast/measures/data";
import { ELECTION_DATES, RACE_REGISTRY } from "@/app/results/_data/raceRegistry";
import { DEDICATED_BOARDS, RACE_PAGES } from "@/app/results/archive/nightBoards";

type Entry = MetadataRoute.Sitemap[number];
const u = (path: string, lastModified: string | Date, changeFrequency: Entry["changeFrequency"], priority: number): Entry => ({
  url: `${SITE.url}${path}`, lastModified, changeFrequency, priority,
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const model = getModel();
  const fc = model.meta.updated;
  const sl = getStatehouse();
  const ms = getMeasures();
  const db = getDownballot();
  const today = new Date();
  const ev = await getEarlyVote().catch(() => null);
  const out: Entry[] = [];

  // section fronts
  out.push(
    u("/", today, "hourly", 1),
    u("/forecast", fc, "daily", 1),
    u("/swingometer", fc, "daily", 0.9),
    u("/what-if", fc, "daily", 0.9),
    u("/watchdog", fc, "daily", 0.8),
    u("/watchdog/trail", fc, "daily", 0.8),
    u("/watchdog/endorsements", fc, "daily", 0.8),
    u("/watchdog/media", fc, "daily", 0.8),
    u("/watchdog/money", fc, "daily", 0.8),
    u("/watchdog/connections", fc, "daily", 0.8),
    u("/watchdog/paid", fc, "daily", 0.8),
    u("/watchdog/counties", fc, "daily", 0.8),
    ...["", "/tape", "/races", "/candidates", "/committees", "/donors", "/vendors", "/groups", "/signals", "/scores", "/foreign", "/lobbying", "/ads", "/events", "/states", "/web"].map((x) => u(`/watchdog/ledger${x}`, fc, "daily", 0.6)),
    u("/forecast/statewide", db.meta.updated, "daily", 0.8),
    u("/forecast/legislatures", sl.meta.updated, "daily", 0.9),
    u("/forecast/measures", ms.meta.updated, "daily", 0.9),
    u("/forecast/other", ms.meta.updated, "daily", 0.7),
    u("/forecast/methodology", fc, "weekly", 0.6),
    u("/forecast/changelog", fc, "daily", 0.4),
    u("/polls", today, "daily", 0.9),
    u("/polls/senate", today, "daily", 0.8),
    u("/polls/governor", today, "daily", 0.8),
    u("/maps", today, "weekly", 0.7),
    u("/maps/early-vote", today, "hourly", 0.95),
    u("/maps/ballot-measures", ms.meta.updated, "daily", 0.85),
    u("/maps/electoral", fc, "weekly", 0.7),
    u("/maps/party-registration", today, "monthly", 0.5),
    u("/maps/voter-registration", today, "monthly", 0.5),
    u("/results", today, "daily", 0.8),
    u("/results/monitor", today, "daily", 0.8),
    u("/results/2026", today, "daily", 0.8),
    u("/results/tonight", today, "daily", 0.7),
    u("/results/archive", today, "weekly", 0.5),
    u("/on-point-polling", today, "monthly", 0.5),
    u("/on-point-polling/methodology", today, "monthly", 0.5),
    u("/on-point-polling/polls", today, "weekly", 0.6),
    u("/on-point-polling/polls/texas-2026", "2026-10-18", "weekly", 0.8),
    u("/on-point-polling/polls/ohio-2026", "2026-10-17", "weekly", 0.8),
    u("/on-point-polling/polls/national-2026", today, "monthly", 0.6),
    u("/on-point-polling/polls/la-mayor-2026", today, "monthly", 0.5),
    u("/on-point-polling/services", today, "monthly", 0.4),
    u("/on-point-polling/weighting-room", today, "monthly", 0.4),
    u("/on-point-polling/sms", today, "yearly", 0.2),
    u("/contact", today, "yearly", 0.3),
    u("/terms", today, "yearly", 0.1),
  );

  // the situation room ships dark in production until the desk launches it
  if (SHOW_SITUATION_ROOM) out.push(u("/on-point-polling/situation-room", today, "daily", 0.5));

  // forecast pages: marquee races first, so the sitemap reads in order of interest
  for (const r of model.races) out.push(u(raceHref(r.id), fc, "daily", r.office === "house" ? (r.marquee ? 0.8 : 0.6) : 0.9));
  for (const r of db.races) out.push(u(dbHref(r), db.meta.updated, "daily", 0.6));
  for (const c of sl.chambers) out.push(u(slHref(c), sl.meta.updated, "daily", 0.7));
  for (const m of ms.measures) out.push(u(bmHref(m), ms.meta.updated, "daily", 0.7));
  // one early vote tracker page per reporting state
  for (const s of ev?.states ?? []) out.push(u(`/maps/early-vote/${s.slug}`, ev!.snapshot, "daily", 0.8));

  // polling averages, every one at its canonical route
  const seen = new Set(out.map((e) => e.url));
  const add = (e: Entry) => { if (!seen.has(e.url)) { seen.add(e.url); out.push(e); } };
  for (const d of AGGREGATES) {
    const href = pollHref(d.id);
    if (href.includes("?")) continue;
    const old = /^\/polls\/archive\//.test(href) || /governor-2025$/.test(href);
    add(u(href, today, old ? "yearly" : "daily", old ? 0.3 : href.split("/").length === 3 ? 0.9 : 0.7));
  }
  for (const p of stateRaceParams()) add(u(`/polls/${p.state}/${p.race}`, today, "weekly", 0.5));

  // election nights already counted, and the two races with pages of their own
  for (const date of ELECTION_DATES) add(u(DEDICATED_BOARDS[date] ?? `/results/archive/${date}`, date, "yearly", 0.4));
  for (const r of RACE_REGISTRY) if (RACE_PAGES.has(r.slug)) add(u(`/results/${r.date}/${r.slug}`, r.date, "yearly", 0.5));

  return out;
}
