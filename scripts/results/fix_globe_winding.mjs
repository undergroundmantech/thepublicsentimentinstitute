// Reverse any county ring that d3-geo reads as covering the rest of the globe (area over a hemisphere), so every
// county draws as itself on the results monitor. Usage: node scripts/results/fix_globe_winding.mjs SITE_DIR
import fs from "node:fs";
import path from "node:path";
import { geoArea } from "d3-geo";
const site = process.argv[2] || ".";
const f = path.join(site, "public/results/2026/counties_ll.json");
const c = JSON.parse(fs.readFileSync(f, "utf8"));
let fixed = 0, rings = 0;
for (const [fips, polys] of Object.entries(c)) {
  c[fips] = polys.map((ring) => {
    rings++;
    if (geoArea({ type: "Polygon", coordinates: [ring] }) > 2 * Math.PI) { fixed++; return [...ring].reverse(); }
    return ring;
  });
}
fs.writeFileSync(f, JSON.stringify(c));
console.log(`${fixed} of ${rings} rings reversed`);
