import PollingAveragesPage, { type ForecastLink } from "@/app/_polling/genericballot/GenericBallotV2";
import { getModel, isInd } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import JsonLd from "@/app/components/JsonLd";
import Link from "@/app/components/Link";
import "./promo.css";
import { aggById } from "./registry";
import { AGGREGATES, buildAggregate } from "@/app/_polling/lib/aggregates";
import { avgLd, avgSummary } from "./seo";

/** Forecast race pages the averages page can link to, keyed `sen-GA` / `gov-GA`. Built on the
 *  server from the model so the client gets a small lookup, not the model. */
function forecastLinks(): Record<string, ForecastLink> {
  const out: Record<string, ForecastLink> = {};
  try {
    for (const r of getModel().races) {
      if (r.office === "house") continue;
      out[`${r.office === "senate" ? "sen" : "gov"}-${r.st}`] = { href: raceHref(r.id), m: r.stages.rate, ind: isInd(r) };
    }
  } catch { /* no model build: the page simply shows no forecast link */ }
  return out;
}

const TIMELINE: Record<string, string> = { "trump-approval": "/polls/approval/timeline", "generic-ballot": "/polls/generic-ballot/timeline" };

/** The page's own average built on the server, so the browser draws it without building it. */
function initialBuild(id: string) {
  const def = AGGREGATES.find((d) => d.id === id);
  return def ? buildAggregate(def) : undefined;
}

/** One polling average on its canonical route. The averages engine renders the page; the
 *  route only picks which average opens first. */
export default function Average({ id }: { id: string }) {
  const def = aggById(id);
  const s = def ? avgSummary(def) : null;
  const group = !s ? "" : s.def.category === "2026 Senate" ? "Senate" : s.def.category.includes("overnor") ? "Governor" : "";
  const crumbs: [string, string][] = [["Home", "/"], ["Polls", "/polls"]];
  if (group) crumbs.push([group, group === "Senate" ? "/polls/senate" : "/polls/governor"]);
  if (s) crumbs.push([s.headline, s.path]);
  return (
    <>
      {s ? <JsonLd data={avgLd(s, crumbs)} /> : null}
      {TIMELINE[id] ? (
        <Link href={TIMELINE[id]} className="opp avg-tl" data-ev="Timeline opened" data-ev-d={JSON.stringify({ from: id })}>
          <span className="k">New</span><b>Walk the timeline</b><span>Scroll the whole term day by day with Pointy, with every major event marked on the line</span><i aria-hidden="true">Open</i>
        </Link>
      ) : null}
      <PollingAveragesPage initialId={id} forecast={forecastLinks()} initialBuilt={initialBuild(id)} />
    </>
  );
}
