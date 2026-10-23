// The Watchdog tools in plain language: one list that the nav, the "you are here" line and the Desk's
// "Start here" cards all read, so a tool is named and explained the same way everywhere.
import React from "react";

export type ToolKey = "desk" | "money" | "paid" | "connections" | "trail" | "endorsements" | "media" | "counties" | "people";
export type Tool = { key: ToolKey; href: string; label: string; question: string; desc: string };
export type ToolGroup = { key: string; label: string; tools: Tool[] };

export const WD_DESK: Tool = {
  key: "desk", href: "/watchdog", label: "Start here",
  question: "What can Watchdog tell me?",
  desc: "Pick a question and Watchdog takes you to the tool that answers it.",
};

export const WD_GROUPS: ToolGroup[] = [
  {
    key: "money", label: "Follow the money", tools: [
      { key: "money", href: "/watchdog/money", label: "Money flow", question: "Who is paying for the closest races?", desc: "Where outside money comes from, which groups it funds and which races it lands in." },
      { key: "paid", href: "/watchdog/paid", label: "Who gets paid", question: "Which firms get paid by campaigns?", desc: "The ad makers, media buyers, pollsters and consultants that campaigns and super PACs pay." },
      { key: "connections", href: "/watchdog/connections", label: "Connections", question: "Who is tied to whom?", desc: "A map of every donor, group, candidate and firm, and the money or support that ties them together." },
    ],
  },
  {
    key: "people", label: "Follow the people", tools: [
      { key: "trail", href: "/watchdog/trail", label: "Campaign trail", question: "Who is campaigning where?", desc: "Where Trump, Vance, Obama and other national figures have held rallies and events this fall." },
      { key: "endorsements", href: "/watchdog/endorsements", label: "Endorsements", question: "Who is backing whom?", desc: "Every notable endorsement in the Senate and governor races, each with its source." },
      { key: "media", href: "/watchdog/media", label: "Media watch", question: "Who is talking about which race?", desc: "Which podcasters, hosts and reporters are putting a race in front of their audience." },
      { key: "people", href: "/watchdog/people", label: "People files", question: "What is on file for my candidate?", desc: "A file on every member of Congress, governor and 2026 nominee: who funds them, the decisions on their desk, and the sources." },
    ],
  },
  {
    key: "places", label: "Places", tools: [
      { key: "counties", href: "/watchdog/counties", label: "County data center", question: "What do we know about my county?", desc: "Every county on one map: past results, the 2026 forecast, gas prices, campaign stops and data center fights." },
    ],
  },
];

export const WD_TOOLS: Tool[] = WD_GROUPS.flatMap((g) => g.tools);

/** The tool a path belongs to. Anything unknown under /watchdog falls back to the Desk. */
export function toolFor(path: string): Tool {
  const p = path.replace(/\/+$/, "") || "/watchdog";
  return WD_TOOLS.find((t) => p === t.href || p.startsWith(t.href + "/")) ?? WD_DESK;
}

/** Small line icons, drawn in currentColor so they follow the active state and the theme. */
export function ToolIcon({ k, size = 16 }: { k: ToolKey; size?: number }) {
  const s = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className: "wd-ico" };
  switch (k) {
    case "desk": return <svg {...s}><path d="M4 11l8-6 8 6" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></svg>;
    case "money": return <svg {...s}><path d="M3 7c4 0 4 4 9 4s5-4 9-4" /><path d="M3 13c4 0 4 4 9 4s5-4 9-4" /><path d="M18 4l3 3-3 3" /></svg>;
    case "paid": return <svg {...s}><rect x="3" y="7" width="18" height="12" rx="1.5" /><path d="M8 7V5h8v2" /><path d="M12 11v4M10.5 12.2c0-.7.7-1.2 1.5-1.2s1.5.5 1.5 1.1-.7.9-1.5.9-1.5.4-1.5 1 .7 1.1 1.5 1.1 1.5-.5 1.5-1.2" /></svg>;
    case "connections": return <svg {...s}><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="7" r="2.4" /><circle cx="12" cy="18" r="2.4" /><path d="M8.2 6.4l7.5.5M7.2 8.1l3.7 7.8M16.9 9.1l-3.7 6.8" /></svg>;
    case "trail": return <svg {...s}><path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.2" /></svg>;
    case "endorsements": return <svg {...s}><path d="M7 11l3-7c1.2 0 2 .9 2 2v3h5.2a1.8 1.8 0 0 1 1.8 2.1l-1 6.2A2 2 0 0 1 16 19H7z" /><path d="M3 11h4v8H3z" /></svg>;
    case "media": return <svg {...s}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" /></svg>;
    case "people": return <svg {...s}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><circle cx="12" cy="11" r="2.2" /><path d="M8.5 17c.6-2 2-3 3.5-3s2.9 1 3.5 3" /></svg>;
    case "counties": return <svg {...s}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>;
  }
}
