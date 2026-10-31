"use client";
// The forecast command board at the top of /forecast: one screen per chamber with the party totals and the closest
// races on the left, a large national map in the middle that opens a race's full page on click, and the projection,
// a live countdown and the ways into the rest of the forecast on the right.
import React, { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/Link";
import { useRouter } from "next/navigation";
import { RATE, RATING_LABEL, rating, raceHref, ELECTION_ISO, type Rating } from "@/app/lib/opp";

export type BRace = { id: string; st: string; state: string; d: number; name: string; dem: string; gop: string; m: number; p: number; ind: boolean };
export type BChamber = { demControl: number; demSeats: number; median: number; seatsTotal: number; p10: number; p90: number; notUpD: number; notUpR: number; majority: number };
export type BoardData = { senate: BRace[]; governor: BRace[]; house: BRace[]; ch: Record<"senate" | "governor" | "house", BChamber>; updated: string };
type Office = "senate" | "house" | "governor";
type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]>; districts: Record<string, { d: string; box?: number[] } | string> };

const ORDER: Rating[] = ["safeD", "likelyD", "leanD", "toss", "leanR", "likelyR", "safeR"];
const last = (n: string) => n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/, "").split(" ").slice(-1)[0];
const fm = (m: number, ind = false) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"}+${Math.abs(m).toFixed(1)}`);

function bboxOf(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

export const BOARD_CSS = `
.fb{position:relative;isolation:isolate;margin:0 0 28px;padding:22px 0 8px;min-height:min(92vh,980px)}
.fb::before{content:"";position:absolute;z-index:-1;inset:-40px -6vw -20px -6vw;background:
  radial-gradient(50% 60% at 50% 45%,rgba(110,70,255,.20),transparent 70%),
  radial-gradient(30% 40% at 20% 30%,rgba(61,123,255,.16),transparent 70%),
  radial-gradient(30% 40% at 82% 70%,rgba(255,59,92,.13),transparent 70%);pointer-events:none}
.fb-tabs{display:flex;justify-content:center;gap:4px;margin:0 auto 18px;padding:4px;width:max-content;max-width:100%;border:1px solid var(--line2);border-radius:999px;background:rgba(var(--canvas-rgb),.6);backdrop-filter:blur(12px)}
.fb-tabs button{position:relative;font:800 13.5px var(--font-b);letter-spacing:.01em;color:var(--mute);background:none;border:0;border-radius:999px;padding:9px 20px;cursor:pointer;transition:color .25s}
.fb-tabs button[aria-pressed="true"]{color:#fff;background:linear-gradient(135deg,rgba(91,61,240,.9),rgba(180,80,220,.75));box-shadow:0 8px 30px -10px rgba(130,80,255,.9)}
.fb-tabs button:focus-visible,.fb-race:focus-visible,.fb-map path:focus-visible{outline:2px solid var(--hi);outline-offset:2px}
.fb-grid{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr) minmax(280px,360px);gap:22px;align-items:start}
@media (max-width:1240px){.fb-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.fb-center{grid-column:1 / -1;order:-1}}
@media (max-width:760px){.fb-grid{grid-template-columns:1fr}}
.fb-eye{font:800 10.5px var(--font-m);letter-spacing:.18em;text-transform:uppercase;color:var(--mute);text-align:center;margin:4px 0 10px}
.fb-party{position:relative;overflow:hidden;border-radius:18px;padding:16px 18px;color:#fff;margin-bottom:12px;box-shadow:0 18px 50px -24px rgba(0,0,0,.8);animation:fb-in .7s cubic-bezier(.2,.8,.2,1) both}
.fb-party.d{background:linear-gradient(135deg,#1c3fb8 0%,#2f6af0 60%,#5b8fff 100%)}
.fb-party.r{background:linear-gradient(135deg,#9a1230 0%,#d3263f 60%,#ff5a6e 100%);animation-delay:.08s}
.fb-party::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.14) 45%,transparent 60%);transform:translateX(-120%);animation:fb-sheen 3.2s ease-in-out 1s 1 both}
.fb-party .fb-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.fb-party .nm{font:800 15px var(--font-d)}
.fb-party .tag{font:800 9.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;background:rgba(255,255,255,.95);color:#111;border-radius:999px;padding:4px 9px}
.fb-party .big{display:flex;align-items:flex-end;justify-content:space-between;margin-top:6px}
.fb-party b{font:800 52px/1 var(--font-d);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.fb-party small{display:block;font:800 9.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;opacity:.85;margin-top:6px}
.fb-party svg{width:120px;height:62px}
.fb-race{display:grid;grid-template-columns:1fr 64px;gap:8px;align-items:center;width:100%;text-align:left;border:0;border-radius:16px;padding:12px 14px;margin-bottom:10px;color:#fff;cursor:pointer;text-decoration:none;position:relative;overflow:hidden;transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s;animation:fb-in .7s cubic-bezier(.2,.8,.2,1) both}
.fb-race:hover{transform:translateX(4px) scale(1.01);box-shadow:0 16px 40px -18px rgba(0,0,0,.9)}
.fb-race.d{background:linear-gradient(120deg,#183a9e,#2c5fd8 70%,#4a7cf0)}
.fb-race.r{background:linear-gradient(120deg,#8a1029,#c3223a 70%,#e8475b)}
.fb-race.t{background:linear-gradient(120deg,#7a5a0c,#c8921e 70%,#e7b341)}
.fb-race .st{font:800 14px var(--font-d)}
.fb-race .pill2{position:absolute;top:10px;right:12px;font:800 9px var(--font-m);letter-spacing:.12em;text-transform:uppercase;background:rgba(255,255,255,.95);color:#111;border-radius:999px;padding:3px 8px}
.fb-race .mg{display:flex;align-items:baseline;gap:10px;margin-top:4px}
.fb-race .mg b{font:800 30px/1 var(--font-d);letter-spacing:-.03em}
.fb-race .mg span{font:800 15px var(--font-d)}
.fb-race .lb{font:800 8.5px var(--font-m);letter-spacing:.12em;text-transform:uppercase;opacity:.75;margin-top:2px}
.fb-race .who{font:700 11.5px var(--font-b);opacity:.92;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fb-race svg{width:64px;height:48px;opacity:.9;align-self:end}
.fb-center{position:relative}
.fb-map{display:block;width:100%;height:auto;max-height:min(70vh,760px);filter:drop-shadow(0 30px 60px rgba(60,20,140,.45))}
.fb-map path{stroke:rgba(var(--canvas-rgb),.95);stroke-width:1.1;vector-effect:non-scaling-stroke;transition:fill .6s ease,opacity .3s,transform .3s;transform-box:fill-box;transform-origin:center}
.fb-map path.live{cursor:pointer}
.fb-map path.live:hover{opacity:.86}
.fb-map path.off{fill:#1b1726}
.fb-map path.tt{stroke:#ffd76a;stroke-width:1.8}
.fb-map text{font:800 10px var(--font-b);fill:rgba(255,255,255,.75);pointer-events:none;text-anchor:middle}
.fb-leg{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:6px;font:800 10.5px var(--font-m);letter-spacing:.1em;text-transform:uppercase;color:var(--ink2)}
.fb-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.fb-hint{text-align:center;font-size:12px;color:var(--mute);margin-top:6px}
.fb-tip{position:absolute;z-index:5;pointer-events:none;min-width:230px;padding:12px 14px;border-radius:14px;background:rgba(14,10,24,.92);border:1px solid var(--line2);backdrop-filter:blur(14px);box-shadow:0 20px 50px -20px #000;transform:translate(-50%,calc(-100% - 14px))}
.fb-tip h4{margin:0 0 6px;font:800 15px var(--font-d)}
.fb-tip .r{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-top:3px}
.fb-tip .r b{font-family:var(--font-m)}
.fb-tip .cta{margin-top:8px;font:800 10px var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:#c9b8ff}
.fb-right h2{margin:0;font:800 clamp(40px,4.4vw,68px)/.95 var(--font-d);letter-spacing:-.045em;background:linear-gradient(100deg,#8f6bff 0%,#c77dff 45%,#ff6b9a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.fb-cd{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px;font:800 11px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin-bottom:8px}
.fb-cd i{width:8px;height:8px;border-radius:50%;background:#ff3b5c;box-shadow:0 0 0 0 rgba(255,59,92,.6);animation:pulse 1.8s infinite}
.fb-cd b{white-space:nowrap;color:var(--ink);font-variant-numeric:tabular-nums}
.fb-proj{margin-top:16px;padding:18px;border-radius:18px;border:1px solid rgba(160,120,255,.35);background:linear-gradient(160deg,rgba(60,30,120,.55),rgba(20,12,40,.75));box-shadow:0 30px 70px -30px rgba(110,60,255,.6)}
.fb-proj .h{font:800 15px var(--font-d)}
.fb-proj .s{font-size:12px;color:var(--ink2);margin-top:2px}
.fb-proj .n{display:flex;align-items:baseline;gap:10px;margin-top:10px}
.fb-proj .n b{font:800 46px/1 var(--font-d);letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.fb-proj .n span{font:800 10px var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.fb-proj .n em{font:800 14px var(--font-d);font-style:normal}
.fb-bar{position:relative;display:flex;height:10px;border-radius:5px;overflow:hidden;margin:14px 0 4px;background:rgba(255,255,255,.08)}
.fb-bar i{display:block;transition:width .8s cubic-bezier(.2,.8,.2,1)}
.fb-bar u{position:absolute;top:-4px;bottom:-4px;width:2px;background:#fff;left:50%}
.fb-proj .mk{text-align:center;font:800 9px var(--font-m);letter-spacing:.1em;color:var(--mute);text-transform:uppercase}
.fb-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.fb-chips span{font:800 11.5px var(--font-b);border:1px solid var(--line2);border-radius:999px;padding:5px 10px;color:var(--ink)}
.fb-acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.fb-acts a,.fb-acts label{display:grid;place-items:center;gap:6px;text-align:center;padding:14px 10px;border:1px solid var(--line2);border-radius:14px;background:rgba(var(--line-rgb),.03);font:800 12.5px var(--font-b);color:var(--ink);text-decoration:none;transition:background .25s,transform .25s;cursor:pointer}
.fb-acts a:hover,.fb-acts label:hover{background:rgba(var(--line-rgb),.08);transform:translateY(-2px)}
.fb-acts select{width:100%;font:700 12px var(--font-b);color:var(--ink);background:var(--bg2);border:1px solid var(--line2);border-radius:8px;padding:5px}
.fb-cta{display:flex;justify-content:center;align-items:center;gap:10px;margin-top:12px;padding:15px;border-radius:14px;background:linear-gradient(135deg,#6a3df5,#a855f7);color:#fff;font:800 15px var(--font-d);text-decoration:none;box-shadow:0 18px 40px -16px rgba(140,80,255,.9);transition:transform .25s,box-shadow .25s}
.fb-cta:hover{transform:translateY(-2px);box-shadow:0 24px 50px -16px rgba(140,80,255,1)}
.fb-more{margin-top:14px;border:1px solid var(--line);border-radius:16px;padding:12px;background:rgba(var(--line-rgb),.02)}
.fb-more .t{display:flex;align-items:center;gap:8px;font:800 13px var(--font-d);margin-bottom:8px}
.fb-more .t em{font:800 9px var(--font-m);font-style:normal;letter-spacing:.1em;background:#7c4dff;color:#fff;border-radius:999px;padding:3px 7px}
.fb-more .g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.fb-more a{display:block;border:1px solid var(--line);border-radius:10px;padding:8px;text-decoration:none;color:var(--ink);font:800 11.5px var(--font-b);transition:border-color .2s,background .2s}
.fb-more a small{display:block;font:600 10.5px var(--font-b);color:var(--mute);margin-top:2px}
.fb-more a:hover{border-color:var(--ink2);background:rgba(var(--line-rgb),.05)}
@keyframes fb-in{from{transform:translateY(16px);opacity:.4}to{transform:none;opacity:1}}
@keyframes fb-sheen{to{transform:translateX(120%)}}
@media (prefers-reduced-motion:reduce){.fb-party,.fb-race,.fb-party::after{animation:none}.fb-map path{transition:none}}
`;

function Arc({ total, d, color }: { total: number; d: number; color: string }) {
  // a small half circle of seats, Democratic seats from the left
  const n = Math.min(total, 100), dn = Math.round((d / total) * n), rows = n > 60 ? 4 : 3, pts: [number, number][] = [];
  const radii = Array.from({ length: rows }, (_, i) => 22 + i * 9), sumR = radii.reduce((x, y) => x + y, 0);
  const per = radii.map((R) => Math.round((n * R) / sumR)); per[rows - 1] += n - per.reduce((x, y) => x + y, 0);
  per.forEach((k, ri) => { const R = radii[ri]; for (let j = 0; j < k; j++) { const a = Math.PI - (j / Math.max(1, k - 1)) * Math.PI; pts.push([60 + R * Math.cos(a), 58 - R * Math.sin(a)]); } });
  pts.sort((a, b) => Math.atan2(58 - b[1], b[0] - 60) - Math.atan2(58 - a[1], a[0] - 60));
  return <svg viewBox="0 0 120 62" aria-hidden="true">{pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={n > 60 ? 2.1 : 2.6} fill={i < dn ? "#fff" : color} opacity={i < dn ? 0.95 : 0.35} />)}</svg>;
}

function Shape({ d }: { d: string }) {
  const [x0, y0, x1, y1] = bboxOf(d); const w = x1 - x0 || 1, h = y1 - y0 || 1, p = Math.max(w, h) * 0.08;
  return <svg viewBox={`${x0 - p} ${y0 - p} ${w + 2 * p} ${h + 2 * p}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d={d} fill="rgba(255,255,255,.85)" /></svg>;
}

function useCountdown() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, Date.parse(ELECTION_ISO) - (now ?? Date.parse(ELECTION_ISO) - 13 * 864e5));
  const dd = Math.floor(left / 864e5), hh = Math.floor((left % 864e5) / 36e5), mm = Math.floor((left % 36e5) / 6e4), ss = Math.floor((left % 6e4) / 1e3);
  return { dd, clock: now == null ? "" : `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` };
}

// keep a tooltip on screen: open it to the left of the pointer near the right edge, and above it near the bottom
const tipFlip = (t: { x: number; y: number; w?: number; h?: number }): React.CSSProperties => ({ transform: `translate(${t.w && t.x > t.w - 290 ? "calc(-100% - 16px)" : "16px"}, ${t.h && t.y > t.h - 230 ? "calc(-100% - 12px)" : "12px"})` });

export default function ForecastBoard({ data }: { data: BoardData }) {
  const router = useRouter();
  const [office, setOffice] = useState<Office>("senate");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [tip, setTip] = useState<{ id: string; x: number; y: number; w?: number; h?: number } | null>(null);
  useEffect(() => { fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {}); }, []);
  const cd = useCountdown();

  const races = data[office];
  const byKey = useMemo(() => {
    const m: Record<string, BRace[]> = {};
    for (const r of races) (m[office === "house" ? r.id : r.st] ??= []).push(r);
    return m;
  }, [races, office]);
  const ch = data.ch[office];
  const rate = (r: BRace): Rating => (Math.abs(r.m) >= 99 ? (r.m < 0 ? "safeD" : "safeR") : rating(r.m));
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const r of races) { const k = rate(r); c[k] = (c[k] ?? 0) + 1; } return c; }, [races]);
  const closest = useMemo(() => [...races].filter((r) => Math.abs(r.m) < 99).sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 4), [races]);
  const favD = races.filter((r) => r.m < 0).length, favR = races.length - favD;
  const dSeats = Math.round(ch.median), rSeats = ch.seatsTotal - dSeats;
  const toss = counts.toss ?? 0;

  const shapes = useMemo(() => {
    if (!geo) return [] as { key: string; d: string; x: number }[];
    if (office === "house") return Object.entries(geo.districts).map(([id, v]) => { const d = typeof v === "string" ? v : v.d; return { key: id, d, x: bboxOf(d)[0] }; });
    return Object.entries(geo.states).map(([st, d]) => ({ key: st, d, x: bboxOf(d)[0] }));
  }, [geo, office]);
  const labels = useMemo(() => (geo && office !== "house" ? Object.entries(geo.states).map(([st, d]) => { const b = bboxOf(d), lb = geo.labels?.[st]; return { st, x: lb ? lb[0] : (b[0] + b[2]) / 2, y: lb ? lb[1] : (b[1] + b[3]) / 2, w: lb ? lb[2] : b[2] - b[0] }; }).filter((l) => l.w > 38) : []), [geo, office]);
  const [W, H] = geo?.frame ?? [975, 610];

  const word = office === "senate" ? { t: "U.S. Senate", s: `Projection · ${races.length} seats up in 2026`, of: "of 100", maj: "the majority" }
    : office === "house" ? { t: "U.S. House", s: "Projection · all 435 seats", of: "of 435", maj: "the majority" }
    : { t: "Governors", s: `Projection · ${races.length} races, ${50 - races.length} not up`, of: "of 50", maj: "most governorships" };
  const leadD = ch.demControl >= 0.5;
  const tipRace = tip ? (byKey[tip.id] ?? [])[0] : null;
  const states = [...new Set(races.map((r) => r.state))].sort();

  return (
    <section className="fb" aria-label="Forecast board">
      <style>{BOARD_CSS}</style>
      <div className="fb-tabs" role="group" aria-label="Chamber">
        {(["senate", "house", "governor"] as Office[]).map((o) => <button key={o} aria-pressed={office === o} onClick={() => { setOffice(o); setTip(null); }}>{o === "senate" ? "Senate" : o === "house" ? "House" : "Governors"}</button>)}
      </div>
      <div className="fb-grid">
        <div className="fb-left">
          <div className="fb-eye">{office === "senate" ? "Senate · 51 for control" : office === "house" ? "House · 218 for a majority" : `Governors · ${races.length} races in 2026`}</div>
          <div className="fb-party d">
            <div className="fb-top"><span className="nm">Democrats</span><span className="tag">{Math.round(ch.demControl * 100)}% control</span></div>
            <div className="big"><div><b>{dSeats}</b><small>{office === "governor" ? "governors" : "seats"} · favored in {favD}</small></div><Arc total={ch.seatsTotal} d={dSeats} color="#bcd0ff" /></div>
          </div>
          <div className="fb-party r">
            <div className="fb-top"><span className="nm">Republicans</span><span className="tag">{Math.round((1 - ch.demControl) * 100)}% control</span></div>
            <div className="big"><div><b>{rSeats}</b><small>{office === "governor" ? "governors" : "seats"} · favored in {favR}</small></div><Arc total={ch.seatsTotal} d={rSeats} color="#ffc2cb" /></div>
          </div>
          <div className="fb-eye" style={{ marginTop: 16 }}>The closest {office === "house" ? "seats" : "races"}</div>
          {closest.map((r, i) => {
            const rt = rate(r); const cls = rt === "toss" ? "t" : r.m < 0 ? "d" : "r";
            const shape = geo ? (office === "house" ? (() => { const v = geo.districts[r.id]; return typeof v === "string" ? v : v?.d; })() : geo.states[r.st]) : null;
            const leadShare = 50 + Math.abs(r.m) / 2;
            return (
              <Link key={r.id} href={raceHref(r.id)} className={`fb-race ${r.m < 0 ? "d" : "r"}`} style={{ animationDelay: `${0.15 + i * 0.07}s` }} data-cls={cls}>
                <span className="pill2">{RATING_LABEL[rt]}</span>
                <div>
                  <div className="st">{office === "house" ? `${r.st}-${String(r.d).padStart(2, "0")}` : r.state}</div>
                  <div className="mg"><b>{fm(r.m, r.ind)}</b><span>{leadShare.toFixed(1)}%</span></div>
                  <div className="lb">Projected · {last(r.m < 0 ? r.dem : r.gop)} two party vote</div>
                  <div className="who">{last(r.dem)} ({r.ind ? "I" : "D"}) v {last(r.gop)} (R)</div>
                </div>
                {shape ? <Shape d={shape} /> : <span />}
              </Link>
            );
          })}
        </div>

        <div className="fb-center" onMouseLeave={() => setTip(null)}>
          <svg className="fb-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${word.t} forecast map. Click a ${office === "house" ? "district" : "state"} to open its race.`}>
            {shapes.map((s) => {
              const rs = byKey[s.key]; const r = rs?.[0];
              const fill = r ? RATE[rate(r)] : undefined;
              const delay = `${((s.x / W) * 0.6).toFixed(2)}s`;
              return (
                <path key={s.key} d={s.d} className={r ? `live${rate(r) === "toss" ? " tt" : ""}` : "off"} style={r ? { fill, transitionDelay: delay } : { transitionDelay: delay }}
                  tabIndex={r ? 0 : -1} role={r ? "link" : undefined} aria-label={r ? `${r.name}, ${RATING_LABEL[rate(r)]}, ${fm(r.m, r.ind)}` : undefined}
                  onMouseMove={r ? (e) => { const box = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ id: s.key, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width, h: box.height }); } : undefined}
                  onClick={r ? () => router.push(raceHref(r.id)) : undefined}
                  onKeyDown={r ? (e) => { if (e.key === "Enter") router.push(raceHref(r.id)); } : undefined} />
              );
            })}
            {labels.map((l) => <text key={l.st} x={l.x} y={l.y + 3}>{l.st}</text>)}
          </svg>
          {tip && tipRace ? (
            <div className="fb-tip" style={{ left: tip.x, top: tip.y , ...tipFlip(tip!) }}>
              <h4>{tipRace.name}</h4>
              <div className="r"><span style={{ color: tipRace.ind ? "var(--ind)" : "var(--dem2)" }}>{tipRace.dem}</span><b>{Math.round((1 - tipRace.p) * 100)}%</b></div>
              <div className="r"><span style={{ color: "var(--gop2)" }}>{tipRace.gop}</span><b>{Math.round(tipRace.p * 100)}%</b></div>
              <div className="r"><span>{RATING_LABEL[rate(tipRace)]}</span><b>{fm(tipRace.m, tipRace.ind)}</b></div>
              <div className="cta">Click for the full race</div>
            </div>
          ) : null}
          <div className="fb-leg">{ORDER.map((k) => <span key={k}><i style={{ background: RATE[k] }} />{RATING_LABEL[k]} {counts[k] ?? 0}</span>)}</div>
          <div className="fb-hint">Every race by the On Point projection · click a {office === "house" ? "district" : "state"} for its full forecast</div>
        </div>

        <div className="fb-right">
          <div className="fb-cd"><i /><b>{cd.dd} days {cd.clock}</b><span>to Election Day · Tue Nov 3, 2026</span></div>
          <h2>United States</h2>
          <div className="fb-proj">
            <div className="h">{word.t}</div>
            <div className="s">{word.s}</div>
            <div className="n"><b>{leadD ? dSeats : rSeats}</b><span>{word.of}</span><em>{leadD ? "Democrats" : "Republicans"} favored for {word.maj}</em></div>
            <div className="fb-bar"><i style={{ width: `${(dSeats / ch.seatsTotal) * 100}%`, background: "linear-gradient(90deg,#1c3fb8,#5b8fff)" }} /><i style={{ width: `${(rSeats / ch.seatsTotal) * 100}%`, background: "linear-gradient(90deg,#ff5a6e,#9a1230)" }} /><u style={{ left: `${(ch.majority / ch.seatsTotal) * 100}%` }} /></div>
            <div className="mk">{office === "governor" ? "half" : `${ch.majority} for control`}</div>
            <div className="fb-chips">
              <span>{toss} toss {toss === 1 ? "up" : "ups"}</span>
              <span>{Math.round(Math.max(ch.demControl, 1 - ch.demControl) * 100)}% chance</span>
              <span>Range {ch.p10} to {ch.p90} D</span>
            </div>
          </div>
          <div className="fb-acts">
            <label htmlFor="fb-state">Explore a state
              <select id="fb-state" defaultValue="" onChange={(e) => { const r = races.find((x) => x.state === e.target.value); if (r) router.push(raceHref(r.id)); }}>
                <option value="" disabled>Pick a state</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <Link href="/swingometer">Swingometer<small style={{ color: "var(--mute)", fontWeight: 600 }}>move any group of voters</small></Link>
          </div>
          <a className="fb-cta" href="#fc-desk">Every race, ranked <span aria-hidden="true">↓</span></a>
          <div className="fb-more">
            <div className="t"><em>NEW</em>More forecasts</div>
            <div className="g">
              <Link href="/forecast/statewide">Statewide<small>164 offices</small></Link>
              <Link href="/forecast/legislatures">Legislatures<small>99 chambers</small></Link>
              <Link href="/maps/ballot-measures">Measures<small>146 questions</small></Link>
              <Link href="/maps/early-vote">Early vote<small>live tracker</small></Link>
              <Link href="/forecast/other">Every race<small>down ballot</small></Link>
              <Link href="/forecast/methodology">Method<small>how it works</small></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
