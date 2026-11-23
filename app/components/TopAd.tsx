"use client";
// The banner under the navigation bar on every page, the first ad a reader sees. Pages that run full screen or hold
// the game's own ad breaks get none, and neither do the private desks.
import { usePathname } from "next/navigation";
import AdUnit from "./AdUnit";

export const NO_ADS = ["/play", "/portal", "/backroom", "/desk", "/admin", "/results/monitor", "/results/tonight"];
export const noAds = (path: string) => NO_ADS.some((p) => path === p || path.startsWith(p + "/"));
export default function TopAd() {
  const path = usePathname() || "";
  if (noAds(path)) return null;
  return <AdUnit key={path} format="horizontal" minH={90} className="top" />;
}
