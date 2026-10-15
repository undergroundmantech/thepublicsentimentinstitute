"use client";

import React, { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { DEM, GOP, fmtMargin, partyColor, surname } from "./lib";

export const TIP_CSS = `\n.fc-tip-odds { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-top: 9px; padding-top: 8px; border-top: 1px solid rgba(var(--fc-line-rgb),0.08); font-size: 12.5px; }\n.fc-tip-odds span { width: 100%; font-family: var(--font-m); font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(var(--fc-ink-rgb),calc(0.4 * var(--fc-mute) + var(--fc-floor))); }\n.fc-tip-odds b { font-family: var(--font-m); font-weight: 700; font-variant-numeric: tabular-nums; }\n.fc-tip-kv { display: flex; justify-content: space-between; gap: 12px; margin-top: 5px; font-size: 12px; color: rgba(var(--fc-ink-rgb),calc(0.55 * var(--fc-mute) + var(--fc-floor))); }\n.fc-tip-kv:first-of-type { margin-top: 9px; }\n.fc-tip-kv b { color: var(--hi); font-family: var(--font-m); font-weight: 700; font-variant-numeric: tabular-nums; }\n`;

// Shared tooltip pieces for every forecast map: the national map, the race stage
// and the county atlas all print the same card, so a county reads the same
// wherever the reader hovers it.

export const commas = (n: number) => Math.round(n).toLocaleString("en-US");

const noop = () => () => undefined;
export function TipPortal({ children }: { children: React.ReactNode }) {
  // client only: the server renders nothing and the browser portals into the body
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}

// Surnames alone are the right label right up until two people on the same ballot
// share one. Alaska's Senate race runs Dan S. Sullivan against Dan J. Sullivan, and
// Oregon's runs two Smiths; printing "Sullivan" twice in a county tooltip is worse
// than printing nothing. Where a surname repeats, those candidates get their full
// name and everyone else keeps the short one.
export function ballotLabels(cands: { name: string }[]): string[] {
  const short = cands.map((c) => surname(c.name));
  const seen = new Map<string, number>();
  for (const s of short) seen.set(s, (seen.get(s) ?? 0) + 1);
  return short.map((s, i) => ((seen.get(s) ?? 0) > 1 ? cands[i].name : s));
}
export const shareOf = (v: number, t: number) => (t > 0 ? `${((v / t) * 100).toFixed(1)}%` : "\u2014");

// One tooltip shape for both layers: who, how many votes, what share, and the margin
// underneath. Counts are the point — a shade alone never told anyone the size of a place.
export function VoteTip({ title, sub, demName, gopName, demColor = DEM, dem, rep, total, margin, foot, x, y, cands, odds, rows }: {
  title: string; sub?: string; demName: string; gopName: string; demColor?: string;
  dem: number; rep: number; total: number; margin: number; foot?: string; x: number; y: number;
  // win odds for each side, printed under the vote rows on statewide and district tips
  odds?: { dem: number; gop: number };
  // extra label and value lines, such as the county layer under the cursor in the atlas
  rows?: [string, string][];
  // when the race runs more than two names, the county's whole ballot rather than
  // a Democrat, a Republican and an undifferentiated "other"
  cands?: { name: string; party: string; pct: number }[];
}) {
  const flip = typeof window !== "undefined" && x > window.innerWidth - 350;
  const yc = typeof window !== "undefined" ? Math.min(y, window.innerHeight - 200) : y;
  return (
    <TipPortal>
    <div className="fc-tip wide" style={{ left: x + (flip ? -320 : 18), top: yc - 14 }}>
      <div className="fc-tip-name">{title}</div>
      {sub ? <div className="fc-tip-sub">{sub}</div> : null}
      {cands && cands.length > 2
        ? ballotLabels(cands).map((label, i) => { const c = cands[i]; return (
            <div key={`${c.name}-${i}`} className="fc-tip-vote">
              <i style={{ background: partyColor(c.party) }} />
              <b>{label}</b>
              <span>{commas(Math.round(total * c.pct / 100))}</span>
              <em>{c.pct.toFixed(1)}%</em>
            </div>
          ); })
        : (<>
            <div className="fc-tip-vote"><i style={{ background: demColor }} /><b>{demName}</b><span>{commas(dem)}</span><em>{shareOf(dem, total)}</em></div>
            <div className="fc-tip-vote"><i style={{ background: GOP }} /><b>{gopName}</b><span>{commas(rep)}</span><em>{shareOf(rep, total)}</em></div>
            {total > 0 && (total - dem - rep) / total >= 0.0005
              ? <div className="fc-tip-vote"><i style={{ background: "rgba(var(--fc-ink-rgb),calc(0.3 * var(--fc-mute) + var(--fc-floor)))" }} /><b>Other candidates</b><span>{commas(total - dem - rep)}</span><em>{shareOf(total - dem - rep, total)}</em></div>
              : null}
          </>)}
      <div className="fc-tip-vote total"><i /><b>Total votes</b><span>{commas(total)}</span><em style={{ color: margin > 0 ? "var(--fc-gop)" : "var(--fc-dem)" }}>{fmtMargin(margin)}</em></div>
      {odds ? (
        <div className="fc-tip-odds">
          <span>Odds to win</span>
          <b style={{ color: demColor }}>{demName} {Math.round(odds.dem * 100)}%</b>
          <b style={{ color: GOP }}>{gopName} {Math.round(odds.gop * 100)}%</b>
        </div>
      ) : null}
      {rows?.length ? rows.map(([k, v]) => <div key={k} className="fc-tip-kv"><span>{k}</span><b>{v}</b></div>) : null}
      {foot ? <div className="fc-tip-foot">{foot}</div> : null}
    </div>
    </TipPortal>
  );
}

