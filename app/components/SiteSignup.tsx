"use client";
// The alerts signup above the footer on every page, unless the page already carries its own signup panel, runs full
// screen, or is a private desk.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import StayConnected from "./StayConnected";
import { noAds } from "./TopAd";

export default function SiteSignup() {
  const path = usePathname() || "";
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false); if (noAds(path) || path.startsWith("/on-point-polling/sms")) return;
    const id = setTimeout(() => setShow(!document.querySelector(".opp-main .oc")), 300);
    return () => clearTimeout(id);
  }, [path]);
  return show ? <div className="oc-site"><StayConnected key={path} variant="foot" /></div> : null;
}
