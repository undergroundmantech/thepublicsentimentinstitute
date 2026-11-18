"use client";
// The fallback ad above the footer, for pages that have no ads of their own. A page with its own ad panels, or the
// game, which has its own ad breaks, gets none here, so ads never stack up at the bottom of a page.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AdUnit from "./AdUnit";

const NONE = ["/play", "/portal"];
export default function AdSlot() {
  const path = usePathname() || "";
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false); if (NONE.some((p) => path === p || path.startsWith(p + "/"))) return;
    // wait for the page to render, then look for its own ad panels
    const id = setTimeout(() => setShow(!document.querySelector(".opp-ad")), 400);
    return () => clearTimeout(id);
  }, [path]);
  return show ? <AdUnit key={path} kind="multiplex" className="opp-ad-foot" /> : null;
}
