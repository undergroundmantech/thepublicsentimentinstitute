import "./globals.css";
import type { Metadata } from "next";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Public Sentiment Institute",
  description: "Polling • Research • Insights",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased overflow-x-hidden">
        {/* Shell: full height, flex column so footer sits naturally */}
        <div className="min-h-screen flex flex-col w-full overflow-x-hidden">
          <Navbar />

          {/* Main grows to fill remaining height */}
          <main className="flex-1 w-full min-w-0">
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 min-w-0">
              {children}
            </div>
          </main>

          <Footer />
        </div>
      </body>
    </html>
  );
}
