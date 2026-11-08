"use client";
// A row of cards that slides sideways while the section is pinned, driven by how far the page has scrolled through it.
// On a phone, or when the reader prefers reduced motion, it falls back to a plain row that swipes on its own.
import { useEffect, useRef, useState } from "react";

export default function HTrack({ children, label }: { children: React.ReactNode; label: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [pin, setPin] = useState(false);
  const [h, setH] = useState<number | null>(null);
  const [prog, setProg] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px) and (prefers-reduced-motion: no-preference)");
    const measure = () => {
      const ok = mq.matches; setPin(ok);
      if (!ok || !track.current) { setH(null); return; }
      const extra = Math.max(0, track.current.scrollWidth - track.current.clientWidth);
      setH(window.innerHeight + extra);
    };
    measure();
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const o = outer.current; if (!o) return;
        const r = o.getBoundingClientRect(), span = o.offsetHeight - window.innerHeight;
        setProg(span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    mq.addEventListener?.("change", measure);
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", measure); mq.removeEventListener?.("change", measure); cancelAnimationFrame(raf); };
  }, []);

  const extra = track.current ? Math.max(0, track.current.scrollWidth - track.current.clientWidth) : 0;
  return (
    <div ref={outer} className={`ht${pin ? " pin" : ""}`} style={pin && h ? { height: h } : undefined}>
      <div className="ht-sticky">
        <div className="ht-bar" aria-hidden="true"><i style={{ transform: `scaleX(${pin ? prog : 1})` }} /></div>
        <div ref={track} className="ht-track" role="region" aria-label={label} tabIndex={0}>
          <div className="ht-row" style={pin ? { transform: `translate3d(${-prog * extra}px,0,0)` } : undefined}>{children}</div>
        </div>
      </div>
    </div>
  );
}
