import type { Metadata } from "next";
import CountyCenter from "./CountyCenter";
import "./counties.css";
import "../connections/connections.css";

export const metadata: Metadata = { title: "County data center", description: "Every US county on one map: presidential results since 2016, the 2026 forecast, who lives there, and every data center project and local fight we track." };

export default function Page() {
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · County data center</div>
          <h1>Every county, <em>everything we know.</em></h1>
          <p className="lede">3,142 counties on one map. Color it by the 2024 result, the shift since 2020, the 2026 forecast, who lives there, or where the data centers are going, the fight that voters in Iowa and Kansas now oppose by about two to one.</p>
        </div>
      </header>
      <CountyCenter />
      <p className="wd-src">Results from Ledger&apos;s county file, compiled from news tallies; the forecast from the On Point model; adults and citizens of voting age by race and ethnicity from the Census Bureau&apos;s CVAP tables; data center projects from company releases, local government records and news reports. Census income, education and local places layers are coming next.</p>
    </>
  );
}
