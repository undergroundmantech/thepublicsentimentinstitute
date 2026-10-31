import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { AGGREGATES } from "@/app/_polling/lib/aggregates";
import { pollHref, PRIMARIES } from "@/app/polls/registry";
import { getModel } from "@/app/lib/forecastData";
import { STATE_NAME, raceHref } from "@/app/lib/opp";
import SearchBox, { type Entry } from "./SearchBox";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Search races, candidates and polls", "description": "Find any race, state, candidate or polling average.", "path": "/search"});

const PAGES: [string, string, string][] = [
  ["/polls", "Polling averages", "every tracked average"], ["/forecast", "Forecast", "Senate, House and governor"], ["/maps/electoral", "Electoral map", "build a map"],
  ["/maps/early-vote", "Early vote tracker", "ballots requested and returned"], ["/maps/party-registration", "Party registration", "voter rolls by party"],
  ["/maps/voter-registration", "Voter registration", "registered voters"], ["/results", "Results", "election results center"], ["/results/tonight", "Live results desk", "election night"],
  ["/results/archive", "Results archive", "past nights"], ["/on-point-polling", "On Point Polling", "polling research and survey fieldwork"], ["/on-point-polling/polls", "On Point Polling poll releases", "On Point Polling fieldwork"], ["/on-point-polling/methodology", "Methodology", "gold standard pollsters DSMeridian"],
  ["/on-point-polling/services", "Partner with On Point Polling", "commission a poll"], ["/on-point-polling/weighting-room", "The Weighting Room", "subscriber community"], ["/contact", "Contact", "email the desk"], ["/on-point-polling/sms", "SMS updates", "text alerts"], ["/terms", "Privacy policy and terms", "legal"],
];

export default function Page() {
  const entries: Entry[] = [];
  for (const [href, title, sub] of PAGES) entries.push({ href, title, sub, kind: "Pages", keys: `${title} ${sub}`.toLowerCase() });
  for (const r of getModel().races) {
    const office = r.office === "house" ? "House" : r.office === "senate" ? "Senate" : "Governor";
    entries.push({ href: raceHref(r.id), title: r.name, sub: `${r.dem} vs ${r.gop}`, kind: `${office} forecast`, keys: `${r.name} ${r.state} ${r.st} ${r.dem} ${r.gop} ${office}`.toLowerCase() });
  }
  for (const d of AGGREGATES) {
    entries.push({ href: pollHref(d.id), title: d.title.replace(/ — /g, ", "), sub: d.category, kind: "Polling averages", keys: `${d.title} ${d.label} ${d.category} ${d.stateAbbr ? STATE_NAME[d.stateAbbr] ?? "" : ""}`.toLowerCase() });
  }
  for (const [k, v] of Object.entries(PRIMARIES)) entries.push({ href: `/polls/${k}`, title: v.title, kind: "Polling averages", keys: v.title.toLowerCase() });
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Search</span></nav>
      <header className="ph">
        <div className="eye g">Search</div>
        <h1>Find a <em>race</em></h1>
        <p className="lede">Search every forecast, polling average and page on On Point Politics by race, state or candidate.</p>
        <div className="pmeta"><span>Indexed <b className="mono">{entries.length.toLocaleString()}</b></span><span>Forecasts <b className="mono">{getModel().races.length}</b></span><span>Averages <b className="mono">{AGGREGATES.length + Object.keys(PRIMARIES).length}</b></span></div>
      </header>
      <SearchBox entries={entries} />
    </div>
  );
}
