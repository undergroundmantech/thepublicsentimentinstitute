import type { Metadata } from "next";
import Matchup from "../Matchup";
import Method from "../Method";
import { getCands, getGenBase, getGenNames, getGrid } from "../server";

export const metadata: Metadata = {
  title: "2028 General Election Forecast | On Point Politics",
  description: "Pick the 2028 nominees: every county forecast and 4,000 simulations, added up into every state and the Electoral College.",
  alternates: { canonical: "/2028/general" },
};
export default function General28() {
  return (
    <main className="wrap x28-main">
      <section className="x28-head"><div className="eye g">2028 general election</div><h1>Pick the nominees, <span className="gt">read every county.</span></h1>
        <p className="lede">Choose a Democrat and a Republican. Every pairing is the On Point 2028 Forecast&apos;s own general election forecast, carried down to all 3,142 counties, and each state is the sum of its counties.</p></section>
      <Matchup base={getGenBase()} cands={getCands()} mode="general" grid={getGrid()} gnames={getGenNames()} />
      <Method />
    </main>
  );
}
