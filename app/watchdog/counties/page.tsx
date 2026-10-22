import type { Metadata } from "next";
import CountyCenter from "./CountyCenter";
import "./counties.css";
import "../connections/connections.css";

export const metadata: Metadata = { title: "County data center", description: "Every US county on one map: presidential results since 2016, the 2026 forecast, the simulated 2026 electorate with low propensity Trump and Harris voters, Trump approval, gas prices, who lives there, campaign stops and every data center fight we track." };

export default function Page() {
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · County data center</div>
          <h1>Every county, <em>everything we know.</em></h1>
          <p className="lede">3,142 counties on one map. Color it by the 2024 result, the 2026 forecast, the low propensity Trump and Harris voters each side needs to turn out, Trump approval, the price of gas, who lives there, where the candidates have campaigned, or where the data centers are going. Click any county for its whole simulated electorate.</p>
        </div>
      </header>
      <CountyCenter />
      <p className="wd-src">Results from Ledger&apos;s county file, compiled from news tallies; the forecast from the On Point model; adults and citizens of voting age by race and ethnicity from the Census Bureau&apos;s CVAP tables; the simulated 2026 electorate from the forecast's voter file, built from On Point Polling respondents and certified 2022 and 2024 turnout; Trump approval from On Point Polling's county estimates; gas prices from AAA; campaign stops from the Watchdog trail; data center projects from company releases, local government records and news reports.</p>
    </>
  );
}
