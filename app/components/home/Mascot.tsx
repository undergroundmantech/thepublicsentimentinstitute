"use client";
// Pointy, the On Point mascot: the On Point ring and P drawn as a round body, the P's bowl as one big eye that looks
// where it walks, with arms, legs and sneakers. Pure SVG; every pose is CSS on the limbs, so the parent only moves and
// flips it. Poses: walk, idle, wave, point, cheer, think, sit. Props sit in the front hand.
import React from "react";
import { ICON_PATH } from "@/app/components/opp/Logo";
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

export default function Mascot({ size = 96, walking, pose, prop = "clipboard", look = 1, cap = false, className, title = "Pointy, the On Point Politics canvasser" }:
  { size?: number; walking?: boolean; pose?: Pose; prop?: Prop; look?: number; cap?: boolean; className?: string; title?: string }) {
  const id = React.useId().replace(/:/g, "");
  const p: Pose = pose ?? (walking === false ? "wave" : "walk");
  const lx = look * 5, py = p === "think" ? -6 : 2;
  return (
    <svg viewBox="-40 -60 380 480" width={size * (380 / 480)} height={size} className={`pty pose-${p}${className ? ` ${className}` : ""}`} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3d7bff" /><stop offset=".5" stopColor="#9b5cff" /><stop offset="1" stopColor="#ff3b5c" /></linearGradient>
        <radialGradient id={`b${id}`} cx=".4" cy=".35" r=".75"><stop offset="0" stopColor="#2a1a46" /><stop offset="1" stopColor="#0d0718" /></radialGradient>
      </defs>
      <ellipse className="pty-sh" cx="150" cy="408" rx="78" ry="10" fill="rgba(0,0,0,.45)" />
      <g className="pty-all">
        {/* legs and sneakers */}
        <g className="pty-leg l"><rect x="112" y="290" width="22" height="86" rx="11" fill="#1b1230" /><path d="M96 372 h44 a10 10 0 0 1 10 10 v4 h-60 v-4 a6 6 0 0 1 6 -10z" fill="#fff" /><rect x="90" y="384" width="60" height="7" rx="3.5" fill="#ff3b5c" /></g>
        <g className="pty-leg r"><rect x="166" y="290" width="22" height="86" rx="11" fill="#1b1230" /><path d="M160 372 h44 a10 10 0 0 1 10 10 v4 h-60 v-4 a6 6 0 0 1 6 -10z" fill="#fff" /><rect x="154" y="384" width="60" height="7" rx="3.5" fill="#3d7bff" /></g>
        {/* back arm */}
        <g className="pty-arm b"><rect x="40" y="170" width="20" height="92" rx="10" fill="#1b1230" /><circle cx="50" cy="266" r="14" fill="#f3eff8" /></g>
        {/* body: the On Point mark */}
        <g className="pty-body">
          <circle cx="150" cy="176" r="128" fill={`url(#b${id})`} />
          <g transform="translate(150 176) scale(1.02) translate(-150 -150)"><path d={ICON_PATH} fill={`url(#g${id})`} /></g>
          {/* the eye sits in the P's bowl */}
          <g className="pty-eye" transform={`translate(${150 + lx} 176)`}>
            <circle r="22" fill="#fff" />
            <circle className="pty-pupil" cx={look * 6} cy={py} r="10.5" fill="#0d0718" />
            <circle cx={look * 6 + 4} cy={py - 5} r="3.6" fill="#fff" />
            <rect className="pty-lid" x="-24" y="-24" width="48" height="0" fill="#0d0718" />
          </g>
          <circle cx="104" cy="214" r="10" fill="#ff3b5c" opacity=".28" /><circle cx="196" cy="214" r="10" fill="#ff3b5c" opacity=".28" />
          {p === "cheer" ? <path d="M126 218 q24 26 48 0 z" fill="#f3eff8" opacity=".95" /> : p === "think" ? <path d="M134 226 h30" stroke="#f3eff8" strokeWidth="6" strokeLinecap="round" opacity=".9" />
            : <path d="M128 222 q22 14 44 0" stroke="#f3eff8" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".9" />}
          {cap ? (
            <g className="pty-cap"><path d="M58 92 a100 70 0 0 1 184 0 z" fill="#140b24" /><path d="M58 92 a100 70 0 0 1 184 0" fill="none" stroke={`url(#g${id})`} strokeWidth="10" /><path d="M226 88 q46 0 64 14 q-30 8 -70 4z" fill="#140b24" stroke="#9b5cff" strokeWidth="4" /><circle cx="150" cy="40" r="8" fill="#e7b341" /></g>
          ) : null}
          {p === "think" ? <g className="pty-dots" fill="#f3eff8"><circle cx="262" cy="40" r="8" /><circle cx="286" cy="12" r="11" /><circle cx="316" cy="-22" r="15" /></g> : null}
        </g>
        {/* front arm with the prop */}
        <g className="pty-arm f">
          <rect x="240" y="170" width="20" height="92" rx="10" fill="#1b1230" />
          <PropArt prop={prop} id={id} />
          <circle cx="250" cy="266" r="14" fill="#f3eff8" />
        </g>
        {p === "cheer" ? <g className="pty-spark" fill="#e7b341"><path d="M20 30 l6 14 l14 6 l-14 6 l-6 14 l-6 -14 l-14 -6 l14 -6z" /><path d="M280 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4z" /></g> : null}
      </g>
    </svg>
  );
}

// kept for callers that inject the styles inline; the same rules ship in pointy.css
export const MASCOT_CSS = "";

// Pointy as a page cameo: the mascot plus an optional speech bubble, placed by the parent with a class.
export function Pointy({ pose = "wave", prop = "clipboard", size = 120, say, look = -1, cap, className, flip }: { pose?: Pose; prop?: Prop; size?: number; say?: React.ReactNode; look?: number; cap?: boolean; className?: string; flip?: boolean }) {
  return (
    <div className={`pty-cameo${flip ? " flip" : ""}${className ? ` ${className}` : ""}`} aria-hidden={say ? undefined : true}>
      {say ? <div className="pty-say">{say}</div> : null}
      <div className="pty-fig"><Mascot size={size} pose={pose} prop={prop} look={look} cap={cap} /></div>
    </div>
  );
}
