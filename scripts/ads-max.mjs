// Nov 18 2026: hand placed AdSense ads on the templates that make the most pages: every race forecast, every polling
// average, every analysis piece, every news story, every state results page and the home page. Ads go between
// sections where readers pause, never inside a chart, map or table, so Auto ads can stay off in page.
// Run from the repo root:
//   node scripts/ads-max.mjs                          display ads everywhere with your display unit
//   node scripts/ads-max.mjs ARTICLE MULTIPLEX        once you create an in-article unit and a multiplex unit in
//                                                     AdSense, pass their numbers to switch those spots over
// Safe to run twice. A step that can't find its place says MISS and changes nothing in that file.
import fs from "node:fs";
let miss = 0;
const say = (k, f, m = "") => console.log(`${k.padEnd(5)} ${f}${m ? "  " + m : ""}`);
const IMP = 'import AdUnit from "@/app/components/AdUnit";';
const touched = [];

function patch(f, steps) {
  if (!fs.existsSync(f)) { say("MISS", f, "not found"); miss++; return; }
  let t = fs.readFileSync(f, "utf8");
  if (t.includes("<AdUnit")) { say("same", f); touched.push(f); return; }
  for (const [a, b, label] of steps) {
    if (!t.includes(a)) { say("MISS", f, `could not find ${label}`); miss++; return; }
    t = t.replace(a, b);
  }
  if (!t.includes(IMP)) { const m = [...t.matchAll(/^import .*;$/gm)].pop(); t = t.slice(0, m.index + m[0].length) + "\n" + IMP + t.slice(m.index + m[0].length); }
  fs.writeFileSync(f, t); touched.push(f); say("ok", f, `${steps.length} ad spaces`);
}

// every analysis piece: an in-article ad a third of the way in, another two thirds in on long pieces, sponsored
// stories at the end
patch("app/analysis/Article.tsx", [
  ['<div className="an-prose">{children}</div>', '<div className="an-prose">{withAds(children)}</div>', "the article body"],
  ['        ))}</div>\n      </section>\n    </div>', '        ))}</div>\n      </section>\n      <AdUnit kind="multiplex" />\n    </div>', "the More analysis list"],
  ['import Link from "@/app/components/Link";', 'import { Children, type ReactNode } from "react";\nimport Link from "@/app/components/Link";', "the imports"],
  ['export default function Article(', `/** The body with ads between paragraphs: one a third of the way in, and on long pieces another two thirds in. */
function withAds(children: ReactNode) {
  const a = Children.toArray(children); if (a.length < 6) return a;
  const k1 = Math.floor(a.length / 3), k2 = Math.floor((2 * a.length) / 3);
  return [...a.slice(0, k1), <AdUnit key="ad1" kind="article" />, ...a.slice(k1, k2), ...(a.length >= 10 ? [<AdUnit key="ad2" kind="article" />] : []), ...a.slice(k2)];
}

export default function Article(`, "the Article component"],
]);

// every race forecast: before the race history, before how we got here, and sponsored stories at the end
patch("app/forecast/[state]/[race]/page.tsx", [
  ['          <section id="history" className="st-sec">', '          <AdUnit />\n          <section id="history" className="st-sec">', "the race history section"],
  ['          <section id="path" className="st-sec">', '          <AdUnit />\n          <section id="path" className="st-sec">', "the how we got here section"],
  ['          <YouTubeBand from="race"', '          <AdUnit kind="multiplex" />\n          <YouTubeBand from="race"', "the YouTube band"],
]);

// every polling average: under the average and its table
patch("app/polls/Average.tsx", [
  ['      <PollingAveragesPage initialId={id} forecast={forecastLinks()} initialBuilt={initialBuild(id)} />', '      <PollingAveragesPage initialId={id} forecast={forecastLinks()} initialBuilt={initialBuild(id)} />\n      <AdUnit />\n      <AdUnit kind="multiplex" />', "the polling average"],
]);

// every news story: after the summary, and at the top of the side column
patch("app/news/story/[id]/page.tsx", [
  ['<section className="nw-prose" aria-label="Summary">{s.summary.map((p, i) => <p key={i}>{p}</p>)}</section>', '<section className="nw-prose" aria-label="Summary">{s.summary.map((p, i) => <p key={i}>{p}</p>)}</section>\n            <AdUnit kind="article" />', "the story summary"],
  ['<aside className="nw-st-side">', '<aside className="nw-st-side">\n            <AdUnit minH={280} />', "the side column"],
]);

// every state results page: above its questions and answers
patch("app/results/2026/[id]/page.tsx", [
  ['      <section className="srs-faq" aria-labelledby="srs-faq">', '      <AdUnit />\n      <section className="srs-faq" aria-labelledby="srs-faq">', "the questions section"],
]);

// the home page: one between the polling averages and the results desk, one near the bottom
patch("app/page.tsx", [
  ['      </section>\n\n      <section className="sec">\n        <div className="sec-h home-ph"><Pointy className="home-pty rd pty-side"', '      </section>\n\n      <AdUnit />\n\n      <section className="sec">\n        <div className="sec-h home-ph"><Pointy className="home-pty rd pty-side"', "the results desk section"],
]);

// the unit numbers, when given
const [article, multiplex] = process.argv.slice(2).map((x) => (x || "").replace(/\D/g, ""));
const U = "app/components/AdUnit.tsx";
if (fs.existsSync(U) && (article || multiplex)) {
  let t = fs.readFileSync(U, "utf8");
  t = t.replace(/export const UNITS = \{[^}]*\};/, `export const UNITS = { display: "1176653089", article: "${article || ""}", multiplex: "${multiplex || ""}" };`);
  fs.writeFileSync(U, t); say("ok", U, `in-article ${article || "not set"}, multiplex ${multiplex || "not set"}`);
}
fs.writeFileSync("scripts/ads-max-files.txt", [...touched, U].join("\n") + "\n");
console.log(miss ? "\nSend the MISS lines to Claude." : "\nDone.");
