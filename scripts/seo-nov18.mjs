// Nov 18 2026 search update. Run from the repo root: node scripts/seo-nov18.mjs   Safe to run twice.
// 1. The home page and the site's default title lead with 2028, the election people search for now, and keep the
//    2026 accuracy record that sets On Point apart.
// 2. 2028 search terms join the site keywords.
// Then, after the deploy is live: node scripts/indexnow.mjs   tells Bing, and through it ChatGPT search, Copilot and
// DuckDuckGo, about every page in the sitemap at once.
import fs from "node:fs";
let miss = 0; const touched = [];
const say = (k, f, m = "") => console.log(`${k.padEnd(5)} ${f}${m ? "  " + m : ""}`);
function swap(f, pairs, done) {
  if (!fs.existsSync(f)) { say("MISS", f, "not found"); miss++; return; }
  let t = fs.readFileSync(f, "utf8"); if (t.includes(done)) { say("same", f); return; }
  for (const [re, to, label] of pairs) { if (!re.test(t)) { say("MISS", f, "could not find " + label); miss++; return; } t = t.replace(re, to); }
  fs.writeFileSync(f, t); touched.push(f); say("ok", f);
}
const HOME_T = "On Point Politics: 2028 election forecast, polls and results from the most accurate pollster of 2026";
const HOME_D = "The 2028 presidential forecast and electoral map, every 2028 candidate, the Trump approval and generic ballot averages and the Senate leader race, from On Point Polling, the most accurate pollster of the 2026 midterms: D +13.1 on the final generic ballot against a D +13.0 result.";
swap("app/page.tsx", [[/seo\(\{"title": "[^"]*", "description": "[^"]*", "path": "\/"/, `seo({"title": "${HOME_T}", "description": "${HOME_D}", "path": "/"`, "the home page title"]], HOME_T);
swap("app/layout.tsx", [[/title: \{ default: "[^"]*", template: "%s \| On Point Politics" \}/, 'title: { default: "On Point Politics: 2028 election forecast, polls and results", template: "%s | On Point Politics" }', "the default title"]], "2028 election forecast, polls and results");
swap("app/lib/seo.ts", [
  [/"Home of On Point Polling, the most accurate pollster of the 2026 midterms: [^"]*"/, '"Home of On Point Polling, the most accurate pollster of the 2026 midterms: the 2028 presidential forecast and electoral map, every 2028 candidate, polling averages, election results and an accuracy report scoring every race against the count."', "the site description"],
  [/export const KEYWORDS = \[\n/, 'export const KEYWORDS = [\n  "2028 election forecast", "2028 presidential election", "2028 electoral map", "2028 presidential candidates", "2028 polls", "2028 Democratic primary", "2028 Republican primary",\n', "the keywords"],
], "2028 electoral map");
fs.writeFileSync("scripts/seo-files.txt", touched.join("\n") + "\n");
console.log(miss ? "\nSend the MISS lines to Claude." : "\nDone.");
