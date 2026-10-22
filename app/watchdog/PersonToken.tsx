// A little cartoon figure for a person on the Watchdog maps: an original On Point style character, not a likeness.
// A round head in the person's party color with their initials, a body, and a prop for their role: a podium mic
// for presidents, a podcast mic, a phone for influencers, a star for celebrities, a money bag for business, a
// megaphone for activists, a banner for unions and groups, a clipboard for everyone else on the trail.
import React from "react";

export const PARTY_COLOR: Record<string, string> = { D: "#3d7bff", R: "#ff3b5c", I: "#b78cff", O: "#8e86a3", other: "#8e86a3" };

function Prop({ role }: { role: string }) {
  const r = role.toLowerCase();
  if (r.includes("president") || r === "cabinet") return <g><rect x="27" y="40" width="14" height="13" rx="2" fill="#2a1a46" stroke="#e7b341" strokeWidth="1.4" /><rect x="33" y="33" width="2" height="8" fill="#e7b341" /><circle cx="34" cy="32" r="2.4" fill="#e7b341" /></g>;
  if (r.includes("reporter") || r.includes("analyst")) return <g><rect x="27" y="30" width="11" height="14" rx="1.4" fill="#fff" stroke="#e7b341" strokeWidth="1.2" /><path d="M29 34 h7 M29 37 h7 M29 40 h5" stroke="#2a1a46" strokeWidth="1" /><path d="M39 29 l3 3 -7 8 -3 1 1 -3z" fill="#e7b341" /></g>;
  if (r.includes("podcast") || r.includes("commentator") || r.includes("host") || r.includes("streamer") || r === "media") return <g><rect x="30" y="30" width="6" height="10" rx="3" fill="#e7b341" /><path d="M28 36 q5 7 10 0" stroke="#e7b341" strokeWidth="1.6" fill="none" /><rect x="32.2" y="41" width="1.6" height="6" fill="#e7b341" /></g>;
  if (r.includes("influencer")) return <rect x="29" y="31" width="9" height="15" rx="2" fill="#140b24" stroke="#e7b341" strokeWidth="1.6" />;
  if (r.includes("celebrity")) return <path d="M34 28 l2.4 5 5.4 .6 -4 3.7 1.1 5.3 -4.9 -2.7 -4.9 2.7 1.1 -5.3 -4 -3.7 5.4 -.6z" fill="#e7b341" />;
  if (r.includes("business")) return <g><path d="M28 36 q0 -6 6 -6 q6 0 6 6 q0 8 -6 8 q-6 0 -6 -8z" fill="#3f8f4a" stroke="#e7b341" strokeWidth="1.2" /><text x="34" y="41" textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff">$</text></g>;
  if (r.includes("activist")) return <g><path d="M28 34 l9 -5 v12 l-9 -5z" fill="#e7b341" /><rect x="26" y="33" width="3" height="4" fill="#e7b341" /></g>;
  if (r.includes("group")) return <g><rect x="27" y="28" width="1.6" height="20" fill="#e7b341" /><path d="M28.6 29 h11 l-3 4 3 4 h-11z" fill="#e7b341" /></g>;
  return <g><rect x="28" y="31" width="10" height="13" rx="1.6" fill="#e7b341" /><rect x="29.5" y="33.5" width="7" height="9" rx="1" fill="#fff" /></g>;
}

export default function PersonToken({ ini, party, role = "surrogate", size = 40, active = false, title }: { ini: string; party: string; role?: string; size?: number; active?: boolean; title?: string }) {
  const c = PARTY_COLOR[party] ?? PARTY_COLOR.O;
  return (
    <svg className="wd-tok" viewBox="0 0 44 56" width={size * (44 / 56)} height={size} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <ellipse cx="20" cy="54" rx="11" ry="2.2" fill="rgba(0,0,0,.45)" />
      <g className="bob">
        {active ? <circle cx="20" cy="17" r="17" fill="none" stroke="#ffd98a" strokeWidth="2" opacity=".9" /> : null}
        <rect x="14" y="40" width="4" height="12" rx="2" fill="#1b1230" /><rect x="22" y="40" width="4" height="12" rx="2" fill="#1b1230" />
        <path d="M9 44 q0 -14 11 -14 q11 0 11 14z" fill={c} opacity=".9" />
        <circle cx="20" cy="17" r="14" fill={c} stroke="#fff" strokeWidth="1.8" />
        <text x="20" y="21.5" textAnchor="middle" fontSize={ini.length > 2 ? 9 : 11.5} fontWeight="800" fill="#fff" fontFamily="var(--font-m), monospace">{ini}</text>
        <Prop role={role} />
      </g>
    </svg>
  );
}
