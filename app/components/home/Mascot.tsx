"use client";
// Pointy, the On Point mascot, November 2026 design: the On Point ring and P as a gradient disc cut in ink, two big
// eyes on the P's bowl, the P's hole for a nose and a grin, purple arms and legs, white gloves, one red and one blue
// sneaker. Pure SVG; every pose is CSS on the limbs, so the parent only moves and
// flips it. Poses: walk, idle, wave, point, cheer, think, sit. Props sit in the front hand.
import React from "react";
import { ICON_PATH } from "@/app/components/opp/Logo";
import { useSiteMode } from "@/app/lib/useSiteTheme";
import "./pointy.css";

export type Pose = "walk" | "idle" | "wave" | "point" | "cheer" | "think" | "sit";
export type Prop = "clipboard" | "megaphone" | "ballot" | "magnifier" | "chart" | "flag" | "pointer" | "none";

function PropArt({ prop, id }: { prop: Prop; id: string }) {
  switch (prop) {
    case "clipboard":
      return (
        <g transform="translate(236 228) rotate(-8)"><rect width="46" height="60" rx="6" fill="#e7b341" /><rect x="6" y="10" width="34" height="44" rx="3" fill="#fff" /><rect x="16" y="-4" width="14" height="10" rx="3" fill="#8e86a3" />
          <rect x="11" y="18" width="24" height="4" rx="2" fill="#3d7bff" /><rect x="11" y="28" width="18" height="4" rx="2" fill="#ff3b5c" /><rect x="11" y="38" width="22" height="4" rx="2" fill="#8e86a3" /></g>
      );
    case "megaphone":
      return (
        <g transform="translate(246 252) rotate(-28)"><path d="M0 -10 L52 -30 L52 30 L0 10 Z" fill={`url(#g${id})`} /><rect x="-12" y="-12" width="16" height="24" rx="5" fill="#f3eff8" /><ellipse cx="52" cy="0" rx="7" ry="30" fill="#2a1a46" />
          <g className="pty-waves" stroke="#f3eff8" strokeWidth="5" fill="none" strokeLinecap="round"><path d="M70 -18 q10 18 0 36" /><path d="M84 -28 q16 28 0 56" opacity=".6" /></g></g>
      );
    case "ballot":
      return (
        <g transform="translate(228 236) rotate(6)"><rect width="56" height="40" rx="5" fill="#fff" /><path d="M0 4 L28 22 L56 4" stroke="#c9c2d6" strokeWidth="3" fill="none" />
          <circle cx="44" cy="30" r="9" fill="#3d7bff" /><path d="M39 30 l4 4 l7 -8" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
      );
    case "magnifier":
      return (
        <g transform="translate(250 262) rotate(-30)"><rect x="-5" y="0" width="10" height="44" rx="5" fill="#e7b341" /><circle cx="0" cy="-26" r="26" fill="rgba(143,176,255,.25)" stroke="#f3eff8" strokeWidth="8" /><path d="M-12 -36 a16 16 0 0 1 14 -6" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" /></g>
      );
    case "chart":
      return (
        <g transform="translate(226 214) rotate(-6)"><rect width="66" height="56" rx="8" fill="#140b24" stroke="#f3eff8" strokeWidth="3" /><rect x="10" y="30" width="10" height="18" rx="2" fill="#ff3b5c" /><rect x="26" y="20" width="10" height="28" rx="2" fill="#9b5cff" /><rect x="42" y="10" width="10" height="38" rx="2" fill="#3d7bff" />
          <path d="M8 26 L28 16 L44 18 L60 6" stroke="#e7b341" strokeWidth="3" fill="none" strokeLinecap="round" /></g>
      );
    case "flag":
      return (
        <g transform="translate(250 266)"><rect x="-3" y="-10" width="6" height="150" rx="3" fill="#e7b341" /><path className="pty-cloth" d="M3 98 h70 l-14 20 l14 20 h-70 z" fill={`url(#g${id})`} /><circle cx="26" cy="118" r="9" fill="none" stroke="#fff" strokeWidth="4" /></g>
      );
    case "pointer":
      return <g transform="translate(250 266) rotate(-6)"><rect x="-3" y="0" width="6" height="96" rx="3" fill="#e7b341" /><circle cx="0" cy="98" r="7" fill="#ff3b5c" /></g>;
    default:
      return null;
  }
}

// Line work and limb colors from the November 2026 Pointy: ink outlines, deep purple limbs, white gloves and sneakers.
const INK = "#110a1d", LIMB = "#46306c";

/** A limb as a thick ink line under a purple line, so every arm and leg carries the same outline as the body. */
function Limb({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (<>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth="26" strokeLinecap="round" />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LIMB} strokeWidth="15" strokeLinecap="round" />
  </>);
}

// The glove and the sneaker are built from simple shapes drawn twice: once fat in ink for the outline, then in white on
// top, so the overlaps merge into one clean cartoon silhouette.
const GLOVE = (<>
  <rect x="-11" y="-14" width="22" height="10" rx="4" />
  <circle cx="0" cy="6" r="14" />
  <ellipse cx="-12" cy="19" rx="5.5" ry="10.5" transform="rotate(22 -12 19)" />
  <ellipse cx="-2" cy="23" rx="5.5" ry="11.5" />
  <ellipse cx="9" cy="20" rx="5.5" ry="10.5" transform="rotate(-20 9 20)" />
  <ellipse cx="15" cy="2" rx="5.5" ry="10" transform="rotate(-62 15 2)" />
</>);
function Glove({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="pty-hand">
        <g fill={INK} stroke={INK} strokeWidth="9" strokeLinejoin="round">{GLOVE}</g>
        <g fill="#fff">{GLOVE}</g>
        <path d="M-9 -4 h18" stroke={INK} strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
      </g>
    </g>
  );
}
const SHOE = (<>
  <path d="M-18 -6 q2 -10 16 -10 h6 q4 0 6 4 l10 6 q16 4 16 16 v4 h-58 v-6 q0 -8 4 -14z" />
  <rect x="-24" y="8" width="60" height="9" rx="4.5" />
</>);
function Sneaker({ x, y, flip, color }: { x: number; y: number; flip?: boolean; color: string }) {
  return (
    <g className="pty-shoe" transform={`translate(${x} ${y})${flip ? " scale(-1 1)" : ""}`}>
      <g fill={INK} stroke={INK} strokeWidth="8" strokeLinejoin="round">{SHOE}</g>
      <g fill="#fff">{SHOE}</g>
      <path d="M-18 -6 q2 -10 16 -10 h3 v24 h-21 v-0 q0 -8 2 -14z" fill={color} />
      <path d="M-1 -16 v24" stroke={INK} strokeWidth="2.5" />
      <g stroke={INK} strokeWidth="2.5" strokeLinecap="round"><path d="M6 -10 l6 4" /><path d="M11 -5 l6 4" /></g>
      <path d="M-24 10 h60" stroke={INK} strokeWidth="2.5" />
    </g>
  );
}

export default function Mascot({ size = 96, walking, pose, prop = "clipboard", look = 1, cap = false, detective = false, className, title = "Pointy, the On Point Politics canvasser" }:
  { size?: number; walking?: boolean; pose?: Pose; prop?: Prop; look?: number; cap?: boolean; detective?: boolean; className?: string; title?: string }) {
  const id = React.useId().replace(/:/g, "");
  const p: Pose = pose ?? (walking === false ? "wave" : "walk");
  // the pupils look the way Pointy faces, and up and away when he thinks
  const lx = Math.max(-1, Math.min(1, look)) * 8, ly = p === "think" ? -9 : 1;
  const eye = (cx: number, cy: number, k: string) => (
    <g className={`pty-eye ${k}`} transform={`translate(${cx} ${cy})`}>
      <clipPath id={`c${k}${id}`}><circle r="29" /></clipPath>
      <circle r="29" fill="#fff" stroke={INK} strokeWidth="5" />
      <g className="pty-look"><circle className="pty-pupil" cx={lx} cy={ly} r="12.5" fill={INK} /><circle cx={lx + 4.5} cy={ly - 5} r="4" fill="#fff" /></g>
      <g clipPath={`url(#c${k}${id})`}><rect className="pty-lid" x="-31" y="-31" width="62" height="0" fill={LIMB} /></g>
      <circle r="29" fill="none" stroke={INK} strokeWidth="5" />
    </g>
  );
  return (
    <svg viewBox="-40 -60 380 480" width={size * (380 / 480)} height={size} className={`pty pty-v2 pose-${p}${className ? ` ${className}` : ""}`} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`g${id}`} x1=".12" y1=".16" x2=".86" y2=".88"><stop offset="0" stopColor="#6a74fe" /><stop offset=".36" stopColor="#6d73ff" /><stop offset=".52" stopColor="#a663ff" /><stop offset=".68" stopColor="#c25ee8" /><stop offset=".84" stopColor="#e855b8" /><stop offset="1" stopColor="#e04f9e" /></linearGradient>
      </defs>
      <ellipse className="pty-sh" cx="150" cy="410" rx="80" ry="9" fill="rgba(0,0,0,.28)" />
      <g className="pty-all">
        {/* legs and sneakers: red on his right foot, blue on his left */}
        <g className="pty-leg l"><Limb x1={123} y1={292} x2={123} y2={366} /><Sneaker x={120} y={380} flip color="#ef3b5d" /></g>
        <g className="pty-leg r"><Limb x1={177} y1={292} x2={177} y2={366} /><Sneaker x={180} y={380} color="#3d6bff" /></g>
        {/* back arm */}
        <g className="pty-arm b"><Limb x1={50} y1={174} x2={50} y2={252} /><Glove x={50} y={264} /></g>
        {/* body: the On Point ring and P, cut in ink, with two eyes on the bowl, the P's hole for a nose and a grin */}
        <g className="pty-body">
          <circle cx="150" cy="176" r="131" fill={INK} />
          <g transform="translate(0 26)"><path d={ICON_PATH} fill={`url(#g${id})`} stroke={`url(#g${id})`} strokeWidth="5" strokeLinejoin="round" /></g>
          <circle cx="150" cy="176" r="128.5" fill="none" stroke={INK} strokeWidth="6" />
          {eye(104, 166, "l")}
          {eye(196, 166, "r")}
          <circle cx="150" cy="176" r="17" fill={INK} />
          <g className="pty-mouth">
            {p === "cheer"
              ? <><path d="M112 214 q38 46 76 0 z" fill={INK} stroke={INK} strokeWidth="5" strokeLinejoin="round" /><path d="M120 218 q30 10 60 0 v4 q-30 12 -60 0z" fill="#fff" /><path d="M134 240 q16 8 32 0 q-16 -8 -32 0z" fill="#ef3b5d" /></>
              : p === "think"
                ? <path d="M132 226 q10 -6 18 0 t18 0" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
                : <><path d="M116 214 q34 36 68 0 q-34 12 -68 0z" fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" /><path d="M121 221 q29 10 58 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" /></>}
          </g>
          {cap ? (
            <g className="pty-cap"><path d="M58 92 a100 70 0 0 1 184 0 z" fill="#140b24" /><path d="M58 92 a100 70 0 0 1 184 0" fill="none" stroke={`url(#g${id})`} strokeWidth="10" /><path d="M226 88 q46 0 64 14 q-30 8 -70 4z" fill="#140b24" stroke="#9b5cff" strokeWidth="4" /><circle cx="150" cy="40" r="8" fill="#e7b341" /></g>
          ) : null}
          {detective ? (
            <g className="pty-det">
              {/* a deerstalker in On Point plaid, ear flaps up, and a gold inspector's badge */}
              <path d="M62 96 q88 -96 176 0 z" fill="#5b3a1e" />
              <path d="M62 96 q88 -96 176 0" fill="none" stroke="#e7b341" strokeWidth="5" />
              <g stroke="#e7b341" strokeWidth="3" opacity=".55"><path d="M96 64 L120 94" /><path d="M136 44 L150 94" /><path d="M172 44 L170 94" /><path d="M206 62 L196 94" /><path d="M80 82 L222 82" /></g>
              <path d="M54 98 q-30 6 -36 -10 q22 -10 44 0z" fill="#5b3a1e" stroke="#e7b341" strokeWidth="3" />
              <path d="M246 98 q30 6 36 -10 q-22 -10 -44 0z" fill="#5b3a1e" stroke="#e7b341" strokeWidth="3" />
              <circle cx="150" cy="34" r="9" fill="#e7b341" />
              <g transform="translate(222 252)"><path d="M0 -16 l14 6 v12 q0 12 -14 18 q-14 -6 -14 -18 v-12z" fill="#e7b341" stroke="#7a5512" strokeWidth="2" /><path d="M-5 0 l4 4 l7 -8" stroke="#3b2608" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>
            </g>
          ) : null}
          {p === "think" ? <g className="pty-dots" fill="#fff" stroke={INK} strokeWidth="4"><circle cx="262" cy="40" r="8" /><circle cx="286" cy="12" r="11" /><circle cx="316" cy="-22" r="15" /></g> : null}
        </g>
        {/* front arm with the prop in the glove */}
        <g className="pty-arm f">
          <Limb x1={250} y1={174} x2={250} y2={252} />
          <PropArt prop={prop} id={id} />
          <Glove x={250} y={264} />
        </g>
        {p === "cheer" ? <g className="pty-spark" fill="#e7b341" stroke={INK} strokeWidth="3"><path d="M20 30 l6 14 l14 6 l-14 6 l-6 14 l-6 -14 l-14 -6 l14 -6z" /><path d="M280 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4z" /></g> : null}
      </g>
    </svg>
  );
}

// kept for callers that inject the styles inline; the same rules ship in pointy.css
export const MASCOT_CSS = "";

// Pointy as a page cameo: the mascot plus an optional speech bubble, placed by the parent with a class.
// Theme only: in Pro Dark and Pro Light the figure is never rendered, and a line that is not a .quip stays as a plain
// note (styled in modes.css). The server and first client render use Pro Dark, so a Pro page never flashes the figure.
export function Pointy({ pose = "wave", prop = "clipboard", size = 120, say, look = -1, cap, detective, className, flip }: { pose?: Pose; prop?: Prop; size?: number; say?: React.ReactNode; look?: number; cap?: boolean; detective?: boolean; className?: string; flip?: boolean }) {
  // the sketchbook look always has Pointy on the page, like the Theme mode
  const [sk, setSk] = React.useState(false);
  React.useEffect(() => { setSk(document.documentElement.hasAttribute("data-sk")); }, []);
  const themed = useSiteMode() === "themed" || sk;
  if (!themed && (!say || className?.split(/\s+/).includes("quip"))) return null;
  return (
    <div className={`pty-cameo${flip ? " flip" : ""}${className ? ` ${className}` : ""}`} data-say={say ? "" : undefined} aria-hidden={say ? undefined : true}>
      {say ? <div className="pty-say">{say}</div> : null}
      {themed ? <div className="pty-fig"><Mascot size={size} pose={pose} prop={prop} look={look} cap={cap} detective={detective} /></div> : null}
    </div>
  );
}
