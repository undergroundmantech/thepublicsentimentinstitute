// app/polling/donaldtrumpapproval/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";
import PollingTimeSeriesChart from "@/app/components/PollingTimeSeriesChart";
import {
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

const GOLD_STANDARD_MULTIPLIER = 3;
import { GOLD_STANDARD_NAMES, RAW_POLLS } from "./data";

function normalizeName(s: string) {
  return s.toLowerCase().replace(/\(r\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function isGoldStandard(pollster: string) {
  const p = normalizeName(pollster);
  return GOLD_STANDARD_NAMES.some((n) => p.includes(normalizeName(n)));
}
function effectiveSampleSize(pollster: string, n: number) {
  if (!Number.isFinite(n) || n <= 0) return n;
  if (!isGoldStandard(pollster)) return n;
  return Math.round(n * GOLD_STANDARD_MULTIPLIER * GOLD_STANDARD_MULTIPLIER);
}

const STATE_RAW: Record<string, { civiqs: number; economist: number; mc: number }> = {
  AL: { civiqs: 9.0,   economist: 2.1,   mc: 16.0 },
  AK: { civiqs: -12.0, economist: -9.2,  mc: -1.0 },
  AZ: { civiqs: -9.0,  economist: -15.3, mc: 4.0 },
  AR: { civiqs: 13.0,  economist: 0.5,   mc: 15.0 },
  CA: { civiqs: -43.0, economist: -26.6, mc: -23.0 },
  CO: { civiqs: -27.0, economist: -26.1, mc: -16.0 },
  CT: { civiqs: -35.0, economist: -32.3, mc: -21.0 },
  DE: { civiqs: -34.0, economist: -24.3, mc: -14.0 },
  DC: { civiqs: -85,   economist: -85,   mc: -85 }, // unchanged
  FL: { civiqs: -9.0,  economist: -5.4,  mc: 2.0 },
  GA: { civiqs: -18.0, economist: -18.9, mc: -5.0 },
  HI: { civiqs: -59.0, economist: -38.6, mc: -34.0 },
  ID: { civiqs: 13.0,  economist: 22.0,  mc: 23.0 },
  IL: { civiqs: -32.0, economist: -33.8, mc: -21.0 },
  IN: { civiqs: 2.0,   economist: -10.5, mc: 0.0 },
  IA: { civiqs: -10.0, economist: -8.6,  mc: -2.0 },
  KS: { civiqs: 3.0,   economist: -7.5,  mc: 1.0 },
  KY: { civiqs: 3.0,   economist: 0.1,   mc: 12.0 },
  LA: { civiqs: 0.0,   economist: -3.7,  mc: 12.0 },
  ME: { civiqs: -23.0, economist: -21.5, mc: -14.0 },
  MD: { civiqs: -46.0, economist: -38.5, mc: -34.0 },
  MA: { civiqs: -50.0, economist: -32.6, mc: -32.0 },
  MI: { civiqs: -22.0, economist: -16.8, mc: -9.0 },
  MN: { civiqs: -27.0, economist: -21.2, mc: -11.0 },
  MS: { civiqs: 1.0,   economist: -2.8,  mc: 11.0 },
  MO: { civiqs: 0.0,   economist: -5.1,  mc: 7.0 },
  MT: { civiqs: 6.0,   economist: 3.0,   mc: 4.0 },
  NE: { civiqs: 1.0,   economist: -4.4,  mc: 6.0 },
  NV: { civiqs: -17.0, economist: -16.5, mc: -5.0 },
  NH: { civiqs: -31.0, economist: -17.2, mc: -12.0 },
  NJ: { civiqs: -31.0, economist: -21.6, mc: -13.0 },
  NM: { civiqs: -28.0, economist: -26.5, mc: -16.0 },
  NY: { civiqs: -35.0, economist: -25.2, mc: -17.0 },
  NC: { civiqs: -11.0, economist: -11.4, mc: -6.0 },
  ND: { civiqs: 15.0,  economist: 9.7,   mc: 15.0 },
  OH: { civiqs: -5.0,  economist: -12.7, mc: -1.0 },
  OK: { civiqs: 17.0,  economist: 3.8,   mc: 14.0 },
  OR: { civiqs: -38.0, economist: -29.0, mc: -23.0 },
  PA: { civiqs: -18.0, economist: -18.3, mc: -3.0 },
  RI: { civiqs: -40.0, economist: -31.3, mc: -26.0 },
  SC: { civiqs: -2.0,  economist: -6.8,  mc: 5.0 },
  SD: { civiqs: 11.0,  economist: -2.8,  mc: 10.0 },
  TN: { civiqs: 8.0,   economist: 5.3,   mc: 17.0 },
  TX: { civiqs: -9.0,  economist: -15.9, mc: 2.0 },
  UT: { civiqs: 1.0,   economist: 1.8,   mc: 7.0 },
  VT: { civiqs: -57.0, economist: -40.9, mc: -35.0 },
  VA: { civiqs: -25.0, economist: -15.6, mc: -12.0 },
  WA: { civiqs: -39.0, economist: -33.6, mc: -21.0 },
  WV: { civiqs: 18.0,  economist: 16.0,  mc: 20.0 },
  WI: { civiqs: -12.0, economist: -18.9, mc: -10.0 },
  WY: { civiqs: 21.0,  economist: 22.0,  mc: 33.0 },
};

const STATE_POP: Record<string, number> = {
  AL:4.1,AK:0.7,AZ:7.4,AR:3.1,CA:39.0,CO:5.9,CT:3.6,DE:1.0,FL:22.6,
  GA:11.0,HI:1.4,ID:2.0,IL:12.5,IN:6.8,IA:3.2,KS:2.9,KY:4.5,LA:4.6,ME:1.4,
  MD:6.2,MA:7.0,MI:10.1,MN:5.7,MS:3.0,MO:6.2,MT:1.1,NE:2.0,NV:3.2,NH:1.4,
  NJ:9.3,NM:2.1,NY:19.3,NC:10.7,ND:0.8,OH:11.8,OK:4.0,OR:4.2,PA:12.9,RI:1.1,
  SC:5.3,SD:0.9,TN:7.1,TX:30.5,UT:3.4,VT:0.6,VA:8.7,WA:7.8,WV:1.8,WI:5.9,WY:0.6,
};

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",
  CT:"Connecticut",DE:"Delaware",DC:"D.C.",FL:"Florida",GA:"Georgia",HI:"Hawaii",
  ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",
  LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",
  MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",
  NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",
  PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",
  WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

// FIPS code → state abbreviation
const FIPS_TO_STATE: Record<number, string> = {
  1:"AL",2:"AK",4:"AZ",5:"AR",6:"CA",8:"CO",9:"CT",10:"DE",11:"DC",
  12:"FL",13:"GA",15:"HI",16:"ID",17:"IL",18:"IN",19:"IA",20:"KS",
  21:"KY",22:"LA",23:"ME",24:"MD",25:"MA",26:"MI",27:"MN",28:"MS",
  29:"MO",30:"MT",31:"NE",32:"NV",33:"NH",34:"NJ",35:"NM",36:"NY",
  37:"NC",38:"ND",39:"OH",40:"OK",41:"OR",42:"PA",44:"RI",45:"SC",
  46:"SD",47:"TN",48:"TX",49:"UT",50:"VT",51:"VA",53:"WA",54:"WV",
  55:"WI",56:"WY",
};

function netToColor(net: number): string {
  if (net > 25)  return "#991b1b";
  if (net > 15)  return "#b91c1c";
  if (net > 8)   return "#dc2626";
  if (net > 3)   return "#ef4444";
  if (net > 0)   return "#f87171";
  if (net === 0) return "#4b2995";
  if (net > -3)  return "#818cf8";
  if (net > -8)  return "#6366f1";
  if (net > -15) return "#4f46e5";
  if (net > -25) return "#3730a3";
  return "#1e1b4b";
}

// ─── Polls data ───────────────────────────────────────────────────────────────

const COLORS: Record<string, string> = { Approve: "#1d5fc4", Disapprove: "#ff0040" };

function round1(n: number) { return Math.round(n * 10) / 10; }

// ─── D3 State Map ─────────────────────────────────────────────────────────────
function StateMap({ tpsiNet, tpsiApprove, tpsiDisapprove }: {
  tpsiNet: number;
  tpsiApprove: number;
  tpsiDisapprove: number;
}) {
  const [tooltip, setTooltip] = useState<{
    code: string;
    x: number;
    y: number;
  } | null>(null);
  const [topoData, setTopoData] = useState<any>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const W = 960, H = 600;

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
      .then((r) => r.json())
      .then(setTopoData)
      .catch(console.error);
  }, []);

  const { correctedStates, rawNationalNet, correctionOffset } = useMemo(() => {
    const stateNets: Record<string, number> = {};
    for (const [code, d] of Object.entries(STATE_RAW)) {
      stateNets[code] = round1((d.civiqs + d.economist + d.mc) / 3);
    }
    let totalPop = 0, weightedNet = 0;
    for (const [code, net] of Object.entries(stateNets)) {
      if (code === "DC") continue;
      const pop = STATE_POP[code] ?? 1;
      weightedNet += net * pop;
      totalPop += pop;
    }
    const rawNationalNet = round1(weightedNet / totalPop);
    const correctionOffset = round1(tpsiNet - rawNationalNet);
    const correctedStates: Record<string, any> = {};
    for (const [code, rawNet] of Object.entries(stateNets)) {
      const correctedNet = round1(rawNet + correctionOffset);
      correctedStates[code] = {
        rawNet,
        correctedNet,
        approve: round1(50 + correctedNet / 2),
        disapprove: round1(50 - correctedNet / 2),
        civiqs: STATE_RAW[code].civiqs,
        economist: STATE_RAW[code].economist,
        mc: STATE_RAW[code].mc,
      };
    }
    return { correctedStates, rawNationalNet, correctionOffset };
  }, [tpsiNet]);

  // Build D3 paths
  const statePaths = useMemo(() => {
    if (!topoData) return [];
    const projection = geoAlbersUsa().scale(1280).translate([W / 2, H / 2]);
    const pathGen = geoPath().projection(projection);
    const states = (feature(topoData, topoData.objects.states) as any).features;
    return states.map((f: any) => {
      const fips = parseInt(f.id, 10);
      const code = FIPS_TO_STATE[fips];
      const d = pathGen(f) ?? "";
      // Centroid for label
      const c = projection(
        [
          (f.bbox ? (f.bbox[0] + f.bbox[2]) / 2 : 0),
          (f.bbox ? (f.bbox[1] + f.bbox[3]) / 2 : 0),
        ] as [number, number]
      );
      const centroid = pathGen.centroid(f);
      return { code, d, cx: centroid[0], cy: centroid[1] };
    });
  }, [topoData]);

  const ttData = tooltip ? correctedStates[tooltip.code] : null;
  const ttName = tooltip ? (STATE_NAMES[tooltip.code] ?? tooltip.code) : "";

  const sortedStates = Object.entries(correctedStates)
    .filter(([c]) => c !== "DC")
    .sort((a, b) => b[1].correctedNet - a[1].correctedNet);

  return (
    <div>
      {/* ── Map header ── */}
      <div className="pap-hero">
        <div className="pap-stripe" />
        <div className="pap-hero-inner">
          <div>
            <div className="pap-eyebrow">State-by-State · TPSI Correction Applied</div>
            <h2 className="pap-hero-title" style={{ fontSize: "clamp(18px,2.5vw,32px)" }}>
              Trump Approval<br />
              <em style={{
                fontStyle: "normal",
                background: "linear-gradient(110deg,#c22f3b,#f87171)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>by State</em>
            </h2>
            <p className="pap-hero-desc">
              Averaged from Civiqs, Economist/YouGov & Morning Consult — corrected to TPSI national avg.
              Hover any state for detail.
            </p>
            <div className="pap-hero-badge-row">
              <span className="pap-badge pap-badge-purple">SOURCE: CIVIQS · ECONOMIST · MORNING CONSULT</span>
              <span className="pap-badge pap-badge-gold">CORRECTED TO TPSI NATIONAL AVG</span>
              <span className="pap-badge">RAW NAT'L NET: {rawNationalNet >= 0 ? "+" : ""}{rawNationalNet.toFixed(1)}</span>
              <span className="pap-badge" style={{
                borderColor: "rgba(251,191,36,0.3)",
                background: "rgba(251,191,36,0.06)",
                color: "rgba(251,191,36,0.85)",
              }}>
                CORRECTION: {correctionOffset >= 0 ? "+" : ""}{correctionOffset.toFixed(1)} PTS
              </span>
            </div>
          </div>
          <div className="pap-hero-read">
            {[
              { label: "TPSI APPROVE",    val: `${tpsiApprove.toFixed(1)}%`,    color: "rgba(77,127,212,1)"},
              { label: "TPSI DISAPPROVE", val: `${tpsiDisapprove.toFixed(1)}%`, color: "rgba(255,0,64,0.9)" },
              { label: "TPSI NET",        val: `${tpsiNet >= 0 ? "+" : ""}${tpsiNet.toFixed(1)}`, color: tpsiNet >= 0 ? "rgba(77,127,212,1) " : "rgba(255,0,64,0.9)" },
            ].map(({ label, val, color }) => (
              <div key={label} className="pap-hero-read-row">
                <span className="pap-hero-read-label">{label}</span>
                <span className="pap-hero-read-val" style={{ color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        background: "var(--panel)",
        border: "1px solid rgba(15,16,32,0.10)",
        borderTop: "none",
      }}>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(15,16,32,0.45)", whiteSpace: "nowrap" }}>NET APPROVE</span>
        <div style={{ display: "flex", gap: 2, flex: 1 }}>
          {[
            { label: "+30", net: 35 }, { label: "+20", net: 22 }, { label: "+10", net: 12 },
            { label: "+3", net: 3 }, { label: "0", net: 0 }, { label: "−3", net: -3 },
            { label: "−10", net: -12 }, { label: "−20", net: -22 }, { label: "−30", net: -35 },
          ].map(({ label, net }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 2 }}>
              <div style={{ width: "100%", height: 8, background: netToColor(net) }} />
              <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 6, color: "var(--muted2)", letterSpacing: "0.1em" }}>{label}</span>
            </div>
          ))}
        </div>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(15,16,32,0.45)", whiteSpace: "nowrap" }}>NET DISAPPROVE</span>
      </div>

      {/* ── D3 Albers USA Map ── */}
      <div style={{
        background: "var(--panel2)",
        border: "1px solid rgba(15,16,32,0.10)",
        borderTop: "none",
        padding: "10px",
        position: "relative",
      }}>
        {!topoData && (
          <div style={{
            height: 400, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "ui-monospace,monospace", fontSize: 10, letterSpacing: "0.2em",
            color: "rgba(15,16,32,0.45)", textTransform: "uppercase",
          }}>
            Loading map…
          </div>
        )}
        {topoData && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "auto", display: "block" }}
            onMouseLeave={() => setTooltip(null)}
          >
            <defs>
              <pattern id="sm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.018)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#sm-grid)" />

            {statePaths.map(({ code, d, cx, cy }: { code: string | undefined; d: string; cx: number; cy: number }) => {
              if (!code) return null;
              const data = correctedStates[code];
              const fill = data ? netToColor(data.correctedNet) : "#1e1b4b";
              const isHov = tooltip?.code === code;

              return (
                <g key={code ?? d.slice(0, 20)}>
                  <path
                    d={d}
                    fill={fill}
                    stroke="#070709"
                    strokeWidth={isHov ? 2.5 : 0.6}
                    opacity={isHov ? 1 : 0.88}
                    style={{ cursor: "pointer", transition: "all 80ms" }}
                    onMouseEnter={(e) => {
                      if (!code) return;
                      const svgEl = svgRef.current!;
                      const rect = svgEl.getBoundingClientRect();
                      const scaleX = W / rect.width;
                      const scaleY = H / rect.height;
                      setTooltip({
                        code,
                        x: (e.clientX - rect.left) * scaleX,
                        y: (e.clientY - rect.top) * scaleY,
                      });
                    }}
                    onMouseMove={(e) => {
                      if (!code) return;
                      const svgEl = svgRef.current!;
                      const rect = svgEl.getBoundingClientRect();
                      const scaleX = W / rect.width;
                      const scaleY = H / rect.height;
                      setTooltip({
                        code,
                        x: (e.clientX - rect.left) * scaleX,
                        y: (e.clientY - rect.top) * scaleY,
                      });
                    }}
                  />
                  {/* State label */}
                  {code && cx && cy && (
                    <text
                      x={cx} y={cy + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="9"
                      fontFamily="var(--font-body), 'Geist Mono', monospace"
                      fontWeight="700"
                      fill="rgba(15,16,32,0.65)"
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {code}
                    </text>
                  )}
                </g>
              );
            })}

            {/* SVG Tooltip */}
            {tooltip && ttData && (() => {
              const rawTx = tooltip.x + 16;
              const rawTy = tooltip.y - 10;
              const tooltipW = 170;
              const tooltipH = 152;
              const tx = Math.min(rawTx, W - tooltipW - 8);
              const ty = Math.max(rawTy, 4);
              const net = ttData.correctedNet;
              const netColor = net >= 0 ? "rgba(77,127,212,1) " : "rgba(255,0,64,0.9)";
              const netStr = `${net >= 0 ? "+" : ""}${net.toFixed(1)}`;
              return (
                <g transform={`translate(${tx},${ty})`} style={{ pointerEvents: "none" }}>
                  <rect x={0} y={0} width={tooltipW} height={tooltipH} rx={0}
                    fill="rgba(11,11,15,0.97)"
                    stroke="rgba(167,139,250,0.4)"
                    strokeWidth="1"
                  />
                  <rect x={0} y={0} width={tooltipW} height={3}
                    fill="rgba(167,139,250,0.5)"
                  />
                  <text x={10} y={22} fontSize={11} fontWeight="900" fontFamily="ui-monospace,monospace" fill="#fff">
                    {ttName?.toUpperCase()}
                  </text>
                  <text x={10} y={32} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.3)" letterSpacing={2}>{tooltip.code}</text>
                  <line x1={8} y1={38} x2={tooltipW - 8} y2={38} stroke="rgba(15,16,32,0.10)" strokeWidth={1} />
                  <text x={10} y={52} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(15,16,32,0.50)" letterSpacing={1.5}>APPROVE</text>
                  <text x={tooltipW - 10} y={52} fontSize={11} fontFamily="ui-monospace,monospace" fontWeight="700" fill="rgba(77,127,212,1) " textAnchor="end">{ttData.approve.toFixed(1)}%</text>
                  <text x={10} y={67} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(15,16,32,0.50)" letterSpacing={1.5}>DISAPPROVE</text>
                  <text x={tooltipW - 10} y={67} fontSize={11} fontFamily="ui-monospace,monospace" fontWeight="700" fill="rgba(255,0,64,0.9)" textAnchor="end">{ttData.disapprove.toFixed(1)}%</text>
                  <text x={10} y={82} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(15,16,32,0.50)" letterSpacing={1.5}>NET</text>
                  <text x={tooltipW - 10} y={82} fontSize={11} fontFamily="ui-monospace,monospace" fontWeight="700" fill={netColor} textAnchor="end">{netStr}</text>
                  <line x1={8} y1={90} x2={tooltipW - 8} y2={90} stroke="rgba(15,16,32,0.06)" strokeWidth={1} />
                  <text x={10} y={102} fontSize={6.5} fontFamily="ui-monospace,monospace" fontWeight="700" fill="rgba(167,139,250,0.6)" letterSpacing={1.5}>RAW SOURCES</text>
                  <text x={10} y={115} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(15,16,32,0.50)">CIVIQS</text>
                  <text x={tooltipW - 10} y={115} fontSize={9} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.5)" textAnchor="end">{ttData.civiqs >= 0 ? "+" : ""}{ttData.civiqs.toFixed(1)}</text>
                  <text x={10} y={128} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(15,16,32,0.50)">ECONOMIST</text>
                  <text x={tooltipW - 10} y={128} fontSize={9} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.5)" textAnchor="end">{ttData.economist >= 0 ? "+" : ""}{ttData.economist.toFixed(1)}</text>
                  <text x={10} y={141} fontSize={7} fontFamily="ui-monospace,monospace" fill="rgba(15,16,32,0.50)">MORNING CONSULT</text>
                  <text x={tooltipW - 10} y={141} fontSize={9} fontFamily="ui-monospace,monospace" fill="rgba(255,255,255,0.5)" textAnchor="end">{ttData.mc >= 0 ? "+" : ""}{ttData.mc.toFixed(1)}</text>
                </g>
              );
            })()}
          </svg>
        )}
      </div>

      {/* ── State Table ── */}
      <div className="pap-table-panel" style={{ borderTop: "none" }}>
        <div className="pap-stripe" />
        <div className="pap-table-head">
          <span className="pap-table-head-title">ALL STATES — CORRECTED ESTIMATES</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="pap-badge pap-badge-gold">DATA: CIVIQS · ECONOMIST · MORNING CONSULT</span>
            <span className="pap-table-head-note">SORTED BY NET APPROVAL ↓</span>
          </div>
        </div>
        <div className="pap-table-scroll">
          <table className="pap-table">
            <thead>
              <tr>
                <th>STATE</th>
                <th className="r">CIVIQS</th>
                <th className="r">ECONOMIST</th>
                <th className="r">MORN. CONSULT</th>
                <th className="r">RAW AVG</th>
                <th className="r">CORRECTED NET</th>
                <th className="r">APPROVE</th>
                <th className="r">DISAPPROVE</th>
              </tr>
            </thead>
            <tbody>
              {sortedStates.map(([code, d]) => {
                const net = d.correctedNet;
                const pos = net >= 0;
                return (
                  <tr key={code}>
                    <td style={{ color: "rgba(15,16,32,0.85)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, background: netToColor(net), border: "1px solid rgba(15,16,32,0.14)", flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{STATE_NAMES[code] ?? code}</span>
                        <span style={{ color: "var(--muted2)", fontSize: 9 }}>{code}</span>
                      </div>
                    </td>
                    <td className="r" style={{ color: d.civiqs >= 0 ? "rgba(77,127,212,1) " : "rgba(255,80,80,0.8)" }}>
                      {d.civiqs >= 0 ? "+" : ""}{d.civiqs.toFixed(1)}
                    </td>
                    <td className="r" style={{ color: d.economist >= 0 ? "rgba(77,127,212,1) " : "rgba(255,80,80,0.8)" }}>
                      {d.economist >= 0 ? "+" : ""}{d.economist.toFixed(1)}
                    </td>
                    <td className="r" style={{ color: d.mc >= 0 ? "rgba(77,127,212,1)" : "rgba(255,80,80,0.8)" }}>
                      {d.mc >= 0 ? "+" : ""}{d.mc.toFixed(1)}
                    </td>
                    <td className="r" style={{ color: d.rawNet >= 0 ? "rgba(77,127,212,1) " : "rgba(255,80,80,0.5)" }}>
                      {d.rawNet >= 0 ? "+" : ""}{d.rawNet.toFixed(1)}
                    </td>
                    <td className="r" style={{ color: pos ? "rgba(77,127,212,1) " : "rgba(255,80,80,0.9)", fontWeight: 700 }}>
                      {net >= 0 ? "+" : ""}{net.toFixed(1)}
                    </td>
                    <td className="r pap-approve-col">{d.approve.toFixed(1)}%</td>
                    <td className="r pap-disapprove-col">{d.disapprove.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology */}
      <div className="pap-table-panel" style={{ borderTop: "none" }}>
        <div style={{ padding: "12px 18px" }}>
          <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--purple-soft, #a78bfa)", marginBottom: 6 }}>
            METHODOLOGY
          </div>
          <p style={{ fontFamily: "ui-monospace,monospace", fontSize: 8.5, lineHeight: 1.75, letterSpacing: "0.08em", color: "rgba(240,240,245,0.22)", margin: 0 }}>
            State net approval figures are sourced from Civiqs, The Economist/YouGov, and Morning Consult
            tracking polls. The three-pollster simple average is corrected by an additive offset equal to the
            difference between the population-weighted implied national net from raw state data and the current
            TPSI-adjusted national average (correction: {correctionOffset >= 0 ? "+" : ""}{correctionOffset.toFixed(1)} points).
            Approve/Disapprove splits are derived symmetrically around 50. State boundaries rendered using
            D3 geoAlbersUsa projection from US Atlas TopoJSON. Data from Civiqs, Economist/YouGov,
            and Morning Consult; corrected to TPSI national weight.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TrumpApprovalPage() {
  const { daily, latestApprove, latestDisapprove, latestNet, seriesForChart } = useMemo(() => {
    const pollsAdj = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));
    const keys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b));
    const range = getDateRange(RAW_POLLS);
    const dailyBase = buildDailyWeightedSeries(pollsAdj as any, keys, range.start, range.end);
    const dailyWithNet = dailyBase.map((row) => {
      const a = Number((row as any).Approve ?? 0);
      const d = Number((row as any).Disapprove ?? 0);
      return { ...row, Net: round1(a - d) };
    }) as any[];
    const latest = dailyWithNet[dailyWithNet.length - 1] ?? null;
    return {
      daily: dailyWithNet,
      latestApprove:    latest ? Number(latest.Approve    ?? 0) : 0,
      latestDisapprove: latest ? Number(latest.Disapprove ?? 0) : 0,
      latestNet:        latest ? Number(latest.Net        ?? 0) : 0,
      seriesForChart: [
        { key: "Approve",    label: "Approve",    color: COLORS.Approve    },
        { key: "Disapprove", label: "Disapprove", color: COLORS.Disapprove },
      ],
    };
  }, []);

  const netText = latestNet === 0 ? "EVEN"
    : latestNet > 0 ? `+${round1(latestNet).toFixed(1)}`
    : `${round1(latestNet).toFixed(1)}`;
  const netColor = latestNet >= 0 ? "rgba(43,255,0,0.85)" : "rgba(255,0,64,0.85)";

  return (
    <>
      <style>{CSS}</style>
      <div className="pap-root">
        <div className="pap-stripe" />

        {/* ── HERO ── */}
        <div className="pap-hero">
          <div className="pap-stripe" />
          <div className="pap-hero-inner">
            <div>
              <div className="pap-eyebrow">Donald Trump · 47th President of the United States</div>
              <h1 className="pap-hero-title">
                Job <em className="pap-em-approve">Approval</em><br />
                Rating
              </h1>
              <p className="pap-hero-desc">
                Daily weighted average across all included polls — recency decay,
                √n sample adjustment, LV/RV/A screen, and PSI Gold Standard upweighting.
              </p>
              <div className="pap-hero-badge-row">
                <span className="pap-badge pap-badge-live"><span className="pap-live-dot" />LIVE TRACKING</span>
                <span className="pap-badge pap-badge-gold">★ GOLD STANDARD ×{GOLD_STANDARD_MULTIPLIER} WEIGHT</span>
                <span className="pap-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="pap-badge pap-badge-purple">RECENCY · √N · LV/RV/A</span>
              </div>
            </div>
            <div className="pap-hero-read">
              {[
                { label: "APPROVE",    val: `${round1(latestApprove).toFixed(1)}%`,    color: "rgba(77,127,212,1) "  },
                { label: "DISAPPROVE", val: `${round1(latestDisapprove).toFixed(1)}%`, color: "rgba(255,0,64,0.9)" },
                { label: "NET",        val: netText,                                    color: netColor               },
              ].map(({ label, val, color }) => (
                <div key={label} className="pap-hero-read-row">
                  <span className="pap-hero-read-label">{label}</span>
                  <span className="pap-hero-read-val" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="pap-section-label">CURRENT AVERAGES</div>
        <div className="pap-kpi-grid">
          {[
            { label: "Approve", value: `${round1(latestApprove).toFixed(1)}%`, sub: "Daily weighted avg", color: "#1d5fc4", bar: latestApprove },
            { label: "Disapprove",  value: `${round1(latestDisapprove).toFixed(1)}%`, sub: "Daily weighted avg",   color: "rgba(255,0,64,0.75)",  bar: latestDisapprove },
            { label: "Net Approval",value: netText,                                    sub: "Approve − Disapprove", color: netColor,               bar: undefined },
            { label: "Polls",       value: `${RAW_POLLS.length}`,                     sub: "Included in model",    color: undefined,              bar: Math.min(100, RAW_POLLS.length / 3) },
          ].map(({ label, value, sub, color, bar }) => (
            <div key={label} className="pap-kpi">
              {color && <div className="pap-kpi-accent" style={{ background: color }} />}
              <div className="pap-kpi-label">{label}</div>
              <div className="pap-kpi-val" style={color ? { color } : {}}>{value}</div>
              <div className="pap-kpi-sub">{sub}</div>
              {bar !== undefined && (
                <div className="pap-kpi-bar">
                  <div className="pap-kpi-bar-fill" style={{ width: `${bar}%`, background: color ?? "var(--purple)" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── CHART ── */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[30, 65]}
          title="Donald Trump national approval polling average"
          subtitle="Approve & Disapprove trendlines — hover to view daily values"
        />

        {/* ── STATE MAP ── */}
        <div className="pap-section-label">STATE-BY-STATE APPROVAL</div>
        <StateMap
          tpsiNet={latestNet}
          tpsiApprove={latestApprove}
          tpsiDisapprove={latestDisapprove}
        />

        {/* ── POLL TABLE ── */}
        <div className="pap-table-panel">
          <div className="pap-stripe" />
          <div className="pap-table-head">
            <span className="pap-table-head-title">ALL INCLUDED NATIONAL POLLS</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="pap-badge pap-badge-gold">★ GOLD STANDARD = ×{GOLD_STANDARD_MULTIPLIER} WEIGHT</span>
              <span className="pap-table-head-note">SORTED BY END DATE ↓</span>
            </div>
          </div>
          <div className="pap-table-scroll">
            <table className="pap-table">
              <thead>
                <tr>
                  <th>POLLSTER</th>
                  <th className="r">END DATE</th>
                  <th className="r">N</th>
                  <th className="r">TYPE</th>
                  <th className="r">WEIGHT</th>
                  <th className="r">APPROVE</th>
                  <th className="r">DISAPPROVE</th>
                  <th className="r">NET</th>
                </tr>
              </thead>
              <tbody>
                {[...RAW_POLLS]
                  .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                  .map((p) => {
                    const a = Number((p.results as any).Approve ?? 0);
                    const d = Number((p.results as any).Disapprove ?? 0);
                    const net = round1(a - d);
                    const netStr = net === 0 ? "0.0" : net > 0 ? `+${net.toFixed(1)}` : net.toFixed(1);
                    const gold = isGoldStandard(p.pollster);
                    const effN = effectiveSampleSize(p.pollster, p.sampleSize);
                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${p.sampleSize}`}>
                        <td style={{ color: "rgba(15,16,32,0.85)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{p.pollster}</span>
                            {gold && <span className="pap-gold-badge">GOLD</span>}
                          </div>
                        </td>
                        <td className="r">{p.endDate}</td>
                        <td className="r">
                          {p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}
                          {gold && p.sampleSize > 0 && (
                            <span style={{ marginLeft: "6px", fontSize: "9px", color: "var(--muted3)" }}>
                              (eff {effN.toLocaleString()})
                            </span>
                          )}
                        </td>
                        <td className="r">{p.sampleType}</td>
                        <td className="r" style={{ color: "var(--foreground)" }}>
                          {gold ? `×${GOLD_STANDARD_MULTIPLIER}.00` : "×1.00"}
                        </td>
                        <td className="r pap-approve-col">{a.toFixed(0)}%</td>
                        <td className="r pap-disapprove-col">{d.toFixed(0)}%</td>
                        <td className={`r ${net > 0 ? "pap-net-pos" : net < 0 ? "pap-net-neg" : ""}`}>{netStr}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CSS — unified design system matching generic ballot page ─────────────────
const CSS = `
  .pap-root {
    --bg: #f7f7f4;
    --bg2: #ffffff;
    --panel: #ffffff;
    --border: rgba(15, 16, 32, 0.08);
    --border2: rgba(15, 16, 32, 0.14);
    --muted: #6b7088;
    --muted2: #9aa0b4;
    --muted3: #b7bccc;
    --purple:      #6d3ee9;
    --purple2:     #8a63ef;
    --purple-soft: #a78bfa;
    --approve:     rgba(204, 0, 0, 0.85);     /* Republican Red */
    --disapprove:  rgba(0, 51, 160, 0.85);    /* Democratic Blue */
  }

  @keyframes pap-fade-up {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pap-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.35; transform:scale(0.75); }
  }
  @keyframes pap-bar-in {
    from { width:0; }
  }

  .pap-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: pap-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }

  /* TRI STRIPE */
  .pap-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      rgba(204,0,0,0.9)    0%,     rgba(204,0,0,0.9)    33.33%,
      var(--purple)        33.33%, var(--purple)        66.66%,
      rgba(77,127,212,1)   66.66%, rgba(77,127,212,1)   100%);
    );
  }

  /* LIVE DOT */
  .pap-live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--purple);
    box-shadow: 0 0 8px rgba(124,58,237,0.7);
    animation: pap-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* EYEBROW */
  .pap-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--purple-soft);
    margin-bottom: 12px;
  }
  .pap-eyebrow::before {
    content: '';
    display: block;
    width: 16px; height: 1px;
    background: var(--purple-soft);
    opacity: 0.5;
  }

  /* HERO */
  .pap-hero {
    border: 1px solid var(--border);
    background: var(--panel);
    position: relative;
    overflow: hidden;
  }
  .pap-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 45% 100% at 0% 60%,   rgba(255,0,64,0.05)    0%, transparent 65%),
      radial-gradient(ellipse 45% 100% at 100% 60%,  rgba(43,255,0,0.04)   0%, transparent 65%),
      radial-gradient(ellipse 30% 60%  at 50% 0%,    rgba(124,58,237,0.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .pap-hero::after {
    content: '';
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px
    );
    pointer-events: none;
  }
  .pap-hero-inner {
    position: relative;
    padding: 26px 28px 24px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: 20px;
  }
  @media (max-width: 640px) { .pap-hero-inner { grid-template-columns: 1fr; } }

  .pap-hero-title {
    font-family: var(--font-display), system-ui, -apple-system, BlinkMacOSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: clamp(22px,3.5vw,46px);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 0.92;
    color: #fff;
    margin: 0 0 14px;
  }
  .pap-em-approve {
    font-style: normal;
    background: linear-gradient(110deg,#c22f3b,#f87171);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .pap-hero-desc {
    font-family: ui-monospace,monospace;
    font-size: 9.5px;
    letter-spacing: 0.12em;
    line-height: 1.75;
    color: var(--muted2);
    text-transform: uppercase;
    max-width: 520px;
  }
  .pap-hero-badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 16px;
  }

  /* BADGES */
  .pap-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    background: var(--panel2);
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-badge-live   { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .pap-badge-purple { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .pap-badge-gold   { border-color:rgba(167,139,250,0.30); background:rgba(124,58,237,0.07); color:var(--purple-soft); }

  /* HERO RIGHT */
  .pap-hero-read {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 170px;
  }
  .pap-hero-read-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    background: var(--panel2);
    position: relative;
    overflow: hidden;
  }
  .pap-hero-read-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase;
    color: var(--muted3);
  }
  .pap-hero-read-val {
    font-family: ui-monospace,monospace;
    font-size: 20px; font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  /* SECTION LABEL */
  .pap-section-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--muted3);
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 12px;
  }
  .pap-section-label::before { content:''; width:20px; height:1px; background:var(--purple-soft); opacity:0.5; }
  .pap-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  /* KPI GRID */
  .pap-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 8px;
  }
  @media (max-width: 860px) { .pap-kpi-grid { grid-template-columns: repeat(2,1fr); } }
  @media (max-width: 480px) { .pap-kpi-grid { grid-template-columns: 1fr; } }

  .pap-kpi {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
    transition: border-color 150ms ease;
  }
  .pap-kpi:hover { border-color: var(--border2); }
  .pap-kpi-accent {
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
  }
  .pap-kpi-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--muted3); margin-bottom: 8px;
  }
  .pap-kpi-val {
    font-family: ui-monospace,monospace;
    font-size: clamp(22px,2.5vw,30px);
    font-weight: 900;
    color: #fff; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .pap-kpi-sub {
    font-family: ui-monospace,monospace;
    font-size: 8px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted3);
    margin-top: 6px;
  }
  .pap-kpi-bar { height: 2px; margin-top: 10px; background: rgba(15,16,32,0.08); }
  .pap-kpi-bar-fill {
    height: 100%;
    animation: pap-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both;
  }

  /* TABLE PANEL */
  .pap-table-panel {
    background: var(--panel);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .pap-table-head {
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  .pap-table-head-title {
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase;
    color: var(--purple-soft);
  }
  .pap-table-head-note {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; letter-spacing: 0.20em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-table-scroll {
    overflow-x: auto;
    max-height: 520px;
    overflow-y: auto;
  }
  table.pap-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 820px;
  }
  table.pap-table thead {
    position: sticky; top: 0;
    background: var(--bg2);
    z-index: 2;
  }
  table.pap-table th {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--muted3);
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  table.pap-table th.r { text-align: right; }
  table.pap-table td {
    font-family: ui-monospace,monospace;
    font-size: 10.5px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(15,16,32,0.05);
    color: var(--muted); vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }
  table.pap-table td.r { text-align: right; }
  table.pap-table tbody tr:hover { background: rgba(124,58,237,0.04); }
  table.pap-table tbody tr:last-child td { border-bottom: none; }

  .pap-gold-badge {
    display: inline-flex; align-items: center;
    padding: 1px 6px;
    border: 1px solid rgba(167,139,250,0.28);
    background: rgba(124,58,237,0.07);
    font-family: ui-monospace,monospace;
    font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--purple-soft);
  }

  .pap-approve-col    { color: rgba(204,0,0,0.85)   !important; font-weight: 700; }
  .pap-disapprove-col { color: rgba(77,127,212,.95)  !important; font-weight: 700; }
  .pap-net-pos        { color: rgba(204,0,0,0.9)    !important; font-weight: 700; }
  .pap-net-neg        { color: rgba(77,127,212,1)   !important; font-weight: 700; }

  @media (prefers-reduced-motion: reduce) {
    .pap-root { animation: none !important; }
    .pap-live-dot { animation: none !important; }
    .pap-kpi-bar-fill { animation: none !important; }
  }
`;
