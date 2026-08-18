/**
 * Styles for the internal desk. Surface, ink and signal tokens come from
 * globals.css so this flips with the site's data-theme; the candidate lane
 * (--k1..--k5) and the map ramp are declared here to the same values the public
 * board uses, so a candidate is the same colour in both places.
 */

export const PORTAL_CSS = `
.pd{
  --k1:#B23A2E; --k2:#1E6E86; --k3:#6D4B96; --k4:#A87516; --k5:#8A929C;
  --map-stroke:rgba(10,10,10,.14); --map-blank:#dcdcd2; --ramp-lo:rgb(237,237,231);
  --mono:var(--font-numeric,'JetBrains Mono'),ui-monospace,monospace;
  --sans:var(--font-body,'Geist'),system-ui,sans-serif;
  --r-panel:14px; --r-card:10px;
  min-height:100vh;background:var(--canvas);color:var(--ink);
  font-family:var(--sans);-webkit-font-smoothing:antialiased;
}
html[data-theme="dark"] .pd{
  --k3:#8a63ef; --k4:#e8b93c;
  --map-stroke:rgba(255,255,255,.10); --map-blank:#2e2e36; --ramp-lo:rgb(30,30,36);
}
.pd *{margin:0;padding:0;box-sizing:border-box}
.pd h1,.pd h2{font-weight:800;letter-spacing:-.028em}
.pd .num,.pd b{font-variant-numeric:tabular-nums}
.pd .good{color:var(--k2)}
.pd .bad{color:var(--k1)}

.pd-shell{max-width:1240px;margin:0 auto;padding:26px 22px 70px}

/* header */
.pd-top{display:flex;justify-content:space-between;align-items:flex-start;gap:28px;
  flex-wrap:wrap;padding-bottom:20px;border-bottom:1px solid var(--hairline)}
.pd-badge{display:inline-block;font-family:var(--mono);font-size:9px;font-weight:700;
  letter-spacing:.13em;text-transform:uppercase;color:var(--gold);
  border:1px solid var(--gold);border-radius:999px;padding:4px 10px}
.pd-top h1{font-size:clamp(22px,2.6vw,31px);line-height:1.12;margin-top:12px}
.pd-top h1 em{font-style:normal;color:var(--k2)}
.pd-deck{font-size:13.5px;color:var(--ink2);max-width:560px;margin-top:9px;line-height:1.6}
.pd-top-right{display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.pd-stamp{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:10px;
  letter-spacing:.09em;text-transform:uppercase;color:var(--ink3)}
.pd-stamp b{color:var(--ink);font-size:12px}
.pd-stamp em{font-style:normal;color:var(--gold)}
.pd-dot{width:7px;height:7px;border-radius:50%;background:var(--live);animation:pd-pulse 1.7s infinite}
@keyframes pd-pulse{50%{opacity:.3}}
.pd-top-links{display:flex;gap:8px}
.pd-top-links a,.pd-top-links button{font-family:var(--mono);font-size:9px;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;color:var(--ink2);background:var(--panel);
  border:1px solid var(--hairline2);border-radius:999px;padding:6px 13px;cursor:pointer;
  text-decoration:none}
.pd-top-links a:hover,.pd-top-links button:hover{color:var(--ink);border-color:var(--ink3)}

/* bento */
.pd-bento{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:20px}
.pd-grade{grid-column:span 2}
.pd-path{grid-column:span 2}
.pd-topline{grid-column:span 2}
.pd-turnout{grid-column:span 2}
.pd-mech{grid-column:span 4}
@media (max-width:900px){
  .pd-bento{grid-template-columns:1fr}
  .pd-grade,.pd-path,.pd-topline,.pd-turnout,.pd-mech{grid-column:span 1}
}

.pd-tile{background:var(--panel);border:1px solid var(--hairline);border-radius:var(--r-panel);
  padding:16px 18px 18px;display:flex;flex-direction:column}
.pd-tile-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.13em;
  text-transform:uppercase;color:var(--ink3);padding-bottom:12px;
  border-bottom:1px solid var(--hairline)}
.pd-tile-head small{font-family:var(--mono);font-size:9px;letter-spacing:.08em;color:var(--ink3)}
.pd-note{font-size:11.5px;line-height:1.55;color:var(--ink3);margin-top:auto;padding-top:12px}

/* grade */
.pd-grade.good{border-color:color-mix(in srgb,var(--k2) 45%,var(--hairline))}
.pd-grade.bad{border-color:color-mix(in srgb,var(--k1) 45%,var(--hairline))}
.pd-grade-body{display:flex;align-items:center;gap:18px;padding:18px 0 14px}
.pd-grade-letter{font-family:var(--mono);font-size:54px;font-weight:700;line-height:1;
  letter-spacing:-.04em;width:82px;height:82px;flex:0 0 auto;display:grid;place-items:center;
  border-radius:var(--r-card);background:var(--panel2);border:1px solid var(--hairline)}
.pd-grade.good .pd-grade-letter{color:var(--k2)}
.pd-grade.bad .pd-grade-letter{color:var(--k1)}
.pd-grade-body strong{display:block;font-size:17px;letter-spacing:-.02em}
.pd-grade-body p{font-size:12.5px;color:var(--ink2);margin-top:6px;line-height:1.55}
.pd-grade-foot{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:auto;
  padding-top:14px;border-top:1px solid var(--hairline)}
.pd-grade-foot span,.pd-path-grid span,.pd-turnout-grid span{display:block;font-family:var(--mono);
  font-size:8.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.pd-grade-foot b,.pd-turnout-grid b{font-family:var(--mono);font-size:18px;margin-top:3px;display:block}
.pd-grade-empty{padding:20px 0}
.pd-grade-empty b{font-family:var(--mono);font-size:44px;color:var(--ink3);line-height:1}
.pd-grade-empty p{font-size:12.5px;color:var(--ink2);margin-top:10px;line-height:1.6;max-width:440px}

/* path */
.pd-path-lead{padding:16px 0 12px}
.pd-path-lead b{font-family:var(--mono);font-size:38px;font-weight:700;letter-spacing:-.03em;
  line-height:1;display:block}
.pd-path-lead small{font-family:var(--mono);font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink3);margin-top:6px;display:block}
.pd-path-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;padding-top:14px;
  border-top:1px solid var(--hairline)}
.pd-path-grid b{font-family:var(--mono);font-size:16px;margin-top:3px;display:block}
.pd-path-grid .good b{color:var(--k2)}
.pd-path-grid .bad b{color:var(--k1)}

/* topline */
.pd-cand{padding:9px 0}
.pd-cand-row{display:grid;grid-template-columns:10px 1fr auto auto;align-items:center;gap:9px;
  font-size:13px}
.pd-cand-row i{width:10px;height:10px;border-radius:2px}
.pd-cand-row b{font-family:var(--mono);font-size:14px}
.pd-cand-row small{font-family:var(--mono);font-size:10px;color:var(--ink3);min-width:64px;
  text-align:right}
.pd-cand.is-target .pd-cand-row span{font-weight:700}
.pd-cand-track{position:relative;height:7px;border-radius:99px;background:var(--panel3);
  margin-top:7px;overflow:hidden}
.pd-cand-track>span{display:block;height:100%}
.pd-cand-exp{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--ink3);opacity:.65}

/* turnout */
.pd-turnout-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px 0 4px}

/* vote mechanics */
.pd-mech-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:16px 0 4px}
@media (max-width:820px){.pd-mech-grid{grid-template-columns:1fr 1fr}}
.pd-mech-grid span{display:block;font-family:var(--mono);font-size:8.5px;font-weight:700;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.pd-mech-grid b{font-family:var(--mono);font-size:17px;margin-top:4px;display:block}

/* panels */
.pd-panel{background:var(--panel);border:1px solid var(--hairline);border-radius:var(--r-panel);
  padding:18px;margin-top:14px}
.pd-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;
  flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--hairline)}
.pd-panel-head h2{font-size:17px}
.pd-panel-head p{font-size:12.5px;color:var(--ink2);margin-top:6px;max-width:640px;line-height:1.6}
.pd-toggles{display:flex;gap:2px;padding:3px;border-radius:999px;background:var(--panel2);
  border:1px solid var(--hairline)}
.pd-toggles button{font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);background:none;border:none;border-radius:999px;
  padding:6px 14px;cursor:pointer}
.pd-toggles button.on{background:var(--panel);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.08)}
.pd-toggles button:disabled{opacity:.4;cursor:not-allowed}

/* map */
.pd-map-wrap{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(240px,1fr);gap:18px;
  margin-top:16px}
@media (max-width:860px){.pd-map-wrap{grid-template-columns:1fr}}
.gm svg{width:100%;height:auto;display:block;background:var(--panel2);
  border:1px solid var(--hairline);border-radius:var(--r-card)}
.gm path{stroke:var(--map-stroke);stroke-width:.8;transition:opacity .12s ease}
.gm path.on{stroke:var(--ink);stroke-width:1.6}
.gm-readout{margin-top:12px;padding:12px 14px;background:var(--panel2);
  border:1px solid var(--hairline);border-radius:var(--r-card);min-height:86px}
.pd .gm-readout-head strong{font-size:14px}
.pd .gm-readout-head small{font-family:var(--mono);font-size:10px;color:var(--ink3);margin-left:8px}
.gm-readout-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:10px}
.gm-readout-grid span{display:block;font-family:var(--mono);font-size:8.5px;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.gm-readout-grid b{font-family:var(--mono);font-size:14px;margin-top:2px;display:block}
@media (max-width:600px){.gm-readout-grid{grid-template-columns:1fr 1fr}}
.gm-hint{font-size:12px;color:var(--ink3);line-height:1.55}
.gm-legend{display:grid;grid-template-columns:1fr;gap:5px;margin-top:10px;
  font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink3)}
.gm-ramp{height:7px;border-radius:99px;
  background:linear-gradient(90deg,#B23A2E,var(--ramp-lo) 50%,#1E6E86)}
.gm-legend-lo{justify-self:start}
.gm-legend-hi{justify-self:end;margin-top:-16px}

.pd-chances{display:flex;flex-direction:column}
.pd-chances-head{display:flex;justify-content:space-between;align-items:baseline;
  padding-bottom:9px;border-bottom:1px solid var(--hairline)}
.pd-chances-head strong{font-size:13px}
.pd-chances-head small{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink3)}
.pd-chance{display:flex;justify-content:space-between;align-items:center;gap:12px;
  padding:10px 0;border-bottom:1px solid var(--hairline)}
.pd-chance strong{display:block;font-size:13px;font-weight:600}
.pd-chance small{font-family:var(--mono);font-size:10px;color:var(--ink3)}
.pd-chance b{font-family:var(--mono);font-size:14px}

/* county bento */
.pd-county-bento{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}
@media (max-width:1080px){.pd-county-bento{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.pd-county-bento{grid-template-columns:1fr}}
.pd-cc{background:var(--panel2);border:1px solid var(--hairline);border-radius:var(--r-card);
  padding:13px 14px 14px;display:flex;flex-direction:column;gap:11px}
.pd-cc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.pd-cc-head strong{display:block;font-size:14px;letter-spacing:-.01em}
.pd-cc-head small{font-family:var(--mono);font-size:9px;color:var(--ink3)}
.pd-cc-rep{font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);white-space:nowrap}
.pd-cc-stack{display:flex;height:5px;border-radius:99px;overflow:hidden;background:var(--panel3)}
.pd-cc-stack span{display:block;height:100%}
.pd-cc-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.pd-cc-grid span{display:block;font-family:var(--mono);font-size:8px;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.pd-cc-grid b{font-family:var(--mono);font-size:14px;margin-top:2px;display:block}
.pd-cc-verdict{font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;color:var(--ink3);
  padding-top:10px;border-top:1px solid var(--hairline)}
.pd-cc-verdict.good{color:var(--k2)}
.pd-cc-verdict.bad{color:var(--k1)}

/* table */
.pd-search{font-family:var(--mono);font-size:11px;color:var(--ink);background:var(--panel2);
  border:1px solid var(--hairline);border-radius:999px;padding:7px 14px;min-width:180px}
.pd-search::placeholder{color:var(--ink3)}
.pd-tablewrap{max-height:560px;overflow:auto;border:1px solid var(--hairline);
  border-radius:var(--r-card);margin-top:16px}
.pd-table{width:100%;border-collapse:collapse;font-size:12.5px}
.pd-table th{position:sticky;top:0;z-index:1;background:var(--panel2);text-align:left;
  padding:10px 12px;font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink3);border-bottom:1px solid var(--hairline);
  white-space:nowrap}
.pd-table th:not(:first-child){text-align:right}
.pd-table td{padding:9px 12px;border-bottom:1px solid var(--hairline)}
.pd-table td.num{font-family:var(--mono);text-align:right;font-variant-numeric:tabular-nums}
.pd-table tbody tr:hover td{background:var(--panel2)}
.pd-table td strong{display:block;font-size:13px;font-weight:600}
.pd-table td small{font-family:var(--mono);font-size:9.5px;color:var(--ink3)}
.pd-empty{text-align:center;color:var(--ink3);padding:22px 0}

.pd-foot{font-size:11.5px;line-height:1.65;color:var(--ink3);max-width:900px;margin-top:18px}
`;
