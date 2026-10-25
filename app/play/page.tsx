import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import PlayApp, { type PIndex } from "./PlayApp";
import "./play.css";

export const metadata: Metadata = {
  title: "Campaign 2026: run a Senate or governor campaign",
  description: "A campaign game built on the On Point Politics forecast. Pick a close Senate or governor race, pick a candidate and a difficulty, then raise money, work the counties, hire pollsters and consultants, buy the air war, build the turnout operation and answer the week's news. Voters react the way the site's own data says they would.",
  alternates: { canonical: "/play" },
};

export default function Page() {
  const idx = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "play", "index.json"), "utf8")) as PIndex;
  return (
    <div className="opp pg">
      <PlayApp idx={idx} />
      <section className="pg-hero">
        <h1 className="sr">Campaign 2026</h1>
        <p>Take over a real campaign on Labor Day and run it to Election Day. Raise the money, work the counties, hire your pollster and consultants, fight the air war, build the turnout operation and decide what to say when the news breaks. Voters react the way On Point&apos;s data says they would: the forecast, every county, the voter groups, the polls, the donor map and the money are the real ones for your race, and the decisions come from what is really happening in it, each with its source.</p>
        <ul className="pg-how">
          <li><b>Eight weeks</b><span>Six days on the trail each week, and only so much energy.</span></li>
          <li><b>{idx.races.length} races</b><span>Every Senate and governor race within 15 points.</span></li>
          <li><b>Four levels</b><span>From Safe Seat to Wave Against You.</span></li>
          <li><b>Election night</b><span>Watch your counties come in, one by one.</span></li>
        </ul>
      </section>
    </div>
  );
}
