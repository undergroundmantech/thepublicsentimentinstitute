"use client";
// The Majority Tracker chamber: all 56 seats of the incoming Senate Democratic caucus as a hemicycle. Schumer's
// projected votes fill from the left aisle, Van Hollen's from the right, firmest at the walls and least certain
// near the center, so the seats nearest the 28 vote aisle are the ones that can still move. Scenarios reseat the
// chamber live; every seat is a button with the senator's card.
import { useEffect, useMemo, useRef, useState } from "react";
import { CAND, NEXT, SWING, TIER, TIERS, type Pick, type Senator, type Tier } from "./data";

type Mode = "proj" | "record" | "flipV" | "flipS";
const MODES: { k: Mode; label: string; note: string }[] = [
  { k: "proj", label: "Our projection", note: "Stated and reported positions plus our estimate for everyone else." },
  { k: "record", label: "On record only", note: "Only senators who have stated or been reported. Everyone else waits in the aisle." },
  { k: "flipV", label: "Low calls flip to Van Hollen", note: "Every low confidence Schumer estimate moves to Van Hollen. His best case." },
  { k: "flipS", label: "Low calls flip to Schumer", note: "Every low confidence Van Hollen estimate moves to Schumer. Schumer's best case." },
];
type Side = Pick | "U";
type Seat = { x: number; y: number; a: number };

const W = 1000, CX = 500, CY = 520, RIN = 190, ROUT = 462, ROWS = [6, 8, 12, 14, 16];

/** seat positions, ordered left to right around the arc */
function seats(): Seat[] {
  const out: Seat[] = [];
  ROWS.forEach((n, i) => {
    const r = RIN + ((ROUT - RIN) * i) / (ROWS.length - 1);
    for (let j = 0; j < n; j++) {
      const a = Math.PI - (Math.PI * j) / (n - 1);
      out.push({ x: CX + r * Math.cos(a), y: CY - r * Math.sin(a), a });
    }
  });
  return out.sort((p, q) => q.a - p.a || Math.hypot(p.x - CX, p.y - CY) - Math.hypot(q.x - CX, q.y - CY));
}
const SEATS = seats();
const rank = (t: Tier) => TIERS.indexOf(t);

function sideOf(x: Senator, m: Mode): Side {
  if (m === "record") return TIER[x.tier].estimate ? "U" : x.pick;
  if (m === "flipV" && x.pick === "S" && x.tier === "low") return "V";
  if (m === "flipS" && x.pick === "V" && x.tier === "low") return "S";
  return x.pick;
}

function useTween(v: number) {
  const [n, setN] = useState(v);
  const from = useRef(v);
  useEffect(() => {
    const a = from.current, b = v; if (a === b) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { from.current = b; setN(b); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 650), e = 1 - Math.pow(1 - k, 3); setN(Math.round(a + (b - a) * e)); if (k < 1) raf = requestAnimationFrame(step); else from.current = b; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [v]);
  return n;
}

export default function Chamber({ rows, need }: { rows: Senator[]; need: number }) {
  const [mode, setMode] = useState<Mode>("proj");
  const [focus, setFocus] = useState<Set<Tier | "swing">>(new Set());
  const [sel, setSel] = useState<Senator | null>(null);
  const [pinned, setPinned] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(t); }, []);

  // seat everyone: Schumer from the left wall inward, undecided in the aisle, Van Hollen from the right wall inward
  const plan = useMemo(() => {
    const flipped = (x: Senator) => sideOf(x, mode) !== x.pick && sideOf(x, mode) !== "U";
    const by = (s: Side) => rows.filter((x) => sideOf(x, mode) === s);
    const S = by("S").sort((a, b) => Number(flipped(a)) - Number(flipped(b)) || rank(a.tier) - rank(b.tier));
    const U = by("U").sort((a, b) => (a.pick === b.pick ? rank(a.tier) - rank(b.tier) : a.pick === "S" ? -1 : 1));
    const V = by("V").sort((a, b) => Number(flipped(b)) - Number(flipped(a)) || rank(b.tier) - rank(a.tier));
    const order = [...S, ...U, ...V];
    const at = new Map(order.map((x, i) => [x.name, i]));
    return { S: S.length, V: V.length, U: U.length, at, flipped };
  }, [rows, mode]);

  const nS = useTween(plan.S), nV = useTween(plan.V);
  const lead = plan.S >= need ? "S" : plan.V >= need ? "V" : null;
  const m = MODES.find((x) => x.k === mode)!;
  const swing = new Set([...SWING, ...NEXT]);
  const lit = (x: Senator) => !focus.size || focus.has(x.tier) || (focus.has("swing") && swing.has(x.name));
  const toggle = (k: Tier | "swing") => setFocus((f) => { const n = new Set(f); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const show = sel ?? null;
  const pct = (n: number) => `${(100 * n) / rows.length}%`;

  return (
    <section className="mt-chamber" aria-labelledby="mt-ch-h">
      <h2 id="mt-ch-h" className="sr">The chamber</h2>
      <div className="mt-rope" role="img" aria-label={`${plan.S} for Schumer, ${plan.V} for Van Hollen${plan.U ? `, ${plan.U} not yet on record` : ""}, ${need} needed`}>
        <div className="side l"><b className="mt-c-S">{nS}</b><span>Schumer</span></div>
        <div className="track">
          <i className="f S" style={{ width: pct(plan.S) }} />
          <i className="f V" style={{ width: pct(plan.V) }} />
          <i className="knot" style={{ left: pct(plan.S + plan.U / 2) }} />
          <i className="mid" />
          <span className="lab">{need} to win</span>
        </div>
        <div className="side r"><b className="mt-c-V">{nV}</b><span>Van Hollen</span></div>
      </div>

      <div className="mt-ch-grid">
        <div className={`mt-hemi${ready ? " in" : ""}`}>
          <svg viewBox={`0 0 ${W} 560`} role="group" aria-label="Senate Democratic caucus seats">
            <defs>
              <radialGradient id="mt-floor" cx="50%" cy="100%" r="70%"><stop offset="0" stopColor="rgba(150,120,255,.20)" /><stop offset="1" stopColor="rgba(150,120,255,0)" /></radialGradient>
              <clipPath id="mt-half"><rect x="-20" y="-20" width="20" height="40" /></clipPath>
            </defs>
            <path d={`M ${CX - ROUT - 34} ${CY} A ${ROUT + 34} ${ROUT + 34} 0 0 1 ${CX + ROUT + 34} ${CY} Z`} fill="url(#mt-floor)" />
            {[RIN - 30, ROUT + 34].map((r) => <path key={r} d={`M ${CX - r} ${CY} A ${r} ${r} 0 0 1 ${CX + r} ${CY}`} className="arc" />)}
            <line x1={CX} y1={CY - RIN + 22} x2={CX} y2={CY - ROUT - 40} className={`aisle${lead ? " won " + lead : ""}`} />
            <text x={CX} y={CY - ROUT - 48} className="aisle-t" textAnchor="middle">{need} TO WIN</text>
            {rows.map((x) => {
              const k = plan.at.get(x.name)!, p = SEATS[k], side = sideOf(x, mode), t = x.tier;
              const est = TIER[t].estimate, flip = plan.flipped(x);
              return (
                <g key={x.name} className={`seat s-${side} t-${t}${lit(x) ? "" : " dim"}${show?.name === x.name ? " sel" : ""}${flip ? " flip" : ""}${focus.has("swing") && swing.has(x.name) ? " swing" : ""}`}
                  style={{ transform: ready ? `translate(${p.x}px, ${p.y}px)` : `translate(${CX}px, ${CY + 30}px) scale(.2)`, transitionDelay: ready ? `${(k * 12) % 700}ms` : "0ms" }}
                  tabIndex={0} role="button" aria-pressed={pinned && show?.name === x.name}
                  aria-label={`${x.name}, ${x.st}. ${side === "U" ? "Not yet on record" : CAND[side].name}. ${TIER[t].label}.`}
                  onMouseEnter={() => { if (!pinned) setSel(x); }} onFocus={() => setSel(x)}
                  onClick={() => { setSel(x); setPinned(!(pinned && sel?.name === x.name)); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(x); setPinned(true); } }}>
                  {x.ifSeated ? <circle r="23" className="ring" /> : null}
                  <circle r="17" className="body" />
                  {t === "reported" ? <circle r="17" className="half" clipPath="url(#mt-half)" /> : null}
                  {!est && t === "stated" ? <circle r="4" className="core" /> : null}
                  <title>{`${x.name}, ${x.st}`}</title>
                </g>
              );
            })}
            <g className="mt-read" transform={`translate(${CX} ${CY - 40})`}>
              <text className="big" textAnchor="middle" y="-34"><tspan className="S">{nS}</tspan><tspan className="dot" dx="14">·</tspan><tspan className="V" dx="14">{nV}</tspan></text>
              <text className="sub" textAnchor="middle" y="4">{lead ? `${CAND[lead].name} clears ${need}` : `Nobody at ${need}${plan.U ? `, ${plan.U} undeclared` : ""}`}</text>
            </g>
          </svg>
        </div>

        <aside className="mt-side">
          <div className="mt-modes" role="radiogroup" aria-label="Scenario">
            {MODES.map((x) => (
              <button key={x.k} type="button" role="radio" aria-checked={mode === x.k} className={mode === x.k ? "on" : ""} onClick={() => setMode(x.k)}>{x.label}</button>
            ))}
          </div>
          <p className="mt-mnote">{m.note}</p>

          <div className="mt-card" aria-live="polite">
            {show ? (
              <>
                <div className={`hd s-${sideOf(show, mode)}`}><i /><b>{show.name.replace(", if seated", "")}</b><span>{show.st}</span></div>
                <div className="tags">
                  <span className={`tag s-${sideOf(show, mode)}`}>{sideOf(show, mode) === "U" ? "Not yet on record" : CAND[sideOf(show, mode) as Pick].name}</span>
                  <span className={`tag ${TIER[show.tier].estimate ? "est" : "rec"}`}>{TIER[show.tier].label}</span>
                  {plan.flipped(show) ? <span className="tag flip">Flipped in this scenario</span> : null}
                  {show.ifSeated ? <span className="tag">Counts only if seated</span> : null}
                </div>
                <p>{show.note}</p>
                {pinned ? <button type="button" className="unpin" onClick={() => setPinned(false)}>Unpin</button> : <span className="hint">Click a seat to pin it</span>}
              </>
            ) : <p className="empty">Point at a seat, or tab through them, to see where each senator stands and why.</p>}
          </div>

          <div className="mt-focus" role="group" aria-label="Highlight">
            <span className="h">Highlight</span>
            {TIERS.map((t) => <button key={t} type="button" aria-pressed={focus.has(t)} className={focus.has(t) ? "on" : ""} onClick={() => toggle(t)}><i className={`k t-${t}`} />{TIER[t].short}</button>)}
            <button type="button" aria-pressed={focus.has("swing")} className={focus.has("swing") ? "on" : ""} onClick={() => toggle("swing")}><i className="k swing" />Swing senators</button>
          </div>
        </aside>
      </div>
    </section>
  );
}
