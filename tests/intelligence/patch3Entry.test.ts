// Patch 3: the Results tab enters the Situation Monitor, behind an opening screen; Pointy stays out of the Pro modes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MENU } from "../../app/components/navMenu";

const read = (p: string) => fs.readFileSync(p, "utf8");

test("the 2026 Results tab opens the Situation Monitor, and its menu still lists every results page", () => {
  const g = MENU.find((x) => x.key === "results")!;
  assert.equal(g.href, "/results/monitor");
  const links = g.cols.flatMap((c) => c.links.map((l) => l.href));
  for (const h of ["/results/2026", "/results/monitor", "/results/2026/calls", "/results/archive"]) assert.ok(links.includes(h), h);
});

test("the monitor has an opening screen: at the click, while the route loads, and until the monitor is ready", () => {
  const splash = read("app/results/monitor/MonitorSplash.tsx");
  assert.match(splash, /role="status"/); assert.doesNotMatch(splash, /Mascot|Pointy\b.*</, "no character on the opening screen");
  assert.match(read("app/results/monitor/loading.tsx"), /MonitorSplash/);
  const mon = read("app/results/monitor/Monitor.tsx");
  assert.match(mon, /<MonitorSplash out=\{splash === "out"\}/);
  assert.match(mon, /const ready = !!geo && !!ix && engS\.checked/);
  assert.match(mon, /: 30000\)/, "the screen never waits forever");
  assert.match(mon, /&& !live\.loading/, "the screen stays until the first count has been read");
  const nav = read("app/components/Navbar.tsx");
  assert.match(nav, /a\.pathname !== "\/results\/monitor"/); assert.match(nav, /<MonitorSplash fixed \/>/);
  assert.match(nav, /e\.metaKey \|\| e\.ctrlKey/, "a new-tab click is left alone");
  assert.match(read("app/results/monitor/monitorSplash.css"), /prefers-reduced-motion/);
});

test("Pointy is drawn on the home globe only in the Theme mode", () => {
  const g = read("app/components/home/HomeGlobe.tsx");
  assert.match(g, /const themed = useSiteMode\(\) === "themed"/);
  assert.match(g, /\{themed \? <div className="hg-man"/);
  assert.match(g, /if \(pointy && tour\.length && man\.current\)/);
  assert.match(g, /if \(pointy && tour\.length > 1\)/, "no route line without him");
});
