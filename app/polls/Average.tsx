import PollingAveragesPage, { type ForecastLink } from "@/app/_polling/genericballot/GenericBallotV2";
import { getModel, isInd } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import JsonLd from "@/app/components/JsonLd";
import { aggById } from "./registry";
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
      <PollingAveragesPage initialId={id} forecast={forecastLinks()} />
    </>
  );
}
