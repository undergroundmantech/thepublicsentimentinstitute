// Cross-checks the live CivicAPI county keys against our geometry and forecast
// keys, and confirms the scale of percent_reporting using a race that has
// already fully reported. Throwaway pre-flight check for August 25.
import { readFileSync } from "node:fs";

const objectKeys = (file) => {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/^\s+"([A-Z][A-Z .'-]*?)"\s*:\s*"/gm)].map((m) => m[1].trim());
};

const get = async (id) => {
  const r = await fetch(`https://civicapi.org/api/v2/race/${id}`, { cache: "no-store" });
  return r.json();
};

const feedCounties = (p) =>
  Object.values(p.region_results || {}).map((r) =>
    String(r.name).replace(/\s+county$/i, "").trim().toUpperCase());

const ALIAS = { LEFLORE: "LE FLORE" };
// Normalise both sides, or the reverse direction reports a false mismatch.
const norm = (xs) => xs.map((x) => ALIAS[x] || x);
const diff = (a, b) => norm(a).filter((x) => !norm(b).includes(x));

// --- Oklahoma -------------------------------------------------------------
const ok = await get(87529);
const okFeed = feedCounties(ok);
const okGeo = objectKeys("app/results/_data/okCountyGeo.ts");
const okFc = [...readFileSync("app/results/_data/okCountyForecast.ts", "utf8")
  .matchAll(/"key":\s*"([^"]+)"/g)].map((m) => m[1]);

console.log("OK feed", okFeed.length, "geo", okGeo.length, "forecast", okFc.length);
console.log("  feed not in geo :", diff(okFeed, okGeo));
console.log("  geo not in feed :", diff(okGeo, okFeed));
console.log("  feed not in fcst:", diff(okFeed, okFc));
console.log("  fcst not in feed:", diff(okFc, okFeed));

// --- South Carolina -------------------------------------------------------
const sc = await get(87534);
const scFeed = feedCounties(sc);
const scGeo = objectKeys("app/results/_data/scCountyGeo.ts");
console.log("SC feed", scFeed.length, "geo", scGeo.length);
console.log("  feed not in geo :", diff(scFeed, scGeo));
console.log("  geo not in feed :", diff(scGeo, scFeed));
console.log("  SC candidates   :", (sc.candidates || []).map((c) => c.name).join(" | "));

// --- percent_reporting scale, from a race that has finished ---------------
const fl = await get(86349);
const flRegions = Object.values(fl.region_results || {});
console.log("FL statewide percent_reporting:", fl.percent_reporting);
console.log("FL county percent_reporting sample:",
  flRegions.slice(0, 5).map((r) => r.percent_reporting),
  "max:", Math.max(...flRegions.map((r) => Number(r.percent_reporting) || 0)));

