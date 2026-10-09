"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Tip, useTip } from "../home/motion";
import { fit, pathsBox, type CountyPath } from "../home/countyGeo";

export type GeoTip = { title: string; rows: [string, string, string?][] };

/** A county or district map fitted to 900 x 620: fills, hover tooltips, optional links and a highlighted unit. */
export default function GeoMap({ paths, fills, tips, hrefs, highlight, label, W = 900, H = 620 }: {
  paths: CountyPath[]; fills: Record<string, string>; tips: Record<string, GeoTip>; hrefs?: Record<string, string>;
  highlight?: string; label: string; W?: number; H?: number;
}) {
  const { tip, show, hide } = useTip();
  const { sc, ox, oy } = useMemo(() => fit(pathsBox(paths), W, H), [paths, W, H]);
  const hl = highlight ? paths.find((p) => p.id === highlight) : undefined;
  return (
    <>
      <svg className="cmap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <g transform={`translate(${ox},${oy}) scale(${sc})`}>
          {paths.map((p, i) => {
            const t = tips[p.id];
            const el = (
              <path key={p.id} d={p.d} fill={fills[p.id] ?? "rgba(255,255,255,.08)"} style={{ strokeWidth: 1 / sc, animationDelay: `${Math.min(i, 250) * 4}ms`, opacity: highlight && highlight !== p.id ? undefined : undefined }}
                onMouseMove={(e) => t && show(<><b>{t.title}</b>{t.rows.map(([k, v, c]) => <div className="row" key={k}><span>{k}</span><span style={c ? { color: c } : undefined}>{v}</span></div>)}</>, e)}
                onMouseLeave={hide} />
            );
            return hrefs?.[p.id] ? <Link key={p.id} href={hrefs[p.id]} aria-label={t?.title}>{el}</Link> : el;
          })}
          {hl && <path d={hl.d} fill="none" stroke="#fff" strokeWidth={2.4 / sc} style={{ pointerEvents: "none", opacity: 1, animation: "none" }} />}
        </g>
      </svg>
      <Tip tip={tip} />
    </>
  );
}
