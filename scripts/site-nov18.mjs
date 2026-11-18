// Nov 18 2026 site update. Run from the repo root after unzipping: node scripts/site-nov18.mjs
// 1. The menu: the Majority Tracker gets its own tab with a Live chip, and a link under Polls.
// 2. The sitemap: the pages people search for most are listed near the top, with the two new pages.
// 3. The 2028 model page: its title no longer says On Point Politics twice.
// Safe to run twice: anything already done is left alone, and a step that can't find its place says so and changes
// nothing in that file.
import fs from "node:fs";
import path from "node:path";
let miss = 0;
const touched = new Set();
const say = (k, f, m = "") => console.log(`${k.padEnd(5)} ${f}${m ? "  " + m : ""}`);

// 1. menu
const NAV = "app/components/navMenu.ts";
if (!fs.existsSync(NAV)) { say("MISS", NAV, "not found"); miss++; }
else {
  let t = fs.readFileSync(NAV, "utf8");
  if (t.includes('key: "tracker"')) say("same", NAV);
  else {
    const GROUP = `  { key: "tracker", label: "Majority Tracker", href: "/majority-tracker", chip: "Live",
    feature: { href: "/majority-tracker", eyebrow: "Live whip count", title: "Schumer vs Van Hollen", note: "Every Senate Democrat and where we project them in the December 1 leader election.", cta: "Open the tracker" },
    cols: [
      { h: "The race", links: [
        { href: "/majority-tracker", label: "Majority Tracker", note: "Every senator, every call", badge: "Live" },
        { href: "/majority-tracker#mt-fence-h", label: "On the fence", note: "The senators who can still move it" },
        { href: "/majority-tracker#mt-faq-h", label: "The race explained" },
      ] },
      { h: "2028", links: [
        { href: "/2028-presidential-candidates", label: "Who is running in 2028", note: "Every name, by party" },
        { href: "/forecast/2028", label: "2028 forecast" },
      ] },
    ] },
`;
    const at = t.indexOf('  { key: "forecast"');
    if (at < 0) { say("MISS", NAV, 'could not find the Forecasts tab, key: "forecast"'); miss++; }
    else {
      t = t.slice(0, at) + GROUP + t.slice(at);
      const POLL = '{ href: "/polls/2028", label: "2028 primaries" },';
      if (t.includes(POLL)) t = t.replace(POLL, POLL + '\n        { href: "/majority-tracker", label: "Senate leader race", badge: "Live" },');
      const F28 = '{ href: "/polls/2028", label: "2028 primary polls" },';
      if (t.includes(F28)) t = t.replace(F28, F28 + '\n        { href: "/2028-presidential-candidates", label: "Who is running in 2028" },');
      fs.writeFileSync(NAV, t); touched.add(NAV); say("ok", NAV, "Majority Tracker tab added before Forecasts");
    }
  }
}

// 2. sitemap
const SM = "app/sitemap.ts";
if (!fs.existsSync(SM)) { say("MISS", SM, "not found"); miss++; }
else {
  let t = fs.readFileSync(SM, "utf8");
  if (t.includes('"/2028-presidential-candidates"')) say("same", SM);
  else {
    const anchor = t.match(/\n(\s*)u\("\/polls", today, "daily", 0\.9\),/);
    if (!anchor) { say("MISS", SM, 'could not find u("/polls", today, "daily", 0.9),'); miss++; }
    else {
      const ind = anchor[1];
      const add = [
        'u("/majority-tracker", today, "hourly", 1)',
        'u("/2028-presidential-candidates", today, "daily", 1)',
        'u("/2028", fc, "daily", 1)',
        'u("/polls/approval", today, "daily", 1)',
        'u("/polls/generic-ballot", today, "daily", 1)',
        'u("/polls/2028", today, "daily", 0.95)',
        'u("/polls/right-track", today, "daily", 0.7)',
        'u("/results/monitor", today, "weekly", 0.8)',
      ].filter((x) => !t.includes(x.split(",")[0] + ","));
      // later sections skip any address already listed, so nothing here is listed twice
      t = t.replace(anchor[0], anchor[0] + add.map((x) => `\n${ind}${x},`).join(""));
      fs.writeFileSync(SM, t); touched.add(SM); say("ok", SM, `${add.length} pages added near the top`);
    }
  }
}

// 3. the doubled title on the 2028 model page
const OLD = "2028 Presidential Model | On Point Politics";
const NEW = "2028 election forecast and electoral map";
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === "node_modules" || e.name.startsWith(".") ? [] : walk(path.join(d, e.name))) : /\.(tsx?|jsx?)$/.test(e.name) ? [path.join(d, e.name)] : []);
const hits = fs.existsSync("app") ? walk("app").filter((f) => fs.readFileSync(f, "utf8").includes(OLD)) : [];
if (!hits.length) say("NOTE", "2028 title", `no file contains "${OLD}"; if the 2028 page still shows the brand twice, send this line to Claude`);
for (const f of hits) { fs.writeFileSync(f, fs.readFileSync(f, "utf8").split(OLD).join(NEW)); touched.add(f); say("ok", f, "2028 title fixed"); }
// the files this run changed, for git add
for (const f of [NAV, SM]) if (fs.existsSync(f)) touched.add(f);
fs.writeFileSync("scripts/nov18-files.txt", [...touched].join("\n") + "\n");

// 4. the 2028 rating scale everywhere on the 2028 pages: Tilt under 2 points, Lean 2 to 6, Likely 6 to 12, Safe 12 and up
const LIB = "app/2028/lib.ts";
if (fs.existsSync(LIB)) {
  let t = fs.readFileSync(LIB, "utf8");
  const OLDR = 'const a = Math.abs(m); if (a < 2) return "Toss up"; const s = m < 0 ? "D" : "R";';
  if (t.includes(OLDR)) { t = t.replace(OLDR, 'const a = Math.abs(m); const s = m < 0 ? "D" : "R"; if (a < 2) return `Tilt ${s}`;'); fs.writeFileSync(LIB, t); touched.add(LIB); say("ok", LIB, "ratings now Tilt, Lean, Likely, Safe"); }
  else if (t.includes("return `Tilt ${s}`")) say("same", LIB);
  else say("NOTE", LIB, "rating labels not found; the new 2028 pages use their own scale either way");
}
fs.writeFileSync("scripts/nov18-files.txt", [...touched].join("\n") + "\n");
console.log(miss ? "\nSend the MISS lines to Claude." : "\nDone.");
