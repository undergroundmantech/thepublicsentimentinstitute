// The weekly Campaign 2028 leaderboard: four boards that start fresh every Monday. Plain code, shared by the game,
// the leaderboard page and the API.
export type Cat = "rwin" | "dwin" | "pop" | "cheap";
export const CATS: { k: Cat; title: string; blurb: string; score: string }[] = [
  { k: "rwin", title: "Best Republican win", blurb: "The most electoral votes won as a Republican.", score: "EV" },
  { k: "dwin", title: "Best Democratic win", blurb: "The most electoral votes won as a Democrat.", score: "EV" },
  { k: "pop", title: "Biggest landslide", blurb: "The widest popular vote win, either party.", score: "points" },
  { k: "cheap", title: "Cheapest win", blurb: "A win on the least campaign money spent.", score: "spent" },
];
export type Row = { name: string; me: string; op: string; p: "D" | "R"; ev: number; pop: number; sp: number; code: string; at: string; fl?: string[]; sc?: string };
export type Board = { week: string; n: number; cats: Record<Cat, Row[]> };
/** the Monday that starts the week, in Eastern time, as YYYY-MM-DD */
export function weekOf(t = new Date()) {
  const et = new Date(t.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = (et.getDay() + 6) % 7; et.setDate(et.getDate() - day);
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, "0")}-${String(et.getDate()).padStart(2, "0")}`;
}
export const prevWeek = (w: string) => { const d = new Date(w + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0, 10); };
export const weekLabel = (w: string) => new Date(w + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
/** which boards a result can enter, and its sort score there; higher is better */
export function scores(r: Row): Partial<Record<Cat, number>> {
  const out: Partial<Record<Cat, number>> = {}; if (r.ev < 270) return out;
  if (r.p === "R") out.rwin = r.ev; else out.dwin = r.ev;
  out.pop = r.pop; if (r.sp > 0) out.cheap = -r.sp;
  return out;
}
export const emptyBoard = (week: string): Board => ({ week, n: 0, cats: { rwin: [], dwin: [], pop: [], cheap: [] } });
