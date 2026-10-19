// Down ballot statewide races: lieutenant governor, attorney general, secretary of state, treasurer, auditor,
// agriculture commissioner and the Texas railroad commissioner. Built by scripts/forecast/downballot/build_downballot.py
// into public/forecast/downballot.json and public/forecast/downballot_counties.json.
import fs from "node:fs";
import path from "node:path";

export type DBPoll = { pollster: string; end: string; n?: number | null; kind: string; D: number; R: number; U?: number; margin: number; age: number; url?: string };
export type DBRace = {
  id: string; st: string; state: string; office: string; officeLabel: string;
  /** the seat, where a state elects several for one office; slug is the page address, the office unless there is a seat */
  seat?: string | null; slug?: string; seatsUp?: number;
  dem: string | null; gop: string | null; others: { name: string; party: string }[];
  incumbent?: string | null; incParty?: string | null; incRunning: boolean; note?: string | null; sources: string[];
  uncontested?: "D" | "R";
  est: { margin: number; prob: number; p10: number | null; p90: number | null };
  votes?: { dem: number; rep: number; other: number; total: number };
  polls: DBPoll[]; pollWeight?: number; pollAvg?: number | null;
  legs: {
    weights?: Record<string, number>; topOfTicket?: number; blend?: number; withCandidates?: number; final?: number;
    history?: number | null; candidateTerm?: number; topRaces?: string[]; anchor?: string;
  };
  history: Record<string, number>;
  primary?: Record<string, number> | null;
  otherShare?: number;
};
export type DBData = { meta: { updated: string; races: number; modeled: number; offices: Record<string, string> }; races: DBRace[] };
export type CountyRow = [number, number, number, number, number[]?];

const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", rel), "utf8"));
let cache: DBData | null = null;
export const getDownballot = (): DBData => (cache ??= read("downballot.json") as DBData);
export const getDownballotCounties = () => read("downballot_counties.json") as Record<string, Record<string, CountyRow> | Record<string, string>>;

export const OFFICE_ORDER = ["lieutenant-governor", "attorney-general", "secretary-of-state", "treasurer", "auditor", "agriculture-commissioner", "railroad-commissioner",
  "comptroller", "land-commissioner", "superintendent", "insurance-commissioner", "labor-commissioner", "public-service-commission", "mine-inspector", "education-board", "supreme-court"];
export const dbHref = (r: Pick<DBRace, "st" | "office"> & { slug?: string }) => `/forecast/statewide/${r.st.toLowerCase()}/${r.slug ?? r.office}`;
