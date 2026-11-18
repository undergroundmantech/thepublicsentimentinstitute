import type { Metadata } from "next";
import Matchup from "../Matchup";
import Method from "../Method";
import AdUnit from "@/app/components/AdUnit";
import "../h28.css";
import { getCands, getDefault } from "../server";
import { fromDefault } from "../lib";

export const metadata: Metadata = {
  title: "Pick a 2028 Ticket | On Point Politics",
  description: "Build a 2028 ticket: nominees, running mates and a third party candidate, forecast in every county and simulated 4,000 times.",
  alternates: { canonical: "/2028/ticket" },
};
export default function Ticket28() {
  return (
    <main className="wrap x28-main h28-page">
      <header className="h28-board p28-board x28-board"><div className="h28-board-top"><p className="h28-count"><i />Running mates and third parties</p></div><div className="h28-face-off prim"><div className="h28-mid wide"><h1 className="h28-h1">Build the <em>2028</em> ticket</h1>
        <p>Nominees, running mates and a third party candidate. Running mates count at a quarter of a nominee in their coalitions and issues and add their home state; a third party draws from the voter types it appeals to in each county.</p></div></div></header>
      <Matchup base={fromDefault(getDefault())} cands={getCands()} mode="ticket" />
      <AdUnit />
      <Method />
      <AdUnit kind="multiplex" />
    </main>
  );
}
