import type { Metadata } from "next";
import TrailMap from "./TrailMap";
import { getTrail } from "../data";
import "../trail.css";

export const metadata: Metadata = { title: "The campaign trail", description: "Where Trump, Vance, Obama, Harris and other national figures are campaigning in the 2026 midterms, who is putting attention on which state, and who endorsed whom." };

export default function Page() {
  const data = getTrail();
  const stops = data.visits.length, people = data.people.filter((p) => p.visits).length;
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · Campaign trail</div>
          <h1>Who is showing up, <em>and where.</em></h1>
          <p className="lede">{stops} confirmed campaign stops by {people} national figures since August, plus the podcasters, influencers and donors putting attention on single races, and every major endorsement. Press play to watch the midterms unfold.</p>
        </div>
      </header>
      <TrailMap data={data} />
    </>
  );
}
