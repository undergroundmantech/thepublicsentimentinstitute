"use client";
// The scroll layer for the accuracy and polling pages, mounted once per page.
//  * [data-fx]    gets data-in once a quarter of it is on screen; CSS grows bars, slides dots and lifts text from there.
//  * [data-count] counts up to data-to the first time it comes into view, keeping data-dec decimals.
//  * [data-par]   gets --p, its position through the viewport from 1 to -1, for slow parallax.
// Everything starts visible: the hidden starting states only apply under html.fx-on, which is set here after anything
// already on screen is marked in, and never set when the reader prefers reduced motion.
import { useEffect } from "react";

function countUp(el: HTMLElement) {
  if (el.dataset.done) return; el.dataset.done = "1";
  const to = Number(el.dataset.to ?? "0"), dec = Number(el.dataset.dec ?? "0"), pre = el.dataset.pre ?? "", suf = el.dataset.suf ?? "";
  let t0 = 0;
  const step = (ts: number) => {
    if (!t0) t0 = ts;
    const p = Math.min(1, (ts - t0) / 1300), v = to * (1 - Math.pow(1 - p, 3));
    el.textContent = `${pre}${v.toFixed(dec)}${suf}`;
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = `${pre}${(0).toFixed(dec)}${suf}`;
  requestAnimationFrame(step);
}

export default function AccFX() {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    const fx = Array.from(document.querySelectorAll<HTMLElement>("[data-fx]"));
    const counts = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    if (reduce || typeof IntersectionObserver === "undefined") { fx.forEach((e) => (e.dataset.in = "1")); return; }
    const vh = window.innerHeight;
    // anything already on screen starts in, so the first paint never blinks
    for (const e of fx) { const r = e.getBoundingClientRect(); if (r.top < vh * 0.85 && r.bottom > 0) e.dataset.in = "1"; }
    root.classList.add("fx-on");
    const io = new IntersectionObserver((ents) => {
      for (const en of ents) if (en.isIntersecting) { (en.target as HTMLElement).dataset.in = "1"; io.unobserve(en.target); }
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
    fx.forEach((e) => { if (!e.dataset.in) io.observe(e); });
    const io2 = new IntersectionObserver((ents) => {
      for (const en of ents) if (en.isIntersecting) { countUp(en.target as HTMLElement); io2.unobserve(en.target); }
    }, { threshold: 0.6 });
    counts.forEach((e) => io2.observe(e));

    const par = Array.from(document.querySelectorAll<HTMLElement>("[data-par]"));
    let raf = 0;
    const tick = () => {
      raf = 0;
      const h = window.innerHeight;
      for (const e of par) {
        const r = e.getBoundingClientRect();
        if (r.bottom < -200 || r.top > h + 200) continue;
        const p = ((r.top + r.height / 2) - h / 2) / (h / 2 + r.height / 2);
        e.style.setProperty("--p", Math.max(-1, Math.min(1, p)).toFixed(3));
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    if (par.length) { tick(); window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll); }
    return () => { io.disconnect(); io2.disconnect(); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); root.classList.remove("fx-on"); };
  }, []);
  return null;
}
