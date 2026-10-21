import "./globals.css";
import "./opp.css";
import "./motion.css";

import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import Navbar from "./components/Navbar";
import TickerBar from "./components/TickerBar";
import Footer from "./components/Footer";
import Ambient from "./components/Ambient";
import Spotlight from "./components/Spotlight";
import RolloutGate from "./components/RolloutGate";
import { THEME_INIT_SCRIPT } from "./lib/theme";
import JsonLd from "./components/JsonLd";
import { KEYWORDS, SITE, graph, orgLd } from "./lib/seo";

// Same type system as the main site: Geist for display and body, JetBrains Mono for data.
// globals.css maps --font-display, --font-body and --font-numeric to --font-d, --font-b, --font-m.
const display = Geist({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Geist({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const numeric = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-numeric", display: "swap" });

const verification: NonNullable<Metadata["verification"]> = {
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : {}),
  ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } } : {}),
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "On Point Politics: 2026 midterm forecasts, polling averages and live results", template: "%s | On Point Politics" },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: KEYWORDS,
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.publisher,
  category: "politics",
  referrer: "origin-when-cross-origin",
  formatDetection: { telephone: false, address: false, email: false },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: { siteName: SITE.name, type: "website", locale: "en_US", title: SITE.name, description: SITE.description },
  twitter: { card: "summary_large_image", title: SITE.name, description: SITE.description },
  verification,
};

export const viewport: Viewport = { themeColor: "#110019", colorScheme: "dark light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${numeric.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="alternate" type="text/plain" title="On Point Politics for language models" href="/llms.txt" />
        <JsonLd data={graph(orgLd())} />
      </head>
      <body suppressHydrationWarning>
        <RolloutGate />
        <div className="sx-progress" aria-hidden="true" />
        <Ambient />
        <Spotlight />
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
