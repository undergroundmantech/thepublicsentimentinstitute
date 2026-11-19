// The 2028 rating scale, by the forecast margin: under 2 points is Tilt, 2 to 6 Lean, 6 to 12 Likely, 12 and up Safe.
// Margins are Republican minus Democrat, so a negative margin is a Democratic lead.
// Colors match the promo's map: bold safe and likely, light lean, and the tilts in the brand purple, leaned blue or red.
export type Rate = "SD" | "LD" | "ND" | "TD" | "TR" | "NR" | "LR" | "SR";
export const RATES: { k: Rate; label: string; short: string; color: string; ink: string; text?: string }[] = [
  { k: "SD", label: "Safe D", short: "Safe", color: "#0a2cff", ink: "#fff", text: "#0a2cff" },
  { k: "LD", label: "Likely D", short: "Likely", color: "#2c7dff", ink: "#fff", text: "#1f5fd6" },
  { k: "ND", label: "Lean D", short: "Lean", color: "#66b8ff", ink: "#0b1640", text: "#2a78c0" },
  { k: "TD", label: "Tilt D", short: "Tilt", color: "#a99bff", ink: "#140b40", text: "#5b47d6" },
  { k: "TR", label: "Tilt R", short: "Tilt", color: "#e3a0ea", ink: "#3a0b40", text: "#a03fae" },
  { k: "NR", label: "Lean R", short: "Lean", color: "#ff7f8c", ink: "#40080f", text: "#d0404f" },
  { k: "LR", label: "Likely R", short: "Likely", color: "#ff2e45", ink: "#fff", text: "#d81f35" },
  { k: "SR", label: "Safe R", short: "Safe", color: "#e0001b", ink: "#fff", text: "#c00018" },
];
export const RATE = Object.fromEntries(RATES.map((r) => [r.k, r])) as Record<Rate, (typeof RATES)[number]>;
export function rateOf(m: number): Rate {
  const a = Math.abs(m), d = m <= 0;
  if (a < 2) return d ? "TD" : "TR";
  if (a < 6) return d ? "ND" : "NR";
  if (a < 12) return d ? "LD" : "LR";
  return d ? "SD" : "SR";
}
