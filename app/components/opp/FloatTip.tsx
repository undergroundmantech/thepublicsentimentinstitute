"use client";
// A hover note that can never be clipped: it renders into the page body at the cursor, measures itself and flips
// left or up when it would run off the screen. Pass the cursor's client coordinates. `scope` is the class list of the
// section the note belongs to (Watchdog uses "opp wd wdt fx-dark"), so its styles still apply outside that section.
import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function FloatTip({ x, y, children, className = "wd-tip", scope = "opp" }: { x: number; y: number; children: React.ReactNode; className?: string; scope?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, W = window.innerWidth, H = window.innerHeight, g = 16;
    let left = x + g, top = y + g;
    if (left + w > W - 8) left = x - g - w;
    if (top + h > H - 8) top = y - g - h;
    setPos({ left: Math.max(8, Math.min(left, W - w - 8)), top: Math.max(8, Math.min(top, H - h - 8)) });
  }, [x, y, children]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={scope} style={{ position: "static", display: "contents" }}>
      <div ref={ref} className={className} role="tooltip"
        style={{ position: "fixed", left: pos?.left ?? x + 16, top: pos?.top ?? y + 16, zIndex: 1200, pointerEvents: "none", visibility: pos ? "visible" : "hidden", display: "block", transform: "none" }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const WD_SCOPE = "opp wd wdt fx-dark";
