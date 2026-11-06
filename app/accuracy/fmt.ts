// Formatting helpers for the accuracy pages, with no file access, so client components can share them.
import type { Chamber, Office, Race } from "./data";

/** A margin, R minus D, as the party ahead and the lead. */
export const mg = (m: number | null | undefined, ind = false, k = 1) =>
  m == null ? "" : Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(k)}`;
/** An error, result minus forecast, as the party the miss ran toward. */
export const er = (e: number | null | undefined, ind = false, k = 1) =>
  e == null ? "" : Math.abs(e) < 0.05 ? "None" : `${e < 0 ? (ind ? "I" : "D") : "R"} ${Math.abs(e).toFixed(k)}`;
export const cls = (m: number | null | undefined, ind = false) => (m == null || Math.abs(m) < 0.05 ? "" : m < 0 ? (ind ? "i" : "d") : "r");
export const pc = (x: number, k = 0) => `${(x * 100).toFixed(k)}%`;
/** The forecast's seat count: the called winner in every race, plus the seats not up. */
export const calledSeats = (c: Chamber) => `${c.projD - c.projI} D${c.projI ? ` · ${c.projI} I` : ""} · ${c.projR} R`;
/** A seat miss, count minus the called seats, as the party the count ran ahead for. */
export const seatMiss = (e: number | null | undefined) => (e == null ? "" : e === 0 ? "None" : `${e > 0 ? "D" : "R"} ${Math.abs(e)}`);
export const OFFICE: Record<Office, string> = { senate: "Senate", governor: "Governor", house: "House" };
export const asofLabel = (iso: string) => {
  const d = new Date(iso.replace("Z", ":00Z"));
  return d.toLocaleString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
};
/** The candidate names the count used, falling back to the forecast's. */
export const who = (r: Race) => ({ d: r.dn ?? r.dem ?? "Democrat", r: r.rn ?? r.gop ?? "Republican" });
export const winnerName = (r: Race) => (r.side === "D" ? who(r).d : who(r).r);
