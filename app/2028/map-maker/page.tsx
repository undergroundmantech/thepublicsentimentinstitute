import type { Metadata } from "next";
import Link from "@/app/components/Link";
import StayConnected from "@/app/components/StayConnected";
import { seo } from "@/app/lib/seo";
import { getDefault } from "../server";
import MapMaker from "./MapMaker";

export const revalidate = 3600;
export const metadata: Metadata = seo({ title: "2028 electoral map maker", description: "Make your own 2028 electoral map. Start from the On Point forecast, click any state to rate it from safe to tilt, and share your map on X.", path: "/2028/map-maker", keywords: ["2028 electoral map maker", "2028 interactive map", "make your own 2028 map", "2028 election map"] });

export default function Page() {
  const s = getDefault().summary;
  const ev: Record<string, number> = {}; const margin: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.states)) { ev[k] = v.ev; margin[k] = v.m; }
  for (const k of ["NE-1", "NE-3"]) if (!(k in ev)) { ev[k] = 1; margin[k] = k === "NE-1" ? 12 : 40; }
  const keys = Object.keys(ev).sort();
  return (
    <main className="h28-page" style={{ padding: "0 16px" }}>
      <header className="ph" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="eye g">2028 map maker</div>
        <h1>Make your own 2028 <em>map</em></h1>
        <p className="lede">Every state starts at its rating in the On Point forecast, {s.D} against {s.R}. Click a state to change it, then share your map. The link carries your map, so anyone who opens it sees exactly what you built.</p>
      </header>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}><MapMaker ev={ev} margin={margin} keys={keys} /></div>
      <p className="cm-mute" style={{ maxWidth: 1100, margin: "16px auto", fontSize: 13 }}>Want the odds behind the colors? See <Link href="/2028">the full 2028 forecast</Link>, <Link href="/2028/general">every matchup</Link> and <Link href="/2028/primaries">both primaries</Link>.</p>
      <StayConnected from="map-maker" title="Get the 2028 forecast when it moves" pick={["forecast", "videos"]} />
    </main>
  );
}
