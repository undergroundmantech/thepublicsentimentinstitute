"use client";
// Sticky section index for long forecast pages: highlights the section on screen and glides to one on click.
import { useEffect, useState } from "react";

export const SNAV_CSS = `
.fx-body{display:grid;grid-template-columns:170px minmax(0,1fr);gap:28px;align-items:start}
@media (max-width:1100px){.fx-body{grid-template-columns:1fr;gap:12px}}
.fx-nav{position:sticky;top:calc(env(safe-area-inset-top,0px) + 92px);display:grid;gap:2px;padding:4px 0}
.fx-nav a{position:relative;display:block;padding:8px 12px 8px 16px;font:700 11px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute);text-decoration:none;border-radius:8px;transition:color .25s,background .25s}
.fx-nav a::before{content:"";position:absolute;left:4px;top:50%;width:3px;height:0;border-radius:2px;background:var(--grad);transform:translateY(-50%);transition:height .3s cubic-bezier(.2,.7,.2,1)}
.fx-nav a:hover{color:var(--ink2);background:rgba(var(--line-rgb),.04)}
.fx-nav a[aria-current="true"]{color:var(--ink)}
.fx-nav a[aria-current="true"]::before{height:18px}
.fx-nav a:focus-visible{outline:2px solid var(--hi);outline-offset:2px}
@media (max-width:1100px){
  .fx-nav{top:calc(env(safe-area-inset-top,0px) + 64px);z-index:20;display:flex;overflow-x:auto;gap:4px;padding:8px;margin:0 -4px;background:rgba(var(--canvas-rgb),.82);backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:14px;scrollbar-width:none}
  .fx-nav a{white-space:nowrap;padding:7px 11px}
  .fx-nav a::before{display:none}
  .fx-nav a[aria-current="true"]{background:rgba(var(--line-rgb),.1)}
}
`;

export default function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [on, setOn] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Map<string, number>();
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) seen.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
      const best = items.map((i) => [i.id, seen.get(i.id) ?? 0] as const).filter(([, v]) => v > 0);
      if (best.length) setOn(best[0][0]);
    }, { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.01, 0.25, 0.5] });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav className="fx-nav" aria-label="On this page">
      <style>{SNAV_CSS}</style>
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} aria-current={on === i.id}
          onClick={(e) => { const el = document.getElementById(i.id); if (!el) return; e.preventDefault(); el.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); history.replaceState(null, "", `#${i.id}`); setOn(i.id); }}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}
