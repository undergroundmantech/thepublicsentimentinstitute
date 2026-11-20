"use client";
// The 2028 hover cards. They sit above everything and follow the pointer on every page, and they carry their own
// colors so they read the same wherever they are drawn.
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import Toon from "@/app/majority-tracker/Toon";
import { fmtMg, fmtPct, last } from "./lib";
import { RATE, rateOf } from "./rate28";

export type At = { x: number; y: number };
/** the card is drawn on the page body, so no transformed or clipped parent can move or cut it, and it flips away from
 * the screen's edges */
export function Tip({ at, children }: { at: At | null; children: ReactNode }) {
  if (!at || !children || typeof document === "undefined") return null;
  const W = window.innerWidth, H = window.innerHeight, fx = at.x > W - 310, fy = at.y > H - 260;
  const style: CSSProperties = { left: fx ? at.x - 16 : at.x + 16, top: fy ? at.y - 16 : at.y + 16, transform: `translate(${fx ? "-100%" : "0"}, ${fy ? "-100%" : "0"})` };
  return createPortal(<div className="t28" role="status" style={style}>{children}</div>, document.body);
}

const shiftLine = (m: number, m24: number | null | undefined) => {
  if (m24 == null) return null; const s = m - m24;
  return Math.abs(s) < 0.5 ? `About where it voted in 2024, ${fmtMg(m24)}` : `${Math.abs(s).toFixed(1)} points ${s < 0 ? "bluer" : "redder"} than 2024, ${fmtMg(m24)}`;
};

/** a state in a general election matchup: rating, both nominees' two party share and win chance, the change from 2024 */
export function StateTip({ name, ev, m, pD, d, r, m24, note, field, lead }: { name: string; ev: number; m: number; pD: number; d: string; r: string; m24?: number | null; note?: string;
  /** with third parties on the ballot: every candidate's share of the whole vote and chance to carry the state */
  field?: { name: string; side: "D" | "R" | "U"; s: number; p: number; c?: string }[];
  /** the leader and the lead over the runner up, in points of the whole vote */
  lead?: { name: string; fm: number; c: string } }) {
  const rt = lead && field && !field.some((f) => f.name === lead.name && f.side !== "U") ? { color: lead.c, ink: "#fff", label: `${last(lead.name)} +${lead.fm.toFixed(1)}` } : RATE[rateOf(m)];
  const dS = (100 - m) / 2, rS = 100 - dS;
  const rows: { name: string; side: "D" | "R" | "U"; s: number; p: number; c?: string }[] = field ?? [{ name: d, side: "D", s: dS / 100, p: pD }, { name: r, side: "R", s: rS / 100, p: 1 - pD }];
  const best = Math.max(...rows.map((x) => x.p));
  return (
    <div className="t28-card">
      <div className="t28-h"><b>{name}</b><span>{ev} electoral vote{ev === 1 ? "" : "s"}</span></div>
      <div className="t28-rt"><span style={{ background: rt.color, color: rt.ink }}>{rt.label}</span><b>{fmtMg(m)}</b></div>
      {rows.map((x) => (
        <div key={x.name} className={`t28-row ${x.side === "D" ? "d" : x.side === "R" ? "r" : "i"}${x.p === best ? " lead" : ""}`}>
          <Toon name={x.name} side={x.side} size={30} uid="t" />
          <span className="n">{last(x.name)}</span>
          <span className="s">{(x.s * 100).toFixed(1)}%</span>
          <span className="bar"><i style={{ width: `${x.s * 100}%`, ...(x.c ? { background: x.c } : {}) }} /></span>
          <span className="p">{fmtPct(x.p)}</span>
        </div>
      ))}
      <div className="t28-f">{shiftLine(m, m24) ?? ""}{note ? <em>{note}</em> : null}</div>
    </div>
  );
}

/** a county: both nominees' projected votes and share, the margin and the change from 2024 */
export function CountyTip({ name, st, D, R, O, d, r, m, m24 }: { name: string; st: string; D: number; R: number; O: number; d: string; r: string; m: number; m24: number | null }) {
  const T = D + R + O, f = (n: number) => Math.round(n).toLocaleString("en-US"), rt = RATE[rateOf(m)];
  return (
    <div className="t28-card">
      <div className="t28-h"><b>{name}</b><span>{st} · {f(T)} votes</span></div>
      <div className="t28-rt"><span style={{ background: rt.color, color: rt.ink }}>{m < 0 ? last(d) : last(r)} by {Math.abs(m).toFixed(1)}</span></div>
      {([["D", d, D], ["R", r, R]] as const).map(([k, n, v]) => (
        <div key={k} className={`t28-row ${k === "D" ? "d" : "r"}${(k === "D") === (m < 0) ? " lead" : ""}`}>
          <Toon name={n} side={k} size={28} uid="u" />
          <span className="n">{last(n)}</span>
          <span className="s">{((v / T) * 100).toFixed(1)}%</span>
          <span className="bar"><i style={{ width: `${(v / T) * 100}%` }} /></span>
          <span className="p">{f(v)}</span>
        </div>
      ))}
      <div className="t28-f">{shiftLine(m, m24) ?? ""}</div>
    </div>
  );
}

/** a state's primary: the top three and the leader's chance of carrying it */
export function PrimTip({ name, party, top, lead, win }: { name: string; party: "D" | "R"; top: [string, number, string][]; lead: string; win: number }) {
  return (
    <div className="t28-card">
      <div className="t28-h"><b>{name}</b><span>{party === "D" ? "Democratic" : "Republican"} primary</span></div>
      {top.map(([n, s, c], i) => (
        <div key={n} className={`t28-row${i === 0 ? " lead" : ""}`}>
          <Toon name={n} side={party} size={28} uid="v" />
          <span className="n">{n}</span>
          <span className="s">{(s * 100).toFixed(1)}%</span>
          <span className="bar"><i style={{ width: `${Math.min(100, s * 160)}%`, background: c }} /></span>
          <span className="p" />
        </div>
      ))}
      <div className="t28-f">{lead} carries it in {fmtPct(win)} of runs<em>Click for its counties</em></div>
    </div>
  );
}

/** one rating band: every state in it */
export function RateTip({ label, color, ink, states, ev }: { label: string; color: string; ink: string; states: [string, number, number][]; ev: number }) {
  return (
    <div className="t28-card">
      <div className="t28-rt"><span style={{ background: color, color: ink }}>{label}</span><b>{ev} electoral votes</b></div>
      <div className="t28-list">{states.length ? states.map(([k, e, m]) => <span key={k}><b>{k}</b> {fmtMg(m)} · {e}</span>) : <span>No states</span>}</div>
    </div>
  );
}
