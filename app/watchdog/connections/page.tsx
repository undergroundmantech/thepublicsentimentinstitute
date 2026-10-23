import type { Metadata } from "next";
import Connections from "./Connections";
import { getGraph } from "../data";
import "./connections.css";

export const metadata: Metadata = { title: "Connections", description: "A map of who is tied to whom in the 2026 midterms: donors, super PACs, candidates and the firms they pay, linked by the money they move, the campaign stops they make and the endorsements they give." };

export default function Page() {
  const graph = getGraph();
  return (
    <>
      <header className="wd-hero cx-hero">
        <div>
          <div className="eye gold">Watchdog · Connections</div>
          <h1>Who is tied <em>to whom.</em></h1>
          <p className="lede">Every donor, super PAC, candidate and firm we track, and the money, campaign stops and endorsements that link them. Each line on the map is one tie, and every tie can be read as a plain sentence with its source.</p>
        </div>
      </header>
      <Connections graph={graph} />
      <p className="wd-src">{graph.nodes.length.toLocaleString("en-US")} names and {graph.edges.length.toLocaleString("en-US")} ties. Money comes from public reporting on FEC filings and from Ledger, On Point&apos;s FEC tracker. Campaign stops and endorsements come from news reports. A tie means money moved or a public act happened. It never means wrongdoing.</p>
    </>
  );
}
