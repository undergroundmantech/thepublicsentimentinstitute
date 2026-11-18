// The 2028 rating scale, by the forecast margin: under 2 points is Tilt, 2 to 6 Lean, 6 to 12 Likely, 12 and up Safe.
// Margins are Republican minus Democrat, so a negative margin is a Democratic lead.
export type Rate = "SD" | "LD" | "ND" | "TD" | "TR" | "NR" | "LR" | "SR";
export const RATES: { k: Rate; label: string; short: string; color: string; ink: string; text?: string }[] = [
  { k: "SD", label: "Safe D", short: "Safe", color: "#1b3aa8", ink: "#fff", text: "#7d9bff" },
  { k: "LD", label: "Likely D", short: "Likely", color: "#3d7bff", ink: "#fff" },
  { k: "ND", label: "Lean D", short: "Lean", color: "#86a9ff", ink: "#0b1640" },
  { k: "TD", label: "Tilt D", short: "Tilt", color: "#c9d8ff", ink: "#0b1640" },
  { k: "TR", label: "Tilt R", short: "Tilt", color: "#ffcdd5", ink: "#40080f" },
  { k: "NR", label: "Lean R", short: "Lean", color: "#ff8fa2", ink: "#40080f" },
  { k: "LR", label: "Likely R", short: "Likely", color: "#ff3b5c", ink: "#fff" },
  { k: "SR", label: "Safe R", short: "Safe", color: "#a8102d", ink: "#fff", text: "#ff7590" },
];
export const RATE = Object.fromEntries(RATES.map((r) => [r.k, r])) as Record<Rate, (typeof RATES)[number]>;
export function rateOf(m: number): Rate {
  const a = Math.abs(m), d = m <= 0;
  if (a < 2) return d ? "TD" : "TR";
  if (a < 6) return d ? "ND" : "NR";
  if (a < 12) return d ? "LD" : "LR";
  return d ? "SD" : "SR";
}
