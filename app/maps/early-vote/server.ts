// Server side early vote numbers for the tracker's crawlable summary, search titles and structured data.
// Reads civicAPI's national feeds directly, an hour at a time, and falls back to the newest snapshot
// saved in scripts/forecast/earlyvote/snapshots when a feed is down, so the page always has numbers.
import fs from "node:fs";
import path from "node:path";
import { STATE_NAME } from "./lib";

const BASE = "https://civicapi.org/api/v2/early-vote";
export const EV_REVALIDATE = 3600;
export const EV_KEYWORDS = ["early vote tracker", "2026 early vote tracker", "early voting 2026", "early vote numbers", "how many people have voted early",
  "mail ballots returned", "early voting by party", "midterm early vote", "early vote by state", "early vote by county"];

type Feed = { snapshot_date: string; regions: Record<string, Record<string, { votes: number }>> };
type Cat = "returned" | "inperson" | "requested";

export type EvState = {
  st: string; name: string; slug: string;
  mail: number; inperson: number; total: number; requested: number;
  dem: number; rep: number; ind: number; unspecified: number;
  /** share of ballots with a reported party, 0 to 1 */
  partyShare: number;
};
export type EarlyVote = { snapshot: string; total: number; mail: number; inperson: number; requested: number;
  dem: number; rep: number; ind: number; partyTotal: number; states: EvState[]; inpersonDate: string; mailDate: string };

export const slugOf = (st: string) => (STATE_NAME[st] ?? st).toLowerCase().replace(/[^a-z]+/g, "-");

async function liveFeed(cat: Cat): Promise<Feed | null> {
  try {
    const r = await fetch(`${BASE}/US/${cat}`, { headers: { accept: "application/json" }, next: { revalidate: EV_REVALIDATE } });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.regions && j.snapshot_date ? (j as Feed) : null;
  } catch { return null; }
}

function savedFeed(cat: Cat): Feed | null {
  try {
    const dir = path.join(process.cwd(), "scripts/forecast/earlyvote/snapshots");
    const days = fs.readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
    for (const d of days) {
      const f = path.join(dir, d, `US_${cat}.json`);
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")) as Feed;
    }
  } catch { /* no saved snapshot on this server */ }
  return null;
}

async function feed(cat: Cat): Promise<Feed | null> {
  const [a, b] = [await liveFeed(cat), savedFeed(cat)];
  if (a && b) return a.snapshot_date >= b.snapshot_date ? a : b;
  return a ?? b;
}

const sum = (g: Record<string, { votes: number }> | undefined, f: (k: string) => boolean) =>
  Object.entries(g ?? {}).reduce((s, [k, v]) => s + (f(k) ? Number(v?.votes) || 0 : 0), 0);
const isInd = (k: string) => k !== "Democratic" && k !== "Republican" && k !== "Unspecified";

let memo: { at: number; v: EarlyVote } | null = null;

export async function getEarlyVote(): Promise<EarlyVote> {
  if (memo && Date.now() - memo.at < 60_000) return memo.v;
  const [ret, inp, req] = await Promise.all([feed("returned"), feed("inperson"), feed("requested")]);
  if (!ret && !inp) throw new Error("no early vote feed or saved snapshot");
  const sts = new Set<string>([...Object.keys(ret?.regions ?? {}), ...Object.keys(inp?.regions ?? {})].filter((s) => s !== "US" && STATE_NAME[s]));
  const states: EvState[] = [...sts].map((st) => {
    const r = ret?.regions[st], i = inp?.regions[st];
    const mail = sum(r, () => true), inperson = sum(i, () => true);
    const dem = sum(r, (k) => k === "Democratic") + sum(i, (k) => k === "Democratic");
    const rep = sum(r, (k) => k === "Republican") + sum(i, (k) => k === "Republican");
    const ind = sum(r, isInd) + sum(i, isInd);
    const total = mail + inperson;
    return { st, name: STATE_NAME[st], slug: slugOf(st), mail, inperson, total, requested: sum(req?.regions[st], () => true),
      dem, rep, ind, unspecified: total - dem - rep - ind, partyShare: total ? (dem + rep + ind) / total : 0 };
  }).filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
  const add = (k: keyof EvState) => states.reduce((s, x) => s + (x[k] as number), 0);
  const snapshot = [ret?.snapshot_date, inp?.snapshot_date].filter(Boolean).sort().reverse()[0] as string;
  const v: EarlyVote = { snapshot, total: add("total"), mail: add("mail"), inperson: add("inperson"), requested: add("requested"),
    dem: add("dem"), rep: add("rep"), ind: add("ind"), partyTotal: add("dem") + add("rep") + add("ind"), states,
    mailDate: ret?.snapshot_date ?? "", inpersonDate: inp?.snapshot_date ?? "" };
  memo = { at: Date.now(), v };
  return v;
}

export const commas = (n: number) => Math.round(n).toLocaleString("en-US");
export const millions = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : commas(n));
export const longDate = (d: string) => {
  const t = new Date(`${d}T12:00:00Z`);
  return isNaN(+t) ? d : t.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};
export const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "n/a");
