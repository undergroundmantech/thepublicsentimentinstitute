import { readFileSync, writeFileSync } from "node:fs";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const FIPS = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"};
const W = 760, H = 440;
const topo = JSON.parse(readFileSync("/tmp/realsite/site/node_modules/us-atlas/states-10m.json", "utf8"));
const fc = feature(topo, topo.objects.states);
const proj = geoAlbersUsa().scale(900).translate([W / 2 - 40, H / 2]);
const path = geoPath().projection(proj);
const out = {};
for (const f of fc.features) {
  const abbr = FIPS[String(f.id).padStart(2, "0")];
  if (!abbr) continue;
  // round to 1dp — invisible at this scale, roughly halves the payload
  const d = path(f).replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));
  const c = path.centroid(f).map((n) => Math.round(n * 10) / 10);
  out[abbr] = { d, c };
}
const body = Object.entries(out).sort().map(([k, v]) => `  ${k}: { d: ${JSON.stringify(v.d)}, c: [${v.c[0]}, ${v.c[1]}] },`).join("\n");
const ts = `// GENERATED FILE — do not hand edit.
// State outlines for the Polling Averages map, projected once at build time with
// d3-geo's geoAlbersUsa from us-atlas states-10m, so the page needs no CDN fetch
// and no projection library at runtime. Regenerate with scripts/polling/gen-state-paths.mjs
// if the viewBox below ever changes.
//
// viewBox: 0 0 ${W} ${H}   ·   geoAlbersUsa().scale(900).translate([${W / 2 - 40}, ${H / 2}])

export const MAP_W = ${W};
export const MAP_H = ${H};

/** Postal code -> { d: SVG path, c: [cx, cy] projected centroid }. */
export const US_STATE_PATHS: Record<string, { d: string; c: [number, number] }> = {
${body}
};
`;
writeFileSync("/tmp/realsite/site/app/polling/lib/usStatePaths.ts", ts);
console.log("states:", Object.keys(out).length, "bytes:", ts.length);
