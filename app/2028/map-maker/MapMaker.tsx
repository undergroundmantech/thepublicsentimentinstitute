"use client";
// Build your own 2028 map: every state starts at its On Point rating, a click moves it one step along the scale, and the
// map lives in the link so it can be shared.
import { useEffect, useMemo, useState } from "react";
import { X, STATE_NAME, type StatesGeo } from "../lib";
import { useJSON } from "../useX";
import { RATES, rateOf, type Rate } from "../rate28";
import { ev as track } from "@/app/lib/ev";
import "@/app/components/community.css";

const ORDER: Rate[] = RATES.map((r) => r.k);
const DIST = ["ME-1", "ME-2", "NE-1", "NE-2", "NE-3"];
export default function MapMaker({ ev, margin, keys }: { ev: Record<string, number>; margin: Record<string, number>; keys: string[] }) {
  const geo = useJSON<StatesGeo>(`${X}/states.json`);
  const start = useMemo(() => Object.fromEntries(keys.map((k) => [k, rateOf(margin[k] ?? 0)])) as Record<string, Rate>, [keys, margin]);
  const [r, setR] = useState<Record<string, Rate>>(start); const [hov, setHov] = useState<string | null>(null); const [copied, setCopied] = useState(false);
  useEffect(() => { // read a shared map from the link
    const h = location.hash.replace(/^#m=/, ""); if (h.length !== keys.length) return;
    const got: Record<string, Rate> = {}; keys.forEach((k, i) => { const j = Number(h[i]); got[k] = ORDER[Number.isFinite(j) && j >= 0 && j < 8 ? j : ORDER.indexOf(start[k])]; }); setR(got);
  }, [keys, start]);
  const code = keys.map((k) => ORDER.indexOf(r[k])).join("");
  useEffect(() => { history.replaceState(null, "", `#m=${code}`); }, [code]);
  const step = (k: string, back = false) => setR((o) => { const i = ORDER.indexOf(o[k]); return { ...o, [k]: ORDER[(i + (back ? 7 : 1)) % 8] }; });
  const sum = useMemo(() => { const s: Record<Rate, number> = { SD: 0, LD: 0, ND: 0, TD: 0, TR: 0, NR: 0, LR: 0, SR: 0 }; for (const k of keys) s[r[k]] += ev[k] ?? 0; return s; }, [r, keys, ev]);
  const D = sum.SD + sum.LD + sum.ND + sum.TD, R = sum.SR + sum.LR + sum.NR + sum.TR;
  const [origin, setOrigin] = useState("https://onpointpolitics.us");
  useEffect(() => setOrigin(location.origin), []);
  const url = `${origin}/2028/map-maker#m=${code}`;
  const tweet = `My 2028 map: D ${D}, R ${R}. ${D >= 270 ? "Democrats win." : R >= 270 ? "Republicans win." : "Nobody gets to 270."} Make yours on @onpointpolitics`;
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } };
  const fill = (k: string) => RATES.find((x) => x.k === r[k])!.color;
  return (
    <div className="mm">
      <div className="mm-bar" aria-live="polite">
        <div className="mm-tot d"><b>{D}</b><span>Democrats</span></div>
        <div className="mm-track" role="img" aria-label={`Democrats ${D} electoral votes, Republicans ${R}`}>
          {ORDER.map((k) => <i key={k} style={{ width: `${(sum[k] / 538) * 100}%`, background: RATES.find((x) => x.k === k)!.color }} />)}
          <em style={{ left: "50%" }}>270</em>
        </div>
        <div className="mm-tot r"><b>{R}</b><span>Republicans</span></div>
      </div>
      <div className="mm-map">
        {geo ? (
          <svg viewBox="0 0 975 610" role="group" aria-label="Click a state to change its rating">
            {Object.entries(geo.states).map(([st, d]) => (
              <path key={st} d={d} fill={fill(st)} stroke="#fff" strokeWidth={hov === st ? 2.4 : 0.9} tabIndex={0} role="button" aria-label={`${STATE_NAME[st] ?? st}, ${ev[st]} electoral votes, ${RATES.find((x) => x.k === r[st])!.label}`}
                onClick={(e) => step(st, e.shiftKey)} onContextMenu={(e) => { e.preventDefault(); step(st, true); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); step(st, e.shiftKey); } }}
                onMouseEnter={() => setHov(st)} onMouseLeave={() => setHov(null)} style={{ cursor: "pointer", outline: "none" }} />
            ))}
            {Object.entries(geo.labels).filter(([st]) => (geo.box[st]?.[2] ?? 0) > 34).map(([st, [x, y]]) => <text key={st} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={800} fill={["SD", "LD", "LR", "SR"].includes(r[st]) ? "#fff" : "#141218"} pointerEvents="none">{st}</text>)}
          </svg>
        ) : <div style={{ aspectRatio: "975 / 610" }} />}
      </div>
      <div className="mm-chips">
        {["DC", ...DIST].filter((k) => keys.includes(k)).map((k) => <button key={k} type="button" className="mm-chip" style={{ background: fill(k), color: RATES.find((x) => x.k === r[k])!.ink }} onClick={() => step(k)} aria-label={`${k}, ${ev[k]} electoral votes, ${RATES.find((x) => x.k === r[k])!.label}`}>{k} · {ev[k]}</button>)}
        <span className="cm-mute">{hov ? `${STATE_NAME[hov]}: ${ev[hov]} electoral votes, ${RATES.find((x) => x.k === r[hov])!.label}. On Point forecast ${(margin[hov] ?? 0) < 0 ? "D" : "R"} +${Math.abs(margin[hov] ?? 0).toFixed(1)}.` : "Click a state to move it one step toward the Republicans; shift click or right click to move it back."}</span>
      </div>
      <div className="mm-legend">{RATES.map((x) => <span key={x.k}><i style={{ background: x.color }} />{x.label} <b>{sum[x.k]}</b></span>)}</div>
      <div className="cm-row">
        <a className="oc-soc x" href={`https://x.com/intent/post?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => track("Map maker share", { to: "x", d: D, r: R })}>Share on X</a>
        <button type="button" className="btn" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
        <button type="button" className="btn" onClick={() => setR(start)}>Reset to the forecast</button>
        <button type="button" className="btn" onClick={() => setR(Object.fromEntries(keys.map((k) => [k, (margin[k] ?? 0) < 0 ? "SD" : "SR"])) as Record<string, Rate>)}>Only safe states</button>
      </div>
    </div>
  );
}
