import type { Metadata } from "next";
import { getEndorsements } from "../data";
import { Pointy } from "@/app/components/home/Mascot";
import EndorseBoard from "./EndorseBoard";
import "./endorse.css";

export const metadata: Metadata = {
  title: "Endorsements",
  description: "Every notable endorsement in the 2026 Senate and governor races: presidents, governors, senators, unions, groups, newspapers, celebrities and podcasters, each with its source.",
};

export default function Page() {
  const e = getEndorsements();
  const total = e.races.reduce((a, r) => a + r.n, 0);
  const endorsers = new Set(e.races.flatMap((r) => r.cands.flatMap((c) => c.list.map((x) => x.by)))).size;
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · Endorsements</div>
          <h1>Who is backing <em>whom.</em></h1>
          <p className="lede">{total.toLocaleString()} endorsements from {endorsers.toLocaleString()} people and groups across all {e.races.length} Senate and governor races on the 2026 ballot. Filter by who is doing the endorsing, open any race, and every line links to where it was reported.</p>
        </div>
        <Pointy className="en-pty keep" pose="point" prop="clipboard" size={116} look={-1} flip detective say={<>Look for the cross party ones. They tell you who thinks a race is close.</>} />
      </header>
      <EndorseBoard data={e} />
      <p className="wd-src">Researched {e.asOf} from each race&apos;s Wikipedia endorsement list, campaign and union pages and local news. {e.unconfirmed.length} claims that could not be confirmed are left out and listed at the bottom. An endorsement is a public statement of support, not money.</p>
    </>
  );
}
