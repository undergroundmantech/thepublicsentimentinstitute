"use client";
// The polling room: every state On Point Polling has fielded, on one map. Released states are shaded by the
// leader in the chosen race and carry their result on a tag; states in the field pulse; states we are
// considering next are hatched. Click a state for its full result, the sample, and where the forecast has it.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { marginColor } from "@/app/lib/opp";
import { STATE_POLLS, FUND_LINE, FUND_URL, type PollRace, type StatePoll } from "./polls/pollMapData";
import "./pollroom.css";

type Geo = { frame: [number, number]; states: Record<string, string> };
type Office = "Senate" | "Governor";
export type RoomForecast = Record<string, Partial<Record<Office, { m: number; href: string }>>>;

const marginOf = (r: PollRace) => { const d = r.cands.find((c) => c.p === "d"), g = r.cands.find((c) => c.p === "r"); return d && g ? d.leaned - g.leaned : 0; };
const ml = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m > 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
const fl = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
const last = (n: string) => n.split(" ").slice(-1)[0];
function bboxOf(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
// tag nudges for states whose box center sits off the shape, in map units
const NUDGE: Record<string, [number, number]> = { FL: [40, 8], MI: [22, 30], TX: [6, 10], SC: [0, 0], OH: [0, 0], NE: [0, 0], WI: [0, 4] };

function Race({ r, fc }: { r: PollRace; fc?: { m: number; href: string } }) {
  const m = marginOf(r), d = r.cands.find((c) => c.p === "d"), g = r.cands.find((c) => c.p === "r");
  return (
    <div className="prm-race">
      <div className="prm-rh"><span>{r.race}</span><b className={m >= 0 ? "d" : "r"}>{ml(m)}</b></div>
      {r.cands.map((c) => (
        <div key={c.n} className={`prm-c ${c.p}`}>
          <span className="nm">{c.n}</span>
          <span className="bar"><i style={{ width: `${c.leaned}%` }} />{c.asked != null ? <s style={{ left: `${c.asked}%` }} title={`${c.asked.toFixed(1)}% before leaners`} /> : null}</span>
          <b>{c.leaned.toFixed(1)}%</b>
        </div>
      ))}
      {fc && d && g ? <Link href={fc.href} className="prm-fc">On Point forecast <b className={fc.m < 0 ? "d" : "r"}>{fl(fc.m)}</b><span>Open the race</span></Link> : null}
    </div>
  );
}

export default function PollingRoom({ forecast, title = "Where On Point Polling has been in the field" }: { forecast: RoomForecast; title?: string }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [office, setOffice] = useState<Office>("Senate");
  const released = STATE_POLLS.filter((p) => p.status === "released");
  const [sel, setSel] = useState<string>(released[0]?.st ?? STATE_POLLS[0].st);
  const [hov, setHov] = useState<string | null>(null);
  useEffect(() => { fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {}); }, []);
  const by = useMemo(() => Object.fromEntries(STATE_POLLS.map((p) => [p.st, p])) as Record<string, StatePoll>, []);
  const shapes = useMemo(() => (geo ? Object.entries(geo.states).map(([st, d]) => { const b = bboxOf(d); return { st, d, x: b[0], cx: (b[0] + b[2]) / 2 + (NUDGE[st]?.[0] ?? 0), cy: (b[1] + b[3]) / 2 + (NUDGE[st]?.[1] ?? 0) }; }) : []), [geo]);
  const [W, H] = geo?.frame ?? [975, 610];
  const raceOf = (p: StatePoll) => p.races.find((r) => r.race === office) ?? null;
  const fillOf = (p?: StatePoll) => { if (!p) return undefined; if (p.status !== "released") return undefined; const r = raceOf(p); return r ? marginColor(-marginOf(r) * 1.6) : undefined; };
  const cur = by[sel];
  const n = released.reduce((a, p) => a + (parseInt((p.sample ?? "").replace(/[^0-9]/g, ""), 10) || 0), 0);

  return (
    <section className="prm" aria-labelledby="prm-h">
      <div className="prm-head">
        <div><div className="eye g">Our fieldwork · 2026</div><h2 id="prm-h">{title}</h2></div>
        <div className="prm-chips" role="group" aria-label="Race">
          {(["Senate", "Governor"] as Office[]).map((o) => <button key={o} className={office === o ? "on" : ""} onClick={() => setOffice(o)}>{o}</button>)}
        </div>
      </div>
      <div className="prm-stats">
        <div><span>State polls released</span><b>{released.length}</b></div>
        <div><span>Registered voters interviewed</span><b>{n.toLocaleString("en-US")}</b></div>
        <div><span>Considering next</span><b>{STATE_POLLS.filter((p) => p.status === "next").map((p) => p.st).join(", ") || "None"}</b></div>
        <div><span>Weighting</span><b>DSMeridian</b></div>
      </div>
      <div className="prm-stage">
        <div className="prm-mapcard">
          {geo ? (
            <svg key={office} className="prm-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`States On Point Polling has polled, ${office} results`}>
              <defs>
                <pattern id="prm-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="rgba(231,179,65,.10)" /><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(231,179,65,.55)" strokeWidth="2.4" /></pattern>
                <filter id="prm-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              {shapes.map((s) => {
                const p = by[s.st];
                const cls = !p ? "off" : p.status === "released" ? `live rel${sel === s.st ? " sel" : ""}` : p.status === "field" ? "live fld" : `live nxt${sel === s.st ? " sel" : ""}`;
                return <path key={s.st} d={s.d} className={cls} style={{ fill: p ? (p.status === "next" ? "url(#prm-hatch)" : fillOf(p)) : undefined, animationDelay: `${((s.x / W) * 0.5).toFixed(2)}s` }}
                  tabIndex={p ? 0 : -1} role={p ? "button" : undefined} aria-label={p ? `${p.name}, ${p.status === "released" ? "poll released" : p.status === "field" ? "in the field" : "considering next"}` : undefined}
                  filter={p && sel === s.st ? "url(#prm-glow)" : undefined}
                  onMouseEnter={p ? () => setHov(s.st) : undefined} onMouseLeave={p ? () => setHov(null) : undefined}
                  onClick={p ? () => setSel(s.st) : undefined} onKeyDown={p ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(s.st); } } : undefined} />;
              })}
              {shapes.filter((s) => by[s.st]).map((s, i) => {
                const p = by[s.st], r = raceOf(p), m = r ? marginOf(r) : 0;
                const txt = p.status === "released" ? (r ? `${s.st} ${ml(m)}` : `${s.st} polled`) : p.status === "field" ? `${s.st} in field` : `${s.st} next?`;
                const w = txt.length * 7.6 + 16;
                return (
                  <g key={s.st} transform={`translate(${s.cx - w / 2} ${s.cy - 34})`} onClick={() => setSel(s.st)}><g className={`prm-tag ${p.status}${sel === s.st || hov === s.st ? " on" : ""}`} style={{ animationDelay: `${0.5 + i * 0.08}s` }}>
                    <rect width={w} height={22} rx={6} className={p.status === "released" ? (m >= 0 ? "d" : "r") : ""} />
                    <polygon points={`${w / 2 - 5},22 ${w / 2 + 5},22 ${w / 2},29`} className={p.status === "released" ? (m >= 0 ? "d" : "r") : ""} />
                    <text x={w / 2} y={15}>{txt}</text>
                  </g></g>
                );
              })}
            </svg>
          ) : <div className="prm-load sx-skel" />}
          <div className="prm-legend"><span><i style={{ background: marginColor(-12) }} />Democrat leads</span><span><i style={{ background: marginColor(12) }} />Republican leads</span><span><i className="hatch" />Considering next</span><span><i className="off" />Not polled</span></div>
        </div>

        <aside className="prm-read" aria-live="polite">
          {cur ? (
            <>
              <div className="prm-rh">
                <span className={`prm-st ${cur.status}`}>{cur.status === "released" ? "Released" : cur.status === "field" ? "In the field" : "Considering next"}</span>
                <h3>{cur.name}</h3>
                {cur.status === "released" ? <p>{cur.dates} · {cur.sample}{cur.moe ? ` · MOE ${cur.moe}` : ""}</p> : <p>{cur.note}</p>}
              </div>
              {cur.races.length ? cur.races.map((r) => <Race key={r.race} r={r} fc={forecast[cur.st]?.[r.race as Office]} />) : null}
              {cur.races.length ? <p className="prm-note">Likely voters with undecideds leaned. The tick on each bar is the share before leaners were allocated.</p> : null}
              <div className="prm-links">
                {cur.href ? <Link className="btn g" href={cur.href}>{cur.hrefLabel ?? "Read the release"}</Link> : null}
                {cur.release ? <a className="btn" href={cur.release} target="_blank" rel="noreferrer">Release on Substack</a> : null}
                {cur.status !== "released" ? <a className="btn g" href={FUND_URL} target="_blank" rel="noreferrer">Fund this poll</a> : null}
              </div>
              {cur.status !== "released" ? <p className="prm-note">{FUND_LINE}</p> : null}
            </>
          ) : null}
          <div className="prm-list">
            {STATE_POLLS.map((p) => { const r = raceOf(p), m = r ? marginOf(r) : 0; return (
              <button key={p.st} className={`prm-li${sel === p.st ? " on" : ""}`} onClick={() => setSel(p.st)}>
                <span className="st">{p.st}</span><span className="nm">{p.name}</span>
                <b className={p.status === "released" ? (m >= 0 ? "d" : "r") : "g"}>{p.status === "released" ? (r ? `${last([...r.cands].sort((a, b) => b.leaned - a.leaned)[0].n)} ${ml(m)}` : "Released") : p.status === "field" ? "In field" : "Next?"}</b>
              </button>); })}
          </div>
        </aside>
      </div>
    </section>
  );
}
