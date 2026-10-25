// War Room data: read at build time from public/watchdog/warroom, written by scripts/watchdog/build_warroom.py.
import fs from "node:fs";
import path from "node:path";

export type Side = "D" | "R";
export type WRow = {
  id: string; office: "senate" | "governor" | "house"; st: string; name: string; dem: string; gop: string; dP: string;
  m: number; p: number; d7: number | null; hD: number | null; hR: number | null; lD: string; lR: string; files: string[]; outside: number | null; ev: number | null;
};
export type HPart = { key: string; label: string; w: number; v: number; why: string[] };
export type HPen = { key: string; label: string; pts: number; why: string };
export type Health = { score: number | null; base: number | null; label: string; parts: HPart[]; pens: HPen[] };
export type Intel = { l: string | null; t: string; u: string | null };
export type People = { id: string; tier: string; hand: boolean; intel: Intel[]; bottom: string[]; contested: number; edges: number; blocs: string[] } | null;
export type Money = { receipts: number | null; cash: number | null; outside_for: number | null; spent: number | null; google_ads: number | null; mix: Record<string, number | null> | null; as_of: string | null } | null;
export type PathItem = { k: string; h: string; t: string; u?: string | null };
export type County = { name: string; m: number; share: number; net: number; pres24: number | null };
export type MapT = { base: County[]; battle: County[]; lag: County[] } | null;
export type Grp = { group: string; label: string; share: number; mine: number; theirs: number; lever: number; close: number };
export type Coal = { swing: Grp[]; strong: Grp[]; weak: Grp[] } | null;
export type WRace = {
  id: string; office: WRow["office"]; st: string; state: string; district: string | null; name: string; dem: string; gop: string; dP: string; rP: string;
  inc: number | null; open: boolean | null; pvi: number | null; pres24: number | null;
  est: { margin: number; prob: number; p10: number | null; p90: number | null }; pollAvg: number | null; trend: { m: number; p: number }[];
  polls: { pollster: string; kind: string; age: number; n: number; margin: number }[]; votes: { dem: number; rep: number; other: number; total: number } | null;
  ev: { shift: number; ballots: number } | null;
  health: Record<Side, Health>; people: Record<Side, People>;
  money: { D: Money; R: Money; groups: { name: string; side: string; kind: string; target: string; amount: number }[]; total: number | null; adBuys: { spender: string; amount: number; source: string }[] };
  earlyVote: { ballots: number; party: { d: number; r: number; o: number }; estimatedShare: number; actualMargin: number; expectedMargin: number; delta: number; pace: number | null; date: string } | null;
  paths: Record<Side, PathItem[]>; map: Record<Side, MapT>; coalition: Record<Side, Coal>;
  media: { who: string; role: string; lean: string; what: string; when: string; src: string }[];
  visits: { who: string; party: string; date: string; city: string; kind: string; note: string; src: string }[];
  news: { id: string; title: string; date: string }[];
  similar: { id: string; corr: number }[];
};
export type WIndex = { asOf: string; ev: string | null; ballots?: number; evStates?: number; n: number; races: WRow[] };

const DIR = path.join(process.cwd(), "public", "watchdog", "warroom");
let memo: WIndex | null = null;
export const getWarIndex = (): WIndex => (memo ??= JSON.parse(fs.readFileSync(path.join(DIR, "index.json"), "utf8")) as WIndex);
export const getWarRace = (id: string): WRace | null => {
  if (!/^[a-z]+-[A-Z]{2}(-\d+)?$/.test(id)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(DIR, "r", `${id}.json`), "utf8")) as WRace; } catch { return null; }
};
