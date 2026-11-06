// How On Point stacked up against every other pollster and forecaster in 2026, read at build time from
// public/accuracy/benchmarks-2026.json. That file is hand kept: other outlets' final numbers do not come from our
// own model files, so edit it when the count settles and the pages follow on the next deploy.
import fs from "node:fs";
import path from "node:path";
import { SITE } from "@/app/lib/seo";

export type Poll = { rank: number; name: string; final: number; score: number; us: boolean };
export type SeatVal = number | string | null;
export type SeatRow = { name: string; house: SeatVal; senate: SeatVal; gov: SeatVal; us: boolean };
export type Bench = {
  asof: string; asof_label: string;
  generic: {
    us: { margin: number; d: number; r: number; field: string; n: number; note: string };
    result: { margin: number; label: string; counted_margin: number; counted_d: number; counted_r: number; counted_votes_m: number };
    averages: { margin: number; lo: number; hi: number; label: string };
  };
  national: { polls: Poll[]; method: string };
  called: { right: number; of: number; share: number; senate: [number, number]; governor: [number, number]; house: [number, number]; house_leaders: [number, number]; senate_miss: string; governor_miss: string; note: string };
  seats: { result: { house: number; senate: number; gov: number; house_approx: boolean }; rows: SeatRow[]; note: string };
  senate: { races: string[]; rows: { rank: number; name: string; right: number; us: boolean }[]; note: string };
  calls: { k: string; v: string; t: string }[];
  graphics: { f: string; t: string }[];
};

let cache: Bench | null = null;
export function getBench(): Bench {
  if (!cache) cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/accuracy/benchmarks-2026.json"), "utf8")) as Bench;
  return cache;
}

export const dm = (m: number) => `D +${Number.isInteger(m) ? m : m.toFixed(1)}`;
export const marginMiss = (p: Poll, result: number) => Math.round(Math.abs(p.final - result) * 10) / 10;
export const GRAPHIC_DIR = "/accuracy/graphics";

/** Structured data for the pollster ranking: an ItemList search engines and answer engines can read. */
export function rankingLd(b: Bench, url: string) {
  return {
    "@type": "ItemList",
    "@id": `${SITE.url}${url}#national-poll-ranking`,
    name: "Most accurate final national polls of the 2026 midterms",
    description: `Every pollster's last national generic ballot before Election Day, scored against the D +${b.generic.result.margin.toFixed(1)} projected final. ${b.national.method}`,
    numberOfItems: b.national.polls.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: b.national.polls.map((p, i) => ({
      "@type": "ListItem", position: i + 1, name: `${p.name}: final ${dm(p.final)}, accuracy score ${p.score.toFixed(2)}, rank ${p.rank}`,
    })),
  };
}

/** Questions people search, answered from the same numbers the page shows. */
export function faqLd(b: Bench, extra: { q: string; a: string }[] = []) {
  const g = b.generic;
  const second = b.national.polls[1];
  const qa = [
    { q: "Who was the most accurate pollster of the 2026 midterms?",
      a: `On Point Polling, the polling arm behind On Point Politics and VT Analytics. Its final national survey had Democrats ahead by ${g.us.margin.toFixed(1)} points, ${g.us.d.toFixed(1)} to ${g.us.r.toFixed(1)}, against a projected final of D +${g.result.margin.toFixed(1)}. Scored on both the margin and the party shares, it ranked first of ${b.national.polls.length} final national polls with a score of ${b.national.polls[0].score.toFixed(2)}, ahead of ${second.name} at ${second.score.toFixed(2)}.` },
    { q: "Which poll was closest on the 2026 generic congressional ballot?",
      a: `On Point Polling had D +${g.us.margin.toFixed(1)} and The Honest Poll had D +13; the projected final is D +${g.result.margin.toFixed(1)}. On Point was 0.1 off on the margin and closer on the vote shares. The polling averages finished near D +${g.averages.margin.toFixed(1)}, a miss of ${(g.result.margin - g.averages.margin).toFixed(1)} points.` },
    { q: "How is pollster accuracy scored?", a: b.national.method },
    ...extra,
  ];
  return { "@type": "FAQPage", mainEntity: qa.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
}
