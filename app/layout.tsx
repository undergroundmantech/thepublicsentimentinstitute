import type { Metadata } from "next";
import { Playfair_Display, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "@/app/globals.css";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";

/* ── Fonts ── */
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-display",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

/* ── Metadata ── */
export const metadata: Metadata = {
  title: {
    default: "Public Sentiment Institute",
    template: "%s | PSI",
  },
  description:
    "A living national polling database capturing American opinion by issue, region, and demographic — built for transparency.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Public Sentiment Institute",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${sourceSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <Navbar />

        <main
          style={{
            maxWidth: "var(--content-w)",
            margin: "0 auto",
            padding: "32px 20px 80px",
          }}
        >
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}