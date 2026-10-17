"use client";
// One chamber, explored from its map: every district drawn over the state, colored by the forecast, with the
// picked district's numbers beside it and the full district table below, all tied to one selection.
import { useEffect, useMemo, useState } from "react";
import { RATING_LABEL, RATE, fmtM, rating, ratingPill } from "@/app/lib/opp";
import { districtFill, MODE_LABEL, type LegisMode } from "@/app/components/opp/legisColor";
import DistrictTable from "./DistrictTable";
import type { SLDistrict } from "./data";

export type ChamberMapData = { box: [number, number, number, number]; outline: string; d: Record<string, [string, number, number]>; hold: Record<string, string> };

const pct = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
const partyWord = (p?: string | null) => (p === "D" ? "Democrats" : p === "R" ? "Republicans" : "another party");

function bb(s: string) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of s.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)) { const x = +m[1], y = +m[2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}

function Detail({ x, hold, label, map }: { x: SLDistrict | null; hold?: string; label: string; map: boolean }) {
  if (!x && !hold) {
    return (
      <div className="slx-detail empty">
        <div className="eye">Pick a district</div>
        <p>{map ? "Hover the map for the odds in any district. Click one to pin it here and find it in the table below." : "Pick a district in the table below."}</p>
      </div>
    );
  }
  if (!x) return <div className="slx-detail"><div className="eye">{label}</div><h3>Not on the 2026 ballot</h3><p>This seat was won by {partyWord(hold)} in 2024 and is next up in 2028.</p></div>;
  const m = x.margin, modeled = m != null && Math.abs(m) < 99;
  const rt = modeled ? (x.indMain && m! < 0 ? "ind" : rating(m!)) : x.probD === 1 ? "safeD" : "safeR";
  const sideD = x.indMain ? `${x.ind ?? "Independent"}` : "Democrats";
  const p = x.probD ?? 0.5;
  return (
    <div className="slx-detail">
      <div className="slx-d-top"><div><div className="eye">{label}</div><h3>District {x.d}{x.seats > 1 ? <small> · {x.seats} seats</small> : null}</h3></div><span className={`pill ${ratingPill(rt)}`}>{RATING_LABEL[rt]}</span></div>
      <div className="slx-d-odds"><div><b className="d mono" style={x.indMain ? { color: "var(--ind)" } : undefined}>{pct(p)}</b><span>{sideD}</span></div><div style={{ textAlign: "right" }}><b className="r mono">{pct(1 - p)}</b><span>Republicans</span></div></div>
      <i className="slx-d-bar"><s style={{ width: `${p * 100}%` }} /></i>
      <dl className="slx-d-dl">
        <div><dt>Forecast</dt><dd className={`mono ${modeled ? (m! < 0 ? "d" : "r") : ""}`}>{modeled ? (x.indMain ? fmtM(m!).replace("D +", "I +") : fmtM(m!)) : x.status === "no Democrat filed" ? "No Democrat filed" : x.status === "no Republican filed" ? "No Republican filed" : "Unopposed last time"}</dd></div>
        <div><dt>2024 lean</dt><dd className={`mono ${x.lean == null ? "" : x.lean < 0 ? "d" : "r"}`}>{x.lean == null ? "Not on file" : fmtM(x.lean)}</dd></div>
        <div><dt>Last winner</dt><dd>{x.winner ?? "Not on file"}{x.last?.year ? <span className="mono" style={{ color: "var(--mute)" }}> {x.last.year}</span> : null}</dd></div>
        {x.last?.d2 != null ? <div><dt>Last result</dt><dd className="mono">{fmtM(100 - 2 * x.last.d2)}</dd></div> : null}
        {x.dem || x.gop || x.ind ? <div><dt>2026 candidates</dt><dd>{x.dem ? <span className="d">{x.dem}</span> : null}{x.dem && (x.gop || x.ind) ? <span style={{ color: "var(--mute)" }}> vs </span> : null}{x.gop ? <span className="r">{x.gop}</span> : null}{x.ind ? <span style={{ color: "var(--ind)" }}>{x.gop || x.dem ? " vs " : ""}{x.ind} ({x.indParty ?? "I"})</span> : null}</dd></div> : null}
        {x.note ? <div><dt>Ballot change</dt><dd>{x.note}</dd></div> : null}
        {x.prim != null ? <div><dt>Primary vote</dt><dd className="mono">{x.prim.toFixed(1)}% Democratic</dd></div> : null}
      </dl>
      {x.polls?.length ? (
        <div className="slx-d-polls"><div className="eye">District polls</div>{x.polls.map((q, i) => <div key={i} className="slx-d-poll"><span>{q.pollster}</span><span className="mono">{q.end.slice(5).replace("-", "/")}</span><span className="mono"><span className="d">{q.D}</span> to <span className="r">{q.R}</span></span></div>)}</div>
      ) : null}
    </div>
  );
}

export default function ChamberExplorer({ districts, map, label, chamberName, aside }: { districts: SLDistrict[]; map: ChamberMapData | null; label: string; chamberName: string; aside?: React.ReactNode }) {
  const [mode, setMode] = useState<LegisMode>("odds");
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const byD = useMemo(() => new Map(districts.map((x) => [x.d, x])), [districts]);
  useEffect(() => {
    const read = () => { const h = decodeURIComponent(location.hash.replace(/^#d-/, "")); if (h && (byD.has(h) || map?.hold[h])) setSel(h); };
    read(); window.addEventListener("hashchange", read); return () => window.removeEventListener("hashchange", read);
  }, [byD, map]);
  // seats that share one district, like Washington's two positions, are drawn and labeled once
  const cells = useMemo(() => {
    if (!map) return [];
    const seen = new Set<string>();
    const out: { d: string; path: string; x: number; y: number; b: number[]; label: string }[] = [];
    for (const [d, [path, x, y]] of Object.entries(map.d)) {
      if (seen.has(path)) continue;
      seen.add(path);
      out.push({ d, path, x, y, b: bb(path), label: d.replace(/^(\d+)-\d$/, "$1") });
    }
    return out;
  }, [map]);
  const [x0, y0, x1, y1] = map?.box ?? [0, 0, 100, 100];
  const pad = Math.max(x1 - x0, y1 - y0) * 0.02;
  const vb = `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`;
  const span = Math.max(x1 - x0, y1 - y0);
  const focus = hov ?? sel;
  const fx = focus ? byD.get(focus) ?? null : null;

  return (
    <>
      <section className="slx">
        <div className="card slx-map">
          <div className="card-h">
            <h3>{chamberName} map</h3>
            <div className="seg" aria-label="Color by" style={{ marginLeft: "auto" }}>
              {(["odds", "margin", "flips"] as LegisMode[]).map((m) => <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>)}
            </div>
          </div>
          <div className="card-b">
            {map ? (
              <svg viewBox={vb} className="slx-svg" role="img" aria-label={`${chamberName} districts colored by ${MODE_LABEL[mode].toLowerCase()}`} onMouseLeave={() => setHov(null)}>
                <defs>
                  {(["D", "R", "O"] as const).map((p) => (
                    <pattern key={p} id={`slx-h-${p}`} width={span / 90} height={span / 90} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width={span / 90} height={span / 90} fill={p === "D" ? "rgba(61,123,255,.12)" : p === "R" ? "rgba(255,59,92,.12)" : "rgba(183,140,255,.12)"} />
                      <line x1="0" y1="0" x2="0" y2={span / 90} stroke={p === "D" ? "rgba(61,123,255,.6)" : p === "R" ? "rgba(255,59,92,.6)" : "rgba(183,140,255,.6)"} strokeWidth={span / 260} />
                    </pattern>
                  ))}
                </defs>
                <path d={map.outline} fill="rgba(140,130,160,.08)" stroke="none" />
                {cells.map((c) => {
                  const x = byD.get(c.d);
                  const hold = !x ? map.hold[c.d] ?? "O" : null;
                  const fill = hold ? `url(#slx-h-${hold})` : districtFill(mode, x!.probD, x!.margin, x!.last?.won?.[0], !!x!.indMain);
                  return (
                    <path key={c.d} d={c.path} fill={fill} className={`slx-cell${sel === c.d ? " sel" : ""}`} style={{ strokeWidth: span / 900 }}
                      onMouseEnter={() => setHov(c.d)} onClick={() => { setSel(c.d); history.replaceState(null, "", `#d-${encodeURIComponent(c.d)}`); }}>
                      <title>{`District ${c.d}${x ? `: Democrats ${pct(x.probD ?? 0.5)}` : ", not up in 2026"}`}</title>
                    </path>
                  );
                })}
                {cells.map((c) => {
                  const w = c.b[2] - c.b[0], h = c.b[3] - c.b[1];
                  if (Math.min(w, h) < span * 0.05 || c.label.length > 4) return null;
                  const x = byD.get(c.d);
                  const dark = x && x.probD != null && x.probD > 0.2 && x.probD < 0.8 && mode === "odds";
                  return <text key={`t${c.d}`} x={c.x} y={c.y} className="slx-lab" fontSize={Math.min(span * 0.022, Math.min(w, h) * 0.32)} fill={dark ? "#1a1020" : "rgba(255,255,255,.88)"}>{c.label}</text>;
                })}
                {focus && map.d[focus] ? <path d={map.d[focus][0]} fill="none" stroke="var(--hi)" strokeWidth={span / 260} style={{ pointerEvents: "none" }} /> : null}
              </svg>
            ) : <div className="slx-nomap">No map is available for this chamber.</div>}
            <div className="sl-legend">
              {mode === "odds" ? <>
                <span><i style={{ background: RATE.safeD }} />Safe D</span><span><i style={{ background: RATE.leanD }} />Lean D</span><span><i style={{ background: RATE.toss }} />Toss up</span>
                <span><i style={{ background: RATE.leanR }} />Lean R</span><span><i style={{ background: RATE.safeR }} />Safe R</span>
              </> : mode === "margin" ? <span><i className="ramp" />D +40 to R +40</span> : <>
                <span><i style={{ background: "#3d7bff" }} />Flips to D</span><span><i style={{ background: "#ff3b5c" }} />Flips to R</span><span><i style={{ background: "rgba(140,130,160,.35)" }} />Held</span>
              </>}
              {Object.keys(map?.hold ?? {}).length ? <span><i className="hatch" />Not up in 2026</span> : null}
            </div>
            <p className="slx-note">District shapes are estimated from where each district&apos;s voters live in the precinct returns, not drawn from the official boundary files.</p>
          </div>
        </div>
        <div className="slx-side">
          <div className="card"><Detail x={fx} hold={focus && !fx ? map?.hold[focus] : undefined} label={chamberName} map={!!map} /></div>
          {aside}
        </div>
      </section>
      <div style={{ marginTop: 16 }}><DistrictTable rows={districts} label={label} selected={sel} onSelect={(d) => setSel(d)} /></div>
    </>
  );
}
