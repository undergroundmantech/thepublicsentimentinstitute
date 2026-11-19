// Nov 19 2026: puts Campaign 2028 in the main menu, a Play tab with a New chip, so every page leads to the game.
// Run from the repo root: node scripts/play-promo.mjs   Safe to run twice.
import fs from "node:fs";
const NAV = "app/components/navMenu.ts";
if (!fs.existsSync(NAV)) { console.log("MISS  " + NAV + " not found"); process.exit(1); }
let t = fs.readFileSync(NAV, "utf8");
if (t.includes('key: "play"')) { console.log("same  " + NAV); process.exit(0); }
const at = t.indexOf('  { key: "more"');
if (at < 0) { console.log('MISS  could not find the More tab, key: "more"; send this line to Claude'); process.exit(1); }
const TAB = `  { key: "play", label: "Play", href: "/play", chip: "New",
    feature: { href: "/play", eyebrow: "Free browser game", title: "Campaign 2028", note: "Run for president on the On Point 2028 forecast: the primaries, debates, a running mate and a county by county fight to 270.", cta: "Play now" },
    cols: [
      { h: "Play", links: [
        { href: "/play", label: "Campaign 2028", note: "Primaries to 270", badge: "New" },
        { href: "/play?daily=1", label: "Daily challenge", note: "Same race for everyone today" },
      ] },
      { h: "The real race", links: [
        { href: "/2028", label: "2028 forecast", note: "The electoral map" },
        { href: "/2028/primaries", label: "2028 primaries" },
        { href: "/2028-presidential-candidates", label: "Who is running in 2028" },
      ] },
    ] },
`;
t = t.slice(0, at) + TAB + t.slice(at);
fs.writeFileSync(NAV, t);
console.log("ok    " + NAV + "  Play tab added before More");
