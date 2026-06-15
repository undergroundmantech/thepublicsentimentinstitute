import "./globals.css";

import type { Metadata } from "next";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { DM_Mono, JetBrains_Mono, Fraunces } from "next/font/google";

/* -----------------------------
   FONTS
------------------------------ */

const display = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${dmMono.variable} ${serif.variable} ${numeric.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* No-flash theme init — runs before paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('psi-theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s||(m?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
        <body
        suppressHydrationWarning
        className={[
          dmMono.className,
          "min-h-screen antialiased overflow-x-hidden",
        ].join(" ")}
      >
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
