// Builds the county files for Campaign 2028 from the On Point 2028 forecast's own files, so the game's counties are
// the forecast's counties: their projected votes and their 2028 baseline margin, Republican minus Democrat.
// Run from the repo root: node scripts/play-counties.mjs
//   public/play/cty/index.json  every county without its shape: [fips, name, votes, margin, x, y] by state
//   public/play/cty/XX.json     one state's county shapes, its outline and the box to draw it in
import fs from "node:fs";
import path from "node:path";
const X = "public/forecast/2028/x", OUT = "public/play/cty";
const C = JSON.parse(fs.readFileSync(path.join(X, "counties.json"), "utf8")).counties;
const G = JSON.parse(fs.readFileSync(path.join(X, "gen.json"), "utf8")).cty;
const S = JSON.parse(fs.readFileSync(path.join(X, "states.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });
const r1 = (n) => Math.round(n * 10) / 10;
const center = (d) => { const n = (d.match(/-?\d+(\.\d+)?/g) || []).map(Number); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); } return [r1((x0 + x1) / 2), r1((y0 + y1) / 2)]; };
const idx = {}, shapes = {};
for (const [f, st, name, d] of C) {
  const g = G[f]; if (!g || !d) continue;
  const votes = Math.round(g[0] + g[1]); if (votes <= 0) continue;
  const [x, y] = center(d);
  (idx[st] ??= []).push([f, name.replace(/ (County|Parish|Borough|Census Area|city and borough|City and Borough|Municipality)$/i, "").replace(/ city$/, " City"), votes, r1(g[2]), x, y]);
  (shapes[st] ??= {})[f] = d;
}
let n = 0;
for (const st of Object.keys(idx)) {
  idx[st].sort((a, b) => b[2] - a[2]);
  const box = S.box?.[st] ?? null;
  fs.writeFileSync(path.join(OUT, `${st}.json`), JSON.stringify({ st, box, outline: S.states?.[st] ?? null, p: shapes[st] }));
  n += idx[st].length;
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(idx));
console.log(`ok    ${OUT}: ${Object.keys(idx).length} states, ${n} counties`);
