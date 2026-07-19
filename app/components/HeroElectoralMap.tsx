"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Decorative hero US map. Muted brand red/blue fills for non-swing states;
 * the 7 battlegrounds fill purple. A dark hairline stroke separates each
 * state so shapes stay legible without any colored/glowing outline. Renders
 * bare — the surrounding card supplies the brand gradient backdrop.
 */

const FIPS_TO_ABBR: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY",
};

const WIN_2024: Record<string, "R" | "D"> = {
  AL: "R", AK: "R", AZ: "R", AR: "R", CA: "D", CO: "D", CT: "D", DE: "D",
  DC: "D", FL: "R", GA: "R", HI: "D", ID: "R", IL: "D", IN: "R", IA: "R",
  KS: "R", KY: "R", LA: "R", ME: "D", MD: "D", MA: "D", MI: "R", MN: "D",
  MS: "R", MO: "R", MT: "R", NE: "R", NV: "R", NH: "D", NJ: "D", NM: "D",
  NY: "D", NC: "R", ND: "R", OH: "R", OK: "R", OR: "D", PA: "R", RI: "D",
  SC: "R", SD: "R", TN: "R", TX: "R", UT: "R", VT: "D", VA: "D", WA: "D",
  WV: "R", WI: "R", WY: "R",
};

// Brand palette (must match the --red/--red2/--blue/--blue2/--purple/--purple2
// tokens in app/globals.css).
const PURPLE       = "#6d3ee9";
const PURPLE_SOFT  = "#8a63ef";
const RED_STROKE   = "#c22f3b";
const BLUE_STROKE  = "#1d5fc4";

const SWING = new Set(["AZ", "GA", "MI", "NV", "NC", "PA", "WI"]);

export default function HeroElectoralMap() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [{ geoAlbersUsa, geoPath }, { feature }, topo] = await Promise.all([
          import("d3-geo"),
          import("topojson-client"),
          fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(r => r.json()),
        ]);
        if (dead || !svgRef.current) return;
        const svg = svgRef.current;
        const W = 640, H = 400;
        const proj = geoAlbersUsa().scale(820).translate([W / 2, H / 2]);
        const path = geoPath().projection(proj);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const states = feature(topo as any, (topo as any).objects.states) as any;

        const baseG  = svg.querySelector("#hp-map-base")  as SVGGElement | null;
        const swingG = svg.querySelector("#hp-map-swing") as SVGGElement | null;
        if (!baseG || !swingG) return;
        while (baseG.firstChild)  baseG.removeChild(baseG.firstChild);
        while (swingG.firstChild) swingG.removeChild(swingG.firstChild);

        for (const f of states.features) {
          const fips = String(f.id).padStart(2, "0");
          const abbr = FIPS_TO_ABBR[fips];
          if (!abbr) continue;
          const isSwing = SWING.has(abbr);
          const winner = WIN_2024[abbr];
          const noStroke = abbr === "AK" || abbr === "HI";
          const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
          el.setAttribute("d", path(f) ?? "");
          if (isSwing) {
            el.setAttribute("fill", "url(#hp-grad-swing)");
            el.setAttribute("stroke", noStroke ? "none" : "#050505");
            el.setAttribute("stroke-width", noStroke ? "0" : "3");
            swingG.appendChild(el);
          } else {
            el.setAttribute("fill", winner === "D" ? BLUE_STROKE : RED_STROKE);
            el.setAttribute("stroke", noStroke ? "none" : "#050505");
            el.setAttribute("stroke-width", noStroke ? "0" : "3");
            baseG.appendChild(el);
          }
        }
        setReady(true);
      } catch {
        /* offline / blocked */
      }
    })();
    return () => { dead = true; };
  }, []);

  return (
    <div className="hp-hero-map">
      <svg
        ref={svgRef}
        viewBox="0 0 640 400"
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "auto",
          opacity: ready ? 1 : 0,
          transition: "opacity 420ms ease",
        }}
        aria-label="2024 Presidential battleground states"
      >
        <defs>
          <linearGradient id="hp-grad-swing" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor={PURPLE_SOFT} />
            <stop offset="100%" stopColor={PURPLE} />
          </linearGradient>
          <filter id="hp-map-shadow" x="-10%" y="-10%" width="120%" height="125%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
            <feOffset dx="0" dy="2" result="off" />
            <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#hp-map-shadow)">
          <g id="hp-map-base" />
          <g id="hp-map-swing" />
        </g>
      </svg>

      <style jsx>{`
        .hp-hero-map {
          position: relative;
          width: 100%;
          display: flex;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
