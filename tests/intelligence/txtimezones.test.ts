import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const tz = read("data/intelligence/reference/tx-county-timezones-2026-10-26.json") as {
  meta: { counties: number; utcOffsetHours: Record<string, number> };
  counties: { fips: string; name: string; zone: string }[];
};
const tx = read("public/results/2026/st/TX.json") as { names: Record<string, string> };

test("the Texas time-zone table covers exactly the 254 counties in the results geography", () => {
  assert.equal(tz.counties.length, 254);
  assert.equal(tz.meta.counties, 254);
  assert.deepEqual(tz.counties.map((c) => c.fips).sort(), Object.keys(tx.names).sort());
  for (const c of tz.counties) assert.equal(c.name, tx.names[c.fips]);
});

test("only El Paso and Hudspeth are Mountain; everything else, including Culberson, is Central", () => {
  const mountain = tz.counties.filter((c) => c.zone === "MOUNTAIN").map((c) => c.name).sort();
  assert.deepEqual(mountain, ["El Paso", "Hudspeth"]);
  assert.equal(tz.counties.find((c) => c.fips === "48109")?.zone, "CENTRAL");
  assert.ok(tz.counties.every((c) => c.zone === "CENTRAL" || c.zone === "MOUNTAIN"));
});

test("7 p.m. local on Nov 3 2026 is 01:00Z (Central) and 02:00Z (Mountain), with no daylight time in effect", () => {
  const close = (zone: string) => new Date(Date.UTC(2026, 10, 3, 19 - tz.meta.utcOffsetHours[zone]!)).toISOString();
  assert.equal(close("CENTRAL"), "2026-11-04T01:00:00.000Z");
  assert.equal(close("MOUNTAIN"), "2026-11-04T02:00:00.000Z");
});
