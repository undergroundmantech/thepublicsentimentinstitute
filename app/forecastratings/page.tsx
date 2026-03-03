"use client";

import { useEffect, useRef, useState } from "react";

// ─── types ────────────────────────────────────────────────────────────────────
type Rating = "Safe D" | "Likely D" | "Lean D" | "Tilt D" | "Tilt R" | "Lean R" | "Likely R" | "Safe R";
type MapType = "senate" | "governor";

interface RaceData {
  state: string;
  name: string;
  inc: string;
  pvi: string;
  rating: Rating;
  rPct: number;
  dPct: number;
  modelMargin: string;
  trumpApp: string;
  officeApp: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: RaceData | null;
}

// ─── Senate data ──────────────────────────────────────────────────────────────
const SENATE_DATA: RaceData[] = [
  { state:"NM", name:"Luján",       inc:"D", pvi:"D+3",    rating:"Safe D",   rPct:0.2,  dPct:99.8, modelMargin:"D +58.3", trumpApp:"-17.3", officeApp:"20" },
  { state:"RI", name:"Reed",        inc:"D", pvi:"D+30",   rating:"Safe D",   rPct:0.9,  dPct:99.1, modelMargin:"D +42.6", trumpApp:"-25.5", officeApp:"36" },
  { state:"MA", name:"Markey",      inc:"D", pvi:"D+33",   rating:"Safe D",   rPct:1.4,  dPct:98.6, modelMargin:"D +38.5", trumpApp:"-30",   officeApp:"22" },
  { state:"DE", name:"Coons",       inc:"D", pvi:"D+18.4", rating:"Safe D",   rPct:4.3,  dPct:95.7, modelMargin:"D +28.0", trumpApp:"-17.7", officeApp:"20" },
  { state:"OR", name:"Merkley",     inc:"D", pvi:"D+14.5", rating:"Safe D",   rPct:5.7,  dPct:94.3, modelMargin:"D +25.3", trumpApp:"-24",   officeApp:"21" },
  { state:"NJ", name:"Booker",      inc:"D", pvi:"D+13.2", rating:"Safe D",   rPct:7.7,  dPct:92.3, modelMargin:"D +22.3", trumpApp:"-16.2", officeApp:"19" },
  { state:"IL", name:"Durbin",      inc:"D", pvi:"D+13",   rating:"Safe D",   rPct:8.3,  dPct:91.7, modelMargin:"D +21.6", trumpApp:"-23",   officeApp:"ret." },
  { state:"NH", name:"Shaheen",     inc:"D", pvi:"D+12.5", rating:"Safe D",   rPct:11.7, dPct:88.3, modelMargin:"D +18.2", trumpApp:"-12.4", officeApp:"ret." },
  { state:"VA", name:"Warner",      inc:"D", pvi:"D+9",    rating:"Safe D",   rPct:12.1, dPct:87.9, modelMargin:"D +17.9", trumpApp:"-11.7", officeApp:"25" },
  { state:"CO", name:"Hickenlooper",inc:"D", pvi:"D+6.2",  rating:"Safe D",   rPct:14.9, dPct:85.1, modelMargin:"D +15.7", trumpApp:"-16.4", officeApp:"22" },
  { state:"NC", name:"Tillis",      inc:"R", pvi:"R+4.8",  rating:"Safe D",   rPct:19.3, dPct:80.7, modelMargin:"D +12.9", trumpApp:"-3.4",  officeApp:"ret." },
  { state:"MN", name:"Smith",       inc:"D", pvi:"D+2.1",  rating:"Likely D", rPct:25.5, dPct:74.5, modelMargin:"D +9.6",  trumpApp:"-12.8", officeApp:"ret." },
  { state:"GA", name:"Ossoff",      inc:"D", pvi:"D+1.5",  rating:"Likely D", rPct:29.1, dPct:70.9, modelMargin:"D +8.0",  trumpApp:"-7.8",  officeApp:"18" },
  { state:"MI", name:"Peters",      inc:"D", pvi:"D+1.4",  rating:"Lean D",   rPct:35.0, dPct:65.0, modelMargin:"D +5.6",  trumpApp:"-9.3",  officeApp:"ret." },
  { state:"ME", name:"Collins",     inc:"R", pvi:"R+11.7", rating:"Lean D",   rPct:38.5, dPct:61.5, modelMargin:"D +4.2",  trumpApp:"-13.3", officeApp:"-13" },
  { state:"OH", name:"Husted",      inc:"R", pvi:"R+4.5",  rating:"Tilt D",   rPct:47.2, dPct:52.8, modelMargin:"D +1.0",  trumpApp:"-0.4",  officeApp:"15" },
  { state:"AK", name:"Sullivan",    inc:"R", pvi:"R+15.8", rating:"Tilt D",   rPct:49.9, dPct:50.1, modelMargin:"D +0.0",  trumpApp:"-1.6",  officeApp:"-8" },
  { state:"TX", name:"Cornyn",      inc:"R", pvi:"R+12.7", rating:"Tilt R",   rPct:52.7, dPct:47.3, modelMargin:"R +1.0",  trumpApp:"-1.5",  officeApp:"6" },
  { state:"IA", name:"Ernst",       inc:"R", pvi:"R+9.6",  rating:"Tilt R",   rPct:55.1, dPct:44.9, modelMargin:"R +1.8",  trumpApp:"-1.6",  officeApp:"ret." },
  { state:"SC", name:"Graham",      inc:"R", pvi:"R+13.4", rating:"Lean R",   rPct:65.7, dPct:34.3, modelMargin:"R +5.9",  trumpApp:"3.9",   officeApp:"-2" },
  { state:"FL", name:"Moody",       inc:"R", pvi:"R+14.5", rating:"Likely R", rPct:71.5, dPct:28.5, modelMargin:"R +8.3",  trumpApp:"1.7",   officeApp:"17" },
  { state:"KY", name:"McConnell",   inc:"R", pvi:"R+22.6", rating:"Likely R", rPct:73.4, dPct:26.6, modelMargin:"R +9.1",  trumpApp:"10.7",  officeApp:"ret." },
  { state:"MT", name:"Daines",      inc:"R", pvi:"R+13.1", rating:"Likely R", rPct:78.7, dPct:21.3, modelMargin:"R +11.8", trumpApp:"11.5",  officeApp:"13" },
  { state:"NE", name:"Ricketts",    inc:"R", pvi:"R+41.4", rating:"Likely R", rPct:78.7, dPct:21.3, modelMargin:"R +11.8", trumpApp:"8",     officeApp:"1" },
  { state:"MS", name:"Hyde-Smith",  inc:"R", pvi:"R+13.1", rating:"Likely R", rPct:78.9, dPct:21.1, modelMargin:"R +11.9", trumpApp:"9.4",   officeApp:"9" },
  { state:"KS", name:"Marshall",    inc:"R", pvi:"R+14.5", rating:"Safe R",   rPct:79.4, dPct:20.6, modelMargin:"R +12.1", trumpApp:"4.9",   officeApp:"6" },
  { state:"AL", name:"Tuberville",  inc:"R", pvi:"R+23.5", rating:"Safe R",   rPct:84.3, dPct:15.7, modelMargin:"R +15.1", trumpApp:"15.6",  officeApp:"ret." },
  { state:"OK", name:"Mullin",      inc:"R", pvi:"R+17",   rating:"Safe R",   rPct:88.5, dPct:11.5, modelMargin:"R +18.4", trumpApp:"18.3",  officeApp:"18" },
  { state:"SD", name:"Rounds",      inc:"R", pvi:"R+34.6", rating:"Safe R",   rPct:93.8, dPct:6.2,  modelMargin:"R +24.4", trumpApp:"11.1",  officeApp:"23" },
  { state:"TN", name:"Hagerty",     inc:"R", pvi:"R+30.1", rating:"Safe R",   rPct:97.2, dPct:2.8,  modelMargin:"R +32.0", trumpApp:"16.3",  officeApp:"27" },
  { state:"ID", name:"Risch",       inc:"R", pvi:"R+32.5", rating:"Safe R",   rPct:98.2, dPct:1.8,  modelMargin:"R +36.0", trumpApp:"26.8",  officeApp:"22" },
  { state:"AR", name:"Cotton",      inc:"R", pvi:"R+36.2", rating:"Safe R",   rPct:98.4, dPct:1.6,  modelMargin:"R +36.8", trumpApp:"15.8",  officeApp:"15" },
  { state:"LA", name:"Cassidy",     inc:"R", pvi:"R+43.4", rating:"Safe R",   rPct:99.1, dPct:0.9,  modelMargin:"R +42.3", trumpApp:"9.6",   officeApp:"9" },
  { state:"WV", name:"Capito",      inc:"R", pvi:"R+46.4", rating:"Safe R",   rPct:99.6, dPct:0.4,  modelMargin:"R +49.3", trumpApp:"26.1",  officeApp:"19" },
  { state:"WY", name:"Lummis",      inc:"R", pvi:"R+48.1", rating:"Safe R",   rPct:99.6, dPct:0.4,  modelMargin:"R +50.2", trumpApp:"31.4",  officeApp:"ret." },
];

// ─── Governor data ────────────────────────────────────────────────────────────
const GOV_DATA: RaceData[] = [
  { state:"HI", name:"Green",     inc:"D", pvi:"D+29.3", rating:"Safe D",   rPct:1.6,  dPct:98.4, modelMargin:"D +41.5", trumpApp:"-38.1", officeApp:"27" },
  { state:"MA", name:"Healey",    inc:"D", pvi:"D+32.1", rating:"Safe D",   rPct:3.7,  dPct:96.3, modelMargin:"D +32.7", trumpApp:"-30",   officeApp:"33" },
  { state:"MD", name:"Moore",     inc:"D", pvi:"D+35.3", rating:"Safe D",   rPct:3.4,  dPct:96.6, modelMargin:"D +33.5", trumpApp:"-33.5", officeApp:"33" },
  { state:"RI", name:"McKee",     inc:"D", pvi:"D+22",   rating:"Safe D",   rPct:4.6,  dPct:95.4, modelMargin:"D +30.2", trumpApp:"-25.5", officeApp:"12" },
  { state:"CO", name:"Polis",     inc:"D", pvi:"D+22.2", rating:"Safe D",   rPct:6.0,  dPct:94.0, modelMargin:"D +27.5", trumpApp:"-16.4", officeApp:"ret." },
  { state:"IL", name:"Pritzker",  inc:"D", pvi:"D+15.4", rating:"Safe D",   rPct:8.6,  dPct:91.4, modelMargin:"D +23.6", trumpApp:"-23",   officeApp:"17" },
  { state:"CT", name:"Lamont",    inc:"D", pvi:"D+15.8", rating:"Safe D",   rPct:16.4, dPct:83.6, modelMargin:"D +16.3", trumpApp:"-22.6", officeApp:"33" },
  { state:"ME", name:"Mills",     inc:"D", pvi:"D+16.1", rating:"Safe D",   rPct:11.2, dPct:88.8, modelMargin:"D +20.7", trumpApp:"-13.3", officeApp:"ret." },
  { state:"MN", name:"Walz",      inc:"D", pvi:"D+10.6", rating:"Safe D",   rPct:12.3, dPct:87.7, modelMargin:"D +19.6", trumpApp:"-12.8", officeApp:"ret." },
  { state:"NY", name:"Hochul",    inc:"D", pvi:"D+9.3",  rating:"Safe D",   rPct:11.3, dPct:88.7, modelMargin:"D +20.6", trumpApp:"-20.1", officeApp:"19" },
  { state:"PA", name:"Shapiro",   inc:"D", pvi:"D+17.7", rating:"Safe D",   rPct:10.3, dPct:89.7, modelMargin:"D +21.6", trumpApp:"-6.7",  officeApp:"34" },
  { state:"VT", name:"Scott",     inc:"R", pvi:"R+44.1", rating:"Safe D",   rPct:1.7,  dPct:98.3, modelMargin:"R +40.4", trumpApp:"-37.6", officeApp:"55" },
  { state:"CA", name:"Newsom",    inc:"D", pvi:"D+21.3", rating:"Likely D", rPct:25.2, dPct:74.8, modelMargin:"D +10.9", trumpApp:"-25.2", officeApp:"ret." },
  { state:"OR", name:"Kotek",     inc:"D", pvi:"D+6.3",  rating:"Likely D", rPct:27.6, dPct:72.4, modelMargin:"D +9.6",  trumpApp:"-24",   officeApp:"6" },
  { state:"AZ", name:"Hobbs",     inc:"D", pvi:"D+3.6",  rating:"Likely D", rPct:34.6, dPct:65.4, modelMargin:"D +6.4",  trumpApp:"-1.2",  officeApp:"18" },
  { state:"KS", name:"Kelly",     inc:"D", pvi:"D+5.1",  rating:"Likely D", rPct:35.1, dPct:64.9, modelMargin:"D +6.1",  trumpApp:"4.9",   officeApp:"ret." },
  { state:"MI", name:"Whitmer",   inc:"D", pvi:"D+13.4", rating:"Likely D", rPct:33.7, dPct:66.3, modelMargin:"D +6.8",  trumpApp:"-9.3",  officeApp:"ret." },
  { state:"NM", name:"Grisham",   inc:"D", pvi:"D+4",    rating:"Likely D", rPct:28.1, dPct:71.9, modelMargin:"D +9.4",  trumpApp:"-17.3", officeApp:"ret." },
  { state:"WI", name:"Evers",     inc:"D", pvi:"D+6.3",  rating:"Likely D", rPct:29.8, dPct:70.2, modelMargin:"D +8.6",  trumpApp:"-7.7",  officeApp:"ret." },
  { state:"NV", name:"Lombardo",  inc:"R", pvi:"R+1.4",  rating:"Tilt D",   rPct:49.2, dPct:50.8, modelMargin:"D +0.3",  trumpApp:"-6.5",  officeApp:"18" },
  { state:"GA", name:"Kemp",      inc:"R", pvi:"R+4.6",  rating:"Tilt R",   rPct:52.6, dPct:47.4, modelMargin:"R +1.0",  trumpApp:"-7.8",  officeApp:"ret." },
  { state:"IA", name:"Reynolds",  inc:"R", pvi:"R+15.6", rating:"Tilt R",   rPct:53.8, dPct:46.2, modelMargin:"R +1.5",  trumpApp:"-1.6",  officeApp:"ret." },
  { state:"AK", name:"Dunleavy",  inc:"R", pvi:"R+23",   rating:"Lean R",   rPct:61.4, dPct:38.6, modelMargin:"R +4.6",  trumpApp:"-1.6",  officeApp:"ret." },
  { state:"TX", name:"Abbott",    inc:"R", pvi:"R+8",    rating:"Lean R",   rPct:61.1, dPct:38.9, modelMargin:"R +4.5",  trumpApp:"-1.5",  officeApp:"12" },
  { state:"FL", name:"DeSantis",  inc:"R", pvi:"R+16.8", rating:"Lean R",   rPct:64.2, dPct:35.8, modelMargin:"R +5.9",  trumpApp:"1.7",   officeApp:"ret." },
  { state:"OH", name:"DeWine",    inc:"R", pvi:"R+22.1", rating:"Lean R",   rPct:63.6, dPct:36.4, modelMargin:"R +5.6",  trumpApp:"-0.4",  officeApp:"ret." },
  { state:"NH", name:"Ayotte",    inc:"R", pvi:"R+12.6", rating:"Likely R", rPct:70.5, dPct:29.5, modelMargin:"R +8.7",  trumpApp:"-12.4", officeApp:"23" },
  { state:"SC", name:"McMaster",  inc:"R", pvi:"R+14.5", rating:"Safe R",   rPct:79.1, dPct:20.9, modelMargin:"R +13.3", trumpApp:"3.9",   officeApp:"ret." },
  { state:"OK", name:"Stitt",     inc:"R", pvi:"R+10.8", rating:"Safe R",   rPct:77.5, dPct:22.5, modelMargin:"R +12.4", trumpApp:"18.3",  officeApp:"ret." },
  { state:"NE", name:"Pillen",    inc:"R", pvi:"R+20.5", rating:"Safe R",   rPct:88.8, dPct:11.2, modelMargin:"R +20.7", trumpApp:"8",     officeApp:"6" },
  { state:"TN", name:"Lee",       inc:"R", pvi:"R+29.1", rating:"Safe R",   rPct:90.1, dPct:9.9,  modelMargin:"R +22.0", trumpApp:"16.3",  officeApp:"ret." },
  { state:"AL", name:"Ivey",      inc:"R", pvi:"R+34",   rating:"Safe R",   rPct:89.1, dPct:10.9, modelMargin:"R +21.0", trumpApp:"15.6",  officeApp:"ret." },
  { state:"AR", name:"Sanders",   inc:"R", pvi:"R+24.9", rating:"Safe R",   rPct:94.2, dPct:5.8,  modelMargin:"R +27.8", trumpApp:"15.8",  officeApp:"19" },
  { state:"SD", name:"Rhoden",    inc:"R", pvi:"R+23.9", rating:"Safe R",   rPct:93.6, dPct:6.4,  modelMargin:"R +26.9", trumpApp:"11.1",  officeApp:"28" },
  { state:"ID", name:"Little",    inc:"R", pvi:"R+37.3", rating:"Safe R",   rPct:98.7, dPct:1.3,  modelMargin:"R +43.5", trumpApp:"26.8",  officeApp:"30" },
  { state:"WY", name:"Gordon",    inc:"R", pvi:"R+55.4", rating:"Safe R",   rPct:99.7, dPct:0.3,  modelMargin:"R +59.5", trumpApp:"31.4",  officeApp:"ret." },
];

// ─── FIPS map ─────────────────────────────────────────────────────────────────
const FIPS: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
  "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
  "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
  "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
  "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
  "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY",
};

const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"D.C.",FL:"Florida",
  GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",
  IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",
  MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NV:"Nevada",NH:"New Hampshire",
  NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",
  ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",
  RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",
  TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",
  WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

// ─── color helpers ────────────────────────────────────────────────────────────
const RATING_FILLS: Record<Rating, string> = {
  "Safe D":   "#1a3a8f",
  "Likely D": "#1e50b3",
  "Lean D":   "#2d6fd4",
  "Tilt D":   "#4d8ee8",
  "Tilt R":   "#e05555",
  "Lean R":   "#cc3333",
  "Likely R": "#b02020",
  "Safe R":   "#8b1a1a",
};

const RATING_TEXT: Record<Rating, string> = {
  "Safe D":   "rgba(147,197,253,.95)",
  "Likely D": "rgba(147,197,253,.85)",
  "Lean D":   "rgba(147,197,253,.8)",
  "Tilt D":   "rgba(147,197,253,.75)",
  "Tilt R":   "rgba(252,165,165,.75)",
  "Lean R":   "rgba(252,165,165,.8)",
  "Likely R": "rgba(252,165,165,.85)",
  "Safe R":   "rgba(252,165,165,.95)",
};

function fillFor(rating?: Rating) {
  if (!rating) return "rgba(255,255,255,0.055)";
  return RATING_FILLS[rating];
}

function isD(r: Rating) { return r.endsWith("D"); }

// ─── Race lookup maps ─────────────────────────────────────────────────────────
const senateByState = Object.fromEntries(SENATE_DATA.map(d => [d.state, d]));
const govByState    = Object.fromEntries(GOV_DATA.map(d => [d.state, d]));

// ─── Summary counters ─────────────────────────────────────────────────────────
function summarize(data: RaceData[]) {
  const counts: Record<Rating, number> = {
    "Safe D":0,"Likely D":0,"Lean D":0,"Tilt D":0,
    "Tilt R":0,"Lean R":0,"Likely R":0,"Safe R":0,
  };
  let dTotal = 0, rTotal = 0;
  for (const r of data) {
    counts[r.rating]++;
    if (isD(r.rating)) dTotal++; else rTotal++;
  }
  return { counts, dTotal, rTotal };
}

// ─── Map component ────────────────────────────────────────────────────────────
function RaceMap({ mapType, dataMap }: { mapType: MapType; dataMap: Record<string, RaceData> }) {
  const svgRef  = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible:false, x:0, y:0, data:null });

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [{ geoAlbersUsa, geoPath }, { feature, mesh }, topo] = await Promise.all([
          import("d3-geo"),
          import("topojson-client"),
          fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(r => r.json()),
        ]);
        if (dead || !svgRef.current) return;
        const svg  = svgRef.current;
        const proj = geoAlbersUsa().scale(1280).translate([480, 300]);
        const path = geoPath().projection(proj);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const states = feature(topo as any, (topo as any).objects.states) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const border = mesh(topo as any, (topo as any).objects.states, (a: any, b: any) => a !== b);
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        for (const f of states.features) {
          const fips  = String(f.id).padStart(2, "0");
          const abbr  = FIPS[fips];
          if (!abbr) continue;
          const race  = dataMap[abbr];
          const fill  = fillFor(race?.rating);

          const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
          el.setAttribute("d", path(f) ?? "");
          el.style.cssText = `fill:${fill};stroke:rgba(0,0,0,0.5);stroke-width:0.6;cursor:${race?"pointer":"default"};transition:filter 140ms ease;`;

          if (race) {
            el.addEventListener("mouseover",  () => { el.style.filter = "brightness(1.3) saturate(1.15)"; });
            el.addEventListener("mouseout",   () => { el.style.filter = ""; });
            el.addEventListener("mousemove",  (ev: MouseEvent) => {
              setTooltip({ visible:true, x:ev.clientX, y:ev.clientY, data:race });
            });
            el.addEventListener("mouseleave", () => setTooltip(t => ({ ...t, visible:false })));
          }
          svg.appendChild(el);
        }

        // border mesh
        const be = document.createElementNS("http://www.w3.org/2000/svg", "path");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        be.setAttribute("d", path(border as any) ?? "");
        be.style.cssText = "fill:none;stroke:rgba(255,255,255,0.07);stroke-width:0.5;pointer-events:none;";
        svg.appendChild(be);
      } catch (e) { console.error(e); }
    })();
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapType]);

  // re-color on data change (no-op here since data is static, but good practice)
  useEffect(() => {
    svgRef.current?.querySelectorAll<SVGPathElement>("path[style]").forEach(el => {
      // paths don't have data-key so we skip re-color; map remounts with key anyway
    });
  }, [dataMap]);

  const tt = tooltip.data;
  const ttColor = tt ? RATING_TEXT[tt.rating] : "#fff";

  return (
    <div style={{ position:"relative" }}>
      <svg ref={svgRef} viewBox="0 0 960 600" style={{ width:"100%", height:"auto", display:"block" }} />

      {tooltip.visible && tt && (
        <div className="race-tooltip" style={{ left: tooltip.x + 16, top: tooltip.y + 16 }}>
          <div className="rtt-stripe" />
          <div style={{ padding:"10px 13px" }}>
            <div className="rtt-abbr">{tt.state} · {STATE_NAMES[tt.state] ?? tt.state}</div>
            <div className="rtt-name">{tt.name}</div>
            <div className="rtt-inc">{tt.inc === "D" ? "Dem. Incumbent" : tt.inc === "R" ? "Rep. Incumbent" : "Open Seat"} · PVI {tt.pvi}</div>
            <div className="rtt-div" />
            <div className="rtt-rating" style={{ color: ttColor }}>
              {tt.rating}
            </div>
            <div className="rtt-margin">{tt.modelMargin}</div>
            <div className="rtt-div" />
            <div className="rtt-bars">
              <div className="rtt-bar-row">
                <span className="rtt-party dem">D</span>
                <div className="rtt-bar-track">
                  <div className="rtt-bar-fill dem-fill" style={{ width:`${tt.dPct}%` }} />
                </div>
                <span className="rtt-pct">{tt.dPct.toFixed(1)}%</span>
              </div>
              <div className="rtt-bar-row">
                <span className="rtt-party rep">R</span>
                <div className="rtt-bar-track">
                  <div className="rtt-bar-fill rep-fill" style={{ width:`${tt.rPct}%` }} />
                </div>
                <span className="rtt-pct">{tt.rPct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="rtt-meta">
              <span>Trump app. {tt.trumpApp}</span>
              <span>Off. app. {tt.officeApp}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rating legend row ────────────────────────────────────────────────────────
const LEGEND_ITEMS: { rating: Rating; label: string }[] = [
  { rating:"Safe D",   label:"Safe D"   },
  { rating:"Likely D", label:"Likely D" },
  { rating:"Lean D",   label:"Lean D"   },
  { rating:"Tilt D",   label:"Tilt D"   },
  { rating:"Tilt R",   label:"Tilt R"   },
  { rating:"Lean R",   label:"Lean R"   },
  { rating:"Likely R", label:"Likely R" },
  { rating:"Safe R",   label:"Safe R"   },
];

// ─── Seat count bar ───────────────────────────────────────────────────────────
function SeatBar({ data, label }: { data: RaceData[]; label: string }) {
  const { counts, dTotal, rTotal } = summarize(data);
  const total = data.length;
  return (
    <div className="seat-bar-wrap">
      <div className="seat-bar-labels">
        <span className="sbl-d">D · {dTotal}</span>
        <span className="sbl-ttl">{label} · {total} RACES</span>
        <span className="sbl-r">{rTotal} · R</span>
      </div>
      <div className="seat-bar-track">
        {(["Safe D","Likely D","Lean D","Tilt D","Tilt R","Lean R","Likely R","Safe R"] as Rating[]).map(r => (
          counts[r] > 0 && (
            <div key={r} className="seat-bar-seg"
              style={{ width:`${(counts[r]/total)*100}%`, background:RATING_FILLS[r] }}
              title={`${r}: ${counts[r]}`}
            />
          )
        ))}
      </div>
      <div className="seat-bar-chips">
        {(["Safe D","Likely D","Lean D","Tilt D","Tilt R","Lean R","Likely R","Safe R"] as Rating[]).map(r =>
          counts[r] > 0 ? (
            <div key={r} className="sbc-chip" style={{ borderColor: RATING_FILLS[r]+"66", background: RATING_FILLS[r]+"22" }}>
              <span style={{ color: RATING_TEXT[r] }}>{r}</span>
              <span className="sbc-n" style={{ color: RATING_TEXT[r] }}>{counts[r]}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RaceRatingsPage() {
  return (
    <>
      <style>{`
        @keyframes rr-fade-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rr-pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.8)} }

        .rr-live-dot {
          display:inline-block; width:6px; height:6px; border-radius:50%;
          background:var(--rep); box-shadow:0 0 8px rgba(230,57,70,.7);
          animation:rr-pulse 1.8s ease-in-out infinite; flex-shrink:0;
        }

        /* ── page header ── */
        .rr-page-hdr {
          border-bottom:1px solid var(--border);
          padding-bottom:24px; margin-bottom:0;
          display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:16px;
        }
        .rr-eyebrow {
          display:flex; align-items:center; gap:9px; margin-bottom:10px;
          font-size:8.5px; font-weight:700; letter-spacing:.30em; text-transform:uppercase; color:var(--purple-soft);
        }
        .rr-eyebrow::before { content:''; display:block; width:20px; height:1px; background:var(--purple-soft); opacity:.5; }
        .rr-title { font-size:clamp(28px,3.5vw,52px); font-weight:900; text-transform:uppercase; letter-spacing:-.01em; line-height:.92; color:#fff; font-family:var(--font-display),ui-sans-serif,sans-serif; }
        .rr-title em { font-style:normal; background:linear-gradient(100deg,var(--red2),var(--purple-soft) 50%,var(--blue2)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .rr-sub { margin-top:10px; font-size:9.5px; letter-spacing:.10em; color:var(--muted2); line-height:1.7; max-width:560px; }
        .rr-badge-row { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
        .rr-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; border:1px solid var(--border); background:rgba(0,0,0,.3); font-size:7.5px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--muted2); }
        .rr-badge-live { border-color:rgba(230,57,70,.25); background:rgba(230,57,70,.07); color:rgba(230,57,70,.9); }
        .rr-badge-purple { border-color:rgba(124,58,237,.30); background:rgba(124,58,237,.08); color:var(--purple-soft); }

        /* ── section ── */
        .rr-section { border:1px solid var(--border); margin-bottom:20px; animation:rr-fade-up .5s cubic-bezier(.22,1,.36,1) both; }
        .rr-section:nth-child(2) { animation-delay:.08s; }

        .rr-sec-hdr {
          display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;
          padding:12px 16px; border-bottom:1px solid var(--border); background:var(--background2);
        }
        .rr-sec-tag { font-size:8px; font-weight:700; letter-spacing:.28em; text-transform:uppercase; color:var(--purple-soft); }
        .rr-sec-sub { font-size:7.5px; letter-spacing:.12em; color:var(--muted3); margin-top:2px; }

        /* ── legend ── */
        .rr-legend {
          display:flex; align-items:center; gap:4px; flex-wrap:wrap;
          padding:9px 14px; border-bottom:1px solid var(--border); background:var(--background2);
        }
        .rr-ll { font-size:7px; font-weight:700; letter-spacing:.24em; text-transform:uppercase; color:var(--muted3); margin-right:4px; }
        .rr-chip { padding:3px 7px; border:1px solid; font-size:6.5px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }

        /* ── seat bar ── */
        .seat-bar-wrap { padding:10px 14px; border-bottom:1px solid var(--border); background:rgba(255,255,255,.015); }
        .seat-bar-labels { display:flex; justify-content:space-between; margin-bottom:5px; font-size:8px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }
        .sbl-d { color:rgba(147,197,253,.8); }
        .sbl-ttl { color:var(--muted3); }
        .sbl-r { color:rgba(252,165,165,.8); }
        .seat-bar-track { display:flex; height:8px; overflow:hidden; gap:1px; }
        .seat-bar-seg { height:100%; transition:width .6s cubic-bezier(.22,1,.36,1); }
        .seat-bar-chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:7px; }
        .sbc-chip { display:flex; align-items:center; gap:5px; padding:3px 7px; border:1px solid; font-size:7px; font-weight:700; letter-spacing:.10em; text-transform:uppercase; }
        .sbc-n { opacity:.8; }

        /* ── map wrap ── */
        .rr-map-wrap { padding:10px 12px; }

        /* ── tooltip ── */
        .race-tooltip {
          position:fixed; pointer-events:none; z-index:9999; width:260px;
          background:rgba(6,6,10,.96); border:1px solid rgba(124,58,237,.4);
          backdrop-filter:blur(18px); box-shadow:0 24px 64px rgba(0,0,0,.85);
        }
        .rtt-stripe { height:2px; background:linear-gradient(90deg,var(--red) 0%,var(--purple) 50%,var(--blue) 100%); }
        .rtt-abbr   { font-size:7px; font-weight:700; letter-spacing:.28em; text-transform:uppercase; color:var(--muted3); }
        .rtt-name   { font-size:14px; font-weight:900; text-transform:uppercase; letter-spacing:.06em; color:#fff; margin-top:3px; }
        .rtt-inc    { font-size:8px; letter-spacing:.10em; color:var(--muted3); margin-top:3px; }
        .rtt-div    { height:1px; background:var(--border); margin:7px 0; }
        .rtt-rating { font-size:9px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; }
        .rtt-margin { font-size:11px; font-weight:900; letter-spacing:.06em; color:rgba(255,255,255,.55); margin-top:3px; }
        .rtt-bars   { display:flex; flex-direction:column; gap:4px; }
        .rtt-bar-row { display:flex; align-items:center; gap:6px; }
        .rtt-party  { font-size:8px; font-weight:900; width:12px; text-align:center; }
        .rtt-party.dem { color:rgba(147,197,253,.8); }
        .rtt-party.rep { color:rgba(252,165,165,.8); }
        .rtt-bar-track { flex:1; height:4px; background:rgba(255,255,255,.07); overflow:hidden; }
        .rtt-bar-fill  { height:100%; transition:width .5s ease; }
        .dem-fill { background:var(--dem); }
        .rep-fill { background:var(--rep); }
        .rtt-pct   { font-size:8px; font-weight:700; letter-spacing:.08em; color:rgba(255,255,255,.45); width:36px; text-align:right; }
        .rtt-meta  { display:flex; justify-content:space-between; margin-top:7px; font-size:7px; letter-spacing:.10em; text-transform:uppercase; color:var(--muted3); font-weight:700; }

        /* ── no-race states note ── */
        .rr-note { padding:7px 14px; border-top:1px solid var(--border); background:rgba(255,255,255,.01); font-size:7px; letter-spacing:.10em; color:var(--muted3); font-weight:700; text-transform:uppercase; }
        .rr-note span { color:var(--muted2); }
      `}</style>

      {/* ── PAGE HEADER ── */}
      <div className="rr-page-hdr">
        <div>
          <div className="rr-eyebrow">
            <span className="rr-live-dot" />
            ELECTION TOOLS · RACE RATINGS
          </div>
          <h1 className="rr-title">2026 Race<br /><em>Ratings</em></h1>
          <p className="rr-sub">
            Model-based ratings for U.S. Senate and Governor races.
            Hover any state for full details — margin projections, approval ratings, and win probability.
          </p>
          <div className="rr-badge-row" style={{ marginTop:12 }}>
            <span className="rr-badge rr-badge-live"><span className="rr-live-dot" />LIVE MODEL</span>
            <span className="rr-badge rr-badge-purple">SENATE · {SENATE_DATA.length} RACES</span>
            <span className="rr-badge rr-badge-purple">GOVERNORS · {GOV_DATA.length} RACES</span>
            <span className="rr-badge">2026 MIDTERMS</span>
          </div>
        </div>
      </div>

      {/* ── SENATE MAP ── */}
      <div className="rr-section" style={{ marginTop:24 }}>
        <div className="res-tri-stripe" />
        <div className="rr-sec-hdr">
          <div>
            <div className="rr-sec-tag">U.S. SENATE · 2026</div>
            <div className="rr-sec-sub">{SENATE_DATA.length} seats rated · hover states for details</div>
          </div>
          <div className="rr-badge-row">
            <span className="rr-badge" style={{ borderColor:"rgba(147,197,253,.2)", color:"rgba(147,197,253,.7)" }}>
              D FAVORED {SENATE_DATA.filter(d=>isD(d.rating)).length}
            </span>
            <span className="rr-badge" style={{ borderColor:"rgba(252,165,165,.2)", color:"rgba(252,165,165,.7)" }}>
              {SENATE_DATA.filter(d=>!isD(d.rating)).length} R FAVORED
            </span>
          </div>
        </div>

        <div className="rr-legend">
          <span className="rr-ll">Legend</span>
          {LEGEND_ITEMS.map(({ rating, label }) => (
            <span key={rating} className="rr-chip"
              style={{ background:RATING_FILLS[rating], borderColor:RATING_FILLS[rating], color:RATING_TEXT[rating] }}>
              {label}
            </span>
          ))}
        </div>

        <SeatBar data={SENATE_DATA} label="SENATE" />

        <div className="rr-map-wrap">
          <RaceMap key="senate" mapType="senate" dataMap={senateByState} />
        </div>
        <div className="rr-note">
          Gray states have no Senate race in 2026. <span>Ratings based on model margin, PVI, incumbent approval, and Trump approval.</span>
        </div>
      </div>

      {/* ── GOVERNOR MAP ── */}
      <div className="rr-section">
        <div className="res-tri-stripe" />
        <div className="rr-sec-hdr">
          <div>
            <div className="rr-sec-tag">GOVERNORS · 2026</div>
            <div className="rr-sec-sub">{GOV_DATA.length} seats rated · hover states for details</div>
          </div>
          <div className="rr-badge-row">
            <span className="rr-badge" style={{ borderColor:"rgba(147,197,253,.2)", color:"rgba(147,197,253,.7)" }}>
              D FAVORED {GOV_DATA.filter(d=>isD(d.rating)).length}
            </span>
            <span className="rr-badge" style={{ borderColor:"rgba(252,165,165,.2)", color:"rgba(252,165,165,.7)" }}>
              {GOV_DATA.filter(d=>!isD(d.rating)).length} R FAVORED
            </span>
          </div>
        </div>

        <div className="rr-legend">
          <span className="rr-ll">Legend</span>
          {LEGEND_ITEMS.map(({ rating, label }) => (
            <span key={rating} className="rr-chip"
              style={{ background:RATING_FILLS[rating], borderColor:RATING_FILLS[rating], color:RATING_TEXT[rating] }}>
              {label}
            </span>
          ))}
        </div>

        <SeatBar data={GOV_DATA} label="GOVERNORS" />

        <div className="rr-map-wrap">
          <RaceMap key="governor" mapType="governor" dataMap={govByState} />
        </div>
        <div className="rr-note">
          Gray states have no Governor race in 2026. <span>Ratings based on model margin, PVI, incumbent approval, and Trump approval.</span>
        </div>
      </div>
    </>
  );
}