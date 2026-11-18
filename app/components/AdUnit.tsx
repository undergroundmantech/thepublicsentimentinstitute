"use client";
// An AdSense ad placed by hand between sections of a page, so ads sit where readers pause and never inside a chart,
// a map or a table. Three kinds:
//   display    a responsive display ad, the account's main unit
//   article    an in-article ad that blends into running text; uses the display unit until an in-article unit exists
//   multiplex  a grid of sponsored stories at the end of a page; shows only once a multiplex unit exists
// Its room is reserved before the ad loads, so the page never jumps. scripts/ads-max.mjs fills in the unit numbers.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const CLIENT = "ca-pub-7542770820535344";
export const UNITS = { display: "1176653089", article: "6961518143", multiplex: "1901083950" };

type Kind = "display" | "article" | "multiplex";
export default function AdUnit({ kind = "display", className, minH }: { kind?: Kind; className?: string; minH?: number }) {
  const path = usePathname();
  const ref = useRef<HTMLModElement>(null);
  const slot = kind === "multiplex" ? UNITS.multiplex : kind === "article" ? UNITS.article || UNITS.display : UNITS.display;
  const fluid = kind === "article" && !!UNITS.article;
  useEffect(() => {
    const el = ref.current; if (!slot || !el || el.getAttribute("data-adsbygoogle-status")) return;
    try { ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({}); } catch { /* blocked */ }
  }, [slot, path]);
  if (!slot) return null;
  const h = minH ?? (kind === "multiplex" ? 320 : 250);
  return (
    <aside className={`opp-ad ${className ?? ""}`} aria-label="Advertisement" style={{ width: "100%", maxWidth: 1100, margin: "36px auto", boxSizing: "border-box" }}>
      <div style={{ font: "700 10px/1 system-ui, sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(255,255,255,.42)", textAlign: "center", marginBottom: 8 }}>Advertisement</div>
      {kind === "multiplex"
        ? <ins key={path} ref={ref} className="adsbygoogle" style={{ display: "block", minHeight: h }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="autorelaxed" />
        : fluid
          ? <ins key={path} ref={ref} className="adsbygoogle" style={{ display: "block", textAlign: "center", minHeight: h }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-layout="in-article" data-ad-format="fluid" />
          : <ins key={path} ref={ref} className="adsbygoogle" style={{ display: "block", minHeight: h }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />}
    </aside>
  );
}
