"use client";
// One listener for the whole site: the card under the pointer gets a soft glow that follows it (motion.css).
import { useEffect } from "react";

export default function Spotlight() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || window.matchMedia?.("(hover: none)").matches) return;
    let lit: HTMLElement | null = null, raf = 0, ev: PointerEvent | null = null;
    const paint = () => {
      raf = 0; if (!ev) return;
      const el = (ev.target as HTMLElement | null)?.closest?.(".opp .card") as HTMLElement | null;
      if (el !== lit) { lit?.classList.remove("sx-lit"); lit = el; el?.classList.add("sx-lit"); }
      if (el) { const r = el.getBoundingClientRect(); el.style.setProperty("--mx", `${ev.clientX - r.left}px`); el.style.setProperty("--my", `${ev.clientY - r.top}px`); }
    };
    const move = (e: PointerEvent) => { ev = e; if (!raf) raf = requestAnimationFrame(paint); };
    const leave = () => { lit?.classList.remove("sx-lit"); lit = null; };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    return () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", leave); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
