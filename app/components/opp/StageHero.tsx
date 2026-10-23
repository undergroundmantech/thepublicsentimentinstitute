// The race page opener, staged like a show: a dark band, marquee bulbs on the race name, the headline, then the
// state as floating pixel art under a spotlight with the two candidates in the wings, and the odds below as
// 100 pixel nights. Shared by the main race pages and the statewide office pages.
import React from "react";
import PixelStage, { type StageLabel } from "./PixelStage";
import { Pointy } from "@/app/components/home/Mascot";

export type StageCand = { name: string; label: string; pct: number; votes: number; color: string };

const initials = (n: string) => n.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export const STAGE_CSS = `
.sg{position:relative;isolation:isolate;margin:6px calc(50% - 50vw) 0;padding:44px max(16px,calc(50vw - var(--wrap,1680px)/2)) 40px;background:linear-gradient(180deg,rgba(4,2,8,0) 0,#040208 110px,#040208 calc(100% - 90px),rgba(4,2,8,0) 100%);color:#f3eff8;overflow:hidden}
.sg::before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:
  radial-gradient(70% 55% at 50% 0%,rgba(120,80,255,.20),transparent 70%),
  radial-gradient(40% 30% at 12% 70%,rgba(61,123,255,.10),transparent 70%),
  radial-gradient(40% 30% at 88% 70%,rgba(255,59,92,.10),transparent 70%)}
.sg::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.35;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:24px 24px;-webkit-mask-image:radial-gradient(60% 60% at 50% 55%,#000,transparent);mask-image:radial-gradient(60% 60% at 50% 55%,#000,transparent)}
.sg-top{text-align:center;max-width:1100px;margin:0 auto;position:relative;z-index:2}
.sg-marq{display:inline-flex;align-items:center;gap:10px;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);font:800 11px var(--font-m);letter-spacing:.2em;text-transform:uppercase;color:#e9e2ff}
.sg-bulbs{display:inline-flex;gap:5px}
.sg-bulbs i{width:5px;height:5px;border-radius:50%;background:#ffd36b;box-shadow:0 0 6px 1px rgba(255,200,90,.8);animation:sg-chase 1.2s steps(1) infinite}
.sg-bulbs i:nth-child(2){animation-delay:.2s}.sg-bulbs i:nth-child(3){animation-delay:.4s}.sg-bulbs i:nth-child(4){animation-delay:.6s}.sg-bulbs i:nth-child(5){animation-delay:.8s}.sg-bulbs i:nth-child(6){animation-delay:1s}
@keyframes sg-chase{0%,100%{opacity:1}50%{opacity:.25}}
.sg h1{font:800 clamp(34px,4.4vw,68px)/1 var(--font-d);letter-spacing:-.045em;margin:16px auto 14px;text-wrap:balance;color:#fff}
.sg h1 .nm{text-shadow:0 0 34px currentColor}
.sg h1 .ph-w{font-style:italic;background:linear-gradient(90deg,#8fb0ff,#c79bff 45%,#ff7a92);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:.14em;margin-right:-.08em}
.sg .lede{max-width:760px;margin:0 auto;color:#c9c1dc;font-size:16px}
.sg-pills{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:16px}
.sg-pills span{font:600 12.5px var(--font-b);color:#d8d0ea;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:6px 12px}
.sg-pills b{color:#fff}
.sg-pills .pill{border:0}
.sg-stage{position:relative;height:clamp(380px,34vw,560px);margin-top:34px}
.sg-lamp{position:absolute;left:50%;top:-6px;width:120px;height:14px;transform:translateX(-50%);border-radius:0 0 40px 40px;background:linear-gradient(180deg,#2a2236,#120d1a);box-shadow:0 10px 40px 10px rgba(200,180,255,.35),inset 0 -3px 0 rgba(255,255,255,.5);z-index:3}
.ps-wrap{position:absolute;inset:0}
.ps-cv{display:block;width:100%;height:100%}
.ps-tip{position:absolute;z-index:5;pointer-events:none;transform:translate(14px,-110%);background:rgba(10,6,18,.92);border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:8px 11px;display:grid;gap:2px;min-width:150px;box-shadow:0 18px 40px -16px #000}
.ps-tip b{font:700 13.5px var(--font-b);color:#fff}
.ps-tip span{font:800 12px var(--font-m);letter-spacing:.04em}
.sg-c{position:absolute;top:50%;width:268px;transform:translateY(-50%);z-index:4;border-radius:18px;padding:18px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.12);box-shadow:0 30px 80px -30px #000,inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(8px);animation:sg-wing .9s cubic-bezier(.2,.8,.2,1) .3s both}
.sg-c.a{left:0}.sg-c.b{right:0;animation-name:sg-wing-r}
.sg-c::before{content:"";position:absolute;left:18px;right:18px;top:-1px;height:2px;border-radius:2px;background:var(--c);box-shadow:0 0 18px 2px var(--c)}
@keyframes sg-wing{from{opacity:0;transform:translate(-40px,-50%)}to{opacity:1;transform:translate(0,-50%)}}
@keyframes sg-wing-r{from{opacity:0;transform:translate(40px,-50%)}to{opacity:1;transform:translate(0,-50%)}}
.sg-av{width:54px;height:54px;border-radius:14px;display:grid;place-items:center;font:800 18px var(--font-d);color:#fff;background:var(--c);box-shadow:0 10px 30px -8px var(--c);image-rendering:pixelated}
.sg-c .nm{font:800 20px/1.15 var(--font-d);letter-spacing:-.02em;margin-top:14px;color:#fff}
.sg-c .pt{font:700 10.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:#a79fbd;margin-top:4px}
.sg-c .pc{font:800 52px/1 var(--font-d);letter-spacing:-.04em;color:var(--c);margin-top:14px;font-variant-numeric:tabular-nums;text-shadow:0 0 30px var(--c)}
.sg-c .vt{font:700 12px var(--font-m);color:#cfc7e2;margin-top:6px;font-variant-numeric:tabular-nums}
.sg-seg{display:grid;grid-template-columns:repeat(20,1fr);gap:3px;margin-top:14px}
.sg-seg i{height:9px;border-radius:2px;background:rgba(255,255,255,.08)}
.sg-seg i.on{background:var(--c);box-shadow:0 0 8px -1px var(--c);animation:sg-pop .3s steps(3) both}
@keyframes sg-pop{from{opacity:0;transform:scale(.2)}to{opacity:1;transform:none}}
.sg-odds{position:relative;z-index:2;max-width:900px;margin:8px auto 0;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:18px;align-items:center}
.sg-odds .side{display:grid;gap:2px;min-width:110px}
.sg-odds .side.r{text-align:right}
.sg-odds .side b{font:800 34px/1 var(--font-d);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.sg-odds .side span{font:700 10.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:#a79fbd}
.sg-grid{display:grid;grid-template-columns:repeat(25,1fr);gap:3px;max-width:600px;width:100%;justify-self:center}
.sg-grid i{aspect-ratio:1;border-radius:2px;background:var(--c);opacity:.95;animation:sg-pop .35s steps(3) both}
.sg-odds .cap{grid-column:1/-1;text-align:center;font:700 11px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:#a79fbd}
.sg-odds .cap b{color:#fff;font-family:var(--font-d);letter-spacing:-.01em;text-transform:none;font-size:18px;display:block;margin-bottom:4px}
@media (max-width:1120px){
  .sg-stage{height:auto}
  .ps-wrap{position:relative;height:clamp(300px,62vw,520px)}
  .sg-c{position:relative;top:auto;transform:none;width:auto;animation-name:sg-up}
  .sg-c.a,.sg-c.b{left:auto;right:auto;animation-name:sg-up}
  .sg-wings{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px}
}
@keyframes sg-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
@media (min-width:1121px){.sg-wings{display:contents}}
@media (max-width:640px){
  .sg-wings{grid-template-columns:1fr;gap:10px}
  .sg-c{display:grid;grid-template-columns:auto minmax(0,1fr) auto;column-gap:12px;align-items:center;padding:14px}
  .sg-av{width:42px;height:42px;font-size:15px;grid-row:1/3}
  .sg-c .nm{margin-top:0;font-size:17px}
  .sg-c .pt{grid-column:2}
  .sg-c .pc{font-size:30px;margin-top:0;grid-column:3;grid-row:1/3}
  .sg-c .vt,.sg-c .sg-seg{grid-column:1/-1}
  .sg-grid{grid-template-columns:repeat(20,1fr);gap:3px}
  .sg-odds{grid-template-columns:1fr 1fr}
  .sg-odds .sg-grid{grid-column:1/-1;grid-row:2}
  .sg-odds .side b{font-size:26px}
}
@media (prefers-reduced-motion:reduce){.sg-bulbs i,.sg-c,.sg-seg i.on,.sg-grid i{animation:none}}
/* light theme: the same show in daylight, a pale lavender stage, ink type and white glass wings */
html[data-theme="light"] .sg{background:linear-gradient(180deg,rgba(234,229,247,0) 0,#ebe6f7 110px,#ebe6f7 calc(100% - 90px),rgba(234,229,247,0) 100%);color:var(--ink)}
html[data-theme="light"] .sg::before{background:radial-gradient(70% 55% at 50% 0%,rgba(120,80,255,.16),transparent 70%),radial-gradient(40% 30% at 12% 70%,rgba(42,99,240,.10),transparent 70%),radial-gradient(40% 30% at 88% 70%,rgba(232,38,75,.09),transparent 70%)}
html[data-theme="light"] .sg::after{opacity:.6;background-image:linear-gradient(rgba(17,0,25,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(17,0,25,.05) 1px,transparent 1px)}
html[data-theme="light"] .sg-marq{background:rgba(255,255,255,.8);border-color:rgba(17,0,25,.1);color:#3a2f5c}
html[data-theme="light"] .sg-bulbs i{background:#e0a21c;box-shadow:0 0 6px 1px rgba(224,162,28,.55)}
html[data-theme="light"] .sg h1{color:var(--ink)}
html[data-theme="light"] .sg h1 .nm{text-shadow:none}
html[data-theme="light"] .sg h1 .ph-w{background-image:linear-gradient(90deg,#2a63f0,#8b3fd9 45%,#e8264b)}
html[data-theme="light"] .sg .lede{color:#3a3350}
html[data-theme="light"] .sg-pills span{color:#3a3350;background:#fff;border-color:rgba(17,0,25,.1)}
html[data-theme="light"] .sg-pills b{color:var(--ink)}
html[data-theme="light"] .sg-lamp{background:linear-gradient(180deg,#d8d2ea,#b9b0d6);box-shadow:0 10px 40px 8px rgba(124,92,240,.22),inset 0 -3px 0 rgba(255,255,255,.9)}
html[data-theme="light"] .ps-tip{background:rgba(255,255,255,.97);border-color:rgba(17,0,25,.12);box-shadow:0 18px 40px -18px rgba(40,20,80,.45)}
html[data-theme="light"] .ps-tip b{color:var(--ink)}
html[data-theme="light"] .sg-c{background:linear-gradient(180deg,#fff,rgba(255,255,255,.8));border-color:rgba(17,0,25,.08);box-shadow:0 30px 60px -32px rgba(40,20,80,.4),inset 0 1px 0 #fff}
html[data-theme="light"] .sg-c::before{box-shadow:0 0 12px 0 var(--c)}
html[data-theme="light"] .sg-c .nm{color:var(--ink)}
html[data-theme="light"] .sg-c .pt,html[data-theme="light"] .sg-odds .side span,html[data-theme="light"] .sg-odds .cap{color:#6b6384}
html[data-theme="light"] .sg-c .pc{text-shadow:none}
html[data-theme="light"] .sg-c .vt{color:#4a4360}
html[data-theme="light"] .sg-seg i{background:rgba(17,0,25,.08)}
html[data-theme="light"] .sg-seg i.on{box-shadow:none}
html[data-theme="light"] .sg-odds .cap b{color:var(--ink)}
`;

function Wing({ c, side }: { c: StageCand; side: "a" | "b" }) {
  const on = Math.round(c.pct / 5);
  return (
    <div className={`sg-c ${side}`} style={{ "--c": c.color } as React.CSSProperties}>
      <div className="sg-av" aria-hidden="true">{initials(c.name)}</div>
      <div className="nm">{c.name}</div>
      <div className="pt">{c.label}</div>
      <div className="pc">{c.pct.toFixed(1)}%</div>
      <div className="vt">{c.votes ? `${c.votes.toLocaleString("en-US")} projected votes` : "projected share"}</div>
      <div className="sg-seg" aria-hidden="true">{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < on ? "on" : ""} style={i < on ? { animationDelay: `${0.6 + i * 0.04}s` } : undefined} />)}</div>
    </div>
  );
}

export default function StageHero({ eyebrow, title, lede, pills, cands, paths, fills, labels, win, lead, other, mapLabel, focus }: {
  eyebrow: string; title: React.ReactNode; lede: React.ReactNode; pills: React.ReactNode;
  cands: StageCand[]; paths: { id: string; d: string }[]; fills: Record<string, string>; labels?: Record<string, StageLabel>;
  win: number | null; lead: { name: string; color: string }; other: { name: string; color: string }; mapLabel: string; focus?: string;
}) {
  const n = win == null ? 0 : Math.round(win * 100);
  const verdict = win == null ? "" : `${lead.name} ${win >= 0.95 ? "all but certain" : win >= 0.85 ? "very likely" : win >= 0.65 ? "favored" : "slightly favored"}`;
  return (
    <header className="sg" aria-label="Race overview">
      <style>{STAGE_CSS}</style>
      <Pointy className="cam-sg" pose="wave" prop="clipboard" size={96} look={-1} flip />
      <div className="sg-top">
        <span className="sg-marq"><span className="sg-bulbs" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} />)}</span>{eyebrow}<span className="sg-bulbs" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} />)}</span></span>
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        <div className="sg-pills">{pills}</div>
      </div>
      <div className="sg-stage">
        <span className="sg-lamp" aria-hidden="true" />
        {paths.length ? <PixelStage paths={paths} fills={fills} labels={labels} label={mapLabel} beam="#dcd0ff" focus={focus} /> : null}
        <div className="sg-wings">
          {cands[0] ? <Wing c={cands[0]} side="a" /> : null}
          {cands[1] ? <Wing c={cands[1]} side="b" /> : null}
        </div>
      </div>
      {win != null ? (
        <div className="sg-odds" aria-label={`${lead.name} wins ${n} of 100 simulated elections`}>
          <div className="side"><b style={{ color: lead.color }}>{n}%</b><span>{lead.name}</span></div>
          <div className="sg-grid" aria-hidden="true">
            {Array.from({ length: 100 }, (_, i) => <i key={i} style={{ "--c": i < n ? lead.color : other.color, animationDelay: `${0.9 + (i % 25) * 0.025 + Math.floor(i / 25) * 0.05}s`, opacity: i < n ? 1 : 0.55 } as React.CSSProperties} />)}
          </div>
          <div className="side r"><b style={{ color: other.color }}>{100 - n}%</b><span>{other.name}</span></div>
          <div className="cap"><b>{verdict}</b>Each square is one simulated election night, {lead.name} wins about {n} of 100</div>
        </div>
      ) : null}
    </header>
  );
}
