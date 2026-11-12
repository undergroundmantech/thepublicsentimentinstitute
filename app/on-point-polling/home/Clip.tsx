"use client";
// A silent product clip in a browser frame. It plays only while on screen, never for readers who prefer reduced motion
// (they get the still and a play button), and loads nothing heavy until it is near the viewport.
import { useEffect, useRef, useState } from "react";
import type { Media } from "./services";

export default function Clip({ m, priority = false }: { m: Media; priority?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(true);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => undefined); else v.pause(); }, { threshold: 0.35 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <figure className="oph-clip">
      <div className="bar" aria-hidden="true"><i /><i /><i /><span>{m.label}</span></div>
      <div className="vid">
        <video ref={ref} muted loop playsInline preload={priority ? "auto" : "none"} poster={m.poster} width={m.w} height={m.h} aria-label={m.alt}
          onPlay={() => setPaused(false)} onPause={() => setPaused(true)}>
          <source src={`${m.src}.webm`} type="video/webm" />
          <source src={`${m.src}.mp4`} type="video/mp4" />
        </video>
        {paused ? <button type="button" className="play" onClick={() => ref.current?.play()} aria-label={`Play: ${m.label}`}><span /></button> : null}
      </div>
      <figcaption>Shown with illustrative data. Client dashboards are private and are not published.</figcaption>
    </figure>
  );
}
