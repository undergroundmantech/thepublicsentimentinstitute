import "./globals.css";

import type { Metadata } from "next";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { SITE_V2 } from "./lib/flags";
import { Quantico, Geist_Mono, Fraunces, JetBrains_Mono } from "next/font/google";

/* -----------------------------
   FONTS
------------------------------ */

const display = Quantico({
  subsets: ["latin"],
  weight: ["400", "700"],           // Quantico only has 400 and 700
  variable: "--font-display",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Editorial serif — used for the redesigned polling section (data-journalism feel).
const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const numeric = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-numeric",
  display: "swap",
});

/* -----------------------------
   META
------------------------------ */

export const metadata: Metadata = {
  title: "Public Sentiment Institute",
  description: "Polling • Research • Insights",
};

/* -----------------------------
   ROOT LAYOUT
------------------------------ */

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // First-visit announcement for the redesign — v2 only. Inline env check +
  // dynamic import keep it out of the v1 client bundle (see app/lib/flags.ts).
  let intro: React.ReactNode = null;
  if (process.env.NEXT_PUBLIC_SITE_V2 === "on") {
    const { default: SiteIntro } = await import("./components/SiteIntro");
    intro = <SiteIntro />;
  }
  return (
    <html
      lang="en"
      data-site={SITE_V2 ? "v2" : "v1"}
      className={`${display.variable} ${mono.variable} ${serif.variable} ${numeric.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* No-flash theme init — runs before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('psi-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s||(m?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        {/* Console line for the devtools crowd — guard: head scripts can run twice across hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: SITE_V2
              ? `if(!window.__tpsiHello){window.__tpsiHello=1;console.log("%c TPSI %c site v2 — you're on the new desk.","background:#c9f24f;color:#050505;font-weight:700;padding:2px 6px","color:#c9f24f;font-weight:600");}`
              : `if(!window.__tpsiHello){window.__tpsiHello=1;console.log("%c TPSI %c there is a second site compiled out of this build. soon.","background:#c9f24f;color:#050505;font-weight:700;padding:2px 6px","color:#8b8b92;font-weight:600");}`,
          }}
        />
      </head>
        <body
        suppressHydrationWarning
        className={[
          mono.className,
          "min-h-screen antialiased overflow-x-hidden",
        ].join(" ")}
      >
        {/* The flag, in the DOM on purpose — inspect element is a feature. */}
        <div
          aria-hidden="true"
          style={{ display: "none" }}
          dangerouslySetInnerHTML={{
            __html: SITE_V2
              ? "<!-- TPSI · NEXT_PUBLIC_SITE_V2=on — you're on the new desk. -->"
              : [
                  "<!--",
                  "",
                  "  ▚▚▚ TPSI",
                  "",
                  "  You found the flag.",
                  "",
                  "  A second site is compiled out of this build — the whole",
                  "  redesign ships dark behind NEXT_PUBLIC_SITE_V2. New home,",
                  "  new polling averages, a live election desk, the forecast.",
                  "",
                  "  It exists. Soon.",
                  "",
                  "-->",
                ].join("\n"),
          }}
        />

        {/* --------------------------------
           Ambient tri-color glow background
        -------------------------------- */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
          {/* Red bloom */}
          <div
            className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full opacity-[0.07]"
            style={{
              background:
                "radial-gradient(circle, #e63946 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />

          {/* Blue bloom */}
          <div
            className="absolute -bottom-32 -right-32 h-[520px] w-[520px] rounded-full opacity-[0.07]"
            style={{
              background:
                "radial-gradient(circle, #2563eb 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />

          {/* Purple bloom */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-[0.05]"
            style={{
              background:
                "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        </div>

        {/* First-visit announcement for the redesign — v2 only */}
        {intro}

        {/* --------------------------------
           PAGE STRUCTURE
        -------------------------------- */}
        <div className="relative z-10 min-h-screen flex flex-col w-full min-w-0">

          {/* HEADER */}
          <header className="w-full min-w-0">
            <Navbar />

            <div
              className="h-[2px] w-full"
              style={{
                background:
                  "linear-gradient(90deg,#e63946 0%,#e63946 33%,#7c3aed 33%,#7c3aed 66%,#2563eb 66%,#2563eb 100%)",
                opacity: 0.55,
              }}
            />
          </header>

          {/* MAIN */}
          <main className="flex-1 w-full min-w-0">
            <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
              <div className="py-6 sm:py-8 lg:py-10 min-w-0 psi-animate-in">
                {children}
              </div>
            </div>
          </main>

          {/* FOOTER */}
          <footer className="w-full min-w-0">
            <div className="h-px w-full bg-[linear-gradient(90deg,transparent_0%,var(--border2)_30%,var(--border2)_70%,transparent_100%)]" />
            <Footer />
          </footer>
        </div>
      </body>
    </html>
  );
}
