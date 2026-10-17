// Shared fills for the state legislative maps, so the national map, the chamber maps and the seat charts agree.
import { RATE, marginColor } from "@/app/lib/opp";

export type LegisMode = "odds" | "margin" | "flips";

export function oddsFill(p: number) {
  if (p >= 0.95) return RATE.safeD;
  if (p >= 0.8) return RATE.likelyD;
  if (p >= 0.6) return RATE.leanD;
  if (p > 0.4) return RATE.toss;
  if (p > 0.2) return RATE.leanR;
  if (p > 0.05) return RATE.likelyR;
  return RATE.safeR;
}

/** Fill for one district. Margin is Republican minus Democratic, probD the Democratic win chance, last the party that won it last time. */
export function districtFill(mode: LegisMode, probD: number | null, margin: number | null, last?: string | null) {
  if (probD == null) return "rgba(128,120,150,.35)";
  if (mode === "odds") return oddsFill(probD);
  if (mode === "margin") return marginColor(margin == null || Math.abs(margin) >= 99 ? (probD > 0.5 ? -40 : 40) : margin);
  const fav = probD >= 0.5 ? "D" : "R";
  if (last && last !== "O" && last !== fav) return fav === "D" ? "#3d7bff" : "#ff3b5c";
  return fav === "D" ? "rgba(61,123,255,.16)" : "rgba(255,59,92,.16)";
}

export const MODE_LABEL: Record<LegisMode, string> = { odds: "Who is favored", margin: "Forecast margin", flips: "Seats changing hands" };
