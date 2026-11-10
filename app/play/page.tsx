import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { Press_Start_2P, Pixelify_Sans } from "next/font/google";
import { type PIndex } from "./PlayApp";
import App28 from "./y28/App28";
import "./play.css";
import "./y28/play28.css";

const head = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--px-d", display: "swap" });
const body = Pixelify_Sans({ subsets: ["latin"], variable: "--px-b", display: "swap" });

export const metadata: Metadata = {
  title: "Campaign 2028: run for president",
  description: "A pixel campaign game built on the On Point Politics 2028 forecast. Run in the Democratic or Republican primaries, win the delegates and the nomination, pick a running mate and take ten weeks to 270 electoral votes, with every state, candidate and voter group from the On Point model.",
  alternates: { canonical: "/play" },
};

export default function Page() {
  const idx = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "play", "index.json"), "utf8")) as PIndex;
  return (
    <div className={`opp pg ${head.variable} ${body.variable}`}>
      <App28 idx={idx} />
      <section className="px-about">
        <h1>Campaign 2028</h1>
        <p>Run for president. Pick any of the 54 Democrats and Republicans in the On Point 2028 model and fight for the nomination state by state, from the first debate stages to the last primaries, or skip ahead to the general election. Every state&apos;s starting margin, every candidate&apos;s pull state by state, the delegate math, the primary standings and the vote history of every group of voters come from the same model that runs the On Point forecast. The midterm edition is still one click away from the title screen.</p>
        <ul className="px-how">
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
      </section>
    </div>
  );
}
