import type { Metadata } from "next";
import Connections from "./Connections";
import { getGraph } from "../data";
import "./connections.css";

export const metadata: Metadata = { title: "Connections", description: "Trace any candidate, super PAC, donor or firm in the 2026 midterms through the money, the campaign stops and the endorsements that tie them together." };

export default function Page() {
  const graph = getGraph();
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · Connections</div>
          <h1>Every name, <em>tied by money.</em></h1>
          <p className="lede">Pick a candidate, a super PAC, a donor or a firm. Everyone tied to it by money, a campaign stop or an endorsement gathers around it, and gold motes travel the way the money moved. Click any body to follow its own web.</p>
        </div>
      </header>
      <Connections graph={graph} />
      <p className="wd-src">{graph.nodes.length} names and {graph.edges.length} ties. Money from public reporting on FEC filings and from Ledger, On Point&apos;s FEC tracker; campaign stops and endorsements from news reports. Ties mean money moved or a public act happened, never wrongdoing.</p>
    </>
  );
}
