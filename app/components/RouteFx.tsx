"use client";
// Page to page motion, Nov 2026. Three layers, each optional:
// 1. A gradient sweep under the masthead runs from the click until the new page is in.
// 2. Where the browser has the View Transitions API, the page changes inside a transition. Moving within a section
//    is a soft crossfade with a lift; jumping to another section opens the new page as a circle growing from
//    the point that was clicked.
// 3. Everywhere else the route template's lift (motion.css) carries the change, as before.
// Reduced motion and light rendering get the sweep only. Nothing here blocks navigation: if a page is slow,
// the transition lets go after a moment and the page arrives normally.
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type VT = { finished: Promise<void>; skipTransition?: () => void };
type Doc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => VT };

const section = (p: string) => "/" + (p.split("/")[1] || "");

export default function RouteFx() {
  const path = usePathname() || "/";
  const bar = useRef<HTMLDivElement>(null);
  const waiting = useRef<(() => void) | null>(null);
  const last = useRef(path);

  useEffect(() => {
    const root = document.documentElement;
    const calm = () => root.hasAttribute("data-lite") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.dataset.noFx !== undefined) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname) return; // same page, a hash or a query change
      // start the sweep
      const b = bar.current;
      if (b) { b.classList.remove("done"); void b.offsetWidth; b.classList.add("go"); window.clearTimeout(Number(b.dataset.t)); b.dataset.t = String(window.setTimeout(() => b.classList.remove("go"), 9000)); }
      const d = document as Doc;
      if (calm() || !d.startViewTransition || waiting.current) return;
      const jump = section(url.pathname) !== section(location.pathname);
      root.style.setProperty("--fx-x", `${e.clientX}px`);
      root.style.setProperty("--fx-y", `${e.clientY}px`);
      root.dataset.fx = jump ? "jump" : "step";
      try {
        const t = d.startViewTransition(() => new Promise<void>((res) => {
          const timer = window.setTimeout(() => { waiting.current = null; res(); }, 2200);
          waiting.current = () => { window.clearTimeout(timer); waiting.current = null; res(); };
        }));
        t.finished.finally(() => { delete root.dataset.fx; });
      } catch { delete root.dataset.fx; }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (last.current === path) return;
    last.current = path;
    // the new route has rendered: let the transition take its second snapshot after the next paint
    const done = waiting.current;
    if (done) requestAnimationFrame(() => requestAnimationFrame(done));
    const b = bar.current;
    if (b) { b.classList.add("done"); window.setTimeout(() => b.classList.remove("go", "done"), 520); }
  }, [path]);

  return <div className="rfx-bar" ref={bar} aria-hidden="true"><i /></div>;
}
