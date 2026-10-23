// Server side readers for the Watchdog data files in public/watchdog, built by scripts/watchdog/build_watchdog.py.
// Pages that use these are static, so the files are read once at build time.
import fs from "node:fs";
import path from "node:path";

const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "watchdog", f), "utf8")) as T;
// the big shared files are read once per build worker, not once per page
const memo = new Map<string, unknown>();
const readOnce = <T,>(f: string): T => { if (!memo.has(f)) memo.set(f, read<T>(f)); return memo.get(f) as T; };

export type Side = "D" | "R" | "I" | "O" | "other" | null;
export type RaceMoney = { key: string; st: string; office: string; total: number | null; forD: number | null; forR: number | null; dem: string | null; gop: string | null; m: number | null; p: number | null; href: string;
  groups: { name: string; side: Side; kind: "support" | "oppose"; target: string; amount: number }[]; source: string; asOf: string; ledger?: { raised: number; outside: number; cands: [string, string, number][] } };
export type Group = { name: string; side: Side; raised: number | null; spent: number | null; cash: number | null; states: string[]; donors: [string, number, string][]; vendors: [string, number, string, string][]; source: string; asOf: string };
export type Money = { asOf: string; races: RaceMoney[]; groups: Group[]; flow: { nodes: { id: string; kind: string; name: string; side: Side }[]; links: { s: string; t: string; v: number }[] };
  ads: { buyer: string; d90: number; all: number; ads: number }[]; adBuys: { state: string; race: string; spender: string; amount: number; source: string }[];
  tape: { date: string; group: string; against: string; amount: number; what: string; vendor: string }[];
  campaigns: { candidate: string; committee: string; paid: [string, number, string][]; gifts: [string, number][]; outside_for: [string, number][]; outside_for_total: number; outside_against: [string, number][]; outside_against_total: number }[]; notes: string };
export type Person = { name: string; party: string; role: string; ini: string; visits: number; attention: number; endorse: number; states: string[] };
export type Trail = { people: Person[]; visits: { who: string; party: string; date: string; st: string; city: string; kind: string; for: string[]; race: string; note: string; src: string }[];
  attention: { who: string; role: string; lean: string; st: string; race: string; what: string; when: string; src: string }[];
  endorse: { by: string; byFull: string; st: string; race: string; cand: string; party: string; date: string; src: string }[] };
export type GNode = { id: string; kind: "race" | "candidate" | "group" | "donor" | "vendor" | "person" | "committee"; name: string; side: Side; href?: string; role?: string; what?: string; race?: string; m?: number };
export type GEdge = { s: string; t: string; k: string; v: number | null; n: number; notes: string[]; src: string };
export type Graph = { nodes: GNode[]; edges: GEdge[] };

export const getMoney = () => read<Money>("money.json");
export const getTrail = () => read<Trail>("trail.json");
export const getGraph = () => readOnce<Graph>("graph.json");
/** candidate names on the Connections map */
export const graphCandidates = () => { const k = "__cands"; if (!memo.has(k)) memo.set(k, new Set(getGraph().nodes.filter((n) => n.kind === "candidate").map((n) => n.name))); return memo.get(k) as Set<string>; };

export const usd = (n: number | null | undefined) => (n == null ? "n/a" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);

// Oct 22 2026: the endorsements board and media watch, from scripts/watchdog/data/endorsements_research.json
export type EItem = { by: string; byRole: string; kind: string; date: string; src: string; note?: string };
export type ECand = { name: string; party: string | null; list: EItem[] };
export type ERace = { key: string; st: string; office: string; race: string; state?: string; id?: string; m?: number; p?: number; href?: string; n: number; cands: ECand[] };
export type MediaItem = { who: string; role: string; lean: string; st: string; race: string; what: string; when: string; src: string };
export type MediaPerson = { name: string; role: string; show: string | null; lean: string; ini: string; items: MediaItem[] };
export type Endorsements = { asOf: string; races: ERace[]; media: MediaPerson[]; kinds: string[]; parties?: Record<string, string>; unconfirmed: { claim: string; why: string }[]; note: string };
export const getEndorsements = () => read<Endorsements>("endorsements.json");

// Oct 23 2026: the people files, from the On Point Watchdog Database, built by scripts/watchdog/build_people.py
export type PRow = { id: string; name: string; party: "D" | "R" | "I" | "O"; st: string; district: string; office: string; current: string; race: string; role: string;
  rating: string; groups: string; priority: string; tier: string; hand: boolean; edges: number; levers: number; board: boolean; opp: string[] };
export type PEdge = { subject_id: string; donor_or_entity: string; type: string; amount: string; amount_usd: string; cumulative: string; date_or_as_of: string; recipient_vehicle: string;
  interest_bloc: string; source: string; hop: string; status: string; note: string; origin: string };
export type PLever = { decision: string; who_holds_it_now: string; when: string; which_donors_care: string; stake: string; subject_position: string; source: string };
export type PFile = PRow & { meta: Record<string, unknown>; profile: string; notes: string; edgesRows: PEdge[]; leversRows: PLever[]; links: Record<string, string> };
export const getPeople = () => readOnce<{ asOf: string; n: number; hand: number; people: PRow[] }>("people/index.json");
export const getPerson = (id: string): PFile | null => { try { return read<PFile>(`people/p/${id}.json`); } catch { return null; } };
export const PARTY_NAME: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent", O: "Other party" };
