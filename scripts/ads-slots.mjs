// Nov 18 2026: one fixed ad space at the bottom of every page, above the footer, instead of Auto ads dropping ads
// inside charts and cards. Run from the repo root with the number of your AdSense display ad unit:
//   node scripts/ads-slots.mjs 1234567890
// Writes app/components/AdSlot.tsx and adds it to the root layout. Safe to run twice; rerun with a new number to change it.
import fs from "node:fs";
const SLOT = (process.argv[2] || "").replace(/\D/g, "");
if (!SLOT) { console.log("MISS  give the ad unit number: node scripts/ads-slots.mjs 1234567890"); process.exit(1); }
const COMP = "app/components/AdSlot.tsx";
fs.mkdirSync("app/components", { recursive: true });
fs.writeFileSync(COMP, `"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// One display ad space with its room reserved, so nothing on the page jumps when the ad loads.
const CLIENT = "ca-pub-7542770820535344";
const SLOT = "${SLOT}";

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
`);
console.log("ok    " + COMP + "  slot " + SLOT);

const L = ["app/layout.tsx", "app/layout.jsx", "src/app/layout.tsx"].find((f) => fs.existsSync(f));
if (!L) { console.log("MISS  no app/layout.tsx; send this line to Claude"); process.exit(1); }
let t = fs.readFileSync(L, "utf8");
if (t.includes("<AdSlot")) { console.log("same  " + L); }
else {
  const imp = L.startsWith("src/") ? 'import AdSlot from "./components/AdSlot";' : 'import AdSlot from "./components/AdSlot";';
  const lastImport = [...t.matchAll(/^import .*;$/gm)].pop();
  t = lastImport ? t.slice(0, lastImport.index + lastImport[0].length) + "\n" + imp + t.slice(lastImport.index + lastImport[0].length) : imp + "\n" + t;
  let done = false;
  const foot = t.match(/\n(\s*)<Footer\b/);
  if (foot) { t = t.replace(foot[0], "\n" + foot[1] + "<AdSlot />" + foot[0]); done = "above <Footer>"; }
  else { const ch = t.match(/\n(\s*)\{children\}/); if (ch) { t = t.replace(ch[0], ch[0] + "\n" + ch[1] + "<AdSlot />"); done = "after {children}"; } }
  if (!done) { console.log("MISS  could not find <Footer> or {children} in " + L + "; send this line to Claude"); process.exit(1); }
  fs.writeFileSync(L, t); console.log("ok    " + L + "  ad space " + done);
}
console.log("\nDone. In AdSense, turn off in page Auto ads so Google stops placing ads inside the charts.");
