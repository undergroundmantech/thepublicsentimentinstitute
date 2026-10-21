import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import JsonLd from "@/app/components/JsonLd";
import { seo, graph, pageLd, crumbsLd } from "@/app/lib/seo";
import { getMeasures, bmHref, GROUP_LABEL } from "@/app/forecast/measures/data";
import { STATE_NAME } from "@/app/lib/opp";
import MeasuresMap, { type MapMeasure } from "./MeasuresMap";

const PATH = "/maps/ballot-measures";

export function generateMetadata(): Metadata {
  const d = getMeasures();
  return seo({
    title: "2026 Ballot Measures Map: Projected Yes and No Votes by County | On Point Politics", absoluteTitle: true, path: PATH,
    description: `Every statewide ballot measure on the November 3, 2026 ballot, ${d.measures.length} questions in ${d.meta.states} states, mapped county by county with projected Yes and No votes, the chance each passes and the polls behind it.`,
    keywords: ["2026 ballot measures", "ballot measures map", "2026 ballot propositions", "ballot measure polls", "ballot measure results", "amendments on the ballot 2026"],
  });
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function BallotMeasuresMapPage() {
  const d = getMeasures();
  const list: MapMeasure[] = d.measures.map((m) => ({
    id: m.id, st: m.st, label: m.label, title: m.title, href: bmHref(m), yes: m.est.yes, p10: m.est.p10, p90: m.est.p90, prob: m.est.prob,
    threshold: m.threshold, votes: m.votes ?? null, category: GROUP_LABEL[m.group] ?? m.category,
  }));
  const geo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "geo.json"), "utf8")) as { frame: [number, number]; states: Record<string, string> };
  // county names for the states with measures only
  const all = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "counties.json"), "utf8"))._n as Record<string, string>;
  const fipsOf: Record<string, string> = { AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09", DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55", WY: "56" };
  const want = new Set(list.map((m) => fipsOf[m.st]).filter(Boolean));
  const names: Record<string, string> = {};
  for (const [f, n] of Object.entries(all)) if (want.has(f.slice(0, 2))) names[f] = n;
  names["DC-DISTRICT_OF_COLUMBIA"] = "District of Columbia";

  const byState = [...new Set(list.map((m) => m.st))].sort();
  const desc = "Every 2026 statewide ballot measure mapped by county with projected Yes and No votes.";
  return (
    <div className="opp">
      <JsonLd data={graph(pageLd({ name: "2026 Ballot Measures Map", description: desc, path: PATH, modified: d.meta.updated }),
        crumbsLd([["Home", "/"], ["Maps", "/maps"], ["Ballot measures", PATH]]))} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/maps">Maps</Link><span className="sep">/</span><span>Ballot measures</span></nav>
      <header className="ph">
        <div className="eye g">November 3, 2026</div>
        <h1>Ballot measures <em>map</em></h1>
        <p className="lede">All {d.measures.length} statewide ballot questions in {d.meta.states} states and the District of Columbia, with the projected Yes and No vote in every county, the chance each one passes and the polls behind the forecast.</p>
        <div className="pmeta"><span>Updated <b>{new Date(d.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</b></span><span>{d.meta.sims.toLocaleString()} simulations per measure</span><Link href="/forecast/measures">Measures forecast</Link></div>
      </header>

      <MeasuresMap measures={list} states={geo.states} frame={geo.frame} names={names} />

      <section className="card" style={{ marginTop: 16 }} aria-labelledby="bmm-all">
        <div className="card-h"><h3 id="bmm-all">Every measure, projected vote</h3><span className="eye" style={{ marginLeft: "auto" }}>{list.length} measures</span></div>
        <div className="tblwrap" style={{ maxHeight: 720, overflow: "auto" }}>
          <table className="tbl">
            <thead><tr><th>State</th><th>Measure</th><th style={{ textAlign: "right" }}>Yes votes</th><th style={{ textAlign: "right" }}>No votes</th><th style={{ textAlign: "right" }}>Yes</th><th style={{ textAlign: "right" }}>Needs</th><th style={{ textAlign: "right" }}>Chance to pass</th></tr></thead>
            <tbody>
              {byState.flatMap((s) => list.filter((m) => m.st === s).map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{STATE_NAME[s] ?? s}</td>
                  <td><Link href={`${PATH}?m=${m.id}`}>{m.label}</Link><span style={{ color: "var(--mute)" }}>{m.title ? `: ${m.title}` : ""}</span></td>
                  <td className="n">{m.votes ? fmt(m.votes.yes) : ""}</td><td className="n">{m.votes ? fmt(m.votes.no) : ""}</td>
                  <td className="n" style={{ color: m.yes >= m.threshold * 100 ? "#2fbf9b" : "#e8794a" }}>{m.yes.toFixed(1)}%</td>
                  <td className="n">{(m.threshold * 100).toFixed(0)}%</td><td className="n">{Math.round(m.prob * 100)}%</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--mute)", padding: "8px 14px 14px", margin: 0 }}>Projected votes are each county&apos;s expected 2026 turnout, less the share of voters who skip a ballot question, times its forecast Yes share. A measure that needs a supermajority or a share of all ballots cast is judged against that bar.</p>
      </section>
    </div>
  );
}
