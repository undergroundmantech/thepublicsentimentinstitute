// Scoped styles for the intelligence diagnostics page. Tokens come from globals.css; party colour is used for data only.
export const ENI_CSS = `
.eni{color:var(--ink);font-family:var(--font-b);-webkit-font-smoothing:antialiased;padding:8px 0 48px}
.eni *{box-sizing:border-box}
.eni h1{font-family:var(--font-d);font-weight:800;letter-spacing:-.03em;font-size:clamp(26px,3.6vw,34px);margin:6px 0 6px}
.eni h2{font-family:var(--font-d);font-weight:800;letter-spacing:-.02em;font-size:17px;margin:0 0 10px}
.eni p{margin:0}
.eni .deck{color:var(--mute);font-size:14px;max-width:820px;margin-bottom:18px}
.eni .num,.eni td,.eni .mono{font-family:var(--font-m);font-variant-numeric:tabular-nums}
.eni .mute{color:var(--mute)}
.eni .dem{color:var(--dem)} .eni .gop{color:var(--gop)}
.eni a{color:var(--ink);text-underline-offset:2px}
.eni .banner{border:1px solid var(--line2);background:var(--glass2);border-radius:10px;padding:10px 14px;font-size:13px;margin:0 0 16px}
.eni .banner b{font:700 10.5px var(--font-m);letter-spacing:.12em;text-transform:uppercase;margin-right:8px}
.eni .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-bottom:14px}
.eni .panel{border:1px solid var(--line);background:var(--glass);border-radius:14px;padding:16px 18px;min-width:0}
.eni .panel.wide{grid-column:1/-1}
.eni .kv{display:grid;grid-template-columns:minmax(150px,auto) 1fr;gap:5px 14px;font-size:13px}
.eni .kv dt{color:var(--mute)} .eni .kv dd{margin:0;font-family:var(--font-m);font-variant-numeric:tabular-nums}
.eni table{width:100%;border-collapse:collapse;font-size:12.5px}
.eni th{font:700 10px var(--font-m);letter-spacing:.1em;text-transform:uppercase;color:var(--mute);text-align:left;padding:7px 8px;border-bottom:1px solid var(--line2);white-space:nowrap}
.eni td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.eni td.r,.eni th.r{text-align:right}
.eni .scroll{overflow-x:auto}
.eni .pill{display:inline-block;font:700 9.5px var(--font-m);letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:999px;border:1px solid var(--line2);color:var(--mute);white-space:nowrap}
.eni .pill.ok{color:var(--win);border-color:currentColor}
.eni .pill.warn{color:var(--gold);border-color:currentColor}
.eni .pill.bad{color:var(--live);border-color:currentColor}
.eni ul{margin:6px 0 0;padding-left:18px;font-size:13px}
.eni li{margin:3px 0}
.eni .issue{font-size:12px;color:var(--mute)}
.eni .issue code{font-family:var(--font-m);color:var(--ink)}
.eni .links{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;margin-bottom:16px}
`;
