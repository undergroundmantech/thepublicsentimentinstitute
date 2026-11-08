"use client";
// A pinned scroll story for the final generic ballot. The stage, a number line from D +2 to D +16, stays on screen while
// the steps scroll past it: the averages land, then our poll, then the result next to it, then every other final poll.
// Margins come in as Democratic leads in points.
import { useEffect, useRef, useState } from "react";

type P = { name: string; final: number; us: boolean };
const LO = 2, HI = 16;
const x = (v: number) => `${((Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO)) * 100}%`;
const f1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export default function BallotScrolly({ polls, us, result, averages, steps }: { polls: P[]; us: number; result: number; averages: number; steps: { k: string; t: string }[] }) {
  const [on, setOn] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const els = refs.current.filter(Boolean) as HTMLDivElement[];
    if (typeof IntersectionObserver === "undefined") { setOn(steps.length - 1); return; }
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) setOn(Number((e.target as HTMLElement).dataset.i));
    }, { rootMargin: "-48% 0px -48% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [steps.length]);

  // a beeswarm: polls at the same half point stack upward
  const stack = new Map<number, number>();
  const dots = polls.slice().sort((a, b) => Number(b.us) - Number(a.us) || a.final - b.final).map((p) => {
    const k = Math.round(p.final * 2) / 2; const n = stack.get(k) ?? 0; stack.set(k, n + 1);
    return { ...p, k, n };
  });
  const top = Math.max(...stack.values());

  return (
    <div className="bs" data-step={on}>
      <div className="bs-stage" aria-hidden="true">
        <div className="bs-frame">
          <p className="bs-cap"><span>Final national generic ballot</span><b>{["The averages", "Our final poll", "The result", "Every final poll"][on] ?? ""}</b></p>
          <div className="bs-plot" style={{ ["--rows" as string]: top }}>
            <div className="bs-swarm">
              {dots.map((d, i) => (
                <i key={d.name} className={d.us ? "us" : ""} title={`${d.name}: D +${f1(d.final)}`}
                  style={{ left: x(d.k), bottom: `calc(${d.n} * var(--dot, 14px))`, ["--d" as string]: `${(i % 14) * 35}ms` }} />
              ))}
            </div>
            <div className="bs-mk avg" style={{ left: x(averages) }}><span>Averages D +{averages.toFixed(1)}</span></div>
            <div className="bs-mk us" style={{ left: x(us) }}><span>On Point D +{us.toFixed(1)}</span></div>
            <div className="bs-mk res" style={{ left: x(result) }}><span>Result D +{result.toFixed(1)}</span></div>
            <div className="bs-gap" style={{ left: x(averages), width: `calc(${x(result)} - ${x(averages)})` }}><em>{(result - averages).toFixed(1)} point miss</em></div>
            <div className="bs-axis">
              {Array.from({ length: (HI - LO) / 2 + 1 }, (_, i) => LO + i * 2).map((t) => <span key={t} style={{ left: x(t) }}>D +{t}</span>)}
            </div>
          </div>
          <div className="bs-read">
            <div><span className="k">On Point</span><b>D +{us.toFixed(1)}</b></div>
            <div><span className="k">Result</span><b>D +{result.toFixed(1)}</b></div>
            <div><span className="k">Our miss</span><b className="ok">{Math.abs(us - result).toFixed(1)}</b></div>
          </div>
        </div>
      </div>
      <div className="bs-steps">
        {steps.map((s, i) => (
          <div key={s.k} ref={(el) => { refs.current[i] = el; }} data-i={i} className={`bs-step${on === i ? " on" : ""}`}>
            <div className="bs-card"><p className="eye">{s.k}</p><p className="t">{s.t}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}
