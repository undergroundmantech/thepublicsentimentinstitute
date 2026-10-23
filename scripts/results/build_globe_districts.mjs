// House district outlines for the situation monitor globe. The forecast's district map, public/forecast/geo.json,
// is drawn in the Albers USA frame; each vertex is turned back into longitude and latitude so the globe can draw the
// same districts. Rings that d3 would read as covering the rest of the globe are turned around.
// Run: node scripts/results/build_globe_districts.mjs
import fs from "node:fs";
import { geoAlbersUsa, geoArea } from "d3-geo";
const g = JSON.parse(fs.readFileSync("public/forecast/geo.json", "utf8"));
const p = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const out = {}; let rings = 0, flipped = 0, dropped = 0;
for (const [id, d] of Object.entries(g.districts)) {
  const rs = [];
  for (const sub of d.d.split("M").filter(Boolean)) {
    const pts = sub.replace(/Z/g, "").split("L").map((s) => s.split(",").map(Number)).filter((x) => x.length === 2 && x.every(Number.isFinite));
    let ring = pts.map((x) => p.invert(x)).filter(Boolean).map(([a, b]) => [Math.round(a * 1e4) / 1e4, Math.round(b * 1e4) / 1e4]);
    if (ring.length < 3) { dropped++; continue; }
    if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ring.push(ring[0]);
    if (geoArea({ type: "Polygon", coordinates: [ring] }) > 2 * Math.PI) { ring = ring.reverse(); flipped++; }
    rs.push(ring); rings++;
  }
  if (rs.length) out[id] = rs;
}
fs.writeFileSync("public/results/2026/districts_ll.json", JSON.stringify(out));
console.log(Object.keys(out).length, "districts", rings, "rings", flipped, "turned", dropped, "dropped", fs.statSync("public/results/2026/districts_ll.json").size, "bytes");
