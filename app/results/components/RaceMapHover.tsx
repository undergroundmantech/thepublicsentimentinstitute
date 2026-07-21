"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  loadGeo,
  fetchRace,
  featuresForState,
  makeProjector,
  geomToPath,
  regionKey,
  candColor,
  tonePalette,
  regionFill,
  shade,
  nodataFill,
  regionVotes,
} from "../onpoint/electionLib.js";

// The race page's county map with the precinct app's EXACT hover tooltip
// (ported from precinct-map/web/components/HoverPanel.tsx, civic branch):
// leader-tinted gradient header, projected banner strip, candidate rows with
// the 4px tone tick + checkbox ✓ + mono votes + bold percents, and the
// reporting footer with its thin progress bar. Hover any county to read it.

const VB_W = 760;
const VB_H = 540;
const CARD_W = 296;
const OFFSET = 18;

const fmtInt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-US");

type Shape = { d: string; fill: string; faint: boolean; name: string; region: any };

/** CO-04 §3 Zone 3: RESULTS / MARGIN / REMAINING map toggles. RESULTS is a
 *  flat leader-color read (who's ahead, no shading); MARGIN is the original
 *  mapShade-graded fill (intensity = lead size, same as the hub thumbnail);
 *  REMAINING (forecast-tier only) shades by how much vote is still
 *  outstanding in that county (100 - percent_reporting). */
export type CountyMapMode = "results" | "margin" | "remaining";

const rgbOf = (h: string) => {
  const x = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
};
const hexOf = (a: number[]) =>
  "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mixHex = (a: string, b: string, t: number) => {
  const A = rgbOf(a), B = rgbOf(b);
  return hexOf(A.map((v, i) => v + (B[i] - v) * t));
};
const isLightTheme = () =>
  typeof document !== "undefined" && document.documentElement.dataset.opaTheme === "light";

/** REMAINING mode fill: neutral base -> amber accent as more vote is still outstanding. */
function remainingFill(region: any): string {
  if (!region) return nodataFill();
  const reporting = Math.max(0, Math.min(100, Number(region.percent_reporting) || 0));
  const outstanding = (100 - reporting) / 100;
  const base = isLightTheme() ? "#eef0f4" : "#20222b";
  return mixHex(base, "#f5b544", 0.12 + 0.7 * outstanding);
}

/** RESULTS mode fill: flat, fully-saturated leader color — "who's ahead"
 *  at a glance, no margin-size shading (that's what MARGIN mode is for). */
function flatLeaderFill(region: any, nameToColor: Record<string, string>): string {
  const votes = regionVotes(region);
  const reporting = Number(region?.percent_reporting) || 0;
  if (votes <= 0 && reporting <= 0) return nodataFill();
  const cs = [...(region.candidates || [])].sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0));
  const localWin = cs[0];
  if (!localWin || (localWin.votes || 0) <= 0 || votes <= 0) return nodataFill();
  const key = String(localWin.name || "").trim().toLowerCase();
  return (nameToColor && nameToColor[key]) || candColor(localWin);
}

export default function RaceMapHover({ race, mode = "margin" }: { race: any; mode?: CountyMapMode }) {
  const [shapes, setShapes] = useState<Shape[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    (async () => {
      try {
        const [geo, detail] = await Promise.all([loadGeo(), fetchRace(race.id, ac.signal)]);
        if (!alive) return;
        const rr = detail?.region_results || {};
        const byKey: Record<string, any> = {};
        for (const k of Object.keys(rr)) {
          const r = rr[k];
          const kk = regionKey(race.province, r?.name || k);
          if (kk) byKey[kk] = r;
        }
        const stateFeats = featuresForState(geo, race.province);
        if (!stateFeats.length) { setFailed(true); return; }
        const rc = [...(race.candidates || [])].sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0));
        const tones = tonePalette(rc);
        const nameToColor: Record<string, string> = {};
        rc.forEach((c: any, i: number) => {
          const k = String(c.name || "").trim().toLowerCase();
          if (k) nameToColor[k] = tones[i];
        });
        const proj = makeProjector(stateFeats, VB_W, VB_H, 18);
        if (!proj) { setFailed(true); return; }
        const out: Shape[] = stateFeats.map((f: any) => {
          const id = String(f.properties?.county_id || "");
          const nm = id.slice(id.indexOf("-") + 1).replace(/_/g, " ");
          const region = byKey[regionKey(race.province, nm) || ""] || null;
          const pretty = region?.name || nm.toLowerCase().replace(/\b\w/g, (m: string) => m.toUpperCase());
          const fill = !region
            ? "rgba(244,244,239,0.04)"
            : mode === "remaining"
            ? remainingFill(region)
            : mode === "results"
            ? flatLeaderFill(region, nameToColor)
            : regionFill(region, nameToColor);
          return {
            d: geomToPath(f.geometry, proj.project),
            fill,
            faint: !region,
            name: pretty,
            region,
          };
        });
        setShapes(out);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; ac.abort(); };
  }, [race?.id, race?.province, mode]);

  const onMove = (i: number) => (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    setHover({ i, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const tip = useMemo(() => {
    if (!hover || !shapes) return null;
    const s = shapes[hover.i];
    if (!s) return null;
    const wrap = wrapRef.current;
    const cw = wrap?.clientWidth || 600;
    const chh = wrap?.clientHeight || 420;
    let cs: any[] = Array.isArray(s.region?.candidates) ? [...s.region.candidates] : [];
    cs.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    const tones = tonePalette(cs);
    const tot = cs.reduce((sum, c) => sum + (c.votes || 0), 0);
    const has = !!s.region && tot > 0;
    const rep = Math.max(0, Math.min(100, Number(s.region?.percent_reporting) || 0));
    const started = has || rep > 0;
    const winner = cs.find((c) => c.winner);
    const margin = (Number(cs[0]?.percent) || 0) - (Number(cs[1]?.percent) || 0);
    const lead = has ? shade(tones[0] || "#3a3d44", margin) : "#3a3d44";
    const banner = winner && started
      ? `${winner.name} is projected to win.`
      : has && cs[0]
      ? `${cs[0].name} leads.`
      : null;
    // flip sides near the right edge, clamp vertically (same as HoverPanel)
    const rightSide = hover.x + OFFSET + CARD_W > cw - 12;
    const left = rightSide ? Math.max(12, hover.x - OFFSET - CARD_W) : hover.x + OFFSET;
    const top = Math.min(Math.max(12, hover.y - 40), Math.max(12, chh - 300));
    return { s, cs: cs.slice(0, 4), tones, tot, has, rep, started, winner, lead, banner, left, top };
  }, [hover, shapes]);

  if (failed) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "rgba(244,244,239,0.35)", fontSize: 13 }}>
        map unavailable for this race
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", width: "100%", height: "100%" }}
        shapeRendering="geometricPrecision"
        onMouseLeave={() => setHover(null)}
      >
        {shapes ? (
          <g>
            {shapes.map((s, i) => (
              <path
                key={i}
                d={s.d}
                fill={s.fill}
                stroke={s.faint ? "rgba(244,244,239,0.07)" : "rgba(5,5,5,0.55)"}
                strokeWidth={0.7}
                strokeLinejoin="round"
                style={{ cursor: s.region ? "crosshair" : "default", transition: "filter .12s ease" }}
                onMouseMove={onMove(i)}
                onMouseEnter={onMove(i)}
              />
            ))}
            {hover && shapes[hover.i] ? (
              <path d={shapes[hover.i].d} fill="none" stroke="#f4f4ef" strokeWidth={1.4} strokeLinejoin="round" pointerEvents="none" />
            ) : null}
          </g>
        ) : null}
      </svg>

      {/* the ported precinct-app tooltip */}
      {tip ? (
        <div style={{ position: "absolute", left: tip.left, top: tip.top, width: CARD_W, zIndex: 30, pointerEvents: "none", userSelect: "none" }}>
          <div
            style={{
              borderRadius: 8, overflow: "hidden",
              background: "linear-gradient(180deg, rgba(28,30,37,0.72) 0%, rgba(17,18,23,0.78) 60%)",
              backdropFilter: "blur(22px) saturate(165%)", WebkitBackdropFilter: "blur(22px) saturate(165%)",
              boxShadow: "0 18px 46px -16px rgba(0,0,0,0.66), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ padding: "10px 16px", background: `linear-gradient(180deg, ${tip.lead} 0%, ${tip.lead}d9 100%)`, boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.30)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.01em", color: "#fff", lineHeight: 1.06, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: '"Instrument Sans", system-ui, sans-serif' }}>
                  {tip.s.name}
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(255,255,255,0.7)", whiteSpace: "nowrap", fontFamily: '"Instrument Sans", system-ui, sans-serif' }}>
                  {race.province} · {race.election_type || "Race"}
                </div>
              </div>
            </div>

            {tip.banner ? (
              <div style={{ padding: "6px 16px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.18em", lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: tip.winner ? `${tip.lead}1c` : "rgba(255,255,255,0.025)", color: tip.winner ? tip.lead : "#9aa1ac", borderBottom: "1px solid rgba(255,255,255,0.05)", fontFamily: '"Instrument Sans", system-ui, sans-serif' }}>
                {tip.banner}
              </div>
            ) : null}

            {!tip.has ? (
              <div style={{ padding: "12px 16px", fontSize: 11.5, color: "rgba(241,236,225,0.6)", lineHeight: 1.45, fontFamily: '"Instrument Sans", system-ui, sans-serif' }}>
                No votes reported here yet.
              </div>
            ) : (
              <div>
                {tip.cs.map((c: any, idx: number) => {
                  const col = tip.tones[idx] || candColor(c);
                  const win = !!c.winner && tip.started;
                  return (
                    <div
                      key={c.name || idx}
                      style={{
                        position: "relative", display: "flex", alignItems: "center", height: 34, paddingRight: 16,
                        borderTop: idx ? "1px solid rgba(255,255,255,0.05)" : "none",
                        background: win ? `linear-gradient(90deg, ${col}26 0%, ${col}10 55%, transparent 100%)` : "transparent",
                        fontFamily: '"Instrument Sans", system-ui, sans-serif',
                      }}
                    >
                      <span style={{ width: 4, alignSelf: "stretch", flexShrink: 0, background: col }} />
                      <span style={{ width: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {win ? (
                          <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
                            <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke={col} strokeWidth="1.6" fill="none" />
                            <path d="M4.5 8.2 L7 10.6 L11.5 5.4" stroke={col} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        ) : null}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: win ? 800 : 700, color: win ? "#f6f1e6" : "rgba(241,236,225,0.92)" }}>
                        {c.name}
                        {c.party && c.party !== "Nonpartisan" ? (
                          <span style={{ color: "rgba(241,236,225,0.4)", fontWeight: 500, fontSize: 11 }}> {c.party}</span>
                        ) : null}
                      </span>
                      <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12, color: "rgba(241,236,225,0.5)", fontVariantNumeric: "tabular-nums", marginRight: 16 }}>
                        {fmtInt(c.votes || 0)}
                      </span>
                      <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", width: 58, textAlign: "right", fontWeight: win ? 800 : 700, color: win ? "#f6f1e6" : "rgba(241,236,225,0.75)" }}>
                        {(Number(c.percent) || 0).toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ padding: "8px 16px 10px", borderTop: "1px solid rgba(255,255,255,0.08)", fontFamily: '"Instrument Sans", system-ui, sans-serif' }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, fontSize: 9.5, color: "rgba(241,236,225,0.5)", lineHeight: 1 }}>
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {tip.has ? `${fmtInt(tip.tot)} votes · civicAPI` : "awaiting results · civicAPI"}
                </span>
                {tip.has ? (
                  <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                    {tip.rep.toFixed(tip.rep >= 10 ? 0 : 1)}% reporting
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 6, height: 3, width: "100%", borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,0.06)" }} aria-hidden>
                <div style={{ height: "100%", width: `${tip.rep}%`, background: tip.lead, transition: "width 360ms ease" }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
