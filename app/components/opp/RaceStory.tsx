// The story blocks of a forecast page: the headline sentence, 100 simulated election nights, the vote share
// with its range, the forecast over time and the path the model takes to its number. Server rendered SVG and CSS,
// animated by motion.css and the keyframes below, and fully readable with motion off.
import React from "react";

const fmtM = (m: number, ind = false) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(1)}`);

export const STORY_CSS = `
.st-hero{position:relative;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:28px;align-items:center;padding:8px 0 6px}
@media (max-width:1000px){.st-hero{grid-template-columns:1fr}}
.st-hero h1{font:800 clamp(34px,4.6vw,64px)/1.02 var(--font-d);letter-spacing:-.04em;margin:8px 0 14px;text-wrap:balance}
.st-hero h1 .nm{white-space:nowrap}
.st-hero h1 .ph-w{font-style:italic;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.06em}
.st-hero .lede{color:var(--ink2);font-size:16.5px;line-height:1.6;max-width:62ch;margin:0}
.st-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.st-pills span{font:700 12px var(--font-b);border:1px solid var(--line2);border-radius:999px;padding:6px 12px;color:var(--ink2);background:rgba(var(--line-rgb),.03)}
.st-pills b{color:var(--ink)}
.st-nights{padding:18px 20px}
.st-grid{display:grid;grid-template-columns:repeat(20,1fr);gap:5px;margin:12px 0 10px}
.st-grid i{display:block;aspect-ratio:1;border-radius:50%;animation:st-dot .5s cubic-bezier(.3,1.6,.5,1) both}
@keyframes st-dot{from{transform:scale(.2);opacity:.2}to{transform:none;opacity:1}}
.st-odds{display:flex;justify-content:space-between;align-items:flex-end;gap:12px}
.st-odds b{font:800 46px/1 var(--font-d);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.st-odds small{display:block;font:700 10.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute);margin-bottom:6px}
.st-sec{scroll-margin-top:110px;display:grid;gap:14px}
.st-ttl{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin:18px 0 2px}
.st-ttl h2{margin:0;font:800 clamp(26px,3vw,40px)/1 var(--font-d);letter-spacing:-.03em;text-transform:uppercase;background:linear-gradient(90deg,var(--ink) 0%,var(--ink) 40%,#b79bff 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.st-ttl p{margin:0;color:var(--mute);font-size:14px}
.st-share{padding:6px 0}
.st-share .row{display:grid;grid-template-columns:minmax(120px,190px) minmax(0,1fr) 70px;gap:16px;align-items:center;padding:16px 18px;border-top:1px solid var(--line)}
.st-share .row:first-child{border-top:0}
.st-share .nm{font-weight:800;color:var(--ink)}
.st-share .nm small{display:block;font:600 12px var(--font-b);color:var(--mute);margin-top:2px}
.st-trk{position:relative;height:40px}
.st-trk .st-tk{position:absolute;top:8px;bottom:8px;width:1px;background:rgba(var(--line-rgb),.12)}
.st-trk .st-tk.mid{background:rgba(var(--line-rgb),.45)}
.st-trk .st-tk em{position:absolute;top:26px;left:50%;transform:translateX(-50%);font:600 10px var(--font-m);font-style:normal;color:var(--mute)}
.st-trk .st-band{position:absolute;top:13px;height:14px;border-radius:7px;opacity:.28}
.st-trk .st-fill{position:absolute;left:0;top:18px;height:4px;border-radius:2px;transform-origin:0 50%;animation:st-grow 1.2s cubic-bezier(.2,.8,.2,1) .15s both}
.st-trk .st-pt{position:absolute;top:12px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#fff;border:4px solid;box-shadow:0 0 0 6px rgba(255,255,255,.06);animation:st-pop .6s cubic-bezier(.3,1.6,.5,1) .9s both}
@keyframes st-grow{from{transform:scaleX(0)}to{transform:none}}
@keyframes st-pop{from{transform:scale(.3)}to{transform:none}}
@media (max-width:640px){.st-share .row{grid-template-columns:1fr auto}.st-share .row .st-trk{grid-column:1 / -1;grid-row:2}}
.st-share .pc{font:800 24px var(--font-d);text-align:right;font-variant-numeric:tabular-nums}
.sx-draw{stroke-dasharray:1;stroke-dashoffset:1;animation:st-draw 1.6s cubic-bezier(.3,.7,.2,1) .2s forwards}
@keyframes st-draw{to{stroke-dashoffset:0}}
.st-trend svg{width:100%;height:auto;display:block}
.st-trend text{font:600 11px var(--font-m);fill:var(--mute)}
.st-path svg{width:100%;height:auto;display:block}
.st-path text{font:600 12px var(--font-b);fill:var(--ink2)}
.st-path .v{font:800 13px var(--font-m);fill:var(--ink)}
@media (prefers-reduced-motion:reduce){.st-grid i,.sx-draw,.st-trk .st-fill,.st-trk .st-pt{animation:none;stroke-dashoffset:0}}
`;

export function phraseFor(p: number) {
  if (p >= 0.97) return "all but certain";
  if (p >= 0.85) return "very likely";
  if (p >= 0.7) return "favored";
  if (p >= 0.58) return "slightly favored";
  return null;
}

/** 100 simulated election nights as dots, filled one by one: the leader's wins first, then the other side's. */
export function NightsGrid({ win, leadName, otherName, leadColor, otherColor, sims }: { win: number; leadName: string; otherName: string; leadColor: string; otherColor: string; sims: number }) {
  const n = Math.round(win * 100);
  return (
    <div className="card st-nights sx-rv-r">
      <div className="st-odds">
        <div><small>{leadName}</small><b style={{ color: leadColor }}>{n}%</b></div>
        <div style={{ textAlign: "right" }}><small>{otherName}</small><b style={{ color: otherColor, fontSize: 30 }}>{100 - n}%</b></div>
      </div>
      <div className="st-grid" role="img" aria-label={`${leadName} wins ${n} of 100 simulated elections`}>
        {Array.from({ length: 100 }, (_, i) => <i key={i} style={{ background: i < n ? leadColor : otherColor, opacity: i < n ? 1 : 0.85, animationDelay: `${i * 9}ms` }} />)}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--ink2)" }}>{leadName} wins about {n} of every 100 election nights in {sims.toLocaleString("en-US")} simulations. Each dot is one night.</p>
    </div>
  );
}

/** Each candidate's projected share with the 80 percent band, on a 25 to 75 scale. */
export function ShareBars({ cands, half }: { cands: { name: string; party: string; pct: number; color: string; win?: number }[]; half: number }) {
  const lo = 25, hi = 75, X = (v: number) => ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100;
  return (
    <div className="card st-share">
      {cands.map((c) => (
        <div className="row" key={c.name}>
          <div className="nm">{c.name}<small>{c.party}{c.win != null ? ` · ${Math.round(c.win * 100)}% to win` : ""}</small></div>
          <div className="st-trk" role="img" aria-label={`${c.name} ${c.pct.toFixed(1)} percent, 80 percent range ${(c.pct - half).toFixed(1)} to ${(c.pct + half).toFixed(1)}`}>
            {[30, 40, 50, 60, 70].map((t) => <span key={t} className={`st-tk${t === 50 ? " mid" : ""}`} style={{ left: `${X(t)}%` }}><em>{t}</em></span>)}
            <span className="st-band" style={{ left: `${X(c.pct - half)}%`, width: `${Math.max(0.5, X(c.pct + half) - X(c.pct - half))}%`, background: c.color }} />
            <span className="st-fill" style={{ width: `${X(c.pct)}%`, background: `linear-gradient(90deg, transparent, ${c.color})` }} />
            <span className="st-pt" style={{ left: `${X(c.pct)}%`, borderColor: c.color }} />
          </div>
          <div className="pc" style={{ color: c.color }}>{c.pct.toFixed(1)}%</div>
        </div>
      ))}
      <p style={{ margin: 0, padding: "4px 18px 14px", fontSize: 12.5, color: "var(--mute)" }}>Scale runs from 25 to 75 percent. The dot is the forecast, the band is the 80 percent range and the brighter tick marks 50 percent.</p>
    </div>
  );
}

/** The forecast over its recent updates: each side's chance of winning, drawn on as it scrolls in. */
export function TrendChart({ trend, demName, gopName, demColor, gopColor }: { trend: { m: number; p: number }[]; demName: string; gopName: string; demColor: string; gopColor: string }) {
  if (trend.length < 3) return null;
  const W = 900, H = 260, L = 44, Rr = 120, T = 16, B = 30;
  const x = (i: number) => L + (i / (trend.length - 1)) * (W - L - Rr);
  const y = (p: number) => T + (1 - p) * (H - T - B);
  const line = (f: (t: { m: number; p: number }) => number) => trend.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(f(t)).toFixed(1)}`).join("");
  const last = trend[trend.length - 1];
  const dW = 1 - last.p, gW = last.p;
  return (
    <div className="card st-trend" style={{ padding: "14px 10px 8px" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Chance of winning over the last ${trend.length} forecast updates, now ${demName} ${Math.round(dW * 100)} percent and ${gopName} ${Math.round(gW * 100)} percent`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => <g key={g}><line x1={L} x2={W - Rr} y1={y(g)} y2={y(g)} stroke={g === 0.5 ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.07)"} strokeDasharray={g === 0.5 ? "4 5" : undefined} /><text x={L - 8} y={y(g) + 4} textAnchor="end">{Math.round(g * 100)}%</text></g>)}
        <path d={`${line((t) => 1 - t.p)}L${x(trend.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={demColor} opacity=".08" />
        <path d={line((t) => 1 - t.p)} fill="none" stroke={demColor} strokeWidth="3" strokeLinejoin="round" pathLength={1} className="sx-draw" />
        <path d={line((t) => t.p)} fill="none" stroke={gopColor} strokeWidth="3" strokeLinejoin="round" pathLength={1} className="sx-draw" />
        <circle cx={x(trend.length - 1)} cy={y(dW)} r="5" fill={demColor} stroke="#fff" strokeWidth="2" />
        <circle cx={x(trend.length - 1)} cy={y(gW)} r="5" fill={gopColor} stroke="#fff" strokeWidth="2" />
        <text x={W - Rr + 12} y={y(dW) + 5} style={{ font: "800 15px var(--font-m)", fill: demColor }}>{Math.round(dW * 100)}% {demName}</text>
        <text x={W - Rr + 12} y={y(gW) + 5} style={{ font: "800 15px var(--font-m)", fill: gopColor }}>{Math.round(gW * 100)}% {gopName}</text>
        <text x={L} y={H - 8}>{trend.length} updates ago</text>
        <text x={W - Rr} y={H - 8} textAnchor="end">Today</text>
      </svg>
    </div>
  );
}

/** The path from the state's lean to the forecast: each stage a stop on one margin axis, joined by a line. */
export function ModelPath({ steps, ind = false }: { steps: { label: string; m: number; note?: string }[]; ind?: boolean }) {
  const vals = steps.map((s) => s.m);
  const span = Math.max(8, ...vals.map((v) => Math.abs(v))) * 1.2;
  const W = 900, rowH = 58, L = 230, R = 40, H = steps.length * rowH + 40;
  const X = (m: number) => L + ((m + span) / (2 * span)) * (W - L - R);
  const pts = steps.map((s, i) => [X(s.m), 30 + i * rowH] as const);
  return (
    <div className="card st-path" style={{ padding: "10px 12px" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={steps.map((s) => `${s.label} ${fmtM(s.m, ind)}`).join(", ")}>
        <rect x={L} y={8} width={(W - L - R) / 2} height={H - 16} fill="rgba(61,123,255,.05)" rx="8" />
        <rect x={X(0)} y={8} width={(W - L - R) / 2} height={H - 16} fill="rgba(255,59,92,.05)" rx="8" />
        <line x1={X(0)} x2={X(0)} y1={8} y2={H - 8} stroke="rgba(255,255,255,.35)" strokeDasharray="4 5" />
        <text x={L + 8} y={H - 14} style={{ fill: "var(--dem2)", font: "700 11px var(--font-m)" }}>{ind ? "I" : "D"} +{span.toFixed(0)}</text>
        <text x={W - R - 8} y={H - 14} textAnchor="end" style={{ fill: "var(--gop2)", font: "700 11px var(--font-m)" }}>R +{span.toFixed(0)}</text>
        <path d={pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("")} fill="none" stroke="url(#st-g)" strokeWidth="3" pathLength={1} className="sx-draw" />
        <defs><linearGradient id="st-g" x1="0" x2="1"><stop offset="0" stopColor="#3d7bff" /><stop offset=".5" stopColor="#a970ff" /><stop offset="1" stopColor="#ff3b5c" /></linearGradient></defs>
        {steps.map((s, i) => (
          <g key={s.label}>
            <text x={12} y={pts[i][1] + 4}>{s.label}</text>
            {s.note ? <text x={12} y={pts[i][1] + 20} style={{ font: "500 11px var(--font-b)", fill: "var(--mute)" }}>{s.note}</text> : null}
            <circle cx={pts[i][0]} cy={pts[i][1]} r={i === steps.length - 1 ? 9 : 6} fill={s.m < 0 ? "#3d7bff" : "#ff3b5c"} stroke="#fff" strokeWidth={i === steps.length - 1 ? 3 : 1.5} />
            <text className="v" x={pts[i][0] + (s.m < 0 ? -14 : 14)} y={pts[i][1] + 5} textAnchor={s.m < 0 ? "end" : "start"}>{fmtM(s.m, ind)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function SecTitle({ title, sub }: { title: string; sub?: string }) {
  return <div className="st-ttl sx-h"><h2>{title}</h2>{sub ? <p>{sub}</p> : null}</div>;
}

// ── Oct 21 2026 hero pieces: the chance of winning as a dot gauge, and the candidate cards ──
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

export const HERO_CSS = `
.st-hero2{position:relative;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.9fr) minmax(300px,.8fr);gap:22px;align-items:center;padding:6px 0}
@media (max-width:1280px){.st-hero2{grid-template-columns:minmax(0,1fr) minmax(300px,.8fr)}.st-hero2 .st-art{display:none}}
@media (max-width:860px){.st-hero2{grid-template-columns:1fr}}
.st-hero2 h1{font:800 clamp(34px,4.2vw,62px)/1.02 var(--font-d);letter-spacing:-.04em;margin:8px 0 14px;text-wrap:balance}
.st-hero2 h1 .ph-w{font-style:italic;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.06em}
.st-art{position:relative;height:min(46vh,460px)}
.st-art canvas{position:absolute;inset:0;width:100%;height:100%}
.st-gauge{padding:18px 18px 14px;text-align:center;background:linear-gradient(170deg,rgba(40,24,80,.65),rgba(14,10,26,.85))!important;border-color:rgba(160,120,255,.28)!important}
.st-gauge .lab{font:800 10.5px var(--font-m);letter-spacing:.18em;text-transform:uppercase;color:var(--ink2)}
.st-gauge svg{width:100%;height:auto;display:block;margin-top:4px}
.st-gauge svg circle.g{animation:st-dot .5s cubic-bezier(.3,1.6,.5,1) both}
.st-gauge .big{font:800 54px/1 var(--font-d);letter-spacing:-.04em;margin-top:-64px;position:relative}
.st-gauge .who{font:800 11px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin-top:4px}
.st-gauge .duo{display:flex;justify-content:space-between;align-items:center;margin-top:14px}
.st-gauge .duo div{display:flex;align-items:center;gap:8px;text-align:left}
.st-gauge .duo div:last-child{flex-direction:row-reverse;text-align:right}
.st-gauge .av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font:800 13px var(--font-d);color:#fff;border:2px solid rgba(255,255,255,.7)}
.st-gauge .duo small{display:block;font:800 9.5px var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.st-gauge .duo b{font:800 18px var(--font-d)}
.st-gauge .verdict{font:800 20px var(--font-d);margin-top:12px}
.st-gauge .sub{font:800 9.5px var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin-top:4px}
.st-cands{display:grid;gap:10px;margin-top:18px;max-width:560px}
.st-cand{position:relative;overflow:hidden;display:grid;grid-template-columns:48px 1fr auto;gap:14px;align-items:center;border-radius:16px;padding:14px 16px;color:#fff;box-shadow:0 18px 40px -22px #000;animation:fb-in2 .7s cubic-bezier(.2,.8,.2,1) both}
.st-cand.d{background:linear-gradient(120deg,#183a9e,#2c5fd8 65%,#5b8fff)}
.st-cand.r{background:linear-gradient(120deg,#8a1029,#c3223a 65%,#ff5a6e);animation-delay:.1s}
.st-cand.i{background:linear-gradient(120deg,#4b2a91,#7a4fd8 65%,#b78cff)}
.st-cand .av{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:rgba(255,255,255,.18);font:800 17px var(--font-d)}
.st-cand .nm{font:800 18px var(--font-d)}
.st-cand .pt{font:800 9.5px var(--font-m);letter-spacing:.12em;text-transform:uppercase;opacity:.85}
.st-cand .pc{text-align:right}
.st-cand .pc b{display:block;font:800 34px/1 var(--font-d);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.st-cand .pc small{display:block;font:800 9.5px var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.82)}
.st-cand .bar{position:absolute;left:0;bottom:0;height:4px;background:rgba(255,255,255,.8);transform-origin:0 50%;animation:st-grow 1.3s cubic-bezier(.2,.8,.2,1) .3s both}
@keyframes fb-in2{from{transform:translateX(-24px);opacity:.4}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.st-gauge svg circle.g,.st-cand,.st-cand .bar{animation:none}}
`;

const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).slice(0, 2).join("");

/** The chance of winning as a half circle of simulated nights, the leader's dots filling from the left. */
export function WinGauge({ win, leadName, otherName, leadColor, otherColor, leadFull, otherFull, verdict }: { win: number; leadName: string; otherName: string; leadColor: string; otherColor: string; leadFull: string; otherFull: string; verdict: string }) {
  seed = 11;
  const N = 220, pts: { x: number; y: number; a: number }[] = [];
  while (pts.length < N) { const a = rnd() * Math.PI, r = 70 + rnd() * 62; pts.push({ x: 150 - Math.cos(a) * r, y: 150 - Math.sin(a) * r, a }); }
  pts.sort((p, q) => p.a - q.a);
  const k = Math.round(win * N);
  return (
    <div className="card st-gauge sx-rv-r">
      <div className="lab">Chance of winning</div>
      <svg viewBox="0 0 300 160" role="img" aria-label={`${leadName} ${Math.round(win * 100)} percent chance of winning`}>
        <path d="M18 150 A132 132 0 0 1 282 150" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="64" />
        {pts.map((p, i) => <circle key={i} className="g" cx={p.x} cy={p.y} r={2.4} fill={i < k ? leadColor : otherColor} opacity={i < k ? 0.95 : 0.6} style={{ animationDelay: `${i * 5}ms` }} />)}
      </svg>
      <div className="big" style={{ color: leadColor }}>{Math.round(win * 100)}%</div>
      <div className="who">{leadName}</div>
      <div className="duo">
        <div><span className="av" style={{ background: leadColor }}>{initials(leadFull)}</span><span><small>{leadName}</small><b style={{ color: leadColor }}>{Math.round(win * 100)}%</b></span></div>
        <div><span className="av" style={{ background: otherColor }}>{initials(otherFull)}</span><span><small>{otherName}</small><b style={{ color: otherColor }}>{100 - Math.round(win * 100)}%</b></span></div>
      </div>
      <div className="verdict" style={{ color: leadColor }}>{verdict}</div>
      <div className="sub">{leadName} wins about {Math.round(win * 100)} of 100 nights like this</div>
    </div>
  );
}

/** One card per candidate: projected share, votes and party, in party color. */
export function CandCards({ cands }: { cands: { name: string; party: string; label: string; pct: number; votes: number; cls: "d" | "r" | "i" }[] }) {
  return (
    <div className="st-cands">
      {cands.map((c, i) => (
        <div key={c.name} className={`st-cand ${c.cls}`} style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
          <span className="av">{initials(c.name)}</span>
          <div><div className="nm">{c.name}</div><div className="pt">{c.label} · {c.votes.toLocaleString("en-US")} votes</div></div>
          <div className="pc"><b>{c.pct.toFixed(1)}%</b><small>of the vote</small></div>
          <span className="bar" style={{ width: `${c.pct}%` }} />
        </div>
      ))}
    </div>
  );
}
