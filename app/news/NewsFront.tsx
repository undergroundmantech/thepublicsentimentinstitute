"use client";
// The live parts of the news front: the headline ticker, the most covered stories as picture cards, the coverage
// compass that plots every story by which side is carrying it, and the blindspot spotlight. All read the same
// live wire the list below uses, so one fetch feeds the whole page.
import React, { useEffect, useMemo, useState } from "react";
import FloatTip from "@/app/components/opp/FloatTip";
import { CATS, LEAN_LABEL, type Lean } from "./sources";
import { LeanBar, LeanTag, ago, outletName } from "./ui";
import { useWire } from "./LiveWire";
import type { Cluster } from "./feed";

const useNow = () => { const [n, setN] = useState(0); useEffect(() => { setN(Date.now()); const t = setInterval(() => setN(Date.now()), 60000); return () => clearInterval(t); }, []); return n; };
export const openStory = (id: string) => window.dispatchEvent(new CustomEvent("nw-open", { detail: id }));
const balance = (c: Cluster) => { const t = c.n.L + c.n.C + c.n.R || 1; return (c.n.R - c.n.L) / t; };
const tilt = (b: number): Lean => (b <= -0.34 ? "L" : b >= 0.34 ? "R" : "C");

export function WireTicker() {
  const { w } = useWire(); const now = useNow();
  const items = useMemo(() => (w?.stories ?? []).filter((c) => c.outlets > 1).slice(0, 18).map((c) => c.head), [w]);
  if (!items.length) return <div className="nw-tick" aria-hidden="true"><span className="lbl"><i />Live wire</span><div className="vp"><span className="wait">Reading every outlet&apos;s feed</span></div></div>;
  const row = items.map((x) => (
    <a key={x.u} href={x.u} target="_blank" rel="noopener noreferrer"><i className={`d l-${x.lean}`} /><b>{outletName(x.o)}</b>{x.t}<time>{now ? ago(x.d, now) : ""}</time></a>
  ));
  return (
    <div className="nw-tick" aria-label="Latest headlines">
      <span className="lbl"><i />Live wire</span>
      <div className="vp"><div className="run">{row}<span aria-hidden="true" className="dup">{row}</span></div></div>
    </div>
  );
}

export function WireStats() {
  const { w, err } = useWire();
  const s = useMemo(() => {
    if (!w) return null;
    const multi = w.stories.filter((c) => c.outlets > 1);
    const all = { L: 0, C: 0, R: 0 }; for (const c of w.stories) for (const x of c.items) all[x.lean]++;
    return { heads: w.items, outlets: Object.values(w.outlets).filter((o) => o.items > 0).length, stories: multi.length, blind: w.stories.filter((c) => c.blind).length, all };
  }, [w]);
  return (
    <div className="nw-stats" aria-live="polite">
      <div><b>{s ? s.heads.toLocaleString() : "..."}</b><span>headlines in 48 hours</span></div>
      <div><b>{s ? s.outlets : "..."}</b><span>outlets reporting</span></div>
      <div><b>{s ? s.stories : "..."}</b><span>stories on more than one outlet</span></div>
      <div><b className="g">{s ? s.blind : "..."}</b><span>blindspots right now</span></div>
      <div className="mix">{s ? <LeanBar n={s.all} /> : <span className="nw-note">{err ? "The live wire is not reachable right now" : "Reading feeds"}</span>}<span>who wrote today&apos;s headlines</span></div>
    </div>
  );
}

/** Every picture the story's outlets offer, largest first: an outlet's large size, then its feed size. */
export function picsOf(c: Cluster): { src: string; o: string; u: string }[] {
  const score = (x: Cluster["items"][number]) => (x.iw ?? 0) >= 800 ? 3 : x.thumb ? 2 : (x.iw ?? 0) >= 400 ? 1 : 0;
  const its = c.items.filter((x) => x.img).sort((a, b) => score(b) - score(a));
  return its.flatMap((x) => [{ src: x.img!, o: x.o, u: x.u }, ...(x.thumb ? [{ src: x.thumb, o: x.o, u: x.u }] : [])]);
}
/** A picture that falls back down the list when a size does not load, and to a coverage graphic at the end. */
export function Photo({ c, credit = true, eager = false }: { c: Cluster; credit?: boolean; eager?: boolean }) {
  const list = useMemo(() => picsOf(c), [c]);
  const [i, setI] = useState(0);
  const cur = list[i];
  const b = balance(c);
  return (
    <figure className={`nw-pic t-${tilt(b)}`}>
      {cur ? <img src={cur.src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setI(i + 1)} onLoad={(e) => { const im = e.currentTarget; if (im.naturalWidth && im.naturalWidth < 120) setI(i + 1); }} /> : (
        <svg viewBox="0 0 300 170" preserveAspectRatio="none" aria-hidden="true">
          {(["L", "C", "R"] as Lean[]).reduce<{ x: number; el: React.ReactNode[] }>((acc, l) => { const t = c.n.L + c.n.C + c.n.R || 1; const w = (300 * c.n[l]) / t; acc.el.push(<rect key={l} x={acc.x} y={0} width={w} height={170} className={`f-${l}`} />); acc.x += w; return acc; }, { x: 0, el: [] }).el}
          <text x="18" y="150" className="n">{c.outlets}</text>
          <text x="18" y="164" className="u">outlets</text>
        </svg>
      )}
      {c.blind ? <span className="flag">Blindspot for the {LEAN_LABEL[c.blind]}</span> : null}
      {credit && cur ? <figcaption>Photo via {outletName(cur.o)}</figcaption> : null}
    </figure>
  );
}
const Pic = ({ c }: { c: Cluster }) => <Photo c={c} />;

/** The lead story's picture: taken from the live wire story that matches it. */
export function LeadPhoto({ keys }: { keys: string[] }) {
  const { w } = useWire();
  const c = useMemo(() => (w?.stories ?? []).find((x) => picsOf(x).length && keys.some((k) => x.items.map((i) => i.t.toLowerCase()).join(" ").includes(k.toLowerCase()))), [w, keys]);
  if (!c) return null;
  return <div className="np-leadpic" data-rv><Photo c={c} eager /></div>;
}

/** Today's date in Eastern time, for the edition line. */
export function Edition() {
  const [d, setD] = useState<string>("");
  useEffect(() => { setD(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })); }, []);
  return <span>{d || "Today"}</span>;
}

/** The filter the front page unfolds through: a crumpled sheet whose folds flatten out over a second and a half.
 * It animates with SMIL inside the filter, so it runs from first paint without waiting for script. */
export function RumpleDefs() {
  return (
    <svg className="np-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="np-unrumple" x="-6%" y="-6%" width="112%" height="112%" colorInterpolationFilters="sRGB">
        <feTurbulence type="turbulence" baseFrequency="0.0065 0.011" numOctaves="3" seed="11" result="folds" />
        <feDisplacementMap in="SourceGraphic" in2="folds" scale="0" xChannelSelector="R" yChannelSelector="G">
          <animate attributeName="scale" values="150;96;44;16;5;0" keyTimes="0;0.18;0.42;0.66;0.85;1" dur="1.5s" fill="freeze" />
        </feDisplacementMap>
      </filter>
    </svg>
  );
}

let rumpleN = 0;
/** Crumple one element and smooth it flat: a displacement map of sharp folds whose strength falls to nothing,
 * with a little crinkle on the way, then the filter is removed so scrolling stays smooth. */
function rumple(el: HTMLElement, from = 58, dur = 1150) {
  const defs = document.querySelector("svg.np-defs"); if (!defs) return;
  const NS = "http://www.w3.org/2000/svg", id = `np-rmp-${++rumpleN}`;
  const f = document.createElementNS(NS, "filter"); f.setAttribute("id", id);
  for (const [k, v] of [["x", "-8%"], ["y", "-8%"], ["width", "116%"], ["height", "116%"], ["color-interpolation-filters", "sRGB"]]) f.setAttribute(k, v);
  const t = document.createElementNS(NS, "feTurbulence");
  t.setAttribute("type", "turbulence"); t.setAttribute("baseFrequency", `${(0.008 + Math.random() * 0.006).toFixed(4)} ${(0.012 + Math.random() * 0.008).toFixed(4)}`);
  t.setAttribute("numOctaves", "3"); t.setAttribute("seed", String(1 + Math.floor(Math.random() * 900))); t.setAttribute("result", "folds");
  const d = document.createElementNS(NS, "feDisplacementMap");
  d.setAttribute("in", "SourceGraphic"); d.setAttribute("in2", "folds"); d.setAttribute("xChannelSelector", "R"); d.setAttribute("yChannelSelector", "G"); d.setAttribute("scale", String(from));
  f.append(t, d); defs.appendChild(f);
  el.style.filter = `url(#${id})`;
  const t0 = performance.now(), delay = parseFloat(el.style.getPropertyValue("--d")) || 0;
  const step = (now: number) => {
    const k = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
    const e = 1 - Math.pow(1 - k, 3);
    const crinkle = 1 + 0.22 * Math.sin(k * 26) * (1 - k);
    d.setAttribute("scale", (from * (1 - e) * crinkle).toFixed(2));
    if (k < 1) requestAnimationFrame(step); else { el.style.filter = ""; f.remove(); }
  };
  requestAnimationFrame(step);
}

/** Cards rumple into place as they scroll into view. Without script, or with reduced motion, everything just shows. */
export function ScrollFx({ font }: { font?: string }) {
  useEffect(() => {
    if (font && !document.querySelector(`link[data-np-font]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = font; l.setAttribute("data-np-font", "1"); document.head.appendChild(l); }
    const root = document.querySelector(".nwp"); if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    root.classList.add("np-fx");
    const show = (el: Element) => { el.classList.add("in"); rumple(el as HTMLElement); };
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
    const seen = new WeakSet<Element>();
    const scan = () => root.querySelectorAll("[data-rv]").forEach((el, i) => {
      if (seen.has(el)) return; seen.add(el);
      const h = el as HTMLElement;
      h.style.setProperty("--d", `${(i % 4) * 80}ms`);
      h.style.setProperty("--rz", `${(Math.random() * 4 - 2).toFixed(2)}deg`);
      h.style.setProperty("--rx", `${(6 + Math.random() * 8).toFixed(1)}deg`);
      const r = el.getBoundingClientRect(); if (r.top < window.innerHeight * 0.9) requestAnimationFrame(() => show(el)); else io.observe(el);
    });
    scan(); const mo = new MutationObserver(scan); mo.observe(root, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [font]);
  return null;
}

export function WireCards({ n = 8 }: { n?: number }) {
  const { w } = useWire(); const now = useNow();
  const list = useMemo(() => (w?.stories ?? []).filter((c) => c.outlets > 1).slice(0, n), [w, n]);
  if (!w) return <div className="nw-cards">{Array.from({ length: 4 }, (_, i) => <div key={i} className="nw-cardx sk sx-skel" />)}</div>;
  if (!list.length) return null;
  return (
    <div className="nw-cards">
      {list.map((c, i) => (
        <article key={c.id} className={`nw-cardx${i === 0 ? " big" : ""}`} data-rv>
          <button onClick={() => openStory(c.id)} aria-label={`Open coverage of ${c.head.t}`}>
            <Pic c={c} />
            <span className="nw-cat">{CATS.find((k) => k.k === c.cat)?.l} · {now ? ago(c.last, now) : ""}</span>
            <h3>{c.head.t}</h3>
            <LeanBar n={c.n} label={i === 0} />
            <span className="nw-src">{outletName(c.head.o)}{c.outlets > 1 ? ` and ${c.outlets - 1} more` : ""}</span>
          </button>
        </article>
      ))}
    </div>
  );
}

export function Compass() {
  const { w } = useWire();
  const [hov, setHov] = useState<{ c: Cluster; x: number; y: number } | null>(null);
  const pts = useMemo(() => {
    const list = (w?.stories ?? []).filter((c) => c.outlets > 1).slice(0, 60);
    const maxO = Math.max(2, ...list.map((c) => c.outlets));
    // a small fixed jitter so stories with the same mix do not sit on top of each other
    return list.map((c, i) => { const b = balance(c); const y = 300 - (Math.log(c.outlets) / Math.log(maxO)) * 210; return { c, x: 710 + b * 630 + ((i * 37) % 23) - 11, y: y + ((i * 53) % 19) - 9, r: 6 + Math.sqrt(c.outlets) * 3.4, t: tilt(b) }; });
  }, [w]);
  return (
    <div className="card nw-compass" data-rv>
      <div className="card-h"><h3>The coverage compass</h3><span className="eye">every story on more than one outlet, placed by who carries it</span></div>
      <svg viewBox="0 0 1400 360" role="img" aria-label="Stories placed from carried only on the Left to carried only on the Right, higher when more outlets carry them">
        <rect x="70" y="20" width="427" height="300" className="band L" /><rect x="497" y="20" width="426" height="300" className="band C" /><rect x="923" y="20" width="427" height="300" className="band R" />
        <line x1="710" x2="710" y1="20" y2="320" className="mid" />
        <text x="84" y="44" className="bl">Carried mostly on the Left</text>
        <text x="710" y="44" className="bl" textAnchor="middle">Carried across the spectrum</text>
        <text x="1336" y="44" className="bl" textAnchor="end">Carried mostly on the Right</text>
        <text x="70" y="344" className="ax">Only Left outlets</text><text x="710" y="344" className="ax" textAnchor="middle">Even</text><text x="1350" y="344" className="ax" textAnchor="end">Only Right outlets</text>
        <text x="60" y="84" className="ax" textAnchor="end">More</text><text x="60" y="314" className="ax" textAnchor="end">Fewer</text>
        <text x="60" y="100" className="ax" textAnchor="end">outlets</text>
        {pts.map((p) => (
          <circle key={p.c.id} cx={p.x} cy={p.y} r={p.r} className={`pt l-${p.t}${p.c.blind ? " bs" : ""}${hov?.c.id === p.c.id ? " on" : ""}`} tabIndex={0}
            onMouseMove={(e) => setHov({ c: p.c, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHov(null)}
            onFocus={(e) => { const r = (e.target as SVGCircleElement).getBoundingClientRect(); setHov({ c: p.c, x: r.right, y: r.top }); }} onBlur={() => setHov(null)}
            onClick={() => openStory(p.c.id)} onKeyDown={(e) => { if (e.key === "Enter") openStory(p.c.id); }}>
            <title>{p.c.head.t}</title>
          </circle>
        ))}
        {!w ? <text x="710" y="180" className="bl" textAnchor="middle">Reading every outlet&apos;s feed</text> : null}
      </svg>
      <p className="nw-cap">Bigger and higher means more outlets carry the story. Ringed dots are blindspots. Click a dot to open how each side covered it.</p>
      {hov ? <FloatTip x={hov.x} y={hov.y} className="nw-tip" scope="opp nw"><b>{hov.c.head.t}</b><LeanBar n={hov.c.n} /><span>{hov.c.outlets} outlets · {outletName(hov.c.head.o)}</span></FloatTip> : null}
    </div>
  );
}

export function Blindspots() {
  const { w } = useWire();
  const side = (l: "L" | "R") => (w?.stories ?? []).filter((c) => c.blind === l).slice(0, 4);
  const col = (l: "L" | "R") => {
    const other: Lean = l === "L" ? "R" : "L"; const list = side(l);
    return (
      <div className={`nw-bs b-${l}`} data-rv>
        <div className="nw-bs-h"><span className="k">Blindspot for the {LEAN_LABEL[l]}</span><h3>Only the {LEAN_LABEL[other]} is covering these</h3><p>Three or more {LEAN_LABEL[other]} outlets and no {LEAN_LABEL[l]} outlet.</p></div>
        {list.length ? <ul>{list.map((c) => (
          <li key={c.id}><button onClick={() => openStory(c.id)}><b>{c.head.t}</b><span>{c.items.map((x) => outletName(x.o)).slice(0, 4).join(", ")}{c.items.length > 4 ? ` and ${c.items.length - 4} more` : ""}</span></button></li>
        ))}</ul> : <p className="nw-note">{w ? "None right now. Every story carried by this side is also being covered by the other." : "Reading feeds"}</p>}
      </div>
    );
  };
  return <div className="nw-bss">{col("L")}{col("R")}</div>;
}

export function SideBySide({ heads }: { heads: Partial<Record<Lean, { o: string; n?: string; t: string; u: string }>> }) {
  return (
    <div className="nw-sbs">
      {(["L", "C", "R"] as Lean[]).map((l) => {
        const h = heads[l];
        return (
          <div key={l} className={`col l-${l}`}>
            <LeanTag lean={l} small />
            {h ? <a href={h.u} target="_blank" rel="noopener noreferrer"><q>{h.t}</q><span>{outletName(h.o, h.n)}</span></a> : <p className="none">No {LEAN_LABEL[l]} outlet has covered this yet.</p>}
          </div>
        );
      })}
    </div>
  );
}
