import type { Metadata } from "next";
import ForecastDesk from "./ForecastDesk";

export const metadata: Metadata = {
  title: "The Forecast · TPSI",
  description:
    "TPSI's 2026 midterm forecast — governors, Senate, and House, from fundamentals, polling, expert ratings, and 10,000 correlated simulations.",
};

export default function ForecastPage() {
  return <ForecastDesk />;
}
