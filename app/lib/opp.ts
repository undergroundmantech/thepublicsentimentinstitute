// OnPoint Politics shared rules, ported from opp-ui/site.js so every page colors and labels
// races the same way. Margins follow the forecast data: negative is a Democratic (or
// independent) lead, positive a Republican lead.

export const RATE = {
  safeD: "#1a3fb0", likelyD: "#3d7bff", leanD: "#a6c2ff",
  toss: "#e7b341",
  leanR: "#ffb3c0", likelyR: "#ff3b5c", safeR: "#b0163a",
  ind: "#b78cff", none: "rgba(var(--line-rgb),.08)",
} as const;
export type Rating = keyof typeof RATE;

export const RATING_LABEL: Record<Rating, string> = {
  safeD: "Safe D", likelyD: "Likely D", leanD: "Lean D", toss: "Toss up",
  leanR: "Lean R", likelyR: "Likely R", safeR: "Safe R", ind: "Lean I", none: "No race",
};

/** Rating bands: under 2 toss up, 2 to 6 lean, 6 to 12 likely, 12 and over safe. */
export function rating(m: number, ind = false): Rating {
  if (ind) return "ind";
  const a = Math.abs(m);
  if (a < 2) return "toss";
  const s = m < 0 ? "D" : "R";
  return ((a < 6 ? "lean" : a < 12 ? "likely" : "safe") + s) as Rating;
}

/** Pill class for a rating: d, r, t or i. */
export function ratingPill(r: Rating): "d" | "r" | "t" | "i" {
  if (r === "toss") return "t";
  if (r === "ind") return "i";
  return r.endsWith("D") ? "d" : "r";
}

/** Map label text is dark on the pale fills. */
export function darkLabel(r: Rating) { return r === "leanD" || r === "leanR" || r === "toss"; }

export const lastName = (n: string) => n.trim().split(/\s+/).pop() || n;

export function fmtM(m: number, ind = false, digits = 1) {
  const a = Math.abs(m).toFixed(digits);
  if (ind) return `I +${a}`;
  return (m < 0 ? "D +" : "R +") + a;
}

/** County margin color: pale for close, deep for solid, interpolated in RGB by |margin| / 40. */
export function marginColor(m: number) {
  const a = Math.min(40, Math.abs(m || 0)) / 40;
  const mix = (c1: number[], c2: number[], t: number) =>
    `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`;
  return m < 0 ? mix([214, 226, 255], [16, 40, 140], a) : mix([255, 220, 228], [140, 10, 40], a);
}
export const RAMP_CSS = "linear-gradient(90deg,#10288c 0%,#3d7bff 25%,#d6e2ff 48%,#ffdce4 52%,#ff3b5c 75%,#8c0a28 100%)";

export const PARTY_COLOR: Record<string, string> = { D: "var(--dem)", R: "var(--gop)", IND: "var(--ind)", I: "var(--ind)" };
export const partyColor = (p?: string) => (p && PARTY_COLOR[p]) || "#6f6883";

export const ELECTION_ISO = "2026-11-03T19:00:00-05:00";
export function daysOut(now = Date.now()) {
  const d = new Date("2026-11-03T00:00:00-05:00").getTime() - now;
  return Math.max(0, Math.ceil(d / 864e5));
}

export const STATE_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Forecast race route: /forecast/oh/senate, /forecast/fl/governor, /forecast/ny/house-17. */
export function raceHref(id: string) {
  const [office, st, dist] = id.split("-");
  const s = (st || "").toLowerCase();
  if (office === "sen") return `/forecast/${s}/senate`;
  if (office === "gov") return `/forecast/${s}/governor`;
  if (office === "house") return `/forecast/${s}/house-${Number(dist)}`;
  return "/forecast";
}
export function raceIdFromRoute(state: string, race: string): string | null {
  const st = state.toUpperCase();
  if (race === "senate") return `sen-${st}`;
  if (race === "governor") return `gov-${st}`;
  const m = race.match(/^house-(\d+|al)$/);
  if (m) return `house-${st}-${String(m[1] === "al" ? 1 : Number(m[1])).padStart(2, "0")}`;
  return null;
}
