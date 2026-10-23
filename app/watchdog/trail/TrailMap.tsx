"use client";
// The campaign trail: every confirmed stop by the national figures campaigning in the 2026 midterms, who is putting
// attention on which state, and who has endorsed whom. Press play to watch the figures hop from stop to stop; pick a
// person to draw their whole route; click a state for everything that happened there.
import FloatTip, { WD_SCOPE } from "@/app/components/opp/FloatTip";
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
// Oct 22 2026: on the national endorsements map each state shows its three most important endorsers and a count of
// the rest; a click on any state opens its county map with every endorser and every campaign stop there.
const TIER: [RegExp, number][] = [[/^president$/i, 100], [/former president/i, 92], [/^vice president$/i, 88], [/former vice president/i, 80], [/majority leader|minority leader|speaker|whip/i, 70],
  [/governor/i, 66], [/senator/i, 62], [/cabinet/i, 60], [/representative|rep\./i, 50], [/surrogate/i, 48], [/celebrity|musician/i, 44], [/podcaster|host|commentator|streamer|influencer/i, 40], [/activist|business/i, 36], [/group/i, 20]];
const tierOf = (role?: string) => TIER.find(([re]) => re.test(role ?? ""))?.[1] ?? 30;
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
  const [zoom, setZoom] = useState<string | null>(null);
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
  const fillOf = (s: string) => { const n = heat[s] ?? 0; if (!n) return "rgba(var(--wd-e),.035)"; const a = 0.16 + 0.6 * Math.sqrt(n / maxHeat); return `rgba(231,179,65,${a.toFixed(3)})`; };

  // tokens to draw
  type Tok = { key: string; name: string; st: string; x: number; y: number; dim: boolean; date?: string; label?: string; size: number; more?: number };
  // Oct 22 2026: every person fits. Each state lays its people out in rings that shrink as the crowd grows; past
  // eleven people the state shows a counter that opens the full list in the state panel.
  const toks: Tok[] = useMemo(() => {
    const out: Tok[] = [];
    if (!geo) return out;
    const per: Record<string, { name: string; extra: Partial<Tok> }[]> = {};
    const add = (name: string, s: string, extra: Partial<Tok>) => { if (!pt[s]) return; (per[s] ??= []).push({ name, extra }); };
    if (mode === "trail") {
      Object.entries(here).sort((a, b) => (P[b[0]]?.visits ?? 0) - (P[a[0]]?.visits ?? 0)).forEach(([name, h]) => add(name, h.st, { dim: h.age > 10, date: h.date }));
    } else if (mode === "attention") {
      const seen = new Set<string>(); att.forEach((a) => { const k = a.who + a.st; if (seen.has(k)) return; seen.add(k); add(a.who, a.st, {}); });
    } else {
      const seen = new Set<string>(); end.forEach((e) => { const k = e.by + e.st; if (seen.has(k)) return; seen.add(k); add(e.by, e.st, { label: e.cand }); });
      const imp = (n: string) => tierOf(P[n]?.role) * 10 + (P[n]?.endorse ?? 0);
      for (const s of Object.keys(per)) per[s].sort((a, b) => imp(b.name) - imp(a.name));
    }
    const SMALL = new Set(["RI", "DE", "CT", "NJ", "MD", "MA", "NH", "VT", "DC"]);
    for (const [s, list] of Object.entries(per)) {
      const p = pt[s];
      const cap = mode === "endorse" ? (SMALL.has(s) ? 1 : 3) : SMALL.has(s) ? 3 : 11;
      const shown = list.slice(0, cap);
      const n = shown.length;
      const size = n <= 1 ? 38 : n <= 4 ? 32 : n <= 7 ? 26 : 22;
      shown.forEach((x, i) => {
        // first person in the middle, the rest on one ring of up to 6 and a second ring beyond it
        let dx = 0, dy = 0;
        if (i > 0) { const ring = i <= 6 ? 1 : 2; const k = ring === 1 ? i - 1 : i - 7; const m = ring === 1 ? Math.min(6, n - 1) : n - 7; const a = (k / Math.max(1, m)) * Math.PI * 2 - Math.PI / 2; const r = (ring === 1 ? 1.05 : 1.95) * size; dx = Math.cos(a) * r; dy = Math.sin(a) * r * 0.78; }
        out.push({ key: `${x.name}-${s}-${i}`, name: x.name, st: s, x: p[0] + dx, y: p[1] + dy - 6, dim: false, size, ...x.extra });
      });
      if (list.length > cap) out.push({ key: `more-${s}`, name: "", st: s, x: p[0] + size * (mode === "endorse" ? 1.45 : 1.7), y: p[1] + size * (mode === "endorse" ? 0.2 : 1.2), dim: false, size, more: list.length - cap });
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
          {geo && zoom ? <StateView st={zoom} statePath={geo.states[zoom]} data={data} P={P} party={party} onBack={() => setZoom(null)} onWho={(n) => setWho(who === n ? null : n)} who={who} />
          : geo ? (
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of the 2026 campaign trail">
              <defs>
                <filter id="trglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
              </defs>
              {Object.entries(geo.states).map(([s, d]) => (
                <path key={s} d={d} className={`tr-st${st === s ? " on" : ""}`} style={{ fill: fillOf(s) }} onClick={() => { setSt(s); setZoom(s); }}
                  onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, st: s })} />
              ))}
              {route ? <><path d={route} className="tr-route glow" filter="url(#trglow)" /><path d={route} className="tr-route" /></> : null}
              {mode === "trail" ? shown.filter((v) => (t - tOf(v.date)) / DAY < 2.5).map((v, i) => { const p = pt[v.st]; return p ? <circle key={`${v.who}${v.date}${i}`} cx={p[0]} cy={p[1]} r="8" className="tr-ring" style={{ stroke: PARTY_COLOR[v.party] ?? "#e7b341" }} /> : null; }) : null}
              {toks.map((k) => {
                if (k.more) return (
                  <g key={k.key} className="tr-more" onClick={() => { setSt(k.st); setZoom(k.st); }} role="button" aria-label={`${k.more} more in ${k.st}`}>
                    <circle cx={k.x} cy={k.y} r={13} /><text x={k.x} y={k.y + 4} textAnchor="middle">+{k.more}</text>
                  </g>
                );
                const p = P[k.name];
                return (
                  <g key={k.key} className={`tr-tok${k.dim ? " dim" : ""}${who === k.name ? " on" : ""}`} style={{ transform: `translate(${k.x - k.size * 0.37}px, ${k.y - k.size * 0.9}px)` }} onClick={() => setWho(who === k.name ? null : k.name)}>
                    <PersonToken ini={p?.ini ?? k.name.slice(0, 2)} party={p?.party ?? "O"} role={p?.role} size={k.size} active={who === k.name} title={k.name} />
                  </g>
                );
              })}
            </svg>
          ) : <div className="tr-load sx-skel" />}
          {tip && !zoom ? (
            <FloatTip x={tip.x} y={tip.y} scope={WD_SCOPE}>
              <h4>{STN[tip.st] ?? tip.st}</h4>
              <div>{data.visits.filter((v) => v.st === tip.st && okParty(v.party)).length} trail stops · {data.attention.filter((a) => a.st === tip.st).length} attention · {data.endorse.filter((e) => e.st === tip.st).length} endorsements</div>
              <div style={{ opacity: .8, marginTop: 4 }}>Click for the county map and the full list</div>
            </FloatTip>
          ) : null}
          <div className="tr-time">
            <button className="wd-btn" onClick={() => { if (t >= END) setT(START); setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play the campaign from August"}>{playing ? "Pause" : "Play"}</button>
            <div className="tr-slider">
              <input id="tr-t" type="range" min={START} max={END} step={DAY} value={t} onChange={(e) => { setPlaying(false); setT(+e.target.value); }} aria-label="Date" />
              <div className="tr-fill" style={{ width: `${pct}%` }} />
            </div>
            <b className="mono">{new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</b>
          </div>
          {zoom ? null : <Pointy className="tr-pty" pose="think" prop="magnifier" size={92} look={-1} flip detective say={<>{shown.length} stops so far. Click a figure to trace a route.</>} />}
        </div>

        <aside className="tr-side">
          {st ? (
            <div className="card">
              <div className="card-h"><h3>{STN[st] ?? st}</h3><button className="wd-btn" style={{ marginLeft: "auto" }} onClick={() => { setSt(null); setZoom(null); }}>Close</button></div>
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

/* ---------------------------------------------------------------- one state, county by county */
type CountyGeo = [string, string, string][];
type CountyMeta = Record<string, { n: string; st: string; area: number; r24?: number }>;
let COUNTY_CACHE: Promise<[CountyGeo, CountyMeta]> | null = null;
let STOP_CO: Promise<Record<string, string[]>> | null = null;
function StateView({ st, statePath, data, P, party, onBack, onWho, who }: { st: string; statePath: string; data: Trail; P: Record<string, Person>; party: "all" | "R" | "D"; onBack: () => void; onWho: (n: string) => void; who: string | null }) {
  const [cg, setCg] = useState<[CountyGeo, CountyMeta] | null>(null);
  const [sc, setSc] = useState<Record<string, string[]>>({});
  const [hv, setHv] = useState<{ x: number; y: number; t: string; s: string[] } | null>(null);
  const [hco, setHco] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    COUNTY_CACHE ??= Promise.all([fetch("/watchdog/us_counties.json").then((r) => r.json()), fetch("/watchdog/counties.json").then((r) => r.json())]) as Promise<[CountyGeo, CountyMeta]>;
    COUNTY_CACHE.then(setCg).catch(() => {});
    STOP_CO ??= fetch("/watchdog/stop_counties.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    STOP_CO.then(setSc);
  }, []);
  const [x0, y0, x1, y1] = bbox(statePath);
  const pad = Math.max(x1 - x0, y1 - y0) * 0.05, vb = [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2];
  const S = Math.min(vb[2], vb[3]);
  const counties = useMemo(() => (cg ? cg[0].filter((c) => c[1] === st) : []), [cg, st]);
  const meta = cg?.[1];
  const cen = useMemo(() => { const m: Record<string, [number, number]> = {}; for (const c of counties) { const b = bbox(c[2]); m[c[0]] = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; } return m; }, [counties]);
  const ok = (p: string) => party === "all" || p === party;
  // campaign stops in this state, each tied to the county of its city
  const stops = useMemo(() => data.visits.filter((v) => v.st === st && ok(v.party)).map((v) => ({ ...v, fips: (v.city && sc[`${st}|${v.city}`]) || [] })).sort((a, b) => b.date.localeCompare(a.date)), [data, st, party, sc]);
  // endorsements in this state, grouped by the candidate they back
  const byCand = useMemo(() => {
    const m = new Map<string, { cand: string; race: string; party: string; who: { name: string; src: string; date: string }[] }>();
    for (const e of data.endorse) if (e.st === st && ok(e.party)) {
      const k = e.cand; const x = m.get(k) ?? { cand: e.cand, race: e.race, party: e.party, who: [] };
      if (!x.who.some((w) => w.name === e.by)) x.who.push({ name: e.by, src: e.src, date: e.date });
      m.set(k, x);
    }
    const out = [...m.values()];
    for (const g of out) g.who.sort((a, b) => tierOf(P[b.name]?.role) - tierOf(P[a.name]?.role) || (P[b.name]?.endorse ?? 0) - (P[a.name]?.endorse ?? 0) || a.name.localeCompare(b.name));
    return out.sort((a, b) => b.who.length - a.who.length);
  }, [data, st, party, P]);
  const nEnd = useMemo(() => new Set(byCand.flatMap((g) => g.who.map((w) => w.name))).size, [byCand]);
  // stop tokens: one per person per county, set in a small ring when a county has several
  const toks = useMemo(() => {
    const per = new Map<string, Map<string, (typeof stops)[number][]>>();
    for (const v of stops) for (const f of v.fips) { const m = per.get(f) ?? new Map(); m.set(v.who, [...(m.get(v.who) ?? []), v]); per.set(f, m); }
    const size = Math.max(S / 22, Math.min(S / 9, S / 12));
    const out: { name: string; f: string; x: number; y: number; size: number; v: (typeof stops)[number][] }[] = [];
    for (const [f, m] of per) {
      const c = cen[f]; if (!c) continue; const arr = [...m.entries()], n = arr.length;
      arr.forEach(([name, v], i) => { const r = n === 1 ? 0 : size * (0.55 + n * 0.08), a = (i / n) * 6.283 - 1.57; out.push({ name, f, x: c[0] + Math.cos(a) * r, y: c[1] + Math.sin(a) * r, size, v }); });
    }
    return out;
  }, [stops, cen, S]);
  const coStops = useMemo(() => { const m: Record<string, (typeof stops)[number][]> = {}; for (const v of stops) for (const f of v.fips) (m[f] ??= []).push(v); return m; }, [stops]);
  const noCity = stops.filter((v) => !v.fips.length);
  const res = (f: string) => { const r = meta?.[f]?.r24; if (r == null) return "No 2024 result on file"; return r >= 0 ? `Trump +${r.toFixed(1)} in 2024` : `Harris +${(-r).toFixed(1)} in 2024`; };
  const shade = (f: string) => { const r = meta?.[f]?.r24; if (r == null) return "rgba(var(--wd-e),.05)"; const lean = Math.max(-1, Math.min(1, r / 60)); return lean >= 0 ? `rgba(255,59,92,${(0.08 + lean * 0.5).toFixed(3)})` : `rgba(61,123,255,${(0.08 - lean * 0.5).toFixed(3)})`; };
  const tip = (e: React.MouseEvent, t: string, lines: string[]) => setHv({ x: e.clientX, y: e.clientY, t, s: lines });
  const coName = (f: string) => meta?.[f]?.n ?? f;
  const suffix = st === "LA" ? " Parish" : st === "AK" ? "" : " County";
  return (
    <div className="tr-sv" ref={box} onMouseLeave={() => { setHv(null); setHco(null); }}>
      <div className="tr-svh"><button className="wd-btn" onClick={onBack}>Back to the national map</button><b>{STN[st] ?? st}</b><span>{nEnd} endorsers · {stops.length} campaign stops in {Object.keys(coStops).length} counties · counties shaded by the 2024 presidential margin</span></div>
      <div className="tr-sv-grid">
        <div className="tr-sv-map">
          <svg viewBox={vb.join(" ")} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${STN[st] ?? st}: county map with every campaign stop`}>
            <path d={statePath} className="tr-sv-st" />
            {counties.map((c) => (
              <path key={c[0]} d={c[2]} className={`tr-sv-co${coStops[c[0]] ? " hit" : ""}${hco === c[0] ? " hv" : ""}`} style={{ fill: shade(c[0]) }}
                onMouseMove={(e) => { setHco(c[0]); const v = coStops[c[0]] ?? []; tip(e, `${coName(c[0])}${suffix}`, [res(c[0]), ...(v.length ? v.map((x) => `${x.who}, ${fd(x.date)}${x.city ? ` in ${x.city}` : ""}`) : ["No campaign stops tracked"])]); }} />
            ))}
            {toks.map((k) => {
              const pp = P[k.name];
              return (
                <g key={`${k.name}-${k.f}`} className={`tr-tok${who === k.name ? " on" : ""}`} style={{ transform: `translate(${k.x - k.size * 0.37}px, ${k.y - k.size * 0.9}px)` }} onClick={() => onWho(k.name)}
                  onMouseMove={(e) => { e.stopPropagation(); setHco(k.f); tip(e, k.name, [`${coName(k.f)}${suffix} · ${res(k.f)}`, ...k.v.map((v) => `${fd(v.date)}${v.city ? `, ${v.city}` : ""}: ${v.kind}${v.for?.length ? ` for ${v.for.join(", ")}` : ""}`)]); }}>
                  <PersonToken ini={pp?.ini ?? k.name.slice(0, 2)} party={pp?.party ?? "O"} role={pp?.role} size={k.size} active={who === k.name} title={k.name} />
                </g>
              );
            })}
          </svg>
          <div className="tr-svk"><span><i className="co" />Counties with a campaign stop are outlined in gold</span><span>Hover any county for its 2024 result and stops</span><span>Click a figure to follow them</span></div>
        </div>
        <aside className="tr-sv-side" aria-label={`Everyone active in ${STN[st] ?? st}`}>
          <h3>// Campaign stops <em>{stops.length}</em></h3>
          {stops.length ? (
            <ul className="tr-sv-stops">
              {stops.map((v, i) => (
                <li key={i} className={who === v.who ? "on" : ""} onClick={() => onWho(v.who)} onMouseEnter={() => setHco(v.fips[0] ?? null)}>
                  <PersonToken ini={P[v.who]?.ini ?? v.who.slice(0, 2)} party={P[v.who]?.party ?? "O"} role={P[v.who]?.role} size={32} />
                  <div><b>{v.who}</b><span>{fd(v.date)} · {v.city || "City not reported"}{v.fips.length ? ` · ${v.fips.map((f) => coName(f)).join(", ")}${suffix}` : ""}</span>{v.for?.length ? <small>For {v.for.join(", ")}</small> : null}</div>
                  {v.src ? <a href={v.src} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Source</a> : null}
                </li>
              ))}
            </ul>
          ) : <p className="tr-sv-none">No campaign stops tracked here yet.</p>}
          {noCity.length ? <p className="tr-sv-none">{noCity.length} {noCity.length === 1 ? "stop has" : "stops have"} no city reported, so {noCity.length === 1 ? "it is" : "they are"} listed but not placed on the map.</p> : null}
          <h3>// Endorsements <em>{nEnd}</em></h3>
          {byCand.map((g) => (
            <div className="tr-sv-cand" key={g.cand}>
              <div className="h"><i style={{ background: PARTY_COLOR[g.party] ?? PARTY_COLOR.O }} /><b>{g.cand}</b><span>{g.race} · {g.who.length}</span></div>
              <div className="chips">
                {g.who.map((w) => (
                  <button key={w.name} className={`tr-sv-chip${who === w.name ? " on" : ""}`} onClick={() => onWho(w.name)} title={`${w.name} endorsed ${g.cand}${w.date ? `, ${fd(w.date)}` : ""}`}>
                    <i style={{ background: PARTY_COLOR[P[w.name]?.party ?? "O"] ?? PARTY_COLOR.O }} />{w.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!byCand.length ? <p className="tr-sv-none">No endorsements tracked here yet.</p> : null}
        </aside>
      </div>
      {hv ? <FloatTip x={hv.x} y={hv.y} scope={WD_SCOPE}><h4>{hv.t}</h4>{hv.s.slice(0, 8).map((l, i) => <div key={i}>{l}</div>)}{hv.s.length > 8 ? <div>and {hv.s.length - 8} more</div> : null}</FloatTip> : null}
    </div>
  );
}
