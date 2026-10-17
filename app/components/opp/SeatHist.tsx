// Distribution of Democratic seats across the simulations, with the majority line.
export default function SeatHist({ hist, majority, total, height = 150 }: { hist: [number, number][]; majority: number; total: number; height?: number }) {
  if (!hist.length) return null;
  const lo = Math.max(0, Math.min(...hist.map((h) => h[0])) - 2);
  const hi = Math.min(total, Math.max(...hist.map((h) => h[0])) + 2);
  const span = Math.max(1, hi - lo + 1);
  const W = 640, H = height, pad = 22;
  const max = Math.max(...hist.map((h) => h[1]));
  const bw = (W - 8) / span;
  const x = (v: number) => 4 + (v - lo) * bw;
  const ticks = Array.from(new Set([lo, majority, hi, Math.round((lo + majority) / 2), Math.round((majority + hi) / 2)])).filter((t) => t >= lo && t <= hi).sort((a, b) => a - b);
  return (
    <svg viewBox={`0 0 ${W} ${H + pad}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Democratic seats across 2,000 simulations">
      {hist.map(([v, p]) => {
        const h = Math.max(1, (p / max) * (H - 8));
        return <rect key={v} x={x(v) + 0.5} y={H - h} width={Math.max(1, bw - 1)} height={h} rx={Math.min(2, bw / 3)} fill={v >= majority ? "var(--dem)" : "var(--gop)"} opacity={0.85} />;
      })}
      <line x1={x(majority)} x2={x(majority)} y1={0} y2={H} stroke="var(--gold)" strokeWidth={1.5} strokeDasharray="3 3" />
      <text x={x(majority) + 6} y={12} fill="var(--gold)" fontSize={11} fontWeight={700} style={{ fontFamily: "var(--font-m)" }}>{majority} for a majority</text>
      <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line2)" />
      {ticks.map((t) => (
        <text key={t} x={x(t) + bw / 2} y={H + 16} fill="var(--mute)" fontSize={11} textAnchor="middle" style={{ fontFamily: "var(--font-m)" }}>{t}</text>
      ))}
    </svg>
  );
}
