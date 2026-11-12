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
        <p className="lede">The official run puts every candidate on every state&apos;s ballot at once, with no dropouts, and simulates each state 4,000 times with the 2026 model&apos;s error structure. Take any candidate out or put them back in, and every state and county reruns. Each state is the sum of its counties.</p></section>
      <PrimView sum={getPrimSummary()} />
      <Method />
    </main>
  );
}
