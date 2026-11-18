"use client";
// An AdSense ad placed by hand between sections of a page, so ads sit where readers pause and never inside a chart,
// a map or a table. Every ad on the site uses this one panel, so they all look alike and sit in the same places:
//   display    between two sections of a page, the account's main unit
//   article    inside running text, an in-article unit that blends into the paragraphs
//   multiplex  the end of a page, a grid of sponsored stories
// Its room is reserved before the ad loads, so the page never jumps. If Google has nothing to show, the panel hides.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import "./ads.css";

const CLIENT = "ca-pub-7542770820535344";
export const UNITS = { display: "1176653089", article: "6961518143", multiplex: "1901083950" };

type Kind = "display" | "article" | "multiplex";
export default function AdUnit({ kind = "display", className, minH, side }: { kind?: Kind; className?: string; minH?: number; side?: boolean }) {
  const path = usePathname();
  const ref = useRef<HTMLModElement>(null);
  const [empty, setEmpty] = useState(false);
  const slot = kind === "multiplex" ? UNITS.multiplex : kind === "article" ? UNITS.article || UNITS.display : UNITS.display;
  const fluid = kind === "article" && !!UNITS.article;
  useEffect(() => {
    const el = ref.current; if (!slot || !el) return; setEmpty(false);
    if (!el.getAttribute("data-adsbygoogle-status")) { try { ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({}); } catch { /* blocked */ } }
    // Google marks a slot it could not fill; the panel then folds away instead of leaving a blank box
    const mo = new MutationObserver(() => { if (el.getAttribute("data-ad-status") === "unfilled") setEmpty(true); });
    mo.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    return () => mo.disconnect();
  }, [slot, path]);
  if (!slot) return null;
  const h = minH ?? (kind === "multiplex" ? 320 : kind === "article" ? 200 : 250);
  return (
    <aside className={`opp-ad${kind === "multiplex" ? " end" : ""}${side ? " side" : ""} ${className ?? ""}`} aria-label="Advertisement" data-empty={empty ? "1" : undefined}>
      <span>Advertisement</span>
      {kind === "multiplex"
        ? <ins key={path} ref={ref} className="adsbygoogle" style={{ display: "block", minHeight: h }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="autorelaxed" />
        : fluid
          ? <ins key={path} ref={ref} className="adsbygoogle" style={{ display: "block", textAlign: "center", minHeight: h }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-layout="in-article" data-ad-format="fluid" />
          : <ins key={path} ref={ref} className="adsbygoogle" style={{ display: "block", minHeight: h }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format={side ? "rectangle" : "auto"} data-full-width-responsive="true" />}
    </aside>
  );
}
