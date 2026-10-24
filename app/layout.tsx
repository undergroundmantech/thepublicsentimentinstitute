import "./globals.css";
import "./opp.css";
import "./motion.css";
import "./chrome.css";
import "./lite.css";
import "./phone.css";

import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import Navbar from "./components/Navbar";
import { getModel } from "./lib/forecastData";
import TickerBar from "./components/TickerBar";
import Footer from "./components/Footer";
import Ambient from "./components/Ambient";
import Spotlight from "./components/Spotlight";
import RolloutGate from "./components/RolloutGate";
import { THEME_INIT_SCRIPT } from "./lib/theme";
import { LITE_INIT_SCRIPT } from "./lib/lite";
import LiteMotion from "./components/LiteMotion";
import MobileTabs from "./components/MobileTabs";
import JsonLd from "./components/JsonLd";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";

// Google Analytics 4. Loaded once the page is interactive so it never holds up the first paint on a phone; GA4's
// enhanced measurement counts each page change in the app from the browser history.
const GA_ID = "G-77X2X4JG8M";
import SiteEvents from "./components/SiteEvents";
import YouTubePromo from "./components/YouTubePromo";
import { FLAG_VALUES, flagJson } from "./lib/flagValues";
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

function navStatus() {
  try {
    const m = getModel();
    const d = new Date(m.meta.updated + "T12:00:00Z");
    const updated = Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : m.meta.updated;
    return { days: m.meta.daysOut, updated, sen: m.chambers.senate.demControl, house: m.chambers.house.demControl, gov: m.chambers.governor.demControl };
  } catch { return undefined; }
}

export const viewport: Viewport = { themeColor: "#110019", colorScheme: "dark light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${body.variable} ${numeric.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: LITE_INIT_SCRIPT }} />
        {/* Google AdSense: the account tag that verifies onpointpolitics.us, and the AdSense loader, as AdSense asks, in
            the head of every page. public/ads.txt carries the same publisher id. */}
        <meta name="google-adsense-account" content="ca-pub-7542770820535344" />
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7542770820535344" crossOrigin="anonymous" />
        <link rel="alternate" type="text/plain" title="On Point Politics for language models" href="/llms.txt" />
        <JsonLd data={graph(orgLd())} />
      </head>
      <body suppressHydrationWarning>
        <RolloutGate />
        <div className="sx-progress" aria-hidden="true" />
        <Ambient />
        <Spotlight />
        <Navbar status={navStatus()} />
        <TickerBar />
        <main className="opp-main">
          <div className="opp-page">{children}</div>
        </main>
        <Footer />
        <MobileTabs />
        <YouTubePromo />
        <LiteMotion />
        <script type="application/json" data-flag-values="" dangerouslySetInnerHTML={{ __html: flagJson(FLAG_VALUES) }} />
        <SiteEvents />
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag("js",new Date());gtag("config","${GA_ID}");`}</Script>
        <Analytics />
      </body>
    </html>
  );
}
