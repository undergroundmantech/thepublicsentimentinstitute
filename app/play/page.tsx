import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { Press_Start_2P, Pixelify_Sans } from "next/font/google";
import { type PIndex } from "./PlayApp";
import App28 from "./y28/App28";
import { AdUnit } from "./y28/ads28";
import "./play.css";
import JsonLd from "@/app/components/JsonLd";
import { seo, SITE } from "@/app/lib/seo";
import "./y28/play28.css";

const head = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--px-d", display: "swap" });
const body = Pixelify_Sans({ subsets: ["latin"], variable: "--px-b", display: "swap" });

const DESC = "Campaign 2028 is a free presidential election game in your browser. Pick any of 54 Democrats and Republicans, win the primaries and the nomination, pick a running mate, debate, and fight county by county to 270 electoral votes, all on the real On Point 2028 forecast. New daily challenge every day.";
export const metadata: Metadata = seo({
  title: "Campaign 2028: a free presidential election simulator game",
  description: DESC,
  path: "/play",
  ownImage: true,
  keywords: ["presidential election game", "election simulator", "2028 election game", "campaign simulator", "political strategy game", "president game online", "270 to win game", "election game free", "campaign trail game"],
});

export default function Page() {
  const idx = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "play", "index.json"), "utf8")) as PIndex;
  return (
    <div className={`opp pg ${head.variable} ${body.variable}`}>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "VideoGame", name: "Campaign 2028", url: `${SITE.url}/play`, description: DESC, genre: ["Strategy", "Simulation"], gamePlatform: "Web browser", applicationCategory: "Game", operatingSystem: "Any", playMode: "SinglePlayer", isAccessibleForFree: true, inLanguage: "en", image: `${SITE.url}/play/opengraph-image`, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@type": "Organization", name: SITE.name, url: SITE.url } }} />
      <App28 idx={idx} />
      <section className="px-about">
        <h1>Campaign 2028</h1>
        <p className="px-how-links"><a href="/play?daily=1">Play today&apos;s daily challenge</a> · <a href="/2028">See the real 2028 forecast</a> · <a href="/2028-presidential-candidates">Who is running in 2028</a></p>
        <p>Run for president. Pick any of the 54 Democrats and Republicans in the On Point 2028 model and fight for the nomination state by state, from the first debate stages to the last primaries, or skip ahead to the general election, then fight for every county in the states that decide it. Every state&apos;s starting margin, every candidate&apos;s pull state by state, the delegate math, the primary standings and the vote history of every group of voters come from the same model that runs the On Point forecast. The midterm edition is still one click away from the title screen.</p>
        <AdUnit k="about1" minH={250} />
        <ul className="px-how">
          <li><b>County ground game</b><span>Every county from the On Point forecast: rallies, field offices, door knocking and local ads, with the other campaign working counties too.</span></li>
          <li><b>Primaries</b><span>Iowa to June, real delegate rules, rivals who drop out and endorse.</span></li>
          <li><b>Endorsements</b><span>Chase the endorsements that move each party&apos;s voters.</span></li>
          <li><b>Debate stage</b><span>Real 2028 issues, a timing meter for every answer and a live focus group.</span></li>
          <li><b>Running mates</b><span>Home state edges from the model, a VP debate and a second campaign trail.</span></li>
          <li><b>Convention</b><span>Nobody at a majority means a contested floor and a deal to cut.</span></li>
          <li><b>270 to win</b><span>Every state and the Maine and Nebraska districts on a pixel tile map.</span></li>
          <li><b>Vote history</b><span>Turnout drives aimed at six vote history groups from 1,152 per county.</span></li>
          <li><b>Third parties</b><span>Ten third party options, each drawing votes by lane.</span></li>
          <li><b>Stances follow you</b><span>What you said to win the primary, independents remember in November.</span></li>
          <li><b>Campaign managers</b><span>Hire a data guru, ad maker, field general, finance chair or message guru.</span></li>
          <li><b>Scandals</b><span>Hot mics, leaked memos and an October surprise, with safe and risky answers.</span></li>
          <li><b>Opposition research</b><span>Dig into your opponent&apos;s weakest positions and pick when to drop the hit.</span></li>
          <li><b>Fog of war</b><span>Your map is your campaign&apos;s read; internal polls sharpen it.</span></li>
          <li><b>Super PACs and ad tone</b><span>Outside money on both sides, and attack ads that can backfire.</span></li>
          <li><b>Election night</b><span>Storms and long lines on Election Day, then the calls come in as polls close.</span></li>
          <li><b>Trophies</b><span>Fifteen to earn, from a clean early sweep to a 400 vote landslide.</span></li>
        </ul>
        <AdUnit k="about2" minH={250} />
      </section>
    </div>
  );
}
