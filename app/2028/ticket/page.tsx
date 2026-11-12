import type { Metadata } from "next";
import Matchup from "../Matchup";
import Method from "../Method";
import { getCands, getDefault } from "../server";

export const metadata: Metadata = {
  title: "Pick a 2028 Ticket | On Point Politics",
  description: "Build a 2028 ticket: nominees, running mates and a third party candidate, forecast in every county and simulated 4,000 times.",
  alternates: { canonical: "/2028/ticket" },
};
export default function Ticket28() {
  return (
    <main className="wrap x28-main">
      <section className="x28-head"><div className="eye g">Pick a ticket</div><h1>Build the 2028 ticket, <span className="gt">see where it wins.</span></h1>
        <p className="lede">Nominees, running mates and a third party candidate. Running mates count at a quarter of a nominee in their coalitions and issues and add their home state; a third party draws from the voter types it appeals to in each county.</p></section>
      <Matchup def={getDefault()} cands={getCands()} mode="ticket" />
      <Method />
    </main>
  );
}
