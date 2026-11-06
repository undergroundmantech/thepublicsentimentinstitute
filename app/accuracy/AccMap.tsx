"use client";
// Where the forecast missed: each state shaded by the average miss across its Senate and governor races, or each House
// district by its own miss. Blue means Democrats ran ahead of the forecast, red means Republicans did.
// Paths: /forecast/geo.json (975 x 610), the same file the forecast maps draw from.
import { useEffect, useMemo, useState } from "react";

export type MapRow = { id: string; label: string; fm: string; act: string; err: number; note?: string };

function errColor(x: number, span = 10) {
  const a = Math.min(1, Math.abs(x) / span);
  const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`;
  return x < 0 ? mix([226, 232, 248], [36, 84, 214], a) : mix([248, 228, 234], [200, 30, 64], a);
}
const fmtE = (e: number) => (Math.abs(e) < 0.05 ? "On target" : `${e < 0 ? "D" : "R"} ${Math.abs(e).toFixed(1)}`);

export default function AccMap({ states, house }: { states: Record<string, MapRow>; house: Record<string, MapRow> }) {
  const [geo, setGeo] = useState<{ states: Record<string, string>; districts: Record<string, { d: string }> } | null>(null);
  const [layer, setLayer] = useState<"s" | "h">("s");
  const [tip, setTip] = useState<{ x: number; y: number; row: MapRow } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/forecast/geo.json").then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setGeo(j); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const paths = useMemo(() => {
    if (!geo) return [];
    if (layer === "s") return Object.entries(geo.states).map(([k, d]) => ({ k, d: typeof d === "string" ? d : (d as { d: string }).d, row: states[k] }));
    return Object.entries(geo.districts).map(([k, g]) => ({ k, d: g.d, row: house[k] }));
  }, [geo, layer, states, house]);

  return (
    <div className="card acc-map">
      <div className="card-h">
        <h3>{layer === "s" ? "Average miss in each state's Senate and governor races" : "The miss in every House district"}</h3>
        <div className="acc-seg" role="tablist" aria-label="Map layer">
          <button type="button" role="tab" id="acc-map-s" aria-selected={layer === "s"} className={layer === "s" ? "on" : ""} onClick={() => setLayer("s")}>States</button>
          <button type="button" role="tab" id="acc-map-h" aria-selected={layer === "h"} className={layer === "h" ? "on" : ""} onClick={() => setLayer("h")}>House districts</button>
        </div>
      </div>
      <div className="card-b">
        {geo ? (
          <svg viewBox="0 0 975 610" className="acc-geo" role="img" aria-label="Map of the forecast miss" onMouseLeave={() => setTip(null)}>
            {paths.map((p) => (
              <path key={p.k} d={p.d} fill={p.row ? errColor(p.row.err, layer === "s" ? 8 : 12) : "rgba(140,134,163,.16)"} style={{ strokeWidth: layer === "s" ? 0.8 : 0.3 }}
                onMouseMove={(e) => p.row && setTip({ x: e.clientX, y: e.clientY, row: p.row })} />
            ))}
          </svg>
        ) : <p className="acc-note">Loading the map</p>}
        <div className="acc-legend"><span>Democrats ran ahead</span><i style={{ background: `linear-gradient(90deg,${errColor(-10)},${errColor(0)},${errColor(10)})` }} /><span>Republicans ran ahead</span><span className="dim">Unshaded: no scored race</span></div>
      </div>
      {tip ? (
        <div className="acc-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>
          <b>{tip.row.label}</b>
          <div className="row"><span>Forecast</span><span>{tip.row.fm}</span></div>
          <div className="row"><span>Result</span><span>{tip.row.act}</span></div>
          <div className="row"><span>Miss</span><span>{fmtE(tip.row.err)}</span></div>
          {tip.row.note ? <div className="nt">{tip.row.note}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
