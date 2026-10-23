import type { Metadata } from "next";
import WatchdogNav from "./WatchdogNav";
import "./watchdog.css";
import "./terminal.css";
import "./light.gen.css";
import "./light.css";

export const metadata: Metadata = {
  title: { default: "Watchdog: who is spending, who is campaigning, and who gets paid", template: "%s | Watchdog | On Point Politics" },
  description: "Follow the money and the people in the 2026 midterms: outside spending by race, super PAC donors and the firms they pay, where Trump, Vance, Obama and others are campaigning, endorsements, and every county's data.",
};

export default function WatchdogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="opp wd wdt fx-dark">
      <div className="wdt-bg" aria-hidden="true"><i className="grid" /><i className="scan" /><i className="vig" /></div>
      <WatchdogNav />
      {children}
    </div>
  );
}
