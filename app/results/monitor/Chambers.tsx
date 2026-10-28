"use client";
// The control panels of the situation monitor: the Senate and House as seat arcs, the governors as a tile map of
// the states, each with the race to a majority and the forecast beside the returns. Every seat or tile is one race.
// Before a race is counted its seat is neutral with a dashed outline in the forecast lean, so expectations never read
// as returns; a counted race shows who leads, a race civicAPI has called fills in solid, and seats not up are rings.
import React from "react";
import { hemiLayout } from "@/app/components/opp/Hemicycle";
import { TILE } from "@/app/components/opp/LegisTiles";
import { leanStroke } from "./paint";
import { STN, fmtM, isInd, sides, type CRace, type XRace } from "../2026/live";

export type SeatState = "nd" | "cd" | "ci" | "ld" | "li" | "aw" | "lr" | "cr" | "nr";
export type Seat = { s: SeatState; pR?: number | null; id?: string; st?: string; label: string };

// governorships not on the ballot this year and the party that holds each
export const GOV_HOLD: Record<string, "D" | "R"> = { DE: "D", NC: "D", WA: "D", NJ: "D", VA: "D", KY: "D", IN: "R", MO: "R", MT: "R", ND: "R", UT: "R", WV: "R", LA: "R", MS: "R" };

export const hasReturns = (c?: CRace) => !!c && (c.pr > 0 || c.c.some((x) => x[2] > 0));
export const liveMargin = (r: XRace, c: CRace | undefined) => { if (!c) return null; const s = sides(r, c.c); return s.t > 0 ? (100 * (s.b - s.a)) / s.t : null; };
export const expM = (r: XRace) => (r.k === "measure" ? (r.yes != null ? 100 - 2 * r.yes : null) : r.m ?? null);
export const raceLabel = (r: XRace, inState: boolean) => (r.k === "house" ? `${r.st}-${r.id.split("-")[2]}` : inState ? r.nm.replace(STN[r.st] + " ", "") : r.nm);

/** One race as one seat: called by civicAPI, leading in the count, not counted yet with its forecast lean. */
export function seatOf(r: XRace, c: CRace | undefined): Seat & Tile {
  const w = c?.c.find((y) => y[4]); const m = liveMargin(r, c); const ind = isInd(r);
  let st: SeatState = "aw", txt = `no votes yet · expected ${fmtM(expM(r), r.k, ind)}`;
  if (w) { const p = w[1].toLowerCase(); st = p.startsWith("rep") ? "cr" : p.startsWith("dem") ? "cd" : "ci"; txt = `civicAPI call: ${w[0]}`; }
  else if (hasReturns(c) && m != null) { st = m < 0 ? (ind ? "li" : "ld") : "lr"; txt = `${fmtM(m, r.k, ind)} with ${c!.pr.toFixed(0)}% in`; }
  const pR = r.pR ?? (r.m != null ? (r.m > 0 ? 0.75 : 0.25) : 0.5);
  return { s: st, pR, id: r.id, st: r.st, label: `${r.k === "house" ? raceLabel(r, false) : r.nm}: ${txt}`, counting: hasReturns(c) && !w };
}

const ORDER: Record<SeatState, number> = { nd: 0, cd: 1, ci: 2, ld: 3, li: 4, aw: 5, lr: 6, cr: 7, nr: 8 };
const sortSeats = (seats: Seat[]) => [...seats].sort((a, b) => ORDER[a.s] - ORDER[b.s] || (a.s === "aw" ? (a.pR ?? 0.5) - (b.pR ?? 0.5) : 0));


export type Count = { dW: number; dL: number; iW: number; iL: number; aw: number; rL: number; rW: number; n: number };
export function countSeats(seats: Seat[]): Count {
  const c: Count = { dW: 0, dL: 0, iW: 0, iL: 0, aw: 0, rL: 0, rW: 0, n: seats.length };
  for (const s of seats) {
    if (s.s === "nd" || s.s === "cd") c.dW++; else if (s.s === "ci") c.iW++; else if (s.s === "ld") c.dL++; else if (s.s === "li") c.iL++;
    else if (s.s === "lr") c.rL++; else if (s.s === "cr" || s.s === "nr") c.rW++; else c.aw++;
  }
  return c;
}

/** Seats on a half disc, Democrats from the left and Republicans from the right, a dashed line at the majority. */
export function SeatArc({ seats, onPick, label }: { seats: Seat[]; onPick?: (s: Seat) => void; label: string }) {
  const sorted = sortSeats(seats);
  const { pts, dot } = hemiLayout(sorted.length);
  const W = 320, R = (W / 2 - 2) / (1 + dot), pad = dot * R + 2, cx = W / 2, cy = R + pad, H = R + pad * 2;
  const r = Math.max(1.1, dot * R);
  return (
    <svg className="mon-arc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line x1={cx} x2={cx} y1={2} y2={cy + 2} className="maj" />
      {sorted.map((s, i) => {
        const p = pts[i]; const x = cx + p.x * R, y = cy - p.y * R;
        const ring = s.s === "nd" || s.s === "nr";
        const lead = s.s === "ld" || s.s === "lr" || s.s === "li";
        const aw = s.s === "aw";
        return (
          <circle key={i} cx={x} cy={y} r={ring ? r * 0.78 : aw ? r * 0.85 : r} className={`st-${s.s}${s.id && onPick ? " pick" : ""}`}
            style={aw ? { stroke: leanStroke(s.pR), strokeDasharray: `${r * 0.55} ${r * 0.4}` } : undefined} strokeWidth={ring ? Math.max(0.8, r * 0.36) : lead || aw ? Math.max(0.7, r * 0.3) : 0}
            onClick={s.id && onPick ? () => onPick(s) : undefined}>
            <title>{s.label}</title>
          </circle>
        );
      })}
    </svg>
  );
}

/** The race to a majority: seats held or won, seats leading, seats not yet counted, from each end. */
export function MajorityBar({ c, maj, majLabel }: { c: Count; maj: number; majLabel: string }) {
  const N = c.n || 1, pc = (v: number) => `${(100 * v) / N}%`;
  return (
    <div className="mon-mb" aria-hidden="true">
      <div className="bar">
        <i className="d" style={{ width: pc(c.dW) }} /><i className="d lead" style={{ width: pc(c.dL) }} />
        <i className="ind" style={{ width: pc(c.iW) }} /><i className="ind lead" style={{ width: pc(c.iL) }} />
        <span className="gap" />
        <i className="r lead" style={{ width: pc(c.rL) }} /><i className="r" style={{ width: pc(c.rW) }} />
        <span className="tick" style={{ left: pc(maj) }} />
      </div>
      <div className="lab" style={{ paddingLeft: `calc(${pc(maj)} - 22px)` }}>{majLabel}</div>
    </div>
  );
}

export type Tile = { st: string; s: SeatState; pR?: number | null; id?: string; label: string; counting?: boolean };

/** The governors on a tile map: one square per state, the race's state colour, rings where no race is held this year. */
export function GovTiles({ tiles, onPick }: { tiles: Tile[]; onPick?: (t: Tile) => void }) {
  const by = new Map(tiles.map((t) => [t.st, t]));
  const S = 26, G = 3;
  return (
    <svg className="mon-tiles" viewBox={`0 0 ${12 * (S + G)} ${8 * (S + G)}`} role="img" aria-label="Governor races by state">
      {Object.entries(TILE).map(([st, [cx, cy]]) => {
        const t = by.get(st); if (!t) return null;
        const x = cx * (S + G), y = cy * (S + G);
        const ring = t.s === "nd" || t.s === "nr";
        return (
          <g key={st} className={`tile st-${t.s}${t.id && onPick ? " pick" : ""}`} onClick={t.id && onPick ? () => onPick(t) : undefined}>
            <title>{t.label}</title>
            <rect x={x + (ring ? 1 : 0)} y={y + (ring ? 1 : 0)} width={S - (ring ? 2 : 0)} height={S - (ring ? 2 : 0)} rx={5}
              style={t.s === "aw" ? { stroke: leanStroke(t.pR), strokeDasharray: "3 2.5" } : undefined} strokeWidth={ring ? 1.6 : t.s === "aw" ? 1.6 : t.s === "ld" || t.s === "lr" || t.s === "li" ? 1.4 : 0} />
            <text x={x + S / 2} y={y + S / 2 + 0.5}>{st}</text>
            {t.counting ? <circle className="cnt" cx={x + S - 5} cy={y + 5} r={2.2} /> : null}
          </g>
        );
      })}
    </svg>
  );
}

/** The key under every panel. */
export function SeatKey() {
  return (
    <div className="mon-key">
      <span><i className="k-w" />Won</span><span><i className="k-l" />Leading</span><span><i className="k-a" />No votes yet, dashed in expected lean</span><span><i className="k-n" />Not up</span>
    </div>
  );
}
