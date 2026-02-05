"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home" },
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
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/25 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
  src="/logo.png"
  alt="The Public Sentiment Institute"
  width={40}
  height={40}
  className="h-15 w-15 rounded-3xl border border-white/5 bg-white/5 shadow-sm object-contain p-1"
/>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white/90">
              The Public Sentiment Institute
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-full px-3 py-2 text-sm font-semibold transition",
                  "border border-transparent",
                  active
                    ? "bg-white/10 text-white/90 border-white/10"
                    : "text-white/70 hover:bg-white/5 hover:text-white/90",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6" className="psi-btn psi-btn-ghost px-4 py-2 text-sm">
            Take survey
          </Link>
        </div>
      </div>
    </header>
  );
}
