"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home" },
  { href: "/donate", label: "Public Polling Fund" },
  { href: "/results", label: "Election Results" },
  { href: "/electoralmap", label: "Interactive Maps" },
  { href: "/polling", label: "Polling Averages" },
  { href: "/goldstandard", label: "Gold Standard Pollsters" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/55 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        {/* Brand */}
        <Link href="/" className="group flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-white/10 blur-md opacity-0 transition group-hover:opacity-100" />
            <Image
              src="/logo.png"
              alt="The Public Sentiment Institute"
              width={44}
              height={44}
              className="relative h-11 w-11 rounded-2xl border border-white/10 bg-white/5 object-contain p-1 shadow-sm"
              priority
            />
          </div>

          <div className="leading-tight">
            <div className="text-sm font-semibold text-white/90">
              The Public Sentiment
            </div>
            <div className="text-xs font-medium tracking-wide text-white/55">
              Institute
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "relative rounded-full px-3 py-2 text-sm font-semibold transition",
                  "text-white/70 hover:text-white/90",
                  active ? "text-white" : "",
                ].join(" ")}
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-full bg-white/10 ring-1 ring-white/15" />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <Link
  href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
  className={[
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
    "text-white/80 border border-white/10 bg-white/[0.04]",
    "hover:bg-white/10 hover:text-white hover:border-white/20",
  ].join(" ")}
>
  Take survey
</Link>

        </div>
      </div>
    </header>
  );
}
