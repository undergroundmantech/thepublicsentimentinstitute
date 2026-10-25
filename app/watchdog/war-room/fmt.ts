// War Room formatting, safe on the server and in the browser.
export const OFFICE_NAME: Record<string, string> = { senate: "Senate", governor: "Governor", house: "House" };

/** Race margins are Republican minus Democratic. dP is the party letter of the candidate in the Democratic slot. */
export function lead(m: number | null | undefined, dP = "D") {
  if (m == null || !isFinite(m)) return "n/a";
  if (Math.abs(m) < 0.05) return "Even";
  return m > 0 ? `R +${m.toFixed(1)}` : `${dP} +${Math.abs(m).toFixed(1)}`;
}
export const usd = (n: number | null | undefined) => {
  if (n == null) return "n/a";
  return n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;
};
export const pct = (p: number) => {
  const v = 100 * p;
  return v > 99 ? ">99%" : v < 1 ? "<1%" : `${Math.round(v)}%`;
};
/** est.prob is the Republican's chance. */
export const winP = (p: number, side: "D" | "R") => (side === "R" ? p : 1 - p);
export const healthTone = (s: number | null) => (s == null ? "na" : s >= 70 ? "strong" : s >= 55 ? "stable" : s >= 40 ? "strained" : "critical");
export function rating(p: number, dP = "D") {
  const r = p, d = 1 - p;
  if (r >= 0.95) return "Safe R"; if (r >= 0.8) return "Likely R"; if (r >= 0.6) return "Lean R";
  if (d >= 0.95) return `Safe ${dP}`; if (d >= 0.8) return `Likely ${dP}`; if (d >= 0.6) return `Lean ${dP}`;
  return "Toss up";
}
export const surname = (n: string) => n.replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ").slice(-1)[0];
export const raceLabel = (r: { office: string; st: string; name: string; id: string }) =>
  r.office === "house" ? `${r.st}-${r.id.split("-")[2]}` : r.name;
export function warHref(id: string) { return `/watchdog/war-room/${id}`; }
