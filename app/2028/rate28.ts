// The 2028 rating scale, by the forecast margin: under 2 points is Tilt, 2 to 6 Lean, 6 to 12 Likely, 12 and up Safe.
// Margins are Republican minus Democrat, so a negative margin is a Democratic lead.
// Colors are the win chance ramp, pale for close and deep for safe, solid at four steps a side so the bands still read.
export type Rate = "SD" | "LD" | "ND" | "TD" | "TR" | "NR" | "LR" | "SR";
export const RATES: { k: Rate; label: string; short: string; color: string; ink: string; text?: string }[] = [
  // Nov 23 2026: the On Point UI ramp for a dark page, pale for close and deep for safe
  { k: "SD", label: "Safe D", short: "Safe", color: "#1c3fc4", ink: "#fff", text: "#8fb0ff" },
  { k: "LD", label: "Likely D", short: "Likely", color: "#3d7bff", ink: "#fff", text: "#7fa6ff" },
  { k: "ND", label: "Lean D", short: "Lean", color: "#7fa6ff", ink: "#0b1640", text: "#a6c2ff" },
  { k: "TD", label: "Tilt D", short: "Tilt", color: "#bccdff", ink: "#0b1640", text: "#c4d4ff" },
  { k: "TR", label: "Tilt R", short: "Tilt", color: "#ffc2cd", ink: "#40080f", text: "#ffc4cf" },
  { k: "NR", label: "Lean R", short: "Lean", color: "#ff8399", ink: "#40080f", text: "#ff9aac" },
  { k: "LR", label: "Likely R", short: "Likely", color: "#ff3b5c", ink: "#fff", text: "#ff6680" },
  { k: "SR", label: "Safe R", short: "Safe", color: "#b0163a", ink: "#fff", text: "#ff4d6a" },
];
export const RATE = Object.fromEntries(RATES.map((r) => [r.k, r])) as Record<Rate, (typeof RATES)[number]>;
export function rateOf(m: number): Rate {
  const a = Math.abs(m), d = m <= 0;
  if (a < 2) return d ? "TD" : "TR";
  if (a < 6) return d ? "ND" : "NR";
  if (a < 12) return d ? "LD" : "LR";
  return d ? "SD" : "SR";
}
