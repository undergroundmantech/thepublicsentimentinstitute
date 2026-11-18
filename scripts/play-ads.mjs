// Nov 18 2026: lets Campaign 2028 run Google's game ads, the full screen ads between weeks and the sponsor ads a
// player chooses to watch. It adds Google's frequency hint to the AdSense tag in the root layout, which tells Google
// how often a game may show a full screen ad at a break; Google still decides when one actually shows.
// Run from the repo root: node scripts/play-ads.mjs   Safe to run twice.
import fs from "node:fs";
const L = ["app/layout.tsx", "app/layout.jsx", "src/app/layout.tsx"].find((f) => fs.existsSync(f));
if (!L) { console.log("MISS  no app/layout.tsx; send this line to Claude"); process.exit(1); }
let t = fs.readFileSync(L, "utf8");
const re = /<script async [^>]*src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+"[^>]*\/>/;
const m = t.match(re);
if (!m) { console.log("MISS  could not find the AdSense script tag in " + L + "; send this line to Claude"); process.exit(1); }
if (m[0].includes("data-ad-frequency-hint")) console.log("same  " + L);
else {
  t = t.replace(m[0], m[0].replace("<script async ", '<script async data-ad-frequency-hint="30s" '));
  fs.writeFileSync(L, t); console.log("ok    " + L + "  game ad frequency hint added");
}
console.log("\nDone.");
