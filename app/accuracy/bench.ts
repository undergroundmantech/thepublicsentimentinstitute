// How On Point stacked up against every other pollster and forecaster in 2026, read at build time from
// public/accuracy/benchmarks-2026.json. That file is hand kept: other outlets' final numbers do not come from our
// own model files, so edit it when the count settles and the pages follow on the next deploy.
import fs from "node:fs";
import path from "node:path";
import { SITE } from "@/app/lib/seo";

/** score is the poll's error: its distance from the count, in points. field is the day fieldwork ended; pop is LV, RV or A. */
export type Poll = { rank: number; name: string; final: number; score: number; us: boolean; field?: string; pop?: string };
export type SeatVal = number | string | null;
export type SeatRow = { name: string; house: SeatVal; senate: SeatVal; gov: SeatVal; us: boolean };
export type Bench = {
  asof: string; asof_label: string;
  generic: {
    us: { margin: number; d: number; r: number; field: string; n: number; note: string };
    result: { margin: number; label: string; counted_margin: number; counted_d: number; counted_r: number; counted_votes_m: number; asof_label?: string; source?: string };
    averages: { margin: number; lo: number; hi: number; label: string };
  };
  national: { polls: Poll[]; method: string; source?: { name: string; url: string } };
  called: { right: number; of: number; share: number; senate: [number, number]; governor: [number, number]; house: [number, number]; house_leaders: [number, number]; senate_miss: string; governor_miss: string; note: string };
  seats: { result: { house: number; senate: number; gov: number; house_approx: boolean }; rows: SeatRow[]; note: string };
  senate: { races: string[]; rows: { rank: number; name: string; right: number; us: boolean }[]; note: string };
  calls: { k: string; v: string; t: string }[];
};

let cache: Bench | null = null;
export function getBench(): Bench {
  if (!cache) cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/accuracy/benchmarks-2026.json"), "utf8")) as Bench;
  return cache;
}

export const dm = (m: number) => `D +${Number.isInteger(m) ? m : m.toFixed(1)}`;
export const marginMiss = (p: Poll, result: number) => Math.round(Math.abs(p.final - result) * 10) / 10;

/** Structured data for the pollster ranking: an ItemList search engines and answer engines can read. */
export function rankingLd(b: Bench, url: string) {
  return {
    "@type": "ItemList",
    "@id": `${SITE.url}${url}#national-poll-ranking`,
    name: "Final national generic ballot polls of the 2026 midterms, ranked by accuracy",
    description: `Every pollster's last national generic ballot before Election Day, ranked by its distance from the D +${b.generic.result.margin.toFixed(1)} count. ${b.national.method}`,
    numberOfItems: b.national.polls.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: b.national.polls.map((p, i) => ({
      "@type": "ListItem", position: i + 1, name: `${p.name}: final ${dm(p.final)}, ${p.score.toFixed(1)} points from the count, rank ${p.rank}`,
    })),
  };
}

/** Questions people search, answered from the same numbers the page shows. */
export function faqLd(b: Bench, extra: { q: string; a: string }[] = []) {
  const g = b.generic;
  const first = b.national.polls[0], us = b.national.polls.find((p) => p.us)!;
  const miss = Math.abs(g.us.margin - g.result.margin).toFixed(1);
  const qa = [
    { q: "Who was the most accurate pollster on the 2026 generic ballot?",
      a: `${first.name}, with a final national poll of ${dm(first.final)} against a count of D +${g.result.margin.toFixed(1)}, ${first.score.toFixed(1)} points off. On Point Polling was second of ${b.national.polls.length}: its final national survey had Democrats ahead by ${g.us.margin.toFixed(1)} points, ${g.us.d.toFixed(1)} to ${g.us.r.toFixed(1)}, ${miss} points from the count.` },
    { q: "How close was On Point Polling on the 2026 generic congressional ballot?",
      a: `On Point Polling had D +${g.us.margin.toFixed(1)} on October 28. The count is D +${g.result.margin.toFixed(1)}, so the poll was ${miss} points off and ranked ${us.rank} of ${b.national.polls.length} final national polls. The polling averages finished near D +${g.averages.margin.toFixed(1)}, a miss of ${(g.result.margin - g.averages.margin).toFixed(1)} points.` },
    { q: "How is pollster accuracy scored?", a: b.national.method },
    ...extra,
  ];
  return { "@type": "FAQPage", mainEntity: qa.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
}

// ---- On Point Polling's own polls, scored race by race (public/accuracy/polling-2026.json, from build_polling.py) ----
export type PollRow = { id: string; race: string; st: string; office: "Senate" | "Governor" | "House"; date: string; n: number; title: string; sponsor: string | null;
  d: string; r: string; ind: boolean; dv: number; rv: number; poll: number; earlier: { date: string; poll: number }[];
  result?: number; pct?: number; final?: boolean; miss?: number; right?: boolean; winner?: string };
export type PollBlk = { n: number; right: number; mae: number; bias: number; within1: number; within3: number };
export type Polling = { asof: string; note: string;
  national: { release: string; date: string; n: number; d: number; r: number; poll: number; result: number; counted: number; miss: number; rank: number; of: number; averages: number };
  summary: { all: PollBlk; senate: PollBlk; governor: PollBlk; house: PollBlk | null; releases: number; states: number }; races: PollRow[] };
let pcache: Polling | null = null;
export function getPolling(): Polling {
  if (!pcache) pcache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/accuracy/polling-2026.json"), "utf8")) as Polling;
  return pcache;
}
/** A margin, R minus D, with the independent shown as I where the D slot is one. */
export const pm = (m: number, ind = false, k = 1) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(k)}`);
