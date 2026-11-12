// Every final 2026 national generic ballot on one Democratic margin scale, with the polling averages as a band, the
// result as a line and ours lit. The markers slide in from the left once on load; at rest they sit on their values.
import type { Bench } from "@/app/accuracy/bench";

const LO = 6, HI = 15;
const x = (m: number) => ((Math.min(HI, Math.max(LO, m)) - LO) / (HI - LO)) * 100;

export default function Needle({ B }: { B: Bench }) {
  const g = B.generic, polls = B.national.polls;
  const ours = polls.find((p) => p.us)!;
  // other pollsters stacked where finals tie
  const stack = new Map<number, number>();
  const others = polls.filter((p) => !p.us).map((p) => { const k = Math.round(p.final * 10); const lvl = stack.get(k) ?? 0; stack.set(k, lvl + 1); return { ...p, lvl }; });
  const ticks = [6, 8, 10, 12, 14];
  return (
    <figure className="oph-needle" aria-label={`Final national polls of 2026 on the generic ballot. On Point Polling D +${ours.final.toFixed(1)}, result D +${g.result.margin.toFixed(1)}, averages near D +${g.averages.margin.toFixed(1)}.`}>
      <figcaption>
        <span className="eye">Final national polls · generic ballot</span>
        <span className="eye dim">{polls.length} pollsters</span>
      </figcaption>
      <div className="track">
        <span className="band" style={{ left: `${x(g.averages.lo)}%`, width: `${x(g.averages.hi) - x(g.averages.lo)}%` }} />
        <span className="band-l" style={{ left: `${x(g.averages.margin)}%` }}>Averages D +{g.averages.margin.toFixed(1)}</span>
        {others.map((p, i) => <i key={p.name} className="tick" title={`${p.name} D +${p.final}`} style={{ left: `${x(p.final)}%`, bottom: `${8 + p.lvl * 7}px`, ["--i" as string]: i }} />)}
        <span className="res" style={{ left: `${x(g.result.margin)}%` }}><em>Result D +{g.result.margin.toFixed(1)}</em></span>
        <span className="us" style={{ left: `${x(ours.final)}%` }}><em>On Point D +{ours.final.toFixed(1)}</em></span>
      </div>
      <div className="axis">{ticks.map((t) => <span key={t} style={{ left: `${x(t)}%` }}>D +{t}</span>)}</div>
    </figure>
  );
}
