import type { Metadata } from "next";
import ForecastDesk from "./ForecastDesk";
import ForecastHub from "./ForecastHub";

export const metadata: Metadata = {
  title: "The Forecast · TPSI",
  description:
    "TPSI's 2026 midterm forecast for governors, the Senate and the House, from fundamentals, polling and 10,000 correlated simulations. Recolor the map by winner, rating, margin, chance, shift or turnout, open any race down to its counties, or simulate election night.",
};

export default function ForecastPage() {
  return (
    <>
      <ForecastHub />
      <div id="desk">
        <ForecastDesk />
      </div>
    </>
  );
}
