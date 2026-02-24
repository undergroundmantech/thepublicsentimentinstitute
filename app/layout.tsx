import "./globals.css";

import type { Metadata } from "next";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { Syne, DM_Mono } from "next/font/google";

const display = Syne({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Public Sentiment Institute",
  description: "Polling • Research • Insights",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body
        className={[
          "min-h-screen antialiased overflow-x-hidden",
          "bg-[var(--background)] text-[var(--foreground)]",
          "font-[var(--font-body)]",
        ].join(" ")}
      >
        {/* Ambient tri-color glow — positioned behind all content */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
          {/* Red bloom — top-left */}
          <div
            className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full opacity-[0.07]"
            style={{
              background: "radial-gradient(circle, #e63946 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          {/* Blue bloom — bottom-right */}
          <div
            className="absolute -bottom-32 -right-32 h-[520px] w-[520px] rounded-full opacity-[0.07]"
            style={{
              background: "radial-gradient(circle, #2563eb 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
          {/* Purple bloom — center */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-[0.05]"
            style={{
              background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col w-full min-w-0">
          {/* ── HEADER ── */}
          <header className="w-full min-w-0">
            <Navbar />
            {/* Tri-color accent line under navbar */}
            <div
              className="h-[2px] w-full"
              style={{
                background:
                  "linear-gradient(90deg, #e63946 0%, #e63946 33%, #7c3aed 33%, #7c3aed 66%, #2563eb 66%, #2563eb 100%)",
                opacity: 0.55,
              }}
            />
          </header>

          {/* ── MAIN ── */}
          <main className="flex-1 w-full min-w-0">
            <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
              <div className="py-6 sm:py-8 lg:py-10 min-w-0 psi-animate-in">
                {children}
              </div>
            </div>
          </main>

          {/* ── FOOTER ── */}
          <footer className="w-full min-w-0">
            {/* Fade divider */}
            <div className="h-px w-full bg-[linear-gradient(90deg,transparent_0%,var(--border2)_30%,var(--border2)_70%,transparent_100%)]" />
            <Footer />
          </footer>
        </div>
      </body>
    </html>
  );
}