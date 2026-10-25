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
  title: "The donor map: every race, every county, 2022 to 2026",
  description: "Where each campaign's donors live, county by county: every 2026 Senate, House and governor race, the 2024 presidential race and the 2022 midterms, with a shift view that compares 2026 against 2024 and 2022.",
  path: "/forecast/donors/map",
});

export default function Page() {
  const p = path.join(process.cwd(), "public", "forecast", "donormap", "index.json");
  const raw = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as DMIndex) : null;
  const idx = raw && Array.isArray(raw.fips) ? raw : null;
  const have = idx ? Object.keys(idx.cycles) : [];
  const govN = idx ? Math.max(0, ...Object.values(idx.cycles).map((c) => c.gov.length)) : 0;
  const nRaces = idx ? Object.values(idx.cycles).reduce((s, c) => s + (c.races?.length ?? 0), 0) : 0;
  return (
    <div className="opp dn dnm">
      <ForecastNav />
      <header className="dn-hero">
        <div className="eye g">Forecast · Donor map</div>
        <h1>Follow the money, <span className="grad">race by race.</span></h1>
        <p>Where each campaign&apos;s donors live, placed in their county. Look at every federal race at once, open a single race such as a 2026 Senate seat, a House district, a governor or the 2024 presidency, or switch to Shift to see how the Democratic share of donor dollars moved from 2022 or 2024 to 2026. Filter by gift size, hover a county for the numbers and click to pin it.</p>
      </header>
      {idx ? <DonorMap idx={idx} /> : <p className="dn-note">{raw ? "The donor map files are being rebuilt for the race view. They will be back shortly." : "The donor map files are not built yet."}</p>}
      <section className="dn-sec glass dn-src">
        <div className="dn-sh"><h2>How the map is built</h2><span>Built {idx?.built.slice(0, 10) ?? "not yet"}</span></div>
        <p className="dn-note">Federal money is the FEC&apos;s bulk file of itemized individual gifts for each cycle. Each candidate&apos;s own committees count, plus every ActBlue and WinRed line that names the campaign it was earmarked for; the campaign&apos;s copy of the same earmarked gift is dropped so nothing counts twice. Gifts are banded by size, refunds come off, and each ZIP code is split among the counties it touches by land area. The comparison window is January 1 of the year before the election through September 30 of the election year, so 2022 and 2024 line up with 2026 at the same point. Donations and dollars are measured per adult, from the Census adult population.</p>
        <p className="dn-note">Single races show the two nominees&apos; money only, from their own committees and earmarked ActBlue and WinRed lines. For past cycles the nominees are the leading Democrat and Republican by money raised; for 2026 they are the nominees on the forecast. The shift view compares each county&apos;s Democratic share of the two parties&apos; donor dollars at the same point in each cycle, so a county that moved from D 55% to D 61% shows as D +6. A race can be compared with the same seat in an earlier cycle or with any other race, such as a 2026 Senate race against the 2024 presidential race in the same counties. Counties with too little money to read are left blank.</p>
        <p className="dn-note">Small donors take two sources. The FEC&apos;s bulk file only lists a donor once their giving passes $200 in the cycle, or $200 in the year for ActBlue and WinRed. ActBlue and WinRed still itemize every earmarked gift in their own monthly reports, with the donor&apos;s ZIP code and the campaign it went to, so the map reads those reports too and adds every gift the bulk file left out. What no file can place is a gift of $200 or less sent straight to a campaign, by check or on its own website: campaigns report those only as one total, which each race card shows next to the candidate.</p>
        <p className="dn-note">Governor money comes from each state&apos;s campaign finance office, since governors do not file with the FEC. Where a state publishes a bulk file it is read whole; elsewhere each nominee&apos;s contributions were exported from the state&apos;s search. State files differ in what they record, so a state whose file does not say who gave counts every itemized gift. {govN ? `${govN} of 36 states are in so far.` : "States are added as their files come in."}</p>
        <p className="dn-note">Cycles on the map now: {have.join(", ") || "none"}, with {nRaces.toLocaleString()} races. {have.length < 3 ? "The others appear when their pulls finish." : ""} <Link href="/forecast/donors">Each race&apos;s donor coalition</Link></p>
      </section>
    </div>
  );
}
