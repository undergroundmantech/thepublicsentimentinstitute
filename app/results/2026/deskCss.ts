// The election night desk styles from the August boards, shared by every November 3 race desk and the monitor.
// Copied from the Oklahoma runoff board so the November desks read as the same publication.
export const DESK_CSS = `
.desk{
  /* Candidate lane. Two names here, but the k3–k5 slots stay defined so the
     shared component CSS below doesn't reference a missing variable. */
  --k1:#B23A2E; --k2:#1E6E86; --k3:#6D4B96; --k4:#A87516; --k5:#8A929C;
  --map-stroke:rgba(var(--canvas-rgb),.14); --map-stroke-hi:rgba(var(--canvas-rgb),.55);
  --map-hatch:rgba(var(--canvas-rgb),.22); --map-blank:#dcdcd2;
  --ramp-mid:rgb(232,232,226); --ramp-lo:rgb(237,237,231);
  --tip-shadow:0 10px 30px rgba(var(--ink-rgb),calc(0.16 * var(--struct)));
  --mono:var(--font-numeric,'JetBrains Mono'),ui-monospace,monospace;
  --sans:var(--font-body,'Geist'),system-ui,sans-serif;
  --r-panel:14px; --r-card:10px; --r-pill:999px;
  --shadow:none;
  color:var(--ink);min-height:100vh;font-family:var(--sans);
  -webkit-font-smoothing:antialiased;
}
html[data-theme="dark"] .desk{
  --k3:#8a63ef; --k4:#e8b93c;
  --map-stroke:rgba(var(--line-rgb),.10); --map-stroke-hi:rgba(var(--line-rgb),.55);
  --map-hatch:rgba(var(--line-rgb),.28); --map-blank:#2e2e36;
  --ramp-mid:rgb(58,58,66); --ramp-lo:rgb(30,30,36);
  --tip-shadow:0 10px 30px rgba(var(--line-rgb),.45);
}

.desk *{margin:0;padding:0;box-sizing:border-box}
.desk a{text-decoration:none;color:inherit}

.desk h1,.desk h2,.desk h3,.desk .projected-name,.desk .snapshot-heading strong{
  font-family:var(--sans);font-weight:800;letter-spacing:-.028em}
.desk .model-label,.desk .topline-status,.desk .topline-columns,.desk .race-kicker,
.desk .l4-called{font-family:var(--mono);font-weight:700;font-size:8px;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.desk .topline-votes,.desk .topline-pct,.desk .projected-bar-value,.desk .ring-center b,
.desk .meta-block b,.desk .outcome-row b,.desk .l4-pct,.desk .projected-margin-wrap b,
.desk .model-stats b,.desk .swing-grid b{font-family:var(--mono);font-variant-numeric:tabular-nums}
.desk .prose{font-family:var(--sans);line-height:1.6}

.utility-button{font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink2);border:1px solid var(--hairline2);
  border-radius:var(--r-pill);padding:5px 12px;background:var(--panel);cursor:pointer}
.utility-button:hover{color:var(--ink)}
.utility-button.lg{padding:10px 18px;font-size:10px;white-space:nowrap}

.shell{max-width:2400px;margin:0 auto;padding:26px clamp(20px,2.6vw,56px) 70px}

/* race header */
.archive-banner{display:flex;justify-content:space-between;align-items:center;gap:12px;
  flex-wrap:wrap;margin-bottom:16px;padding:9px 13px;border-radius:var(--r-card);
  background:var(--panel2);border:1px solid var(--hairline2);
  font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.archive-banner a{color:var(--ink2);border-bottom:1px solid var(--hairline2)}
.archive-banner a:hover{color:var(--ink)}
.race-header{padding-bottom:20px;border-bottom:1px solid var(--hairline)}
.race-kicker{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--live);
  animation:dpulse 1.7s infinite;flex:0 0 auto}
.live-dot.sm{width:6px;height:6px;margin-top:4px}
@keyframes dpulse{50%{opacity:.3}}
.race-heading-row{display:flex;justify-content:space-between;gap:32px;
  align-items:flex-start;margin-top:12px;flex-wrap:wrap}
.race-header h1{font-size:clamp(22px,2.6vw,32px);line-height:1.14}
.race-deck{font-size:14px;color:var(--ink2);max-width:560px;margin-top:9px;line-height:1.6}
.race-meta{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:14px 26px}
.meta-block span{display:block;font-family:var(--mono);font-size:8px;font-weight:700;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.meta-block b{display:block;font-size:17px;font-weight:800;letter-spacing:-.02em;margin-top:3px}
.race-tabs{display:flex;gap:20px;margin-top:18px;flex-wrap:wrap}
.race-tabs a{font-size:12px;color:var(--ink3);padding-bottom:4px;border-bottom:2px solid transparent}
.race-tabs a[aria-current="page"]{color:var(--ink);border-bottom-color:var(--ink)}
.race-tabs a:hover{color:var(--ink2)}

/* dashboard grid */
.dashboard-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-top:20px}
.card{background:var(--panel);border:1px solid var(--hairline);border-radius:var(--r-panel);
  box-shadow:var(--shadow);overflow:hidden}
.span-3{grid-column:span 3}
@media(max-width:900px){.dashboard-grid{grid-template-columns:1fr}.span-3{grid-column:span 1}}

/* reported results */
.topline-shell{padding:16px 18px 18px}
.winner-band{display:flex;align-items:center;gap:13px;margin:-16px -18px 16px;padding:14px 18px;
  border-bottom:1px solid var(--hairline);
  background:linear-gradient(90deg,color-mix(in srgb,var(--called) 16%,transparent),transparent 62%)}
.winner-badge{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:grid;
  place-content:center;font-size:14px;font-weight:800;color:var(--panel);
  background:var(--called)}
.winner-copy{min-width:0}
.winner-copy span{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--called);font-weight:700}
.winner-copy strong{display:block;font-size:18px;letter-spacing:-.02em;margin-top:3px}
.winner-copy small{display:block;font-size:10.5px;color:var(--ink3);margin-top:3px}
.topline-header{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;
  flex-wrap:wrap}
.topline-title h2{font-size:21px;line-height:1.12}
.topline-title p{font-size:11.5px;color:var(--ink2);margin-top:5px}
.topline-meta{text-align:right}
.topline-status{display:block}
.topline-updated{font-family:var(--mono);font-size:9px;color:var(--ink3);letter-spacing:.04em}
.topline-columns{display:grid;grid-template-columns:1fr 90px 74px;gap:10px;margin-top:16px;
  padding-bottom:7px;border-bottom:1px solid var(--hairline)}
.topline-columns span:nth-child(n+2){text-align:right}
.topline-row{padding:13px 0;border-bottom:1px solid var(--hairline)}
.topline-row:last-child{border-bottom:none}
.topline-row-top{display:grid;grid-template-columns:1fr 90px 74px;gap:10px;align-items:center}
.topline-candidate{display:flex;gap:10px;align-items:flex-start;min-width:0}
.topline-mark{flex:0 0 18px;height:18px;display:grid;place-content:center;margin-top:1px}
.topline-dot{width:9px;height:9px;border-radius:50%}
.topline-check{width:17px;height:17px;border-radius:50%;display:grid;place-content:center;
  font-size:10px;font-weight:800;font-style:normal;color:var(--panel);background:var(--called)}
.topline-copy{min-width:0}
.topline-copy strong{display:block;font-size:15px;font-weight:700;letter-spacing:-.01em}
.topline-copy small{display:block;font-family:var(--mono);font-size:8.5px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);margin-top:2px}
.topline-lead{display:block;font-family:var(--mono);font-size:9px;color:var(--ink2);
  margin-top:4px;letter-spacing:.03em}
.topline-lead.won{display:inline-block;color:var(--called);font-weight:700;
  letter-spacing:.08em;text-transform:uppercase;font-size:8px;padding:3px 8px;
  border:1px solid color-mix(in srgb,var(--called) 45%,transparent);
  border-radius:var(--r-pill);
  background:color-mix(in srgb,var(--called) 12%,transparent)}
.topline-votes{font-size:13px;color:var(--ink2);text-align:right}
.topline-pct{font-size:22px;font-weight:800;letter-spacing:-.03em;text-align:right}
.topline-bar{height:7px;border-radius:99px;background:var(--panel3);overflow:hidden;margin-top:9px}
.topline-bar span{display:block;height:100%;border-radius:99px;
  transition:width 600ms cubic-bezier(.16,1,.3,1)}
.empty-live{padding:22px 0 6px}
.empty-live .prose{font-size:13px;color:var(--ink2);max-width:420px}
.empty-note{font-size:12px;color:var(--ink2);max-width:520px;margin:14px 0 4px;
  padding-bottom:12px;border-bottom:1px solid var(--hairline)}
.topline-foot{display:flex;justify-content:space-between;align-items:baseline;gap:12px;
  margin-top:14px;padding-top:11px;border-top:1px solid var(--hairline);
  font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.topline-reporting b,.topline-margin b{font-size:13px;color:var(--ink);letter-spacing:-.01em;
  font-variant-numeric:tabular-nums;margin-right:5px}

/* forecast snapshot */
.snapshot{padding:16px 18px 18px;border-bottom:1px solid var(--hairline)}
.snapshot-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.snapshot-heading strong{display:block;font-size:21px;line-height:1.12}
.snapshot-heading small{display:block;font-size:11px;color:var(--ink2);margin-top:4px}
.race-rule-pill{font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink2);border:1px solid var(--hairline2);
  border-radius:var(--r-pill);padding:4px 10px;white-space:nowrap}
.forecast-model-layout{display:grid;grid-template-columns:auto 1fr;gap:22px;margin-top:18px;
  align-items:start}
@media(max-width:560px){.forecast-model-layout{grid-template-columns:1fr}}
.forecast-hero{text-align:center}
.prob-ring,.rep-ring{--value:50;--ring:var(--k1);position:relative;width:126px;aspect-ratio:1;
  margin:10px auto 0;border-radius:50%;
  background:conic-gradient(from -90deg,var(--ring) calc(var(--value)*1%),var(--panel3) 0)}
.prob-ring.sm{width:104px}
.rep-ring{width:82px;
  background:conic-gradient(from -90deg,var(--live) calc(var(--value)*1%),var(--panel3) 0)}
.prob-ring::before,.rep-ring::before{content:"";position:absolute;inset:15px;border-radius:50%;
  background:var(--panel);box-shadow:inset 0 0 0 1px var(--hairline)}
.prob-ring.sm::before{inset:13px}
.rep-ring::before{inset:11px}
.ring-center{position:absolute;inset:0;z-index:1;display:grid;place-content:center;text-align:center}
.ring-center b{display:block;font-size:29px;font-weight:800;line-height:1;letter-spacing:-.05em}
.ring-center span{display:block;font-family:var(--mono);font-size:8px;color:var(--ink3);
  margin-top:5px;letter-spacing:.08em;text-transform:uppercase}
.prob-ring.sm .ring-center b{font-size:24px}
.ring-center.sm b{font-size:17px}
.ring-center.sm span{font-size:7px}
.forecast-support{display:flex;flex-direction:column;gap:16px}
.outcome-row{display:flex;align-items:center;gap:8px;padding:6px 0;
  border-bottom:1px solid var(--hairline);font-size:12px}
.outcome-row:last-child{border-bottom:none}
.outcome-row i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.outcome-row span{flex:1}
.outcome-row b{font-weight:800;font-size:13px}
.outcome-row.muted span,.outcome-row.muted b{color:var(--ink3)}
.reporting-module{display:flex;align-items:center;gap:14px;padding-top:13px;
  border-top:1px solid var(--hairline)}
.reporting-copy span{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.reporting-copy b{display:block;font-size:13px;font-weight:700;margin-top:3px}
.gatebox{margin-top:16px;padding:14px;border:1px dashed var(--hairline2);border-radius:var(--r-card)}
.gatebox .prose{font-size:12.5px;color:var(--ink2);margin-top:6px}

/* projection zone */
.projection-zone{padding:16px 18px 18px}
.projected-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;
  flex-wrap:wrap}
.projected-intro{flex:1;min-width:220px}
.projected-name{font-size:21px;margin-top:5px}
.projection-headline{font-size:11.5px;color:var(--ink2);margin-top:7px;max-width:400px}
.projected-margin-wrap{text-align:right}
.projected-margin-wrap span{display:block;font-family:var(--mono);font-size:8px;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.projected-margin-wrap b{display:block;font-size:28px;font-weight:800;letter-spacing:-.04em;
  margin-top:3px}
.projected-margin-wrap small{display:block;font-size:9px;color:var(--ink3);margin-top:2px}
.projection-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;
  margin-top:18px;padding-top:14px;border-top:1px solid var(--hairline)}
.projection-head strong{display:block;font-size:14px;font-weight:800;letter-spacing:-.02em}
.projection-head small{display:block;font-size:10px;color:var(--ink3);margin-top:4px;
  line-height:1.45;max-width:400px}
.projected-bars{margin-top:14px;display:flex;flex-direction:column;gap:11px}
.projected-bar-row{display:grid;grid-template-columns:96px 1fr 52px 74px;gap:10px;align-items:center}
.projected-bar-name{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600}
.projected-bar-name i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
.projected-bar-track{height:9px;border-radius:99px;background:var(--panel3);overflow:hidden}
.projected-bar-fill{display:block;height:100%;border-radius:99px;border:1.5px dashed;
  background:color-mix(in srgb, currentColor 0%, transparent)}
.projected-bar-value{font-size:14px;font-weight:800;text-align:right}
.projected-bar-delta{font-family:var(--mono);font-size:8.5px;color:var(--ink3);text-align:right;
  letter-spacing:.03em}
.model-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;
  margin-top:18px;padding-top:14px;border-top:1px solid var(--hairline)}
.model-stats span{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.model-stats b{display:block;font-size:12.5px;font-weight:700;margin-top:3px}
.no-history{font-family:var(--mono);font-size:8.5px;font-style:italic;color:var(--ink3);
  margin-top:14px;padding-top:11px;border-top:1px solid var(--hairline)}

/* county map + table */
.county{margin-top:20px;padding:20px}
.county-head{display:flex;justify-content:space-between;align-items:center;gap:14px;
  flex-wrap:wrap;margin-bottom:14px}
.rd-view-toggles,.rd-map-toggles{display:flex;gap:4px;padding:3px;border-radius:999px;
  background:var(--panel2);border:1px solid var(--hairline)}
.rd-view-toggles button{padding:6px 15px;border-radius:999px;border:0;background:none;cursor:pointer;
  font-family:var(--mono);font-size:10.5px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);transition:background .15s ease,color .15s ease}
.rd-view-toggles button.on{background:var(--gop);color:#fff}
.rd-map-toggles button{padding:5px 13px;border-radius:999px;border:0;background:none;cursor:pointer;
  font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);transition:background .15s ease,color .15s ease}
.rd-map-toggles button.on{background:var(--canvas);color:var(--panel)}
.rd-map{position:relative;height:clamp(460px,calc(100vh - 230px),1000px);width:100%;border-radius:var(--r-panel);
  overflow:hidden;background:var(--panel2);border:1px solid var(--hairline)}
.rd-map-legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;
  font-family:var(--mono);font-size:10px;letter-spacing:.04em;color:var(--ink3)}
.map-empty{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px;
  align-items:center;justify-content:center;text-align:center;padding:0 24px;
  pointer-events:none;font-family:var(--mono);font-size:11px;letter-spacing:.05em;
  text-transform:uppercase;color:var(--ink3)}
.map-empty-sub{font-family:var(--sans);font-size:12px;letter-spacing:0;
  text-transform:none;color:var(--ink3);max-width:300px;line-height:1.5}
.rd-map-legend-sw{width:46px;height:5px;border-radius:99px;flex-shrink:0}
.rd-key{display:inline-flex;align-items:center;gap:5px}
.rd-key i{width:9px;height:9px;border-radius:2px;display:inline-block}
.rd-map-legend-note{color:var(--ink3)}
.rd-map-hint{margin-left:auto;color:var(--ink3);white-space:nowrap}
@media(max-width:640px){.rd-map-hint{display:none}}
.county-caveat{font-size:11.5px;color:var(--ink3);margin-top:14px;max-width:880px}

.mech-box{margin-top:16px;padding:14px;border:1px solid var(--hairline2);
  border-radius:var(--r-card);background:var(--panel2)}
.swing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;
  margin-top:10px}
.swing-grid span{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.swing-grid b{display:block;font-size:12.5px;font-weight:700;margin-top:3px}
.mech-box .prose{font-size:11.5px;color:var(--ink2);margin-top:12px;padding-top:10px;
  border-top:1px solid var(--hairline);max-width:820px}

.rd-county{margin-top:22px}
.rd-county-tools{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
  gap:12px;margin-bottom:14px}
.rd-county-search{display:flex;align-items:center;gap:8px;padding:8px 13px;border-radius:10px;
  background:var(--panel2);border:1px solid var(--hairline);color:var(--ink3);
  flex:1 1 220px;max-width:340px}
.rd-county-search input{flex:1;min-width:0;background:none;border:0;outline:none;
  color:var(--ink);font-family:var(--sans);font-size:13px}
.rd-county-search input::placeholder{color:var(--ink3)}
.rd-county-sorts{display:flex;flex-wrap:wrap;gap:4px;padding:3px;border-radius:999px;
  background:var(--panel2);border:1px solid var(--hairline)}
.rd-county-sorts button{padding:5px 12px;border-radius:999px;border:0;background:none;cursor:pointer;
  font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink3);transition:background .15s ease,color .15s ease}
.rd-county-sorts button:hover{color:var(--ink2)}
.rd-county-sorts button.on{background:var(--canvas);color:var(--panel)}
.rd-county-tablewrap{max-height:520px;overflow:auto;border:1px solid var(--hairline);
  border-radius:12px;background:var(--panel)}
.rd-county-table{width:100%;border-collapse:collapse;font-family:var(--sans);font-size:13px;
  table-layout:fixed}
.rd-county-table thead th{position:sticky;top:0;z-index:1;background:var(--panel2);
  text-align:left;padding:10px 12px;font-family:var(--mono);font-size:9.5px;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);
  border-bottom:1px solid var(--hairline)}
.rd-county-table th.num,.rd-county-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.rd-county-table td{padding:10px 12px;border-bottom:1px solid var(--hairline);color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rd-county-table tbody tr:last-child td{border-bottom:0}
.rd-county-table tbody tr:hover td{background:var(--panel2)}
.rd-county-loading{text-align:center;padding:26px 14px;color:var(--ink3);font-style:italic}
.ok-region-cell{font-family:var(--mono);font-size:11px;color:var(--ink3)}
/* inline-flex, not flex: a display:flex <td> stops behaving as a table cell and
   the columns collapse on top of each other. */
.rd-cand-cell{display:inline-flex;align-items:baseline;justify-content:flex-end;gap:6px;
  font-family:var(--mono)}
.rd-cand-cell b{font-weight:700}
.rd-cand-votes{color:var(--ink3);font-size:10.5px}
.rd-cand-tcc{display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:7px;
  background:var(--gold);vertical-align:middle}
@media(max-width:900px){
  .rd-cand-votes{display:none}
  .ok-county-table{font-size:11.5px}
  .ok-county-table td,.ok-county-table thead th,.ok-county-table tfoot td{padding:9px 7px}
  .ok-region-cell{display:none}
}

/* oklahoma choropleth */
.ok-map-wrap{position:relative;width:100%;height:100%;overflow:hidden;
  padding:16px;touch-action:none;cursor:grab}
.ok-map-wrap.dragging{cursor:grabbing}
.ok-map{display:block;width:100%;height:100%}
.ok-cty{stroke:var(--map-stroke);stroke-width:.6;cursor:pointer;transition:opacity .12s ease}
.ok-cty:hover{opacity:.78;stroke:var(--map-stroke-hi);stroke-width:1.4}
.ok-cty-hatch{pointer-events:none;stroke:none}
.ok-hatch-line{stroke:var(--map-hatch)}
.ok-zoom{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:1px;
  border-radius:9px;overflow:hidden;border:1px solid var(--hairline2);background:var(--panel);
  box-shadow:0 4px 14px rgba(var(--line-rgb),.18)}
.ok-zoom button{width:30px;height:28px;border:0;background:var(--panel);color:var(--ink2);
  cursor:pointer;font-family:var(--mono);font-size:14px;line-height:1;font-weight:700;
  display:grid;place-items:center;transition:background .12s ease,color .12s ease}
.ok-zoom button+button{border-top:1px solid var(--hairline)}
.ok-zoom button:hover:not(:disabled){background:var(--panel2);color:var(--ink)}
.ok-zoom button:disabled{opacity:.4;cursor:default}
.ok-zoom button.reset{font-size:8px;letter-spacing:.06em}
.ok-tip,.sc-tip{position:absolute;z-index:5;pointer-events:none;min-width:206px;max-width:250px;
  padding:10px 12px;border-radius:var(--r-card);background:var(--panel);
  border:1px solid var(--hairline2);box-shadow:var(--tip-shadow);
  font-family:var(--sans);font-size:12px;color:var(--ink)}
.ok-tip strong,.sc-tip strong{display:block;font-size:13px;font-weight:800;margin-bottom:6px}
.ok-tip-row,.sc-tip-row{display:flex;justify-content:space-between;gap:16px;
  font-family:var(--mono);font-size:11.5px;line-height:1.7}
.ok-tip-row b,.sc-tip-row b{font-variant-numeric:tabular-nums}
.ok-tip-sub,.sc-tip-sub{margin-top:5px;font-family:var(--mono);font-size:9.5px;
  letter-spacing:.04em;color:var(--ink3)}
.ok-tip-flag{margin-top:6px;font-family:var(--mono);font-size:8.5px;font-weight:700;
  letter-spacing:.11em;text-transform:uppercase;color:var(--gold)}

/* south carolina panel */
.sc-zone{margin-top:20px;padding:20px}
.sc-head{display:flex;justify-content:space-between;gap:26px;align-items:flex-start;
  flex-wrap:wrap;padding-bottom:16px;border-bottom:1px solid var(--hairline)}
.sc-head h2{font-size:21px;line-height:1.14;margin-top:10px}
.sc-deck{font-size:12.5px;color:var(--ink2);margin-top:9px;max-width:620px}
.sc-prob{text-align:center;flex:0 0 auto}
.sc-grid{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:18px}
@media(max-width:860px){.sc-grid{grid-template-columns:1fr}}
.sc-col{min-width:0}
.sc-sub{margin-top:18px;padding-top:14px;border-top:1px solid var(--hairline)}
.sc-note{font-size:11.5px;color:var(--ink3);margin-top:12px}
.sc-map-frame{position:relative;margin-top:10px;height:clamp(240px,32vh,340px);
  border-radius:var(--r-panel);overflow:hidden;background:var(--panel2);
  border:1px solid var(--hairline)}
.sc-map-wrap{position:relative;width:100%;height:100%;padding:12px}
.sc-map{display:block;width:100%;height:100%}
.sc-cty{stroke:var(--map-stroke);stroke-width:.6;cursor:pointer;transition:opacity .12s ease}
.sc-cty:hover{opacity:.78;stroke:var(--map-stroke-hi);stroke-width:1.4}

/* scenario engine cta */
.engine-cta{margin-top:20px;padding:20px;display:flex;justify-content:space-between;
  align-items:center;gap:24px;flex-wrap:wrap}
.engine-cta h2{font-size:16px}
.engine-cta .prose{font-size:12px;color:var(--ink2);margin-top:6px;max-width:620px}

/* slate */
.board{margin-top:38px}
.board-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;
  padding-bottom:12px;border-bottom:1px solid var(--hairline2);flex-wrap:wrap}
.board-head h2{font-size:21px}
.board-head p{font-size:11.5px;color:var(--ink2);margin-top:4px}
.board-meta{display:flex;align-items:center;gap:10px}
.grp{margin-top:22px}
.grp-hd{display:flex;justify-content:space-between;gap:12px;align-items:baseline;
  margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid var(--hairline)}
.grp-hd h3{font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:10px}
.l4{background:var(--panel);border:1px solid var(--hairline);border-radius:var(--r-card);
  box-shadow:var(--shadow);padding:12px 13px;display:flex;flex-direction:column;gap:10px;
  transition:border-color 140ms ease}
.l4:hover{border-color:var(--hairline2)}
.l4-hd{display:flex;gap:9px;align-items:flex-start}
.l4-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex:0 0 auto;background:var(--ink3)}
.l4-dot.d{background:var(--dem)} .l4-dot.r{background:var(--gop)} .l4-dot.n{background:var(--c2)}
.l4-title{flex:1;min-width:0}
.l4-title strong{display:block;font-size:13px;font-weight:700;letter-spacing:-.01em}
.l4-title small{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);margin-top:2px}
.l4-called{color:var(--called)}
.l4-body{display:flex;flex-direction:column;gap:9px}
.l4-row{display:grid;grid-template-columns:1fr auto;gap:4px 8px}
.l4-nm{display:flex;align-items:center;gap:5px;min-width:0;font-size:11.5px;font-weight:600}
.l4-nm span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l4-check{flex:0 0 13px;display:inline-grid;place-content:center;width:13px;height:13px;
  border-radius:50%;font-size:8px;font-weight:800;font-style:normal;
  color:var(--panel);background:var(--called)}
.l4-check.ghost{visibility:hidden}
.l4-pct{font-size:12px;font-weight:800}
.l4-bar{grid-column:1/-1;height:4px;border-radius:99px;background:var(--panel3);overflow:hidden}
.l4-bar span{display:block;height:100%;border-radius:99px;
  transition:width 600ms cubic-bezier(.16,1,.3,1)}
.l4-empty{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink3);padding:8px 0}
.l4-foot{margin-top:auto;padding-top:8px;border-top:1px solid var(--hairline)}

/* method */
.method{margin-top:38px;padding-top:18px;border-top:1px solid var(--hairline)}
.method h2{font-size:16px}
.method .prose{font-size:12px;color:var(--ink2);margin-top:9px;max-width:840px}
.method-foot{display:flex;justify-content:space-between;gap:14px;margin-top:16px;flex-wrap:wrap}

@media(max-width:640px){
  .topline-columns,.topline-row-top{grid-template-columns:1fr 70px 58px}
  .topline-pct{font-size:18px}
  .projected-bar-row{grid-template-columns:74px 1fr 44px}
  .projected-bar-delta{display:none}
  .grid{grid-template-columns:1fr}
}
`;
