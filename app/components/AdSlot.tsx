"use client";
// The sponsored stories grid above the footer on every page. A page that already ends with its own grid, the game,
// which has its own ad breaks, and the private desks get none, so two grids never stack up at the bottom of a page.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AdUnit from "./AdUnit";
import { noAds } from "./TopAd";

export default function AdSlot() {
  const path = usePathname() || "";
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false); if (noAds(path) && !path.startsWith("/results/monitor")) return;
    // wait for the page to render, then look for its own end of page grid
    const id = setTimeout(() => setShow(!document.querySelector(".opp-main .opp-ad.end")), 400);
    return () => clearTimeout(id);
  }, [path]);
  return show ? <AdUnit key={path} kind="multiplex" className="opp-ad-foot" /> : null;
}
