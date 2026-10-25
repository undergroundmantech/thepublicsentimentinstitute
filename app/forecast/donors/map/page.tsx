import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { seo } from "@/app/lib/seo";
import DonorMap, { type DMIndex } from "./DonorMap";
import "../donors.css";
import "./map.css";

export const metadata: Metadata = seo({
  title: "The donor map: 2022, 2024 and 2026, county by county",
  description: "Every county's political donors across three cycles: how many people give, how much, which party gets it, how much comes in gifts under $200, and how each moved since 2022, for House, Senate, President and all 36 governor races.",
  path: "/forecast/donors/map",
});

export default function Page() {
  const p = path.join(process.cwd(), "public", "forecast", "donormap", "index.json");
  const idx = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as DMIndex) : null;
  const have = idx ? Object.keys(idx.cycles) : [];
  const govN = idx ? Math.max(0, ...Object.values(idx.cycles).map((c) => c.gov.length)) : 0;
  return (
    <div className="opp dn dnm">
      <ForecastNav />
      <header className="dn-hero">
        <div className="eye g">Forecast · Donor map</div>
        <h1>Three cycles of donors, <span className="grad">every county.</span></h1>
        <p>Where the people who give to campaigns live, and how that changed from the 2022 midterms through the 2024 presidential race to 2026: every itemized gift and every ActBlue and WinRed line to House, Senate and presidential campaigns, plus governor nominees from the state filings, each placed in the donor&apos;s county. Pick a cycle, an office and a measure; click a county for its top recipients or a state to zoom in.</p>
      </header>
      {idx ? <DonorMap idx={idx} /> : <p className="dn-note">The donor map files are not built yet.</p>}
      <section className="dn-sec glass dn-src">
        <div className="dn-sh"><h2>How the map is built</h2><span>Built {idx?.built.slice(0, 10) ?? "not yet"}</span></div>
        <p className="dn-note">Federal money is the FEC&apos;s bulk file of itemized individual gifts for each cycle. Each candidate&apos;s own committees count, plus every ActBlue and WinRed line that names the campaign it was earmarked for; the campaign&apos;s copy of the same earmarked gift is dropped so nothing counts twice. Gifts are banded by size, refunds come off, and each ZIP code is split among the counties it touches by land area. The comparison window is January 1 of the year before the election through September 30 of the election year, so 2022 and 2024 line up with 2026 at the same point. Donations are counted per 1,000 adults, from the Census adult population.</p>
        <p className="dn-note">Governor money comes from each state&apos;s campaign finance office, since governors do not file with the FEC. Where a state publishes a bulk file it is read whole; elsewhere each nominee&apos;s contributions were exported from the state&apos;s search. State files differ in what they record, so a state whose file does not say who gave counts every itemized gift. {govN ? `${govN} of 36 states are in so far.` : "States are added as their files come in."}</p>
        <p className="dn-note">Cycles on the map now: {have.join(", ") || "none"}. {have.length < 3 ? "The others appear when their pulls finish." : ""} Until the 2026 pull is rerun with the same method, 2026 shows the October 20 donor map, which counts donations but not the party split by county. Connecticut&apos;s 2026 figures there are by planning region, which the county map does not draw. <Link href="/forecast/donors">Each race&apos;s donor coalition</Link></p>
      </section>
    </div>
  );
}
