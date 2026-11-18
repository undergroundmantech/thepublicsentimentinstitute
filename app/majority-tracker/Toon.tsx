// Cartoon portraits for the Majority Tracker, drawn in SVG from the traits in looks.ts. ToonG draws into a 100 by 100
// box so it can sit inside the chamber's own SVG; Toon wraps it in an <svg> of its own for cards and the face off.
// No hooks, so it renders on the server and in client components alike.
import { lookAny as lookOf, type Hair, type Look, type Shade } from "./looks";

export type Side = "S" | "V" | "U" | "D" | "R";
const INK = "#1b1328";
const SKIN: Record<Side, [string, string]> = { S: ["#efe6ff", "#d9c9ff"], V: ["#dff7ee", "#bfe9d8"], U: ["#f1ede8", "#ddd6ce"], D: ["#e6eeff", "#c9d8ff"], R: ["#ffe8ec", "#ffcdd6"] };
const BG: Record<Side, string> = { S: "#9a86ff", V: "#34c79a", U: "#8f8a99", D: "#3d7bff", R: "#ff3b5c" };
const TIE: Record<Side, string> = { S: "#7a62ff", V: "#13a37a", U: "#77717f", D: "#1f56d6", R: "#c8173d" };
const SHADE: Record<Shade, string> = {
  white: "#f6f3ef", silver: "#d8d5dc", gray: "#a9a5b0", salt: "#8e8996", dark: "#3b2f36", brown: "#6e4b35",
  auburn: "#8a4b33", blond: "#e8c57a", black: "#1c1620", red: "#b4532c",
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "");

function hairBack(h: Hair, c: string) {
  if (h === "bob") return <path d="M25 64 C20 40 27 15 50 14 C73 15 80 40 75 64 C69 66 66 60 66 52 L34 52 C34 60 31 66 25 64 Z" fill={c} stroke={INK} strokeWidth="2.2" />;
  if (h === "long") return <path d="M23 80 C16 46 25 13 50 13 C75 13 84 46 77 80 C70 82 66 72 66 60 L34 60 C34 72 30 82 23 80 Z" fill={c} stroke={INK} strokeWidth="2.2" />;
  if (h === "curly") return <g fill={c} stroke={INK} strokeWidth="2">{[[27, 44], [26, 56], [31, 66], [73, 44], [74, 56], [69, 66]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="8" />)}</g>;
  return null;
}

function hairFront(h: Hair, c: string) {
  const p = { fill: c, stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const };
  switch (h) {
    case "short": return <path d="M30 41 C28 24 38 16 50 16 C62 16 72 24 70 41 C66 31 58 27 50 27 C42 27 34 31 30 41 Z" {...p} />;
    case "side": return <path d="M30 40 C29 22 41 15 52 16 C64 17 72 25 70 40 C65 29 55 25 44 29 C38 31 33 35 30 40 Z" {...p} />;
    case "swoop": return <path d="M29 41 C26 19 43 10 57 14 C69 17 74 28 71 41 C67 31 61 25 53 25 C46 26 40 29 37 34 C34 33 31 36 29 41 Z" {...p} />;
    case "buzz": return <path d="M31 37 C32 22 42 18 50 18 C58 18 68 22 69 37 C63 29 57 26 50 26 C43 26 37 29 31 37 Z" {...p} strokeWidth={1.6} opacity={0.9} />;
    case "balding": return <g {...p}><path d="M29.5 51 C26 41 28.5 32 35 29 C34.5 35 35.5 41 37.5 46 Z" /><path d="M70.5 51 C74 41 71.5 32 65 29 C65.5 35 64.5 41 62.5 46 Z" /></g>;
    case "wild": return <g {...p}><path d="M30 46 C24 40 22 30 30 26 C30 34 33 38 36 40 Z" /><path d="M70 46 C76 40 78 30 70 26 C70 34 67 38 64 40 Z" /><circle cx="24" cy="36" r="6" /><circle cx="76" cy="36" r="6" /><circle cx="22" cy="46" r="5" /><circle cx="78" cy="46" r="5" /></g>;
    case "bob": return <path d="M30 40 C30 22 41 16 50 16 C61 16 71 23 70 40 C62 31 51 27 42 31 C37 33 33 36 30 40 Z" {...p} />;
    case "long": return <path d="M30 41 C30 21 41 15 50 15 C61 15 71 22 70 41 C64 29 55 24 46 28 C39 31 34 35 30 41 Z" {...p} />;
    case "pixie": return <path d="M29 42 C27 23 39 15 51 15 C64 16 73 25 71 42 C68 33 62 28 56 28 C58 32 56 35 52 35 C49 30 41 30 36 35 C33 37 31 39 29 42 Z" {...p} />;
    case "curly": return <g fill={c} stroke={INK} strokeWidth="2">{[[33, 30], [41, 22], [50, 19], [59, 22], [67, 30], [30, 39], [70, 39]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="8" />)}</g>;
    case "updo": return <g {...p}><circle cx="50" cy="13" r="8" /><path d="M30 40 C30 22 41 17 50 17 C61 17 70 23 70 40 C64 30 55 26 46 28 C39 30 33 35 30 40 Z" /></g>;
    default: return null;
  }
}

function torso(l: Look, side: Side) {
  const tie = TIE[side];
  if (l.top === "hoodie") return (
    <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M6 104 C8 80 26 70 50 70 C74 70 92 80 94 104 Z" fill="#3d3a48" />
      <path d="M34 72 C38 82 62 82 66 72" fill="none" />
      <path d="M44 80 L42 94 M56 80 L58 94" fill="none" strokeWidth="1.8" />
    </g>
  );
  if (l.fem) return (
    <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M8 104 C10 82 28 74 50 74 C72 74 90 82 92 104 Z" fill="#2a2440" />
      <path d="M38 75 C42 88 58 88 62 75 Z" fill={tie} />
      <g fill="#fff" stroke="none">{[42, 46, 50, 54, 58].map((x, i) => <circle key={x} cx={x} cy={80 + [0, 2.6, 3.4, 2.6, 0][i]} r="1.3" />)}</g>
    </g>
  );
  if (l.top === "open") return (
    <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M8 104 C10 82 28 74 50 74 C72 74 90 82 92 104 Z" fill="#4a3a2c" />
      <path d="M40 75 L50 90 L60 75 Z" fill="#c9b49a" />
    </g>
  );
  return (
    <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round">
      <path d="M8 104 C10 82 28 74 50 74 C72 74 90 82 92 104 Z" fill="#262039" />
      <path d="M39 75 L50 93 L61 75 Z" fill="#fff" />
      <path d="M47.5 79 L52.5 79 L55 95 L50 101 L45 95 Z" fill={tie} />
      <path d="M39 75 L45 86 L50 80 M61 75 L55 86 L50 80" fill="none" strokeWidth="1.6" />
    </g>
  );
}

function mouth(m: Look["mouth"]) {
  switch (m) {
    case "grin": return <g><path d="M41 62 Q50 72 59 62 Z" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" /><path d="M42.5 63.5 L57.5 63.5" stroke={INK} strokeWidth="1" opacity=".35" /></g>;
    case "flat": return <path d="M43 64 Q50 65.5 57 64" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />;
    case "smirk": return <path d="M43 64 Q51 67 58 61" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />;
    default: return <path d="M42 62.5 Q50 69 58 62.5" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />;
  }
}

function facial(f: Look["face"], c: string) {
  const s = { stroke: INK, strokeWidth: 1.8, strokeLinejoin: "round" as const };
  switch (f) {
    case "stache": return <path d="M41 61 C45 57.5 49 58.5 50 60 C51 58.5 55 57.5 59 61 C55 62.5 52 61.5 50 61.5 C48 61.5 45 62.5 41 61 Z" fill={c} {...s} />;
    case "walrus": return <path d="M38 64 C40 56 47 56 50 59 C53 56 60 56 62 64 C58 61 54 62 50 63 C46 62 42 61 38 64 Z" fill={c} {...s} />;
    case "goatee": return <g fill={c} {...s}><path d="M44 68 C45 76 55 76 56 68 C53 70.5 47 70.5 44 68 Z" /><path d="M42 61 C46 58.5 49 59.5 50 60.5 C51 59.5 54 58.5 58 61 C54 62 52 61.5 50 61.8 C48 61.5 46 62 42 61 Z" /></g>;
    case "beard": return <path d="M30 50 C30 67 38 77 50 78 C62 77 70 67 70 50 C68 58 64 63 59 65 C56 61.5 44 61.5 41 65 C36 63 32 58 30 50 Z" fill={c} {...s} />;
    case "stubble": return <path d="M31 52 C32 67 39 76 50 77 C61 76 68 67 69 52 C66 63 59 68 50 68 C41 68 34 63 31 52 Z" fill={c} opacity=".28" />;
    default: return null;
  }
}

function specs(g: Look["glasses"]) {
  const s = { fill: "rgba(255,255,255,.18)", stroke: INK, strokeWidth: 2 };
  if (g === "rect") return <g><rect x="34" y="43" width="13" height="10" rx="3" {...s} /><rect x="53" y="43" width="13" height="10" rx="3" {...s} /><path d="M47 47 Q50 45.5 53 47" fill="none" stroke={INK} strokeWidth="2" /></g>;
  if (g === "round") return <g><circle cx="41" cy="48" r="6.5" {...s} /><circle cx="59" cy="48" r="6.5" {...s} /><path d="M47.5 47 Q50 45.5 52.5 47" fill="none" stroke={INK} strokeWidth="2" /></g>;
  if (g === "half") return <g><path d="M35 53 L47 53 L46 58.5 Q41 60.5 36 58.5 Z M53 53 L65 53 L64 58.5 Q59 60.5 54 58.5 Z" {...s} /><path d="M47 54 Q50 53 53 54" fill="none" stroke={INK} strokeWidth="2" /></g>;
  return null;
}

/** a portrait inside a 100 by 100 box */
export function ToonG({ name, side = "U", uid = "" }: { name: string; side?: Side; uid?: string }) {
  if (name.startsWith("Generic")) return (
    <g>
      <circle cx="50" cy="50" r="50" fill={BG[side]} />
      <path d="M14 100 C16 78 32 70 50 70 C68 70 84 78 86 100 Z" fill={INK} opacity=".55" />
      <circle cx="50" cy="44" r="21" fill={INK} opacity=".55" />
      <text x="50" y="55" textAnchor="middle" fontSize="30" fontWeight="900" fill="#fff" fontFamily="system-ui, sans-serif">?</text>
      <circle cx="50" cy="50" r="48.6" fill="none" stroke={INK} strokeWidth="2.8" />
    </g>
  );
  const l = lookOf(name), [skin, shadow] = SKIN[side], hc = SHADE[l.shade];
  const j = l.jaw ?? 1, rx = 20 * j, clip = `tc-${slug(name)}-${side}${uid}`;
  const brow = l.brows === "heavy" ? 3.4 : 2.2;
  return (
    <g>
      <defs><clipPath id={clip}><circle cx="50" cy="50" r="50" /></clipPath></defs>
      <circle cx="50" cy="50" r="50" fill={BG[side]} />
      <g clipPath={`url(#${clip})`}>
        <g opacity=".22" fill="#fff">{[16, 30, 44, 58, 72, 86].flatMap((x) => [14, 26].map((y) => <circle key={`${x}${y}`} cx={x + (y === 26 ? 7 : 0)} cy={y} r="1.6" />))}</g>
        {hairBack(l.hair, hc)}
        {torso(l, side)}
        <rect x="43" y="64" width="14" height="14" fill={shadow} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={50 - rx} cy="50" rx="4.5" ry="6" fill={skin} stroke={INK} strokeWidth="2.2" />
        <ellipse cx={50 + rx} cy="50" rx="4.5" ry="6" fill={skin} stroke={INK} strokeWidth="2.2" />
        <path d={`M${50 - rx} 44 C${50 - rx} 26 ${50 - rx * 0.55} 20 50 20 C${50 + rx * 0.55} 20 ${50 + rx} 26 ${50 + rx} 44 C${50 + rx} 62 ${50 + rx * 0.6} 74 50 74 C${50 - rx * 0.6} 74 ${50 - rx} 62 ${50 - rx} 44 Z`} fill={skin} stroke={INK} strokeWidth="2.4" />
        <ellipse cx="38" cy="57" rx="4.2" ry="2.6" fill="#ff8fa3" opacity=".35" />
        <ellipse cx="62" cy="57" rx="4.2" ry="2.6" fill="#ff8fa3" opacity=".35" />
        {facial(l.face, hc)}
        {hairFront(l.hair, hc)}
        <path d={`M35.5 ${41.5} Q41 ${38.5} 46 ${41}`} fill="none" stroke={l.shade === "white" || l.shade === "silver" ? "#8b8794" : INK} strokeWidth={brow} strokeLinecap="round" />
        <path d={`M54 ${41} Q59 ${38.5} 64.5 ${41.5}`} fill="none" stroke={l.shade === "white" || l.shade === "silver" ? "#8b8794" : INK} strokeWidth={brow} strokeLinecap="round" />
        <circle cx="41" cy="48" r="2.6" fill={INK} /><circle cx="59" cy="48" r="2.6" fill={INK} />
        <circle cx="41.9" cy="47.1" r=".8" fill="#fff" /><circle cx="59.9" cy="47.1" r=".8" fill="#fff" />
        <path d="M50 49 C48 55 47 57 50.5 58" fill="none" stroke={INK} strokeWidth="1.9" strokeLinecap="round" />
        {mouth(l.mouth)}
        {specs(l.glasses)}
      </g>
      <circle cx="50" cy="50" r="48.6" fill="none" stroke={INK} strokeWidth="2.8" />
    </g>
  );
}

/** a portrait as its own <svg> */
export default function Toon({ name, side = "U", size = 64, className, uid = "" }: { name: string; side?: Side; size?: number; className?: string; uid?: string }) {
  const label = name.replace(", if seated", "");
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Cartoon of ${label}`}>
      <ToonG name={name} side={side} uid={uid} />
    </svg>
  );
}
