// Small pieces shared by the news pages: the lean tag, the coverage bar and time stamps.
import React from "react";
import { LEAN_LABEL, OUTLET, type Lean } from "./sources";

export function LeanTag({ lean, small }: { lean: Lean; small?: boolean }) {
  return <span className={`nw-tag l-${lean}${small ? " sm" : ""}`}>{LEAN_LABEL[lean]}</span>;
}

export function LeanBar({ n, label = true }: { n: { L: number; C: number; R: number }; label?: boolean }) {
  const t = n.L + n.C + n.R || 1;
  const pct = (x: number) => Math.round((100 * x) / t);
  return (
    <div className="nw-bar" role="img" aria-label={`Coverage: ${n.L} Left, ${n.C} Center, ${n.R} Right`}>
      <div className="track">
        {n.L ? <i className="L" style={{ width: `${(100 * n.L) / t}%` }} /> : null}
        {n.C ? <i className="C" style={{ width: `${(100 * n.C) / t}%` }} /> : null}
        {n.R ? <i className="R" style={{ width: `${(100 * n.R) / t}%` }} /> : null}
      </div>
      {label ? <div className="lab"><span className="L">Left {pct(n.L)}%</span><span className="C">Center {pct(n.C)}%</span><span className="R">Right {pct(n.R)}%</span></div> : null}
    </div>
  );
}

export const outletName = (id: string, n?: string) => n ?? OUTLET[id]?.name ?? id;
export const outletLean = (id: string): Lean => OUTLET[id]?.lean ?? "C";

export function ago(ms: number, now: number) {
  const m = Math.max(0, Math.round((now - ms) / 60000));
  if (m < 60) return `${m || 1} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}
