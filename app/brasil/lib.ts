// Brazil 2026 runoff: shared types, names, colors and formatting for the Portuguese pages. Margins are always
// Flávio minus Lula, in points of the valid vote, the way the model writes them.
export type BrState = {
  uf: string; name: string; region: string; flavio: number; lula: number; margin: number; rating: string; p: number;
  p10: number; p90: number; valid: number; fv: number; lv: number; r1: number; r22: number; sw1: number; sw22: number;
  d: string | null; cx: number | null; cy: number | null;
};
export type BrPoll = { pollster: string; field_mid: string; n: number; flavio: number; lula: number; weight: number };
export type BrData = {
  updated: string; election: string; round1: number; civic: Record<string, number>; gov_civic: Record<string, number>;
  national: { flavio: number; lula: number; margin: number; p_flavio: number; p_lula: number; p10: number; p90: number; p05: number; p95: number;
    valid: number; blank_null: number; r1: number; r22: number; polls: BrPoll[];
    legs: { transfer_prior_flavio: number; polling_avg_flavio: number; blended_target_flavio: number; r1_2026_flavio_two_way: number; r2_2022_bolsonaro: number } };
  states: Record<string, BrState>;
};
export type MunRow = [number, string, number | null, number, number | null, string];   // ibge, name, flavio %, valid votes, first round %, path

export const FL = "#2f6fe3", LU = "#e0323c";
export const FL_NAME = "Flávio Bolsonaro", LU_NAME = "Lula";
export const ELECTION_ISO = "2026-10-25T20:00:00Z";              // polls close at 17h, horário de Brasília, in every state
export const SITE_URL = "https://onpointpolitics.us";

const noAcc = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
export const slugOf = (name: string) => noAcc(name).toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
export const keyOf = (name: string) => noAcc(name).toLowerCase().replace(/[^a-z]/g, "");

export const UF_ORDER = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
export const REGIAO: Record<string, string> = { Norte: "Norte", Nordeste: "Nordeste", "Centro-Oeste": "Centro-Oeste", Sudeste: "Sudeste", Sul: "Sul", Exterior: "Exterior" };
export const PREP: Record<string, string> = {   // the preposition each state takes: em São Paulo, no Rio, na Bahia
  AC: "no", AL: "em", AP: "no", AM: "no", BA: "na", CE: "no", DF: "no", ES: "no", GO: "em", MA: "no", MT: "em", MS: "em", MG: "em",
  PA: "no", PB: "na", PR: "no", PE: "em", PI: "no", RJ: "no", RN: "no", RS: "no", RO: "em", RR: "em", SC: "em", SP: "em", SE: "em", TO: "no",
};
export const inState = (uf: string, name: string) => `${PREP[uf] ?? "em"} ${name}`;

export function ratingPt(r: string) {
  const who = r.includes("Bolsonaro") ? "Flávio" : "Lula";
  return r.startsWith("Safe") ? `${who} com folga` : r.startsWith("Likely") ? `Provável ${who}` : r.startsWith("Lean") ? `Tendência ${who}` : `Leve tendência ${who}`;
}
// rating pill colors: deep for one sided, pale for close, the same scale as the map
export function ratingStyle(r: string) {
  const f = r.includes("Bolsonaro"), lvl = r.startsWith("Safe") ? 3 : r.startsWith("Likely") ? 2 : r.startsWith("Lean") ? 1 : 0;
  const bg = f ? ["#cfdcf8", "#8fb0f2", "#3f74e6", "#1d48b0"][lvl] : ["#f9d3d5", "#f29aa0", "#e0444d", "#a8121c"][lvl];
  return { background: bg, color: lvl >= 2 ? "#fff" : "#16121f" };
}
export function ratingOf(m: number) {
  const a = Math.abs(m), w = m >= 0 ? "Bolsonaro" : "Lula";
  return `${a < 2 ? "Tilt" : a < 6 ? "Lean" : a < 12 ? "Likely" : "Safe"} ${w}`;
}

export const nf = (x: number, d = 1) => x.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const nint = (x: number) => Math.round(x).toLocaleString("pt-BR");
export const pct = (x: number, d = 1) => `${nf(x, d)}%`;
export const mg = (m: number, d = 1) => (Math.abs(m) < 0.05 ? "Empate" : `${m > 0 ? "Flávio" : "Lula"} +${nf(Math.abs(m), d)}`);
export const mgShort = (m: number, d = 1) => (Math.abs(m) < 0.05 ? "0" : `${m > 0 ? "F" : "L"}+${nf(Math.abs(m), d)}`);
export const compact = (x: number) => (x >= 1e6 ? `${nf(x / 1e6, x >= 1e7 ? 1 : 2)} mi` : x >= 1e3 ? `${nf(x / 1e3, 0)} mil` : nint(x));

// margin to color: pale near even, deep when one sided, on the same bands as the ratings
export function marginColor(m: number | null | undefined, alpha = 1) {
  if (m == null || !Number.isFinite(m)) return `rgba(120,110,140,${0.35 * alpha})`;
  const a = Math.min(Math.abs(m), 40) / 40, t = Math.pow(a, 0.75);
  const lo = m >= 0 ? [205, 219, 247] : [248, 209, 211], hi = m >= 0 ? [37, 92, 214] : [205, 34, 46];
  const c = lo.map((v, i) => Math.round(v + (hi[i] - v) * t));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

// map bounds from an SVG path string made of M and L style coordinate pairs
export function pathBounds(d: string) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1] as const;
}
