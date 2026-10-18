import type { Metadata } from "next";
import Link from "next/link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, pageLd, seo } from "@/app/lib/seo";
import SwingClient from "./SwingClient";
import { getSwingData } from "./data";

export const metadata: Metadata = seo({
  title: "2026 election swingometer: move the voters, move the forecast",
  description: "Shift any group of voters by race, age, education, gender, income, party, 2024 vote or turnout history and watch every Senate, governor and House race in the On Point Politics 2026 forecast move with them, with live vote counts and chamber odds.",
  path: "/forecast/swingometer",
  keywords: ["election swingometer", "2026 swingometer", "midterm scenario tool", "demographic swing", "turnout scenario", "2026 Senate forecast", "2026 House forecast"],
});

export default function Page() {
  const d = getSwingData();
  const updated = new Date(d.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const n = { s: d.races.filter((r) => r.o === "s").length, g: d.races.filter((r) => r.o === "g").length, h: d.races.filter((r) => r.o === "h").length };
  const desc = "An interactive scenario tool on the On Point Politics 2026 forecast: shift the vote margin or turnout of any group of voters and every race and chamber updates.";
  return (
    <div className="opp fc-wide">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["Forecast", "/forecast"], ["Swingometer", "/forecast/swingometer"]]),
        pageLd({ name: "2026 election swingometer", description: desc, path: "/forecast/swingometer", modified: d.updated }),
        { "@type": "WebApplication", name: "On Point Politics swingometer", url: "https://onpointpolitics.com/forecast/swingometer", applicationCategory: "ReferenceApplication", operatingSystem: "Any", isAccessibleForFree: true, description: desc, offers: { "@type": "Offer", price: 0, priceCurrency: "USD" } },
      )} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>Swingometer</span>
      </nav>
      <ForecastNav />
      <header className="ph">
        <div className="eye g">2026 swingometer</div>
        <h1>Move the voters, <em>move the map</em></h1>
        <p className="lede">
          Every slider starts at the On Point forecast. Shift how any group votes or how many of them turn out, from low propensity Trump voters to college graduates, and all {n.s} Senate races,
          {" "}{n.g} governor races and {n.h} House races move with them, along with the vote counts and each party&apos;s chance to win the Senate, the House and the governorships.
        </p>
        <div className="pmeta"><span>Forecast updated <b>{updated}</b></span><span>Days to the election <b className="mono">{d.daysOut}</b></span><span>Groups <b className="mono">{d.dims.reduce((a, x) => a + x.groups.length, 0)}</b></span></div>
      </header>

      <SwingClient />

      <div className="callout" style={{ marginTop: 16 }}>
        <div className="eye">How the swingometer works</div>
        Each Senate and governor race is built on the forecast&apos;s own simulated electorate, the same voters behind the estimated exit poll on its race page:
        how big each group is and how it splits. Turnout propensity is each kind of voter&apos;s modeled chance of voting, 80% or more for high propensity,
        and a 2024 Trump or Harris voter is placed in each kind of voter by how On Point Polling respondents like them recalled their 2024 vote. A vote margin slider moves that group&apos;s margin by the points you set, and a turnout slider grows or
        shrinks its share of the electorate. The race&apos;s margin moves by exactly what that does to the total, and its chance to win moves along the
        forecast&apos;s own range of outcomes, so a race with little polling moves more than a heavily polled one would on the same shift. House districts have no
        published electorate of their own, so each starts from its state&apos;s and is tilted toward the district&apos;s partisanship: a deep blue city seat counts
        more Democrats and more Black voters, a rural seat more white voters without a degree. Chamber odds move the forecast&apos;s full range of seat outcomes by
        the change in expected seats. With every slider at zero, every number is the published forecast. <Link href="/forecast/methodology" style={{ textDecoration: "underline" }}>Forecast methodology</Link>.
      </div>
    </div>
  );
}
