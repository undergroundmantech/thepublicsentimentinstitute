"use client";

import React, { useEffect, useRef, useState } from "react";
import { candColor } from "../onpoint/electionLib.js";
import ResultMap from "../onpoint/ResultMap.jsx";

// The county atlas — an editorial plate composition. One hero plate (the
// richest statewide geography, held static) beside a 2×2 rail of specimens
// that CYCLE through the season's best statewide maps with a soft crossfade.
// Frameless maps floating on a tone glow, museum-figure captions.

const surname = (n?: string) => (n ? n.trim().split(/\s+/).pop() : "");
const partyLetter = (cand: any) => {
  const p = String(cand?.party || "").toLowerCase();
  if (/democr/.test(p)) return "D";
  if (/republic|gop/.test(p)) return "R";
  if (/independ/.test(p)) return "I";
  return "";
};
const fmtMargin = (doc: any) => {
  const L = doc?.leader;
  if (!L) return "";
  const lead = Number(L.lead) || 0;
  if (lead >= 100) return "unopposed";
  const pl = partyLetter(L.cand);
  const n = lead < 10 ? lead.toFixed(1) : Math.round(lead);
  return `${pl ? pl + "+" : "+"}${n}`;
};

function Plate({
  doc,
  docs,
  no,
  hero,
  near,
  offset = 0,
  onOpen,
}: {
  doc?: any;
  docs?: any[];
  no: number;
  hero?: boolean;
  near: boolean;
  offset?: number;
  onOpen: (race: any) => void;
}) {
  const list: any[] = docs && docs.length ? docs : doc ? [doc] : [];
  const [i, setI] = useState(0);

  // cycle the list once in view (motion-permitting), staggered per plate
  useEffect(() => {
    if (!near || list.length <= 1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % list.length), 6400 + offset);
    return () => window.clearInterval(id);
  }, [near, list.length, offset]);

  const active = list.length ? list[i % list.length] : null;
  const cand = active?.leader?.cand;
  const tone = cand ? candColor(cand) : "#6a6cff";
  const meta = [active?.stateName || active?.province, active?.office, `${Math.round(Number(active?.reporting) || 0)}% in`]
    .filter(Boolean)
    .join(" · ");

  return (
    <figure
      className={`desk-plate ${hero ? "hero" : "sm"}`}
      style={{ ["--t" as any]: tone }}
      role="button"
      tabIndex={0}
      onClick={() => active?.race && onOpen(active.race)}
      onKeyDown={(e) => { if (e.key === "Enter" && active?.race) onOpen(active.race); }}
      aria-label={`Open ${active?.contest || "race"}`}
    >
      <div className="desk-plate-map">
        <div className="desk-plate-swap" key={active?.id}>
          {active?.race ? <ResultMap race={active.race} inView={near} whole={active?.wholeMap !== false} fit="contain" /> : null}
        </div>
        {list.length > 1 ? (
          <span className="desk-plate-dots" aria-hidden>
            {list.map((_, k) => <i key={k} className={k === i % list.length ? "on" : ""} />)}
          </span>
        ) : null}
      </div>
      <figcaption className="desk-plate-cap" key={`c-${active?.id}`}>
        <span className="desk-plate-no">plate {String(no).padStart(2, "0")}</span>
        <span className="desk-plate-body">
          <b>{active?.contest || active?.title || "—"}</b>
          <span>{meta}</span>
        </span>
        <span className="desk-plate-lead" style={{ color: tone }}>
          {surname(cand?.name)} {fmtMargin(active)}
        </span>
      </figcaption>
      {hero ? (
        <span className="desk-plate-cta" aria-hidden>
          open the precinct map <i>→</i>
        </span>
      ) : null}
    </figure>
  );
}

export default function PrecinctShowcase({
  lead,
  pool,
  onOpen,
}: {
  lead: any;
  pool: any[];
  onOpen: (race: any) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return (
    <div className={`desk-atlaswrap ${near ? "is-in" : ""}`} ref={ref}>
      <span className="desk-atlas-side" aria-hidden>county results · live from the desk · 2026</span>
      <div className="desk-atlas">
        {lead ? (
          <div className="desk-atlas-main">
            <Plate doc={lead} no={1} hero near={near} onOpen={onOpen} />
          </div>
        ) : null}
        <div className="desk-atlas-rail">
          {[0, 1, 2, 3].map((k) => {
            const slice = pool.filter((_: any, idx: number) => idx % 4 === k);
            return slice.length ? (
              <Plate key={k} docs={slice} no={k + 2} near={near} offset={k * 1500} onOpen={onOpen} />
            ) : (
              <figure key={k} className="desk-plate sm" aria-hidden><div className="desk-plate-map" /></figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}
