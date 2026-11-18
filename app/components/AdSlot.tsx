"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// One display ad space with its room reserved, so nothing on the page jumps when the ad loads.
const CLIENT = "ca-pub-7542770820535344";
const SLOT = "1176653089";

export default function AdSlot({ slot = SLOT }: { slot?: string }) {
  const path = usePathname();
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!slot || !el || el.getAttribute("data-adsbygoogle-status")) return;
    try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch {}
  }, [slot, path]);
  if (!slot) return null;
  return (
    <aside aria-label="Advertisement" style={{ width: "100%", maxWidth: 1200, margin: "48px auto 32px", padding: "0 16px", boxSizing: "border-box" }}>
      <div style={{ font: "700 10px/1 system-ui, sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", textAlign: "center", marginBottom: 8 }}>Advertisement</div>
      <ins key={path} ref={ref} className="adsbygoogle" style={{ display: "block", minHeight: 100 }}
        data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
