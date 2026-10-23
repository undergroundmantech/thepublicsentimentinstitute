import type { Metadata } from "next";
import TrailMap from "./TrailMap";
import { getTrail } from "../data";
import "../trail.css";

export const metadata: Metadata = { title: "The campaign trail", description: "Where the 2026 Senate and governor nominees and national figures like Trump, Vance, Obama and Harris are campaigning, who is putting attention on which state, and who endorsed whom." };

export default function Page() {
  const data = getTrail();
  const stops = data.visits.length, people = data.people.filter((p) => p.visits).length, cand = data.visits.filter((v) => v.cand).length;
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · Campaign trail</div>
          <h1>Who is showing up, <em>and where.</em></h1>
          <p className="lede">{stops} confirmed campaign stops since August by {people} people: {cand} by the Senate and governor nominees themselves and the rest by the national figures campaigning for them. Plus the podcasters, influencers and donors putting attention on single races, and every major endorsement. Press play to watch the midterms unfold.</p>
        </div>
      </header>
      <TrailMap data={data} />
    </>
  );
}
