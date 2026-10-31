import type { Metadata } from "next";
import Link from "@/app/components/Link";
import fs from "node:fs";
import path from "node:path";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { seo } from "@/app/lib/seo";
import DonorExplorer, { type DRace } from "./DonorExplorer";
import "./donors.css";

export const metadata: Metadata = seo({
  title: "Donor coalitions: who funds the 2026 midterms, and where",
  description: "The 2026 House and Senate donor map, about two billion dollars in itemized gifts and ActBlue and WinRed lines through September 30, county by county: each race's small and large donors, in state and out of state money, and how each nominee's donor coalition lines up with the voters, plus how the forecast uses it.",
  path: "/forecast/donors",
});

type DFile = {
  meta: { as_of_transactions: string; period: string; total: number; contributions: number; by_source: Record<string, number>; national: Record<string, number> };
  k: number; dead: number; cap: number; fits: Record<string, { coef: number[]; sd: number; n: number }>;
  national: { bands_n: number[]; parties: Record<string, { mapped: number; raised: number }>; by_source: Record<string, number> };
  states: { st: string; donations: number; per1k: number; small: number }[];
  races: DRace[]; moved: string[];
};
const usd = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`);

export default function Page() {
  const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "donors.json"), "utf8")) as DFile;
  const nb = d.national.bands_n, nbT = nb.reduce((a, b) => a + b, 0);
  const P = d.national.parties, src = d.national.by_source, srcT = src.campaign + src.actblue + src.winred;
  const moved = d.moved.map((id) => d.races.find((r) => r.id === id)!).filter(Boolean);
  const races = d.races.filter((r) => r.D || r.R);
  const BAND = ["Under $200", "$200 to $999", "$1,000 to $2,499", "$2,500 and up"];
  return (
    <div className="opp dn">
      <ForecastNav />
      <header className="dn-hero">
        <div className="eye g">Forecast · Donor coalitions</div>
        <h1>Who funds the midterms, <span className="grad">and where they live.</span></h1>
        <p>{usd(d.meta.total)} in itemized gifts to 2026 House and Senate campaigns, {d.meta.contributions.toLocaleString()} donations through September 30, every ActBlue and WinRed line included and each one placed in the county the donor lives in. Here is each race&apos;s donor coalition, set against its voters, and how the forecast now reads it. <Link href="/forecast/donors/map">See the national donor map across 2022, 2024 and 2026</Link>.</p>
      </header>

      <section className="dn-kpis">
        <div className="glass"><span>Democratic candidates</span><b className="d">{usd(P.dem.mapped)}</b><small>mapped, of {usd(P.dem.raised)} raised</small></div>
        <div className="glass"><span>Republican candidates</span><b className="r">{usd(P.rep.mapped)}</b><small>mapped, of {usd(P.rep.raised)} raised</small></div>
        <div className="glass"><span>Through ActBlue</span><b>{Math.round((100 * src.actblue) / srcT)}%</b><small>WinRed {Math.round((100 * src.winred) / srcT)}%, direct to campaigns {Math.round((100 * src.campaign) / srcT)}%</small></div>
        <div className="glass"><span>Gifts under $200</span><b>{Math.round((100 * nb[0]) / nbT)}%</b><small>of every donation counted, {Math.round((100 * nb[3]) / nbT * 10) / 10}% are $2,500 and up</small></div>
      </section>

      <section className="dn-sec glass">
        <div className="dn-sh"><h2>What the forecast does with it</h2><span>New on October 25</span></div>
        <div className="dn-two">
          <div>
            <p>Every race with both nominees on file gets a donor score from four readings: the Democrat&apos;s share of the two nominees&apos; in state dollars, the share of donations, a count of people rather than dollars, how much more of one side&apos;s money comes in gifts under $200, and how far each side&apos;s donors reach into the other side&apos;s counties.</p>
            <p>Each reading is set against what a race of the same partisan lean and incumbency normally shows, fit across {d.fits.instate?.n ?? 400} races, so ActBlue&apos;s national size never counts as an edge. Inside one spread of normal the term is zero. Past it the race moves {d.k} logit per unit, capped at {d.cap}, through the fundamentals and census legs, so a well polled race barely moves. Governors file with the states and carry no donor term. <Link href="/forecast/methodology#donors">How the model works</Link></p>
          </div>
          <div>
            <span className="dn-k">Races past the normal range: {moved.length}</span>
            <ul className="dn-moved">
              {moved.slice(0, 14).map((r) => (
                <li key={r.id}><a href={`#${r.id}`}>{r.office === "senate" ? `${r.name}` : r.id.replace("house-", "")}</a><span>z {r.sig!.z > 0 ? "+" : ""}{r.sig!.z.toFixed(1)}</span><b className={r.sig!.shift_logit > 0 ? "d" : "r"}>{r.sig!.shift_logit > 0 ? "toward D" : "toward R"} {Math.abs(r.sig!.shift_logit).toFixed(3)}</b></li>
              ))}
            </ul>
            <p className="dn-note">Shift in logit before blending with the polls; most of these are House seats with little or no polling.</p>
          </div>
        </div>
      </section>

      <DonorExplorer races={races} />

      <section className="dn-sec glass">
        <div className="dn-sh"><h2>Where the donations come from</h2><span>Donations per 1,000 votes cast in 2024, every party</span></div>
        <div className="dn-states">
          {d.states.slice(0, 51).map((s) => (
            <div key={s.st} title={`${s.donations.toLocaleString()} donations, ${Math.round(s.small * 100)}% under $200`}>
              <b>{s.st}</b><span className="bar"><i style={{ width: `${Math.min(100, (100 * s.per1k) / d.states[0].per1k)}%` }} /></span><em>{Math.round(s.per1k)}</em>
            </div>
          ))}
        </div>
        <p className="dn-note">Donations by size band nationally: {BAND.map((b, i) => `${b} ${nb[i].toLocaleString()}`).join(", ")}.</p>
      </section>
      <p className="dn-note dn-src">Source: the On Point donor map built October 20 2026 from FEC candidate committee filings (itemized individual receipts, refunds netted), ActBlue and WinRed earmark lines from their raw filings (2025 midyear and year end, 2026 monthlies and quarterlies) and FEC bulk data through June 30; ZIP codes placed in counties by land area. Excludes joint fundraising transfers, unitemized direct gifts and candidate self funding. Money sources by type cover January 1 2025 to June 30 2026. Totals raised come from each campaign&apos;s FEC reports through September 30. Connecticut uses its planning regions.</p>
    </div>
  );
}
