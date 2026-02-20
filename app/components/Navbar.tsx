"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

const nav = [
  { href: "/", label: "Home" },
  { href: "/donate", label: "Public Polling Fund" },
  { href: "/results", label: "Election Results" },
  { href: "/electoralmap", label: "Interactive Maps" },
  { href: "/polling", label: "Polling Averages" },
  { href: "/goldstandard", label: "Gold Standard Pollsters" },
  { href: "/contact", label: "Contact" },
];

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const activeLabel = useMemo(() => {
    const found =
      nav.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href))) ??
      nav[0];
    return found?.label ?? "Menu";
  }, [pathname]);

  // Close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ESC to close + lock scroll while open
  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0f] shadow-lg">
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
            const hideOnMobile = item.href === "/electoralmap";
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
  "relative rounded-full px-3 py-2 text-sm font-semibold transition",
  "text-white/70 hover:text-white/90",
  active ? "text-white" : "",
  hideOnMobile ? "hidden md:block" : "",
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

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Desktop CTA */}
          <Link
            href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
            className={[
              "hidden sm:inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition",
              "text-white/80 border border-white/10 bg-white/[0.04]",
              "hover:bg-white/10 hover:text-white hover:border-white/20",
            ].join(" ")}
          >
            Take survey
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            className={[
              "md:hidden inline-flex items-center justify-center rounded-full p-2 transition",
              "border border-white/10 bg-white/[0.04] text-white/85",
              "hover:bg-white/10 hover:border-white/20",
              "focus:outline-none focus:ring-2 focus:ring-white/20",
            ].join(" ")}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={[
          "md:hidden fixed inset-0 z-[60]",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        aria-hidden={!mobileOpen}
      >
        {/* Overlay */}
        <button
          type="button"
          className={[
            "absolute inset-0 transition-opacity",
            mobileOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu overlay"
          style={{ background: "rgba(0,0,0,0.85)" }}
        />

        {/* Panel */}
        <aside
          className={[
            "absolute right-0 top-0 h-full w-[86%] max-w-sm",
            "border-l border-white/10 bg-[#0b0b0f]",
            "transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
            <div className="text-sm font-semibold text-white/90">{activeLabel}</div>
            <button
              type="button"
              className={[
                "inline-flex items-center justify-center rounded-full p-2 transition",
                "border border-white/10 bg-[#111118] text-white/85",
                "hover:bg-white/10 hover:border-white/20",
                "focus:outline-none focus:ring-2 focus:ring-white/20",
              ].join(" ")}
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4">
            <nav className="space-y-2">
              {nav
  .filter((item) => item.href !== "/electoralmap")
  .map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      "block rounded-2xl px-3 py-3 text-sm font-semibold transition",
                      active
                        ? "bg-white/10 text-white ring-1 ring-white/15"
                        : "text-white/80 hover:text-white hover:bg-white/5",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="my-5 psi-divider" />

            <Link
              href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
              onClick={() => setMobileOpen(false)}
              className={[
                "w-full inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition",
                "text-white border border-white/10 bg-white/[0.04]",
                "hover:bg-white/10 hover:border-white/20",
              ].join(" ")}
            >
              Take survey
            </Link>

            <p className="mt-3 text-xs text-white/55">
              Tip: press <span className="text-white/70">Esc</span> to close.
            </p>
          </div>
        </aside>
      </div>
    </header>
  );
}