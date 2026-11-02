// The race opener for Pro Dark and Pro Light: a compact title block, then one panel that compares the candidates
// (chance of winning, projected share, projected votes) over a single probability bar. StageHero renders it next to
// the Theme stage from the same props, and CSS on <html data-mode> shows one or the other before first paint.
import React from "react";
import Link from "@/app/components/Link";

export type ProCand = { name: string; label: string; pct: number; votes: number; color: string; chance: number | null };

export const PRO_HERO_CSS = `
:root[data-mode="themed"] .ph{display:none}
:root:not([data-mode="themed"]) header.sg{display:none}
.ph{--ph-acc:#a58bff;--ph-acc2:#7c5cff;display:grid;gap:16px;margin:10px 0 4px;color:var(--ink)}
html[data-theme="light"] .ph{--ph-acc:#6a3fd0;--ph-acc2:#7c4dff}
.ph-head{display:grid;gap:8px;max-width:1040px}
.ph-kick{display:flex;align-items:center;gap:10px;font:700 11px/1.3 var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.ph-kick::before{content:"";flex:none;width:20px;height:3px;border-radius:2px;background:linear-gradient(90deg,var(--ph-acc2),var(--ph-acc))}
.ph h1{font:800 clamp(25px,2.3vw,36px)/1.14 var(--font-d);letter-spacing:-.025em;margin:0;color:var(--hi);text-wrap:balance}
.ph h1 .nm{color:inherit!important;text-shadow:none}
.ph h1 .ph-w{background:none;-webkit-text-fill-color:currentColor;color:var(--ph-acc);font-style:normal;padding:0;margin:0}
.ph-dek{margin:0;max-width:78ch;font-size:15.5px;line-height:1.5;color:var(--ink2)}
.ph-dek b{color:var(--ink)!important}
.ph-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:4px}
.ph-meta>span{font:600 12.5px/1.2 var(--font-b);color:var(--ink2);border:1px solid var(--line);border-radius:6px;padding:5px 9px}
.ph-meta>span b{color:var(--ink);font-weight:700}
.ph-meta>.pill{border:0;border-radius:6px;padding:6px 9px;font-size:11px}
.ph-board{border:1px solid var(--line);border-radius:14px;background:var(--panel);box-shadow:0 1px 0 rgba(var(--line-rgb),.04),0 18px 40px -32px rgba(0,0,0,.6)}
html[data-theme="light"] .ph-board{background:#fff;box-shadow:0 1px 2px rgba(17,0,25,.05),0 14px 32px -28px rgba(40,20,80,.35)}
.ph-cands{display:grid;grid-template-columns:repeat(var(--n,2),minmax(0,1fr))}
.ph-c{--t:var(--c);display:grid;gap:12px;align-content:start;padding:18px 22px 16px;min-width:0;border-top:3px solid var(--c);position:relative}
.ph-c:first-child{border-top-left-radius:13px}.ph-c:last-child{border-top-right-radius:13px}
.ph-c+.ph-c{border-left:1px solid var(--line)}
html[data-theme="light"] .ph-c{--t:color-mix(in srgb,var(--c) 74%,#000)}
.ph-id{display:grid;gap:2px;min-width:0}
.ph-name{font:750 20px/1.2 var(--font-d);letter-spacing:-.015em;color:var(--hi);overflow-wrap:anywhere}
.ph-party{font:700 10.5px/1.3 var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.ph-stats{display:grid;grid-template-columns:auto auto 1fr;gap:6px 26px;align-items:end}
.ph-st{display:grid;gap:3px;min-width:0}
.ph-st>span{font:700 10px/1.25 var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.ph-st b{font:800 22px/1 var(--font-d);letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ink)}
.ph-win b{font-size:40px;letter-spacing:-.035em;color:var(--t)}
.ph-votes{font:600 13px/1.3 var(--font-m);font-variant-numeric:tabular-nums;color:var(--ink2)}
.ph-c.r{text-align:right}
.ph-c.r .ph-stats{justify-content:end;grid-template-columns:1fr auto auto}
.ph-c.r .ph-stats .ph-win{order:3}.ph-c.r .ph-stats .ph-pct{order:2}.ph-c.r .ph-stats .ph-vt{order:1}
.ph-prob{padding:2px 22px 16px;display:grid;gap:8px}
.ph-track{position:relative;display:flex;height:10px;border-radius:5px;overflow:hidden;background:rgba(var(--line-rgb),.1)}
.ph-seg{height:100%;background:var(--c)}
.ph-seg+.ph-seg{box-shadow:inset 2px 0 0 var(--panel)}
html[data-theme="light"] .ph-seg+.ph-seg{box-shadow:inset 2px 0 0 #fff}
.ph-mid{position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;margin-left:-1px;background:var(--hi);opacity:.55}
.ph-cap{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 16px;font-size:13px;color:var(--ink2)}
.ph-cap b{color:var(--ink)}
.ph-links{display:flex;flex-wrap:wrap;gap:6px 16px}
.ph-links a{font:700 12.5px var(--font-b);color:var(--ph-acc);text-decoration:none;border-bottom:1px solid transparent}
.ph-links a:hover,.ph-links a:focus-visible{border-bottom-color:currentColor}
.ph-links a::after{content:" \\2192"}
@media (max-width:1100px){.ph-stats,.ph-c.r .ph-stats{grid-template-columns:auto auto;gap:10px 22px}.ph-c.r .ph-stats{justify-content:end}.ph-vt{grid-column:1/-1}}
@media (max-width:640px){
  .ph{gap:12px;margin-top:4px}
  .ph h1{font-size:23px}
  .ph-dek{font-size:14.5px}
  .ph-c{padding:14px 12px 12px;gap:10px}
  .ph-name{font-size:16.5px}
  .ph-stats,.ph-c.r .ph-stats{grid-template-columns:1fr;gap:8px}
  .ph-c.r .ph-stats>*{order:0}
  .ph-win b{font-size:32px}
  .ph-st b{font-size:19px}
  .ph-votes{font-size:12px}
  .ph-prob{padding:2px 12px 12px}
}
@media (max-width:359px){.ph-cands{grid-template-columns:1fr}.ph-c+.ph-c{border-left:0;border-top:3px solid var(--c)}.ph-c.r{text-align:left}}
`;

export default function ProHero({ eyebrow, title, lede, pills, cands, verdict, probLabel, links }: {
  eyebrow: string; title: React.ReactNode; lede: React.ReactNode; pills: React.ReactNode; cands: ProCand[];
  verdict: string; probLabel: string; links: { label: string; href: string }[];
}) {
  const withBar = cands.length === 2 && cands.every((c) => c.chance != null);
  return (
    <section className="ph" aria-label="Race overview">
      <div className="ph-head">
        <div className="ph-kick">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="ph-dek">{lede}</p>
        <div className="ph-meta">{pills}</div>
      </div>
      {cands.length ? (
        <div className="ph-board">
          <div className="ph-cands" style={{ "--n": cands.length } as React.CSSProperties}>
            {cands.map((c, i) => (
              <div key={c.name} className={`ph-c${i === 1 ? " r" : ""}`} style={{ "--c": c.color } as React.CSSProperties}>
                <div className="ph-id"><span className="ph-name">{c.name}</span><span className="ph-party">{c.label}</span></div>
                <div className="ph-stats">
                  {c.chance != null ? <div className="ph-st ph-win"><span>{probLabel}</span><b>{c.chance}%</b></div> : null}
                  <div className="ph-st ph-pct"><span>{c.votes ? "Projected vote" : "Projected share"}</span><b>{c.pct.toFixed(1)}%</b></div>
                  {c.votes ? <div className="ph-st ph-vt"><span>Projected votes</span><div className="ph-votes">{c.votes.toLocaleString("en-US")}</div></div> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="ph-prob">
            {withBar ? (
              <div className="ph-track" role="img" aria-label={cands.map((c) => `${c.name} ${c.chance}%`).join(", ")}>
                {cands.map((c) => <i key={c.name} className="ph-seg" style={{ width: `${c.chance}%`, "--c": c.color } as React.CSSProperties} />)}
                <span className="ph-mid" aria-hidden="true" />
              </div>
            ) : null}
            <div className="ph-cap">
              {verdict ? <span><b>{verdict}</b></span> : <span />}
              <nav className="ph-links" aria-label="More on this forecast">{links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}</nav>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
