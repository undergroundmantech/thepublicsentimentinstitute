import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import { Press_Start_2P, Pixelify_Sans } from "next/font/google";
import PlayApp, { type PIndex } from "./PlayApp";
import "./play.css";

const head = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--px-d", display: "swap" });
const body = Pixelify_Sans({ subsets: ["latin"], variable: "--px-b", display: "swap" });

export const metadata: Metadata = {
  title: "Campaign 2026: run a Senate or governor campaign",
  description: "A pixel campaign game built on the On Point Politics forecast. Pick a close Senate or governor race and run the last eight weeks from a campaign bus: meet the people who matter, fight the air war, build a real turnout operation, take the debate stage and sweat out a long election night, with the real events of each race.",
  alternates: { canonical: "/play" },
};

export default function Page() {
  const idx = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "play", "index.json"), "utf8")) as PIndex;
  return (
    <div className={`opp pg ${head.variable} ${body.variable}`}>
      <PlayApp idx={idx} />
      <section className="px-about">
        <h1>Campaign 2026</h1>
        <p>Take over a real campaign on Labor Day and run it to Election Day. Send the bus county to county, meet party chairs, union bosses, megadonors and podcasters, fight the air war, register voters and bank early ballots, take the debate stage and watch the returns come in past midnight. You never see the true county numbers, only your campaign&apos;s read of them, as sharp as your polling and as fresh as your last visit. Voters react the way On Point&apos;s data says they would, and the events, ads, endorsements and debates come from what is really happening in each race, with sources.</p>
        <ul className="px-how">
          <li><b>{idx.races.length} races</b><span>Every Senate and governor race within 15 points.</span></li>
          <li><b>Fog of war</b><span>Polls and ground teams sharpen your county read; it goes stale.</span></li>
          <li><b>Real turnout</b><span>Enthusiasm, registration, early votes, Election Day weather and lines.</span></li>
          <li><b>Debate stage</b><span>Real issues, a delivery meter, comebacks and a live dial.</span></li>
          <li><b>A real rival</b><span>The other campaign picks a plan every week, as sharp as its real money, incumbency and odds.</span></li>
          <li><b>Made for the camera</b><span>Work the crowd at rallies, cut ads in the studio, crisis clocks, whale alerts and calling the race yourself.</span></li>
          <li><b>The Kalshi line</b><span>Your race opens at its live Kalshi price and trades on the public polls all campaign.</span></li>
          <li><b>Trophies</b><span>Crises, the chaos wheel, viral rallies and hot streaks, with a trophy case to fill.</span></li>
          <li><b>Election night</b><span>Mail and Election Day votes in batches, a needle, and the call.</span></li>
        </ul>
      </section>
    </div>
  );
}
