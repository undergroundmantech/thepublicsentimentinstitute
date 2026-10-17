// Chamber seat diagram. Every seat is a dot laid on concentric arcs, sorted by the Democratic win
// probability so the split between blue and red reads as a single line through the arc. Seats not on
// the ballot this year are drawn hollow in the color of the party that holds them.
import { RATE } from "@/app/lib/opp";

export type HemiSeat = { p: number | null; hold?: "D" | "R" | "O"; label?: string; href?: string };

export function probFill(p: number) {
  if (p >= 0.95) return RATE.safeD;
  if (p >= 0.8) return RATE.likelyD;
  if (p >= 0.6) return RATE.leanD;
  if (p > 0.4) return RATE.toss;
  if (p > 0.2) return RATE.leanR;
  if (p > 0.05) return RATE.likelyR;
  return RATE.safeR;
}
const HOLD = { D: "#3d7bff", R: "#ff3b5c", O: "#b78cff" } as const;

/** Positions for n seats on a half disc of unit radius, left to right. */
export function hemiLayout(n: number, inner = 0.36) {
  const rows = Math.max(1, Math.min(14, Math.round(Math.sqrt(n / 3.2))));
  const radii = Array.from({ length: rows }, (_, i) => (rows === 1 ? 0.7 : inner + ((1 - inner) * i) / (rows - 1)));
  const tot = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.max(1, Math.floor((n * r) / tot)));
  let left = n - counts.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; left > 0; i = (i - 1 + rows) % rows) { counts[i]++; left--; }
  const pts: { x: number; y: number; a: number }[] = [];
  radii.forEach((r, i) => {
    const k = counts[i];
    for (let j = 0; j < k; j++) {
      const a = k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1);
      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), a });
    }
  });
  pts.sort((p, q) => q.a - p.a || p.y - q.y);
  const radial = rows > 1 ? (1 - inner) / (rows - 1) : 0.3;
  const arc = Math.min(...radii.map((r, i) => (counts[i] > 1 ? (Math.PI * r) / (counts[i] - 1) : 1)));
  return { pts, dot: Math.min(radial, arc) * 0.42 };
}

export function sortSeats(seats: HemiSeat[]) {
  const v = (s: HemiSeat) => (s.hold ? (s.hold === "D" ? 2 : s.hold === "R" ? -2 : 0) : s.p ?? 0.5);
  return [...seats].sort((a, b) => v(b) - v(a));
}

export default function Hemicycle({ seats, majority, size = 520, caption }: { seats: HemiSeat[]; majority?: number; size?: number; caption?: React.ReactNode }) {
  const sorted = sortSeats(seats);
  const { pts, dot } = hemiLayout(sorted.length);
  const W = size, R = (size / 2 - 2) / (1 + dot), pad = dot * R + 2, cx = W / 2, cy = R + pad, H = R + pad * 2;
  return (
    <figure className="hemi" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${seats.length} seats${majority ? `, ${majority} for a majority` : ""}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {majority ? <line x1={cx} x2={cx} y1={cy - R - 4} y2={cy + 2} stroke="var(--mute2)" strokeDasharray="2 4" strokeWidth={1} /> : null}
        {sorted.map((s, i) => {
          const p = pts[i];
          const x = cx + p.x * R, y = cy - p.y * R, r = Math.max(1.2, dot * R);
          const title = s.label ? <title>{s.label}</title> : null;
          const c = s.hold ? (
            <circle key={i} cx={x} cy={y} r={r * 0.82} fill="none" stroke={HOLD[s.hold]} strokeWidth={Math.max(0.8, r * 0.34)} opacity={0.7}>{title}</circle>
          ) : (
            <circle key={i} cx={x} cy={y} r={r} fill={probFill(s.p ?? 0.5)}>{title}</circle>
          );
          return s.href ? <a key={i} href={s.href}>{c}</a> : c;
        })}
      </svg>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
