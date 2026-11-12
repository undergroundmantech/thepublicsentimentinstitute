import type { Metadata } from "next";
import PrimView from "../PrimView";
import Method from "../Method";
import { getPrimSummary } from "../server";

export const metadata: Metadata = {
  title: "2028 Primary Forecast | On Point Politics",
  description: "The 2028 Democratic and Republican primaries: nomination odds, every state in calendar order and every county.",
  alternates: { canonical: "/2028/primaries" },
};
export default function Primaries28() {
  return (
    <main className="wrap x28-main">
      <section className="x28-head"><div className="eye g">2028 primaries</div><h1>Both nominations, <span className="gt">state by state.</span></h1>
        <p className="lede">The calendar simulation runs every primary in order, drops candidates who fall short and moves their voters to the most similar rival. Each state shows its race as it typically stands on its date, spread over its counties so the counties add to the state.</p></section>
      <PrimView sum={getPrimSummary()} />
      <Method />
    </main>
  );
}
