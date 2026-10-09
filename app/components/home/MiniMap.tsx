"use client";
import { useEffect, useState } from "react";
import { marginColor } from "@/app/lib/opp";
import { fit, pathsBox, type CountyPath, type CountyRow } from "./countyGeo";

/** A 320 x 180 county map for story thumbnails, the same colors as the simulation map. */
export default function MiniMap({ raceId }: { raceId: string }) {
  const [g, setG] = useState<{ paths: CountyPath[]; rows: Record<string, CountyRow> } | null>(null);
  useEffect(() => {
    const st = raceId.split("-")[1];
    let alive = true;
    Promise.all([fetch(`/forecast/states/${st}.json`).then((r) => r.json()), fetch("/forecast/counties.json").then((r) => r.json())])
      .then(([s, c]) => { if (alive) setG({ paths: s.counties, rows: c[raceId] ?? {} }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [raceId]);
  if (!g) return null;
  const { sc, ox, oy } = fit(pathsBox(g.paths), 320, 180, 30, 20);
  return (
    <g transform={`translate(${ox},${oy}) scale(${sc})`}>
      {g.paths.map((p) => <path key={p.id} d={p.d} fill={marginColor(g.rows[p.id]?.[0] ?? 0)} stroke="#120820" strokeWidth={1 / sc} />)}
    </g>
  );
}
