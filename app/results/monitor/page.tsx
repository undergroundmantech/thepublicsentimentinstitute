import type { Metadata } from "next";
import Monitor from "./Monitor";
import { getModel } from "@/app/lib/forecastData";
import "./monitor.css";

export const metadata: Metadata = {
  title: "Situation monitor: every November 3 race",
  description: "A full screen globe of every 2026 Senate, House, governor, statewide, ballot measure and legislative race, live from civicAPI against the On Point Politics forecast.",
  alternates: { canonical: "https://onpointpolitics.com/results/monitor" },
};

export default function Page() {
  const m = getModel();
  const c = m.chambers;
  return (
    <Monitor chambers={{
      sen: { notD: m.meta.senNotUpD, notR: m.meta.senNotUpR, dS: c.senate.demSeats, pD: c.senate.demControl },
      house: { dS: c.house.demSeats, pD: c.house.demControl },
      gov: { notD: m.meta.govNotUpD, notR: m.meta.govNotUpR, dS: c.governor.demSeats, pD: c.governor.demControl },
    }} />
  );
}
