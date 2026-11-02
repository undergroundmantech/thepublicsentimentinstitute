// The race opener for Pro Dark and Pro Light: a compact title block, then one board with the forecast facts, the
// candidates (or parties, or Yes and No) and a single probability bar. StageHero renders it next to the Theme stage
// from the same props, and CSS on <html data-mode> shows exactly one of the two before first paint.
// Chances come only from the explicit outcomes passed in, matched to candidates by key. A candidate with no outcome
// shows no chance, and the bar is drawn only for a verified distribution (every outcome, summing to 100 percent).
import React from "react";
import Link from "@/app/components/Link";
import { fmtChance, isDistribution, leaders, verdictFor, type HeroCand, type Outcome } from "./heroOdds";

export type ProCand = HeroCand;
export type ProFact = { k: string; v: React.ReactNode };

export const PRO_HERO_CSS = `
:root[data-mode="themed"] .prh{display:none}
:root:not([data-mode="themed"]) header.sg{display:none}
.prh{--prh-acc:#a58bff;--prh-bd:var(--line2);display:grid;gap:14px;margin:8px 0 6px;color:var(--ink)}
html[data-theme="light"] .prh{--prh-acc:#5b2fc4;--prh-bd:rgba(17,0,25,.14)}
.prh-head{display:grid;gap:8px;max-width:1040px}
.prh-kick{display:flex;align-items:center;gap:10px;font:700 11px/1.3 var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.prh-kick::before{content:"";flex:none;width:18px;height:3px;border-radius:2px;background:var(--prh-acc)}
.prh h1{font:800 clamp(24px,2.2vw,34px)/1.15 var(--font-d);letter-spacing:-.022em;margin:0;color:var(--hi);text-wrap:balance}
.prh h1 .nm{color:inherit!important;text-shadow:none}
.prh h1 .ph-w{background:none;-webkit-text-fill-color:currentColor;color:var(--prh-acc);font-style:normal;padding:0;margin:0}
.prh-dek{margin:0;max-width:80ch;font-size:15.5px;line-height:1.5;color:var(--ink2)}
.prh-dek b{color:var(--ink)!important}
.prh-board{border:1px solid var(--prh-bd);border-radius:12px;background:var(--panel);overflow:hidden}
html[data-theme="light"] .prh-board{background:#fff;box-shadow:0 1px 2px rgba(17,0,25,.05)}
.prh-facts{display:flex;flex-wrap:wrap;gap:10px 30px;margin:0;padding:12px 20px;border-bottom:1px solid var(--prh-bd)}
.prh-fact{display:grid;gap:3px;min-width:0}
.prh-fact dt{font:700 10px/1.25 var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.prh-fact dd{margin:0;font:650 14px/1.3 var(--font-b);color:var(--ink);font-variant-numeric:tabular-nums}
.prh-fact dd .mono{font-family:var(--font-m)}
.prh-fact dd .pill{display:inline-block;border:0;border-radius:6px;padding:3px 8px;font-size:11px}
.prh-cands{display:grid;grid-template-columns:repeat(var(--n,2),minmax(0,1fr))}
.prh-c{--t:var(--c);display:grid;gap:12px;align-content:start;padding:16px 20px;min-width:0;box-shadow:inset 0 3px 0 var(--c)}
.prh-c+.prh-c{border-left:1px solid var(--prh-bd)}
html[data-theme="light"] .prh-c{--t:color-mix(in srgb,var(--c) 72%,#000)}
.prh-id{display:grid;gap:2px;min-width:0}
.prh-name{font:750 19px/1.2 var(--font-d);letter-spacing:-.015em;color:var(--hi);overflow-wrap:anywhere}
.prh-party{font:700 10.5px/1.3 var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.prh-stats{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 26px;margin:0}
.prh-st{display:grid;gap:3px;min-width:0}
.prh-st dt{font:700 10px/1.25 var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.prh-st dd{margin:0;font:800 21px/1 var(--font-d);letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ink)}
.prh-st dd small{font:600 12px var(--font-b);letter-spacing:0;color:var(--mute);margin-left:4px}
.prh-win dd{font-size:38px;letter-spacing:-.035em;color:var(--t)}
.prh-vt dd{font:600 14px/1.3 var(--font-m);letter-spacing:0;color:var(--ink2)}
.prh-c.r{text-align:right}
.prh-c.r .prh-stats{flex-direction:row-reverse}
.prh-others{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 22px;padding:10px 20px;border-top:1px solid var(--prh-bd);font-size:13px;color:var(--ink2)}
.prh-others>span:first-child{font:700 10px/1.3 var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.prh-others b{color:var(--ink);font-weight:700}
.prh-others .mono{font-family:var(--font-m);font-variant-numeric:tabular-nums}
.prh-prob{display:grid;gap:10px;padding:14px 20px 16px;border-top:1px solid var(--prh-bd)}
.prh-track{position:relative;display:flex;height:10px;border-radius:5px;overflow:hidden;background:rgba(var(--line-rgb),.1)}
.prh-seg{height:100%;background:var(--c)}
.prh-seg+.prh-seg{box-shadow:inset 2px 0 0 var(--bg)}
html[data-theme="light"] .prh-seg+.prh-seg{box-shadow:inset 2px 0 0 #fff}
.prh-mid{position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--hi);opacity:.5}
.prh-legend{display:flex;flex-wrap:wrap;gap:4px 18px;margin:0;padding:0;list-style:none;font:600 12.5px/1.3 var(--font-b);color:var(--ink2)}
.prh-legend li{display:flex;align-items:center;gap:7px}
.prh-legend i{width:10px;height:10px;border-radius:2px;background:var(--c)}
.prh-legend b{font-family:var(--font-m);font-variant-numeric:tabular-nums;color:var(--ink)}
.prh-scope{margin:0;font-size:12.5px;line-height:1.45;color:var(--mute)}
.prh-cap{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 16px;font-size:13.5px;color:var(--ink2)}
.prh-cap b{color:var(--ink)}
.prh-links{display:flex;flex-wrap:wrap;gap:6px 18px}
.prh-links a{font:700 13px var(--font-b);color:var(--prh-acc);text-decoration:none;border-bottom:1px solid transparent}
.prh-links a:hover,.prh-links a:focus-visible{border-bottom-color:currentColor}
.prh-links a::after{content:" \\2192"}
@media (max-width:640px){
  .prh{gap:12px;margin-top:4px}
  .prh h1{font-size:23px}
  .prh-dek{font-size:14.5px}
  .prh-facts{gap:10px 20px;padding:12px}
  .prh-c{padding:14px 12px;gap:10px}
  .prh-name{font-size:16.5px}
  .prh-stats,.prh-c.r .prh-stats{flex-direction:column;align-items:stretch;gap:8px}
  .prh-win dd{font-size:31px}
  .prh-st dd{font-size:18px}
  .prh-vt dd{font-size:12.5px}
  .prh-others,.prh-prob{padding-left:12px;padding-right:12px}
}
@media (max-width:359px){.prh-cands{grid-template-columns:1fr}.prh-c+.prh-c{border-left:0;border-top:1px solid var(--prh-bd)}.prh-c.r{text-align:left}}
`;

const pctText = (n: number) => `${n.toFixed(1)}%`;

export default function ProHero({ eyebrow, title, lede, facts, cands, others = [], odds, probLabel, links, note }: {
  eyebrow: string; title: React.ReactNode; lede: React.ReactNode; facts: ProFact[];
  cands: ProCand[]; others?: ProCand[]; odds: Outcome[] | null; probLabel: string;
  links: { label: string; href: string }[]; note?: string;
}) {
  const dist = isDistribution(odds) ? odds : null;
  const chanceOf = (key?: string) => (dist && key ? dist.find((o) => o.key === key)?.p ?? null : null);
  const shown = new Set(cands.map((c) => c.key).filter(Boolean));
  // the legend lists the bar's outcomes when one of them (a tied chamber) has no card of its own
  const legend = dist && dist.some((o) => !shown.has(o.key));
  const verdict = dist ? verdictFor(leaders(dist).lead) : note ?? "";
  return (
    <section className="prh" aria-label="Race overview">
      <div className="prh-head">
        <div className="prh-kick">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="prh-dek">{lede}</p>
      </div>
      <div className="prh-board">
        {facts.length ? (
          <dl className="prh-facts">{facts.map((f) => <div key={f.k} className="prh-fact"><dt>{f.k}</dt><dd>{f.v}</dd></div>)}</dl>
        ) : null}
        {cands.length ? (
          <div className="prh-cands" style={{ "--n": cands.length } as React.CSSProperties}>
            {cands.map((c, i) => {
              const ch = chanceOf(c.key);
              return (
                <div key={c.key ?? c.name} className={`prh-c${cands.length === 2 && i === 1 ? " r" : ""}`} data-key={c.key} style={{ "--c": c.color } as React.CSSProperties}>
                  <div className="prh-id"><span className="prh-name">{c.name}</span><span className="prh-party">{c.label}</span></div>
                  <dl className="prh-stats">
                    {ch != null ? <div className="prh-st prh-win"><dt>{probLabel}</dt><dd data-p={ch}>{fmtChance(ch)}</dd></div> : null}
                    {c.seats != null ? <div className="prh-st prh-seats"><dt>Expected seats</dt><dd>{c.seats.toFixed(1)}{c.seatsOf ? <small>of {c.seatsOf}</small> : null}</dd></div> : null}
                    {c.pct != null ? <div className="prh-st prh-pct"><dt>{c.share === "seat" ? "Projected seat share" : "Projected vote share"}</dt><dd>{pctText(c.pct)}</dd></div> : null}
                    {c.votes ? <div className="prh-st prh-vt"><dt>Projected votes</dt><dd>{c.votes.toLocaleString("en-US")}</dd></div> : null}
                  </dl>
                </div>
              );
            })}
          </div>
        ) : null}
        {others.length ? (
          <div className="prh-others">
            <span>Also on the ballot, no modeled win chance</span>
            {others.map((o) => (
              <span key={o.name} className="prh-o"><b>{o.name}</b> {o.label}{o.pct != null ? <> · <span className="mono">{pctText(o.pct)}</span></> : null}{o.votes ? <> · <span className="mono">{o.votes.toLocaleString("en-US")}</span> votes</> : null}</span>
            ))}
          </div>
        ) : null}
        <div className="prh-prob">
          {dist ? (
            <div className="prh-track" role="img" aria-label={dist.map((o) => `${o.name} ${fmtChance(o.p)}`).join(", ")}>
              {dist.map((o) => <i key={o.key} className="prh-seg" data-key={o.key} style={{ width: `${o.p * 100}%`, "--c": o.color } as React.CSSProperties} />)}
              <span className="prh-mid" aria-hidden="true" />
            </div>
          ) : null}
          {legend ? (
            <ul className="prh-legend">{dist!.map((o) => <li key={o.key} style={{ "--c": o.color } as React.CSSProperties}><i aria-hidden="true" />{o.name} <b>{fmtChance(o.p)}</b></li>)}</ul>
          ) : null}
          {dist && others.length && !dist.some((o) => o.tie) ? (
            <p className="prh-scope">Win chances are from the model&apos;s head-to-head simulation of {dist.map((o) => o.name).join(" and ")}. Other candidates have a projected share but no simulated chance.</p>
          ) : null}
          <div className="prh-cap">
            {verdict ? <span><b>{verdict}</b></span> : <span />}
            <nav className="prh-links" aria-label="More on this forecast">{links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}</nav>
          </div>
        </div>
      </div>
    </section>
  );
}
