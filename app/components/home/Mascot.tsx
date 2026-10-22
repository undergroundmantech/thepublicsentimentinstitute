"use client";
// Pointy, the On Point mascot: the On Point ring and P drawn as a round body, the P's bowl as one big eye that looks
// where it walks, with arms, legs, sneakers and a clipboard for knocking doors. Pure SVG; the walk cycle is CSS on
// the limbs, so the parent only moves and flips it. walking=false stands it still and waves.
import React from "react";
import { ICON_PATH } from "@/app/components/opp/Logo";

export default function Mascot({ size = 96, walking = true, look = 1, className, title = "Pointy, the On Point Politics canvasser" }: { size?: number; walking?: boolean; look?: number; className?: string; title?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 300 420" width={size * (300 / 420)} height={size} className={`pty${walking ? " walk" : " idle"}${className ? ` ${className}` : ""}`} role="img" aria-label={title}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3d7bff" /><stop offset=".5" stopColor="#9b5cff" /><stop offset="1" stopColor="#ff3b5c" /></linearGradient>
        <radialGradient id={`b${id}`} cx=".4" cy=".35" r=".75"><stop offset="0" stopColor="#2a1a46" /><stop offset="1" stopColor="#0d0718" /></radialGradient>
      </defs>
      <ellipse className="pty-sh" cx="150" cy="408" rx="78" ry="10" fill="rgba(0,0,0,.45)" />
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
        <g className="pty-eye" transform={`translate(${150 + look * 5} 176)`}>
          <circle r="22" fill="#fff" />
          <circle className="pty-pupil" cx={look * 6} cy="2" r="10.5" fill="#0d0718" />
          <circle cx={look * 6 + 4} cy="-3" r="3.6" fill="#fff" />
          <rect className="pty-lid" x="-24" y="-24" width="48" height="0" fill="#0d0718" />
        </g>
        <path d="M128 222 q22 14 44 0" stroke="#f3eff8" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".9" />
      </g>
      {/* front arm with the clipboard */}
      <g className="pty-arm f">
        <rect x="240" y="170" width="20" height="92" rx="10" fill="#1b1230" />
        <g transform="translate(236 228) rotate(-8)"><rect width="46" height="60" rx="6" fill="#e7b341" /><rect x="6" y="10" width="34" height="44" rx="3" fill="#fff" /><rect x="16" y="-4" width="14" height="10" rx="3" fill="#8e86a3" />
          <rect x="11" y="18" width="24" height="4" rx="2" fill="#3d7bff" /><rect x="11" y="28" width="18" height="4" rx="2" fill="#ff3b5c" /><rect x="11" y="38" width="22" height="4" rx="2" fill="#8e86a3" /></g>
        <circle cx="250" cy="266" r="14" fill="#f3eff8" />
      </g>
    </svg>
  );
}

export const MASCOT_CSS = `
.pty{overflow:visible;display:block;max-width:none!important;flex:none}
.pty .pty-leg,.pty .pty-arm{transform-box:fill-box;transform-origin:50% 0}
.pty.walk .pty-leg.l{animation:pty-swing .5s ease-in-out infinite alternate}
.pty.walk .pty-leg.r{animation:pty-swing .5s ease-in-out infinite alternate-reverse}
.pty.walk .pty-arm.b{animation:pty-arm .5s ease-in-out infinite alternate-reverse}
.pty.walk .pty-arm.f{animation:pty-arm2 .5s ease-in-out infinite alternate}
.pty.walk .pty-body{animation:pty-bob .25s ease-in-out infinite alternate}
.pty.idle .pty-arm.f{animation:pty-wave .7s ease-in-out infinite alternate}
.pty .pty-lid{animation:pty-blink 4.6s infinite}
.pty .pty-sh{transform-box:fill-box;transform-origin:center}
.pty.walk .pty-sh{animation:pty-shadow .25s ease-in-out infinite alternate}
@keyframes pty-swing{from{transform:rotate(-24deg)}to{transform:rotate(24deg)}}
@keyframes pty-arm{from{transform:rotate(-20deg)}to{transform:rotate(20deg)}}
@keyframes pty-arm2{from{transform:rotate(-12deg)}to{transform:rotate(14deg)}}
@keyframes pty-bob{from{transform:translateY(0)}to{transform:translateY(-7px)}}
@keyframes pty-shadow{from{transform:scaleX(1)}to{transform:scaleX(.9)}}
@keyframes pty-wave{from{transform:rotate(-150deg)}to{transform:rotate(-110deg)}}
@keyframes pty-blink{0%,93%,100%{height:0}95%,97%{height:48px}}
@media (prefers-reduced-motion:reduce){.pty *{animation:none!important}}
`;
