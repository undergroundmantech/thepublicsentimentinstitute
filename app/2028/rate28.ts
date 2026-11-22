// The 2028 rating scale, by the forecast margin: under 2 points is Tilt, 2 to 6 Lean, 6 to 12 Likely, 12 and up Safe.
// Margins are Republican minus Democrat, so a negative margin is a Democratic lead.
// Colors are the win chance ramp, pale for close and deep for safe, solid at four steps a side so the bands still read.
export type Rate = "SD" | "LD" | "ND" | "TD" | "TR" | "NR" | "LR" | "SR";
export const RATES: { k: Rate; label: string; short: string; color: string; ink: string; text?: string }[] = [
  { k: "SD", label: "Safe D", short: "Safe", color: "#10288c", ink: "#fff", text: "#10288c" },
  { k: "LD", label: "Likely D", short: "Likely", color: "#4358aa", ink: "#fff", text: "#2c429c" },
  { k: "ND", label: "Lean D", short: "Lean", color: "#798bc9", ink: "#0b1640", text: "#4358aa" },
  { k: "TD", label: "Tilt D", short: "Tilt", color: "#a6b5e3", ink: "#0b1640", text: "#5b6fb8" },
  { k: "TR", label: "Tilt R", short: "Tilt", color: "#e3aab7", ink: "#40080f", text: "#b85a6f" },
  { k: "NR", label: "Lean R", short: "Lean", color: "#c9798c", ink: "#40080f", text: "#aa4159" },
  { k: "LR", label: "Likely R", short: "Likely", color: "#aa4159", ink: "#fff", text: "#9c2742" },
  { k: "SR", label: "Safe R", short: "Safe", color: "#8c0a28", ink: "#fff", text: "#8c0a28" },
];
export const RATE = Object.fromEntries(RATES.map((r) => [r.k, r])) as Record<Rate, (typeof RATES)[number]>;
export function rateOf(m: number): Rate {
  const a = Math.abs(m), d = m <= 0;
  if (a < 2) return d ? "TD" : "TR";
  if (a < 6) return d ? "ND" : "NR";
  if (a < 12) return d ? "LD" : "LR";
  return d ? "SD" : "SR";
}
