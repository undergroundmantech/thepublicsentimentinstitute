import "./globals.css";
import "./opp.css";

import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import Navbar from "./components/Navbar";
import TickerBar from "./components/TickerBar";
import Footer from "./components/Footer";
import Ambient from "./components/Ambient";
import RolloutGate from "./components/RolloutGate";
import { THEME_INIT_SCRIPT } from "./lib/theme";

// Same type system as the main site: Geist for display and body, JetBrains Mono for data.
// globals.css maps --font-display, --font-body and --font-numeric to --font-d, --font-b, --font-m.
const display = Geist({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Geist({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const numeric = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-numeric", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://onpointpolitics.com"),
  title: { default: "OnPoint Politics", template: "%s | OnPoint Politics" },
  description: "Polling averages, county level forecasts and live election results for the 2026 midterms. Fieldwork and modeling by The Public Sentiment Institute.",
  applicationName: "OnPoint Politics",
  openGraph: { siteName: "OnPoint Politics", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#110019", colorScheme: "dark light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${numeric.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
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
