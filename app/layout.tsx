import "./globals.css";
import "./opp.css";

import type { Metadata, Viewport } from "next";
import { Sora, Manrope, JetBrains_Mono } from "next/font/google";
import Navbar from "./components/Navbar";
import TickerBar from "./components/TickerBar";
import Footer from "./components/Footer";
import Ambient from "./components/Ambient";
import RolloutGate from "./components/RolloutGate";

// OnPoint Politics type: Sora for headlines and big numbers, Manrope for body,
// JetBrains Mono for anything tabular. globals.css maps these to --font-d, --font-b, --font-m.
const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-sora", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-manrope", display: "swap" });
const jbm = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-jbm", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://onpointpolitics.com"),
  title: { default: "OnPoint Politics", template: "%s | OnPoint Politics" },
  description: "Polling averages, county level forecasts and live election results for the 2026 midterms. Fieldwork and modeling by The Public Sentiment Institute.",
  applicationName: "OnPoint Politics",
  openGraph: { siteName: "OnPoint Politics", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#110019", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${sora.variable} ${manrope.variable} ${jbm.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <RolloutGate />
        <Ambient />
        <Navbar />
        <TickerBar />
        <main className="opp-main">
          <div className="opp-page">{children}</div>
        </main>
        <Footer />
      </body>
    </html>
  );
}
