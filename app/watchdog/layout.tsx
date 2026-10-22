import type { Metadata } from "next";
import WatchdogNav from "./WatchdogNav";
import Ambient from "@/app/components/opp/Ambient";
import "./watchdog.css";

export const metadata: Metadata = {
  title: { default: "Watchdog: who is spending, who is campaigning, and who gets paid", template: "%s | Watchdog | On Point Politics" },
  description: "Follow the money and the people in the 2026 midterms: outside spending by race, super PAC donors and the firms they pay, where Trump, Vance, Obama and others are campaigning, endorsements, and every county's data.",
};

export default function WatchdogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="opp wd fx-dark">
      <Ambient />
      <WatchdogNav />
      {children}
    </div>
  );
}
