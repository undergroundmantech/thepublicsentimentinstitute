"use client";
// The 2028 presidential vote in every congressional district, 2026 lines. Each district starts from its own 2024
// presidential margin and moves with the vote weighted swing of the counties it covers. Picking a matchup moves every
// district by its state's candidate shift, the same shift the state map uses.
// Paths: /forecast/geo.json districts (975 x 610). Data: /forecast/2028/districts.json.
import { useEffect, useMemo, useState } from "react";
import FloatTip from "@/app/components/opp/FloatTip";
import { fmtMg, fmtPct, marginColor, probColor, shiftColor, shiftFor, type Cand, type Coal } from "./sim28";

type Row = [number, number, number, number, number, string, string]; // m, pD, p10, p90, m24, 2026 House party, 2026 House winner
const NAME: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

function useJson<T>(url: string): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => { let live = true; fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setV(j as T); }).catch(() => undefined); return () => { live = false; }; }, [url]);
  return v;
}
// normal tail, for the matchup's district win chance from the published 80% range
function phi(z: number) { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }

export default function District28({ dcand, rcand, coal }: { dcand: Record<string, Cand>; rcand: Record<string, Cand>; coal: Coal }) {
  const geo = useJson<{ districts: Record<string, { d: string; box: number[] }> }>("/forecast/geo.json");
  const data = useJson<{ cols: string[]; rows: Record<string, Row> }>("/forecast/2028/districts.json");
  const [dC, setDC] = useState("Generic Democrat");
  const [rC, setRC] = useState("Vance");
  const [st, setSt] = useState("");
  const [layer, setLayer] = useState<"m" | "p" | "s">("m");
  const [tip, setTip] = useState<{ x: number; y: number; cd: string } | null>(null);

  const dflt = dC === "Generic Democrat" && rC === "Vance";
  const rows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.rows).map(([cd, r]) => {
      const s = cd.slice(0, 2); const sh = dflt ? 0 : shiftFor(dcand, rcand, dC, rC, s, coal); const m = r[0] + sh;
      const sd = Math.max(2, (r[3] - r[2]) / 2.563); const pD = dflt ? r[1] : phi(-m / sd);
      return { cd, st: s, m, pD, m24: r[4], hp: r[5], hw: r[6] };
    });
  }, [data, dflt, dC, rC, dcand, rcand, coal]);
  const by = useMemo(() => new Map(rows.map((r) => [r.cd, r])), [rows]);
  const shown = st ? rows.filter((r) => r.st === st) : rows;
  const nD = rows.filter((r) => r.m < 0).length, n24 = rows.filter((r) => r.m24 < 0).length;
  const flips = rows.filter((r) => (r.m < 0) !== (r.m24 < 0));
  const vb = useMemo(() => {
    if (!geo || !st) return "0 0 975 610";
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of rows) if (r.st === st) { const b = geo.districts["house-" + r.cd]?.box; if (!b) continue; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[0] + b[2]); y1 = Math.max(y1, b[1] + b[3]); }
    if (x0 > x1) return "0 0 975 610";
    const pad = Math.max(x1 - x0, y1 - y0) * 0.05; return `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`;
  }, [geo, st, rows]);
  const fill = (cd: string) => { const r = by.get(cd); if (!r) return "rgba(120,120,140,.15)"; return layer === "p" ? probColor(r.pD) : layer === "s" ? shiftColor(r.m - r.m24, 12) : marginColor(r.m); };
  const t = tip ? by.get(tip.cd) : null;
  const sw = st ? 0.25 : 0.4;

  return (
    <section className="p28-sec">
      <div className="sec-h"><h2>Every congressional district</h2><p>The presidential vote in all 435 districts on the 2026 lines. Each district starts from its own 2024 result and moves with the counties it covers. {dflt ? "A generic Democrat against Vance" : `${dC} against ${rC}`} carries {nD} districts, against {n24} for Harris in 2024; {flips.length} change hands.</p></div>
      <div className="p28-controls sub">
        <label>Democrat <select id="p28-cd-d" value={dC} onChange={(e) => setDC(e.target.value)}>{Object.keys(dcand).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label>Republican <select id="p28-cd-r" value={rC} onChange={(e) => setRC(e.target.value)}>{Object.keys(rcand).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label>State <select id="p28-cd-st" value={st} onChange={(e) => setSt(e.target.value)}><option value="">United States</option>{Object.keys(NAME).sort((a, b) => NAME[a].localeCompare(NAME[b])).map((s) => <option key={s} value={s}>{NAME[s]}</option>)}</select></label>
        <div className="p28-seg sm" role="tablist" aria-label="District map layer">
          {([["m", "Margin"], ["p", "Win chance"], ["s", "Shift from 2024"]] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={layer === k} className={layer === k ? "on" : ""} onClick={() => setLayer(k)}>{l}</button>)}
        </div>
      </div>
      <div className="p28-two">
        <div className="card p28-mapcard">
          {geo && data ? (
            <svg viewBox={vb} className="p28-map" role="img" aria-label="2028 presidential margin by congressional district" onMouseLeave={() => setTip(null)}>
              {Object.entries(geo.districts).filter(([k]) => !st || k.slice(6, 8) === st).map(([k, g]) => (
                <path key={k} className="c" d={g.d} fill={fill(k.slice(6))} style={{ strokeWidth: sw }} onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, cd: k.slice(6) })} onClick={() => setSt(k.slice(6, 8))} />
              ))}
            </svg>
          ) : <p className="note">Loading districts</p>}
          <div className="p28-legend"><span>{layer === "s" ? "Toward D" : "D"}</span><i className="ramp" style={{ background: layer === "s" ? "linear-gradient(90deg,#2454d6,#ecf0fa,#faecf0,#c81e40)" : "linear-gradient(90deg,#10288c,#3d7bff,#d6e2ff,#ffdce4,#ff3b5c,#8c0a28)" }} /><span>{layer === "s" ? "Toward R" : "R"}</span><span>Click a district to zoom to its state.</span></div>
        </div>
        <div className="card"><div className="card-h"><h3>{st ? NAME[st] : "Closest districts"}</h3><span className="eye">{st ? `${shown.length} districts` : "within 10 points"}</span></div>
          <div className="card-b p28-tbl tall"><table><thead><tr><th>District</th><th className="n">2024</th><th className="n">2028</th><th className="n">D win</th><th>2026 House</th></tr></thead><tbody>
            {(st ? [...shown].sort((a, b) => a.cd.localeCompare(b.cd)) : shown.filter((r) => Math.abs(r.m) < 10).sort((a, b) => Math.abs(a.m) - Math.abs(b.m))).map((r) => (
              <tr key={r.cd}><td>{r.cd}</td><td className={`n ${r.m24 < 0 ? "d" : "r"}`}>{fmtMg(r.m24)}</td><td className={`n ${r.m < 0 ? "d" : "r"}`}>{fmtMg(r.m)}</td><td className="n">{fmtPct(r.pD)}</td><td className={r.hp === "D" ? "d" : r.hp === "R" ? "r" : ""}>{r.hw || "no result"}</td></tr>
            ))}
          </tbody></table></div></div>
      </div>
      {tip && t ? (
        <FloatTip x={tip.x} y={tip.y} className="p28-tip" scope="opp">
          <b>{NAME[t.st] ?? t.st} {t.cd.slice(3)}</b>
          <div className="row"><span>2028 margin</span><span>{fmtMg(t.m)}</span></div>
          <div className="row"><span>Democratic win</span><span>{fmtPct(t.pD)}</span></div>
          <div className="row"><span>2024 result</span><span>{fmtMg(t.m24)}</span></div>
          <div className="row"><span>Shift from 2024</span><span>{fmtMg(t.m - t.m24)}</span></div>
          <div className="row"><span>2026 House winner</span><span>{t.hw ? `${t.hw}, ${t.hp}` : "no result"}</span></div>
        </FloatTip>
      ) : null}
    </section>
  );
}
