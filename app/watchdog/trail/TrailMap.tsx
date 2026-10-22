"use client";
// The campaign trail: every confirmed stop by the national figures campaigning in the 2026 midterms, who is putting
// attention on which state, and who has endorsed whom. Press play to watch the figures hop from stop to stop; pick a
// person to draw their whole route; click a state for everything that happened there.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PersonToken, { PARTY_COLOR } from "../PersonToken";
import { Pointy } from "@/app/components/home/Mascot";
import type { Trail, Person } from "../data";

type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]> };
type Mode = "trail" | "attention" | "endorse";
const START = Date.parse("2026-08-01T12:00:00Z"), END = Date.parse("2026-11-03T12:00:00Z"), DAY = 864e5;
const STN: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
const fd = (iso: string) => { const t = Date.parse(iso + "T12:00:00Z"); return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : iso; };
const tOf = (iso: string) => { const t = Date.parse(iso.slice(0, 10) + "T12:00:00Z"); return Number.isFinite(t) ? t : NaN; };
function bbox(d: string) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const re = /(-?\d+\.?\d*)[ ,](-?\d+\.?\d*)/g; let m; while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; }

export default function TrailMap({ data }: { data: Trail }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [mode, setMode] = useState<Mode>("trail");
  const [party, setParty] = useState<"all" | "R" | "D">("all");
  const [who, setWho] = useState<string | null>(null);
  const [st, setSt] = useState<string | null>(null);
  const [t, setT] = useState<number>(() => Math.min(END, Date.parse("2026-10-22T12:00:00Z")));
  const [playing, setPlaying] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; st: string } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {}); }, []);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((x) => { if (x >= END) { setPlaying(false); return END; } return x + DAY; }), 140);
    return () => clearInterval(id);
  }, [playing]);

  const P = useMemo(() => Object.fromEntries(data.people.map((p) => [p.name, p])) as Record<string, Person>, [data.people]);
  const pt = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    if (!geo) return out;
    for (const [s, d] of Object.entries(geo.states)) { const lb = geo.labels?.[s]; if (lb) out[s] = [lb[0], lb[1]]; else { const b = bbox(d); out[s] = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; } }
    return out;
  }, [geo]);
  const okParty = (p: string) => party === "all" || p === party;
  const visits = useMemo(() => data.visits.filter((v) => okParty(v.party) && (!who || v.who === who)), [data.visits, party, who]);
  const shown = visits.filter((v) => tOf(v.date) <= t);
  const att = data.attention.filter((a) => (party === "all" || a.lean === party) && (!who || a.who === who));
  const end = data.endorse.filter((e) => (party === "all" || e.party === party) && (!who || e.by === who));

  // where each person is on day t: their latest stop on or before t
  const here = useMemo(() => {
    const by: Record<string, { st: string; date: string; age: number; kind: string }> = {};
    for (const v of shown) { const a = (t - tOf(v.date)) / DAY; if (!by[v.who] || tOf(v.date) >= tOf(by[v.who].date)) by[v.who] = { st: v.st, date: v.date, age: a, kind: v.kind }; }
    return by;
  }, [shown, t]);
  const heat = useMemo(() => {
    const h: Record<string, number> = {};
    if (mode === "trail") for (const v of shown) h[v.st] = (h[v.st] ?? 0) + 1;
    else if (mode === "attention") for (const a of att) h[a.st] = (h[a.st] ?? 0) + 1;
    else for (const e of end) h[e.st] = (h[e.st] ?? 0) + 1;
    return h;
  }, [mode, shown, att, end]);
  const maxHeat = Math.max(1, ...Object.values(heat));
  const fillOf = (s: string) => { const n = heat[s] ?? 0; if (!n) return "rgba(255,255,255,.035)"; const a = 0.16 + 0.6 * Math.sqrt(n / maxHeat); return `rgba(231,179,65,${a.toFixed(3)})`; };

  // tokens to draw
  type Tok = { key: string; name: string; st: string; x: number; y: number; dim: boolean; date?: string; label?: string };
  const toks: Tok[] = useMemo(() => {
    const out: Tok[] = [];
    if (!geo) return out;
    const per: Record<string, number> = {};
    const place = (name: string, s: string, extra: Partial<Tok>) => {
      const p = pt[s]; if (!p) return; const k = per[s] = (per[s] ?? 0) + 1; if (k > 4) return;
      const ang = [0, -2.2, 2.2, -1.1, 1.1][k - 1] ?? 0, rr = k === 1 ? 0 : 26;
      out.push({ key: `${name}-${s}-${k}`, name, st: s, x: p[0] + Math.sin(ang) * rr, y: p[1] - Math.cos(ang) * rr * 0.6 - 8, dim: false, ...extra });
    };
    if (mode === "trail") {
      Object.entries(here).sort((a, b) => (P[b[0]]?.visits ?? 0) - (P[a[0]]?.visits ?? 0)).forEach(([name, h]) => place(name, h.st, { dim: h.age > 10, date: h.date }));
    } else if (mode === "attention") {
      const seen = new Set<string>(); att.forEach((a) => { const k = a.who + a.st; if (seen.has(k)) return; seen.add(k); place(a.who, a.st, {}); });
    } else {
      const seen = new Set<string>(); end.forEach((e) => { const k = e.by + e.st; if (seen.has(k)) return; seen.add(k); place(e.by, e.st, { label: e.cand }); });
    }
    return out;
  }, [geo, mode, here, att, end, pt, P]);

  // the focused person's route so far
  const route = useMemo(() => {
    if (!who || mode !== "trail") return "";
    const pts = shown.filter((v) => v.who === who).sort((a, b) => tOf(a.date) - tOf(b.date)).map((v) => pt[v.st]).filter(Boolean) as [number, number][];
    if (pts.length < 2) return "";
    return pts.map((p, i) => { if (!i) return `M${p[0]},${p[1]}`; const q = pts[i - 1]; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2 - Math.hypot(p[0] - q[0], p[1] - q[1]) * 0.25; return `Q${mx},${my} ${p[0]},${p[1]}`; }).join(" ");
  }, [who, mode, shown, pt]);

  const W = geo?.frame[0] ?? 975, H = geo?.frame[1] ?? 610;
  const stVisits = st ? data.visits.filter((v) => v.st === st && okParty(v.party)) : [];
  const stAtt = st ? data.attention.filter((a) => a.st === st) : [];
  const stEnd = st ? data.endorse.filter((e) => e.st === st) : [];
  const upcoming = data.visits.filter((v) => tOf(v.date) > Date.parse("2026-10-22T00:00:00Z") && okParty(v.party)).sort((a, b) => tOf(a.date) - tOf(b.date));
  const recent = [...shown].sort((a, b) => tOf(b.date) - tOf(a.date)).slice(0, 8);
  const pct = ((t - START) / (END - START)) * 100;
  const peopleShown = data.people.filter((p) => okParty(p.party) && (mode === "trail" ? p.visits : mode === "attention" ? p.attention : p.endorse));

  return (
    <div className="tr">
      <div className="tr-bar">
        <div className="wd-chips" role="group" aria-label="What to show">
          {([["trail", "On the trail"], ["attention", "Attention"], ["endorse", "Endorsements"]] as [Mode, string][]).map(([k, l]) => <button key={k} className={mode === k ? "on" : ""} aria-pressed={mode === k} onClick={() => { setMode(k); setWho(null); }}>{l}</button>)}
        </div>
        <div className="wd-chips" role="group" aria-label="Party">
          {([["all", "Everyone"], ["R", "Republicans"], ["D", "Democrats"]] as const).map(([k, l]) => <button key={k} className={party === k ? "on" : ""} aria-pressed={party === k} onClick={() => setParty(k)}>{l}</button>)}
        </div>
        {who ? <button className="wd-btn" onClick={() => setWho(null)}>Showing {who} · show everyone</button> : null}
      </div>

      <div className="tr-stage">
        <div className="tr-map card" ref={wrap} onMouseLeave={() => setTip(null)}>
          {geo ? (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of the 2026 campaign trail">
              <defs>
                <filter id="trglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
              </defs>
              {Object.entries(geo.states).map(([s, d]) => (
                <path key={s} d={d} className={`tr-st${st === s ? " on" : ""}`} style={{ fill: fillOf(s) }} onClick={() => setSt(s === st ? null : s)}
                  onMouseMove={(e) => { const b = wrap.current!.getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, st: s }); }} />
              ))}
              {route ? <><path d={route} className="tr-route glow" filter="url(#trglow)" /><path d={route} className="tr-route" /></> : null}
              {mode === "trail" ? shown.filter((v) => (t - tOf(v.date)) / DAY < 2.5).map((v, i) => { const p = pt[v.st]; return p ? <circle key={`${v.who}${v.date}${i}`} cx={p[0]} cy={p[1]} r="8" className="tr-ring" style={{ stroke: PARTY_COLOR[v.party] ?? "#e7b341" }} /> : null; }) : null}
              {toks.map((k) => {
                const p = P[k.name];
                return (
                  <g key={k.key} className={`tr-tok${k.dim ? " dim" : ""}${who === k.name ? " on" : ""}`} style={{ transform: `translate(${k.x - 14}px, ${k.y - 34}px)` }} onClick={() => setWho(who === k.name ? null : k.name)}>
                    <PersonToken ini={p?.ini ?? k.name.slice(0, 2)} party={p?.party ?? "O"} role={p?.role} size={38} active={who === k.name} title={k.name} />
                  </g>
                );
              })}
            </svg>
          ) : <div className="tr-load sx-skel" />}
          {tip ? (
            <div className="wd-tip" style={{ left: tip.x + 14, top: tip.y + 12, transform: tip.x > (wrap.current?.clientWidth ?? 0) - 330 ? "translateX(calc(-100% - 28px))" : undefined }}>
              <h4>{STN[tip.st] ?? tip.st}</h4>
              <div>{data.visits.filter((v) => v.st === tip.st && okParty(v.party)).length} trail stops · {data.attention.filter((a) => a.st === tip.st).length} attention · {data.endorse.filter((e) => e.st === tip.st).length} endorsements</div>
              <div style={{ opacity: .8, marginTop: 4 }}>Click for the full list</div>
            </div>
          ) : null}
          <div className="tr-time">
            <button className="wd-btn" onClick={() => { if (t >= END) setT(START); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play the campaign from August"}>{playing ? "Pause" : "Play"}</button>
            <div className="tr-slider">
              <input id="tr-t" type="range" min={START} max={END} step={DAY} value={t} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} aria-label="Date" />
              <div className="tr-fill" style={{ width: `${pct}%` }} />
            </div>
            <b className="mono">{new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</b>
          </div>
          <Pointy className="tr-pty" pose="think" prop="magnifier" size={92} look={-1} flip detective say={<>{shown.length} stops so far. Click a figure to trace a route.</>} />
        </div>

        <aside className="tr-side">
          {st ? (
            <div className="card">
              <div className="card-h"><h3>{STN[st] ?? st}</h3><button className="wd-btn" style={{ marginLeft: "auto" }} onClick={() => setSt(null)}>Close</button></div>
              <div className="tr-list">
                {stVisits.length ? <div className="eye gold">On the trail</div> : null}
                {stVisits.map((v, i) => <Item key={`v${i}`} p={P[v.who]} title={`${v.who} · ${fd(v.date)}${v.city ? `, ${v.city}` : ""}`} text={`${v.kind === "announced" ? "Announced: " : ""}${v.note}${v.for.length ? ` For ${v.for.join(", ")}.` : ""}`} src={v.src} />)}
                {stAtt.length ? <div className="eye gold">Attention</div> : null}
                {stAtt.map((a, i) => <Item key={`a${i}`} p={P[a.who]} title={`${a.who} · ${a.race}`} text={a.what} src={a.src} />)}
                {stEnd.length ? <div className="eye gold">Endorsements</div> : null}
                {stEnd.map((e, i) => <Item key={`e${i}`} p={P[e.by]} title={`${e.by} endorsed ${e.cand}`} text={`${e.race}${e.date ? `, ${e.date}` : ""}`} src={e.src} />)}
                {!stVisits.length && !stAtt.length && !stEnd.length ? <div className="wd-empty">Nothing confirmed in {STN[st] ?? st} yet.</div> : null}
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-h"><h3>{mode === "trail" ? "Latest stops" : mode === "attention" ? "Who is paying attention" : "Endorsements"}</h3></div>
              <div className="tr-list">
                {mode === "trail" ? recent.map((v, i) => <Item key={i} p={P[v.who]} title={`${v.who} · ${STN[v.st] ?? v.st}, ${fd(v.date)}`} text={v.note} src={v.src} onClick={() => setSt(v.st)} />)
                  : mode === "attention" ? att.map((a, i) => <Item key={i} p={P[a.who]} title={`${a.who} · ${a.race}`} text={a.what} src={a.src} onClick={() => setSt(a.st)} />)
                  : end.map((e, i) => <Item key={i} p={P[e.by]} title={`${e.by} endorsed ${e.cand}`} text={`${e.race}${e.date ? `, ${e.date}` : ""}`} src={e.src} onClick={() => setSt(e.st)} />)}
              </div>
            </div>
          )}
          {mode === "trail" && upcoming.length ? (
            <div className="card">
              <div className="card-h"><h3>Coming up before Election Day</h3></div>
              <div className="tr-list">{upcoming.slice(0, 10).map((v, i) => <Item key={i} p={P[v.who]} title={`${fd(v.date)} · ${v.who}`} text={`${v.city ? `${v.city}, ` : ""}${STN[v.st] ?? v.st}${v.for.length ? `, for ${v.for.join(", ")}` : ""}`} src={v.src} onClick={() => setSt(v.st)} />)}</div>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="card tr-people">
        <div className="card-h"><h3>The people</h3><span className="eye" style={{ marginLeft: "auto" }}>Click anyone to follow them</span></div>
        <div className="tr-rail">
          {peopleShown.map((p) => (
            <button key={p.name} className={`tr-person${who === p.name ? " on" : ""}`} onClick={() => { setWho(who === p.name ? null : p.name); if (mode === "trail") setT(END); }}>
              <PersonToken ini={p.ini} party={p.party} role={p.role} size={44} active={who === p.name} />
              <span><b>{p.name}</b><small>{mode === "trail" ? `${p.visits} ${p.visits === 1 ? "stop" : "stops"}` : mode === "attention" ? `${p.attention} items` : `${p.endorse} endorsements`} · {p.states.length} states</small></span>
            </button>
          ))}
        </div>
        <p className="wd-note" style={{ padding: "0 16px 14px" }}>Only visits and statements confirmed by a news report or the campaign&apos;s own announcement are shown. Figures are On Point cartoon characters in each person&apos;s party color with their initials, not likenesses. <Link href="/watchdog/connections" style={{ textDecoration: "underline" }}>See how they connect to the money</Link>.</p>
      </div>
    </div>
  );
}

function Item({ p, title, text, src, onClick }: { p?: Person; title: string; text: string; src?: string; onClick?: () => void }) {
  return (
    <div className={`tr-item${onClick ? " click" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}>
      {p ? <PersonToken ini={p.ini} party={p.party} role={p.role} size={34} /> : <span style={{ width: 27 }} />}
      <span><b>{title}</b><small>{text}</small>{src ? <a href={src} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Source</a> : null}</span>
    </div>
  );
}
