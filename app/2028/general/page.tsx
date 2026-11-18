import type { Metadata } from "next";
import Matchup from "../Matchup";
import Method from "../Method";
import AdUnit from "@/app/components/AdUnit";
import "../h28.css";
import { getCands, getGenBase, getGenNames, getGrid } from "../server";

export const metadata: Metadata = {
  title: "2028 General Election Forecast | On Point Politics",
  description: "Pick the 2028 nominees: every county forecast and 4,000 simulations, added up into every state and the Electoral College.",
  alternates: { canonical: "/2028/general" },
};
export default function General28() {
  return (
    <main className="wrap x28-main h28-page">
      <header className="h28-board p28-board x28-board"><div className="h28-board-top"><p className="h28-count"><i />2028 general election · every county</p></div><div className="h28-face-off prim"><div className="h28-mid wide"><h1 className="h28-h1">Pick the <em>2028</em> nominees</h1>
        <p>Choose a Democrat and a Republican. Every pairing is the On Point 2028 Forecast&apos;s own general election forecast, carried down to all 3,142 counties, and each state is the sum of its counties.</p></div></div></header>
      <Matchup base={getGenBase()} cands={getCands()} mode="general" grid={getGrid()} gnames={getGenNames()} />
      <AdUnit />
      <Method />
      <AdUnit kind="multiplex" />
    </main>
  );
}
