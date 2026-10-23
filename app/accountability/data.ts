// The Accountability Index, read at build time from public/accountability/index.json.
// Built by scripts/accountability/build_index.py from TrackAIPAC, FEC, Quiver Quantitative and the scorecards.
import fs from "node:fs";
import path from "node:path";
import type { Dot } from "./AxViz";

export type Part = "lobby" | "pac" | "trading" | "cross";
export const PARTS: Part[] = ["lobby", "pac", "trading", "cross"];
export type CardMeta = { id: string; name: string; lean: "L" | "R"; w: number; year: string; source: string; meanD: number; meanR: number };
export type CardVal = { score: number; lifetime: number | null; url?: string; norm: number; grade?: string };
export type Member = {
  id: string; slug: string; name: string; last: string; ch: "S" | "H"; st: string; dist: number | null; seat: string; party: "D" | "R" | "I"; since: string;
  parts: Partial<Record<Part, number>>; imputed?: Part[]; cards: Record<string, CardVal>; side: { L: number | null; R: number | null }; sideImputed?: ("L" | "R")[]; index?: number; grade?: string; rank?: number; coverage: number;
  lobby: { amount?: number | null; pacs?: number | null; ie?: number | null; approved?: boolean; tags?: string | null; missing?: string };
  money?: { raised: number | null; pac: number | null; pacShare: number | null; individual: number | null; partyCommittees: number | null; period: string; coverageThrough: string; url: string; note?: string };
  trades: { n: number; volume: number | null; url?: string; none?: boolean; note?: string };
  aff?: { grade: string; aligned: number | null; total: number | null; url: string };
  lcv?: { score: number | null; lifetime: number | null; url: string };
  heritage?: { score: number | null; lifetime: number | null; url: string };
};
export type Other = { name: string; office: string; party: string | null; amount: number | null; amount_text?: string | null; label: string; url: string };
export type Src = { name: string; url: string; asof?: string };
export type AxDoc = { updated: string; count: number; ranked: number; weights: Record<Part, number>; medians: Record<Part, number>; sideMedians: Record<"D" | "R", { L: number; R: number }>; cards: CardMeta[]; sources: Record<string, Src>; members: Member[]; others: Other[] };

let cache: AxDoc | null = null;
export function getAx(): AxDoc {
  if (!cache) cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/accountability/index.json"), "utf8")) as AxDoc;
  return cache;
}

export const PART_LABEL: Record<Part, string> = { lobby: "Pro-Israel lobby money", pac: "PAC money share", trading: "Stock trading", cross: "Crossing the aisle" };
export const PART_SHORT: Record<Part, string> = { lobby: "Lobby", pac: "PACs", trading: "Trading", cross: "Aisle" };
export const PARTY_LABEL = { D: "Democrat", R: "Republican", I: "Independent" } as const;
export const GRADES = [
  { g: "A", min: 75, note: "75 and up" },
  { g: "B", min: 66, note: "66 to 74.9" },
  { g: "C", min: 57, note: "57 to 65.9" },
  { g: "D", min: 48, note: "48 to 56.9" },
  { g: "F", min: 0, note: "Below 48" },
];
export const STATE_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia", PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands", AS: "American Samoa", MP: "Northern Mariana Islands",
};

export function money(n: number | null | undefined) {
  if (n == null) return "Not listed";
  const a = Math.abs(n);
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `$${Math.round(n / 1e3).toLocaleString()}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
export const pct = (x: number | null | undefined) => (x == null ? "Not listed" : `${Math.round(x * 100)}%`);
export const seatLong = (m: Pick<Member, "ch" | "st" | "dist">) =>
  m.ch === "S" ? `Senator from ${STATE_NAME[m.st] ?? m.st}` : !m.dist ? `${STATE_NAME[m.st] ?? m.st} at large` : `${STATE_NAME[m.st] ?? m.st} District ${m.dist}`;

export const dotOf = (m: Member): Dot => ({ slug: m.slug, name: m.name, seat: m.seat, party: m.party, ch: m.ch, index: m.index ?? null, grade: m.grade ?? null, rank: m.rank ?? null, lobby: m.lobby.amount ?? null, pac: m.money?.pacShare ?? null, trades: m.trades.n, cross: m.parts.cross ?? null, sL: m.side.L, sR: m.side.R });
