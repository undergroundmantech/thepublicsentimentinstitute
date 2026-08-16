// Auto-generated scoped stylesheet ported from changeorders/TPSI_FL_Scenario_Engine_Final.html.
// Colors/fonts are aliased to site tokens (app/globals.css) so this flips with data-theme.
export const FLSE_CSS = `
.flse{
 --bg:var(--background);--pnl:var(--panel);--pnl2:var(--panel2);--ink:var(--foreground);--ink2:var(--foreground2);--ink3:var(--muted);--ink4:var(--muted2);
 --line:var(--border2);--line2:var(--border);--fill:var(--panel3);
 --f:var(--font-body);--m:var(--font-numeric);
 --r:var(--r-lg);--sh:var(--shadow-sm);
 font-family:var(--f);color:var(--ink);-webkit-font-smoothing:antialiased;
 font-size:14px;line-height:1.5;
}

.flse *{margin:0;padding:0;box-sizing:border-box}

.flse .wrap{max-width:1560px;margin:0 auto;padding:28px 24px 40px}
.flse .masthead{margin-bottom:20px}
.flse .eyebrow{font-family:var(--m);font-size:9.5px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--ink4)}
.flse h1{font-size:26px;font-weight:700;letter-spacing:-.02em;margin-top:8px;color:var(--ink)}
.flse .sub{font-size:13px;color:var(--ink3);margin-top:8px;max-width:760px}
.flse .presets{display:flex;gap:7px;margin-top:16px;flex-wrap:wrap}
.flse .pbtn{font-size:12px;font-weight:600;padding:8px 14px;border:1px solid var(--line);background:var(--pnl2);
 border-radius:99px;cursor:pointer;color:var(--ink2);transition:all .12s;white-space:nowrap}
.flse .pbtn:hover{border-color:var(--ink3);color:var(--ink)}
.flse .pbtn.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.flse .grid{display:grid;grid-template-columns:436px minmax(0,1fr) 296px;gap:16px;align-items:start}
.flse .card{background:var(--pnl);border:1px solid var(--line);border-radius:var(--r);margin-bottom:14px;box-shadow:none}
.flse .ch{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;border-bottom:1px solid var(--line2)}
.flse .ct{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--ink2)}
.flse .cs{font-family:var(--m);font-size:10px;color:var(--ink4)}
.flse .cb{padding:14px 16px}
.flse table.mx{width:100%;border-collapse:collapse}
.flse .mx th{font-family:var(--m);font-size:8px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
 color:var(--ink4);padding:0 3px 7px;text-align:center}
.flse .mx th:first-child{text-align:left}
.flse .mx td{padding:2.5px 3px}
.flse .mx td:first-child{font-size:11px;font-weight:500;color:var(--ink2);white-space:nowrap;padding-right:6px}
.flse .mx input{background:var(--pnl2);width:100%;min-width:34px;font-family:var(--m);font-size:11px;font-weight:600;text-align:right;
 border:1px solid var(--line);border-radius:6px;padding:5px 4px;color:var(--ink);transition:border .12s}
.flse .mx input:focus{outline:none;border-color:var(--ink2)}
.flse .mx input.ro{background:var(--fill);color:var(--ink4);border-color:transparent;cursor:default}
.flse .mx input.el{background:var(--pnl2)}
.flse .hint{font-size:11px;color:var(--ink4);line-height:1.5;margin-top:10px}
.flse .row{display:grid;grid-template-columns:1fr 92px 46px;gap:10px;align-items:center;padding:7px 0}
.flse .row+.row{border-top:1px solid var(--line2)}
.flse .rl{font-size:12.5px;font-weight:600;color:var(--ink)}
.flse .rl i{display:block;font-style:normal;font-size:10.5px;color:var(--ink4);font-weight:400;margin-top:1px}
.flse input[type=range]{width:100%;accent-color:var(--ink);height:3px}
.flse .rv{font-family:var(--m);font-size:11px;font-weight:600;text-align:right;color:var(--ink2)}
.flse .tgl{position:relative;width:40px;height:22px;border-radius:99px;background:var(--fill);cursor:pointer;
 transition:background .16s;border:none;padding:0;justify-self:end}
.flse .tgl:after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;
 background:var(--pnl2);box-shadow:0 1px 3px rgba(0,0,0,.3),0 0 0 1px var(--line2);transition:transform .16s}
.flse .tgl.on{background:var(--ink)}
.flse .tgl.on:after{transform:translateX(18px)}
.flse .cbtn{border:1px solid var(--line);background:var(--pnl2);border-radius:6px;width:22px;height:22px;
 cursor:pointer;color:var(--ink3);font-size:11px;line-height:1;padding:0;transition:all .12s;flex-shrink:0}
.flse .cbtn:hover{border-color:var(--ink3);color:var(--ink)}
.flse .cbtn.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.flse .cname{display:flex;align-items:center;gap:9px}
.flse .xbtn{font-size:11px;font-weight:600;padding:5px 11px;border:1px solid var(--line);background:var(--pnl2);
 border-radius:99px;cursor:pointer;color:var(--ink2);transition:all .12s;white-space:nowrap}
.flse .xbtn:hover{border-color:var(--ink3)}
.flse .xbtn.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.flse .ctbl th{cursor:pointer;user-select:none}
.flse .ctbl th:hover{color:var(--ink2)}
.flse .ctbl th .ar{opacity:0;margin-left:3px;font-size:8px}
.flse .ctbl th.sorted{color:var(--ink)}
.flse .ctbl th.sorted .ar{opacity:1}
.flse .tsum{display:flex;justify-content:space-between;align-items:baseline;padding:12px 0 6px;border-bottom:1px solid var(--line2);margin-bottom:6px}
.flse .tbig{font-family:var(--m);font-size:23px;font-weight:700;letter-spacing:-.02em}
.flse .tsm{font-family:var(--m);font-size:11px;color:var(--ink4)}
.flse .tabs{display:flex;gap:6px;margin-bottom:11px;flex-wrap:wrap}
.flse .tab{font-size:11.5px;font-weight:600;padding:7px 13px;border:1px solid var(--line);background:var(--pnl2);
 border-radius:99px;cursor:pointer;color:var(--ink3);transition:all .12s}
.flse .tab:hover{border-color:var(--ink3)}
.flse .tab.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.flse .mapwrap{background:var(--pnl2);border:1px solid var(--line);border-radius:var(--r);padding:12px}
.flse svg#fl-map{width:100%;height:auto;display:block}
.flse path.cty{stroke:var(--pnl);stroke-width:.7;cursor:pointer;transition:opacity .1s}
.flse path.cty:hover{opacity:.78}
.flse .tip{position:fixed;background:var(--pnl2);color:var(--ink);border:1px solid var(--line);
 box-shadow:var(--shadow-md);font-size:12px;line-height:1.55;padding:11px 13px;
 border-radius:9px;pointer-events:none;opacity:0;transition:opacity .1s;z-index:99;max-width:250px}
.flse .tip b{font-weight:700}
.flse .tip .tn{font-size:13px;font-weight:700;margin-bottom:1px}
.flse .tip .tr{font-size:10.5px;color:var(--ink4);margin-bottom:7px}
.flse .tip .tl{display:flex;justify-content:space-between;font-family:var(--m);font-size:11px;padding:1.5px 0}
.flse .tip .tf{margin-top:7px;padding-top:7px;border-top:1px solid var(--line2);font-size:11px;color:var(--ink3)}
.flse .res{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}
.flse .rn{font-size:13px;font-weight:600}
.flse .rp{font-family:var(--m);font-size:16px;font-weight:700}
.flse .bar{height:7px;background:var(--fill);border-radius:4px;overflow:hidden;margin-bottom:3px}
.flse .bar i{display:block;height:100%;border-radius:4px}
.flse .rvv{font-family:var(--m);font-size:10px;color:var(--ink4);margin-bottom:11px}
.flse .stack{display:flex;height:22px;border-radius:6px;overflow:hidden;margin-bottom:14px}
.flse .note{font-size:11.5px;color:var(--ink3);line-height:1.5;padding-top:11px;margin-top:2px;border-top:1px solid var(--line2)}
.flse .btn{font-size:12px;font-weight:600;padding:10px;border:1px solid var(--ink);background:var(--ink);
 color:var(--bg);border-radius:8px;cursor:pointer;width:100%}
.flse .btn.alt{background:var(--pnl2);color:var(--ink)}
.flse .btn:hover{opacity:.88}
.flse .simv{font-family:var(--m);font-size:29px;font-weight:700;letter-spacing:-.02em}
.flse .hist{display:flex;align-items:flex-end;gap:1px;height:56px;margin-top:12px}
.flse .hist i{flex:1;border-radius:1px 1px 0 0;min-height:1px}
.flse .hax{display:flex;justify-content:space-between;font-family:var(--m);font-size:8.5px;color:var(--ink4);margin-top:4px}
.flse .leg{display:flex;flex-wrap:wrap;gap:11px;font-size:12px;color:var(--ink3)}
.flse .leg b{color:var(--ink)}
.flse .sw{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:middle}
/* county table */
.flse .ctbl{width:100%;border-collapse:collapse}
.flse .ctbl th{font-family:var(--m);font-size:8.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
 color:var(--ink4);padding:9px 6px;text-align:right;position:sticky;top:0;background:var(--pnl);border-bottom:1px solid var(--line);z-index:3}
.flse .ctbl th:first-child{text-align:left;padding-left:14px}
.flse .ctbl td{padding:0;border-bottom:1px solid var(--line2)}
.flse .crow{display:grid;grid-template-columns:1.5fr 1fr .7fr repeat(5,.7fr) 1fr;align-items:center;
 padding:9px 6px 9px 14px;cursor:pointer;font-size:12px}
.flse .crow:hover{background:var(--fill)}
.flse .crow>span{text-align:right;font-family:var(--m);font-size:11px;color:var(--ink2)}
.flse .crow>span:first-child{text-align:left;font-family:var(--f);font-size:12.5px;font-weight:600;color:var(--ink)}
.flse .crow>span:nth-child(2){text-align:left;font-weight:600;font-family:var(--f);font-size:12px}
.flse .cdet{background:var(--fill);padding:14px 16px 16px;border-bottom:1px solid var(--line)}
.flse .cdet .dg{display:grid;grid-template-columns:repeat(auto-fit,minmax(148px,1fr));gap:13px}
.flse .dk{font-family:var(--m);font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink4);margin-bottom:5px}
.flse .dv{font-family:var(--m);font-size:14px;font-weight:700}
.flse .dbar{margin-top:9px}
.flse .dbr{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:2px}


.flse .foot{display:flex;justify-content:space-between;margin-top:20px;padding-top:14px;border-top:1px solid var(--line);
 font-family:var(--m);font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink4)}
@media(max-width:1240px){
 .flse .grid{grid-template-columns:minmax(0,1fr) 320px}
 .flse #fl-left{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
 .flse #fl-left>.card{margin-bottom:0}
}
@media(max-width:820px){
 .flse .wrap{padding:18px 12px 30px;max-width:100%}
 .flse .grid{grid-template-columns:minmax(0,1fr)}
 .flse #fl-left, .flse #fl-mid, .flse #fl-right{min-width:0;max-width:100%}
 .flse #fl-left{grid-column:auto;grid-template-columns:minmax(0,1fr);display:grid}
 .flse #fl-right{order:-1}
 .flse h1{font-size:20px}
 .flse .sub{font-size:12.5px}
 .flse .cb{padding:12px}
 .flse .mx{table-layout:fixed;width:100%}
 .flse .mx td:first-child{font-size:10px;padding-right:4px;width:31%;
  overflow:hidden;text-overflow:ellipsis}
 .flse .mx input{min-width:0;font-size:10px;padding:5px 3px}
 .flse .mx th{font-size:7.5px;letter-spacing:.02em}
 .flse .row{grid-template-columns:1fr 76px 42px;gap:8px}
 .flse .crow{grid-template-columns:1.5fr 1fr .8fr 1fr;font-size:11.5px;padding-left:12px}
 .flse .crow>span:nth-child(n+4):nth-child(-n+8){display:none}
 .flse .ctbl th:nth-child(n+4):nth-child(-n+8){display:none}
 .flse .cdet .dg{grid-template-columns:1fr 1fr}
 .flse .presets{gap:6px}
 .flse .pbtn{font-size:11.5px;padding:7px 11px}
}
@media(max-width:430px){
 .flse .mx td:first-child{font-size:9px;width:28%}
 .flse .mx input{font-size:9.5px}
 .flse .tbig{font-size:20px}
}
`;
