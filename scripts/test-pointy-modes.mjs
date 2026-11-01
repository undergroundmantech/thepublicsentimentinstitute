// On the home page Pointy is Theme-only: no walker, route, footprints, bubble or cameo in Pro Dark or Pro Light.
// Other pages keep their cameos in every mode.
// Run: node --test scripts/test-pointy-modes.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), "utf8");

test("every Pointy cameo renders nothing on the home page outside Theme, and is unchanged elsewhere", () => {
  const src = read("app/components/home/Mascot.tsx");
  assert.match(src, /const themed = useSiteMode\(\) === "themed";/);
  assert.match(src, /const home = usePathname\(\) === "\/";/);
  assert.match(src, /if \(home && !themed\) return null;/);
  // the hook starts in Pro Dark on the server and first client render, so a Pro home page never flashes him
  assert.match(read("app/lib/useSiteTheme.ts"), /useState<Mode>\("dark"\)/);
});

test("the only direct Mascot render on the home page is the globe walker", () => {
  const page = read("app/page.tsx");
  assert.doesNotMatch(page, /<Mascot\b/);
  assert.doesNotMatch(read("app/components/home/HomeWhatIf.tsx"), /<Mascot\b/);
});

test("the home globe gates the walking canvasser and its tour on Theme, with Pro copy", () => {
  const src = read("app/components/home/HomeGlobe.tsx");
  assert.match(src, /const themed = useSiteMode\(\) === "themed"/);
  assert.match(src, /if \(!geo \|\| !themed\) return \[\]/);
  assert.ok(src.includes("The 2026 midterms on one interactive globe. Explore the closest races, examine state forecasts, and select any state for detailed projections."));
  const pro = src.split("The 2026 midterms on one interactive globe")[1].split("</p>")[0];
  assert.doesNotMatch(pro, /Pointy|canvasser/);
});

