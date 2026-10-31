// The race page layout pieces, shared by the race, statewide office, ballot measure and legislature pages.
export const FX_CSS = `
.rx-play{display:grid;grid-template-columns:auto repeat(3,minmax(0,1fr));gap:10px;align-items:stretch;margin-top:14px;padding:12px;border-radius:18px;border:1px solid rgba(231,179,65,.35);background:radial-gradient(80% 140% at 0% 0%,rgba(231,179,65,.10),transparent 60%),var(--glass)}
.rx-ph{display:grid;align-content:center;gap:2px;padding:0 8px}
.rx-ph .eye{font:800 10px var(--font-m);letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}
.rx-ph b{font:800 15px var(--font-d);letter-spacing:-.01em}
.rx-pl{display:grid;gap:3px;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:rgba(var(--line-rgb),.03);transition:border-color .2s,transform .2s}
.rx-pl:hover{border-color:var(--gold);transform:translateY(-2px)}
.rx-pl b{font:800 14px var(--font-d)}
.rx-pl span{font-size:12.5px;color:var(--mute);line-height:1.4}
@media (max-width:900px){.rx-play{grid-template-columns:1fr}}
.opp.fx{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.opp.fx > .crumbs,.opp.fx > header{margin-bottom:0}
.fx-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:900px){.fx-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
.fx-k{padding:14px 16px;display:grid;gap:4px;align-content:start}
.fx-k span{font:700 10.5px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.fx-k b{font:800 26px/1.1 var(--font-d);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.fx-k small{font-size:12.5px;color:var(--ink2)}
.fx-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:stretch}
.fx-grid2 > .card{margin:0}
@media (max-width:960px){.fx-grid2{grid-template-columns:1fr}}
.fx-house .cmap{max-height:min(78vh,860px)}
`;
