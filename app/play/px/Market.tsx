"use client";
// The Kalshi line in the game, all in pixels: live prices for the lobby, an LED ticker, the market on your race inside
// the campaign, the real market's price history and a tile map of every race, each drawn on the game's own pixel grid
// from Kalshi's public prices. Kalshi's own widgets play on an old CRT set, run through a mosaic filter so they look
// like part of the game. Prices come from /api/kalshi; when Kalshi does not answer, the game plays on without them.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as E from "../engine";
import { priceFor, type KalshiRace } from "@/app/kalshi";
import { eventChart, forecastMap } from "@/app/kalshiWidgets";
import { grid, line, box, steps, dot } from "./pxdraw";
import { cls, sur } from "./ui";
import { sfx } from "./sound";

export type KxMap = Record<string, KalshiRace | null>;
export type Board = { id: string; st: string; c: [string, string][]; m: number }[];
export const cents = (p: number) => `${Math.round(p * 100)}¢`;
const KX = "#09bc7f", KX2 = "#067a54", INK = "#0b0716", MUTE = "#4a3a80", DIM = "#241848";

/** Live Kalshi prices for a list of race ids. Oct 31 2026: asked for in batches of 20, two at a time, and merged as they
 *  land, so the lobby fills in race by race and no race is dropped from an oversized request. */
export function useKalshi(ids: string[]): KxMap {
  const [m, setM] = useState<KxMap>({});
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return; let live = true;
    const all = key.split(","), B: string[][] = [];
    for (let i = 0; i < all.length; i += 20) B.push(all.slice(i, i + 20));
    const run = async () => { for (let b = B.shift(); b && live; b = B.shift()) { const j = await fetchKalshi(b); if (live && j) setM((o) => ({ ...o, ...j })); } };
    run(); run();
    return () => { live = false; };
  }, [key]);
  return m;
}
/** Prices for a few race ids straight from /api/kalshi, or null if the request fails. */
export async function fetchKalshi(ids: string[]): Promise<KxMap | null> {
  try { const x = await fetch(`/api/kalshi?ids=${encodeURIComponent(ids.join(","))}`); if (!x.ok) return null; const j = await x.json(); return (j?.races as KxMap) ?? null; } catch { return null; }
}
type Hist = { event?: string; sides: { party: string; name: string; price: number; pts: { t: number; p: number }[] }[] };
/** The real market's daily price history for one race. */
export function useKalshiHist(id: string | null): Hist | null {
  const [h, setH] = useState<Hist | null>(null);
  useEffect(() => {
    setH(null); if (!id) return; let live = true;
    fetch(`/api/kalshi/history?id=${encodeURIComponent(id)}&days=60`).then((x) => (x.ok ? x.json() : null)).then((j) => { if (live && j?.sides) setH(j as Hist); }).catch(() => {});
    return () => { live = false; };
  }, [id]);
  return h;
}
/** The price of a candidate in a race, or null. */
export const kxPrice = (k: KalshiRace | null | undefined, c: { name: string; party: string }) => priceFor(k, c.name, c.party);

// ============================================================ a pixel line chart
type Series = { pts: [number, number][]; col: string; thick?: number; stepped?: boolean };
type Ref = { y: number; col: string; label?: string };
/** Points are 0 to 1 on both axes; y is a price. Drawn on a gw by gh grid with labels in the pixel font on top. */
export function PxChart({ series, refs = [], gw = 120, gh = 46, label, tags = [] }: { series: Series[]; refs?: Ref[]; gw?: number; gh?: number; label: string; tags?: { x: number; y: number; t: string; col: string }[] }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const L = 10, R = gw - 3, T = 3, B = gh - 4;
  const X = (x: number) => L + x * (R - L), Y = (y: number) => B - y * (B - T);
  useEffect(() => {
    const g = grid(cv.current, gw, gh); if (!g) return;
    box(g, 0, 0, gw, gh, INK);
    for (let k = 0; k <= 4; k++) line(g, L, Y(k / 4), R, Y(k / 4), k === 2 ? MUTE : DIM, k === 2 ? [2, 2] : [1, 3]);
    for (const r of refs) line(g, L, Y(r.y), R, Y(r.y), r.col, [1, 2]);
    for (const s of series) {
      const P = s.pts.map(([x, y]) => [X(x), Y(y)] as [number, number]);
      if (s.stepped !== false) steps(g, P, s.col, s.thick ?? 1);
      else for (let i = 1; i < P.length; i++) line(g, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], s.col, undefined, s.thick ?? 1);
      const lp = P[P.length - 1]; if (lp) { box(g, lp[0] - 1, lp[1] - 1, 3, 3, s.col); dot(g, lp[0], lp[1], "#fff6e0"); }
    }
  });
  return (
    <div className="px-chart" role="img" aria-label={label}>
      <canvas ref={cv} className="px-pcv" aria-hidden="true" />
      <span className="ax" style={{ top: `${(Y(1) / gh) * 100}%` }}>100</span><span className="ax" style={{ top: `${(Y(0.5) / gh) * 100}%` }}>50</span><span className="ax" style={{ top: `${(Y(0) / gh) * 100}%` }}>0</span>
      {refs.filter((r) => r.label).map((r) => <span key={r.label} className="ref" style={{ top: `${(Y(r.y) / gh) * 100}%`, color: r.col }}>{r.label}</span>)}
      {tags.map((t) => <span key={t.t} className="tag" style={{ left: `${(X(t.x) / gw) * 100}%`, top: `${(Y(t.y) / gh) * 100}%`, color: t.col }}>{t.t}</span>)}
    </div>
  );
}

// ============================================================ the LED ticker
export function LedTicker({ board, kx }: { board: Board; kx: KxMap }) {
  const items = useMemo(() => board.map((b) => {
    const k = kx[b.id]; const a = kxPrice(k, { name: b.c[0][0], party: b.c[0][1] }), z = kxPrice(k, { name: b.c[1][0], party: b.c[1][1] });
    const p0 = a ?? (z == null ? null : 1 - z); if (p0 == null) return null;
    const lead = p0 >= 0.5 ? 0 : 1, pp = lead ? z ?? 1 - p0 : p0;
    const prev = k?.sides.find((x) => sur(x.name).toLowerCase() === sur(b.c[lead][0]).toLowerCase())?.prev ?? null;
    const d = prev != null ? Math.round((pp - prev) * 100) : 0;
    return { k: b.id, t: `${b.st} ${b.id.startsWith("sen") ? "SEN" : "GOV"} ${sur(b.c[lead][0]).toUpperCase()} ${Math.round(pp * 100)}¢`, d, p: (b.c[lead][1] || "D").toLowerCase() };
  }).filter(Boolean) as { k: string; t: string; d: number; p: string }[], [board, kx]);
  if (!items.length) return null;
  const row = items.map((x) => <span key={x.k} className={x.p}>{x.t}{x.d ? <em className={x.d > 0 ? "up" : "dn"}>{x.d > 0 ? "+" : ""}{x.d}</em> : null}</span>);
  return <div className="px-led" role="marquee" aria-label="Kalshi prices on every race"><b>KALSHI</b><div className="run"><div className="tape">{row}{row}</div></div></div>;
}

// ============================================================ every race on a tile map
const TILE: Record<string, [number, number]> = {
  AK: [0, 0], ME: [11, 0], VT: [10, 1], NH: [11, 1], WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], WI: [7, 2], MI: [8, 2], NY: [9, 2], RI: [10, 2], MA: [11, 2],
  OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3], CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
  AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5], OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6], HI: [0, 7], TX: [4, 7], FL: [9, 7],
};
export function KxBoard({ board, kx, office, mine }: { board: Board; kx: KxMap; office: "senate" | "governor"; mine?: string }) {
  const [hov, setHov] = useState<string | null>(null);
  const rows = board.filter((b) => b.id.startsWith(office === "senate" ? "sen-" : "gov-"));
  const by = new Map(rows.map((b) => [b.st, b]));
  const cell = (st: string) => {
    const b = by.get(st); if (!b) return { st, cls: "none", t: "" };
    const k = kx[b.id]; const a = kxPrice(k, { name: b.c[0][0], party: b.c[0][1] }), z = kxPrice(k, { name: b.c[1][0], party: b.c[1][1] });
    const p0 = a ?? (z == null ? null : 1 - z);
    if (p0 == null) return { st, cls: "nomkt", t: "", b };
    const lead = p0 >= 0.5 ? 0 : 1, pp = lead ? z ?? 1 - p0 : p0, party = (b.c[lead][1] || (lead ? "R" : "D")).toLowerCase();
    const tier = pp >= 0.9 ? 3 : pp >= 0.75 ? 2 : pp >= 0.6 ? 1 : 0;
    return { st, cls: tier ? `${party}${tier}` : "tu", t: cents(pp), b, who: b.c[lead][0], pp };
  };
  const cells = Object.keys(TILE).map(cell);
  const h = hov ? cells.find((x) => x.st === hov) : null;
  const tally = cells.reduce((a, x) => { if (x.b && "pp" in x) { const p = x.cls.startsWith("r") ? "R" : x.cls === "tu" ? "T" : "D"; a[p] = (a[p] ?? 0) + 1; } return a; }, {} as Record<string, number>);
  return (
    <div className="px-kxmap">
      <div className="px-tiles" role="img" aria-label={`Kalshi ${office} map`}>
        {cells.map((x) => <button key={x.st} type="button" className={cls("t", x.cls, mine === x.b?.id && "mine", hov === x.st && "on")} style={{ gridColumn: TILE[x.st][0] + 1, gridRow: TILE[x.st][1] + 1 }} onMouseEnter={() => setHov(x.st)} onFocus={() => setHov(x.st)} onClick={() => sfx("tick")} disabled={!x.b}><b>{x.st}</b>{x.t ? <i>{x.t}</i> : null}</button>)}
      </div>
      <div className="px-kxmap-k">
        <span><i className="d2" />Dem or independent favored {tally.D ?? 0}</span><span><i className="tu" />Toss up {tally.T ?? 0}</span><span><i className="r2" />Republican favored {tally.R ?? 0}</span>
        <b>{h && h.b ? ("pp" in h && h.pp != null ? `${h.st}: ${h.who} ${cents(h.pp)} on Kalshi` : `${h.st}: no Kalshi market yet`) : "Point at a state"}</b>
      </div>
    </div>
  );
}

// ============================================================ Kalshi's own widgets on a pixel CRT
/** The mosaic filter: samples the picture every few pixels and blows each sample up into a block, then cuts the
 * colors down to a small palette. It runs on anything, Kalshi's embedded widgets included. */
export function PxFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <filter id="px-mosaic4" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feFlood x="1" y="1" width="2" height="2" /><feComposite width="4" height="4" /><feTile result="a" />
        <feComposite in="SourceGraphic" in2="a" operator="in" /><feMorphology operator="dilate" radius="1" />
        <feComponentTransfer><feFuncR type="discrete" tableValues="0 .2 .45 .7 1" /><feFuncG type="discrete" tableValues="0 .2 .45 .7 1" /><feFuncB type="discrete" tableValues="0 .2 .45 .7 1" /></feComponentTransfer>
      </filter>
      <filter id="px-mosaic2" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feFlood x="0" y="0" width="1" height="1" /><feComposite width="2" height="2" /><feTile result="a" />
        <feComposite in="SourceGraphic" in2="a" operator="in" /><feMorphology operator="dilate" radius="1" />
        <feComponentTransfer><feFuncR type="discrete" tableValues="0 .15 .3 .5 .7 .85 1" /><feFuncG type="discrete" tableValues="0 .15 .3 .5 .7 .85 1" /><feFuncB type="discrete" tableValues="0 .15 .3 .5 .7 .85 1" /></feComponentTransfer>
      </filter>
    </svg>
  );
}
type Mode = "chunky" | "light" | "off";
const MODE_KEY = "opp_play_crt";
export function Crt({ src, title, h, label }: { src: string; title: string; h: number; label: string }) {
  const [mode, setMode] = useState<Mode>("chunky");
  const [on, setOn] = useState(false);
  useEffect(() => { try { const m = localStorage.getItem(MODE_KEY) as Mode | null; if (m) setMode(m); } catch { /* storage blocked */ } }, []);
  const pick = (m: Mode) => { setMode(m); sfx("click"); try { localStorage.setItem(MODE_KEY, m); } catch { /* storage blocked */ } };
  return (
    <div className={cls("px-crt", mode)}>
      <div className="bezel">
        <span className="brand">KALSHI·TV</span>
        <div className="screen" style={{ height: h }}>
          {on ? <iframe src={src} title={title} loading="lazy" referrerPolicy="no-referrer-when-downgrade" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" />
            : <button type="button" className="off" onClick={() => { setOn(true); sfx("whoosh"); }}><b>{label}</b><span>Press to tune in</span></button>}
          <i className="scan" aria-hidden="true" /><i className="glass" aria-hidden="true" />
        </div>
        <div className="knobs" role="group" aria-label="Picture">
          {(["chunky", "light", "off"] as Mode[]).map((m) => <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? "on" : ""} onClick={() => pick(m)}>{m === "chunky" ? "8 BIT" : m === "light" ? "16 BIT" : "HD"}</button>)}
          {on ? <button type="button" onClick={() => { setOn(false); sfx("click"); }}>OFF</button> : null}
        </div>
      </div>
    </div>
  );
}

/** The real market's history for a race, in pixels. */
export function RealMarket({ id, me, op, side }: { id: string; me: { name: string; party: string }; op: { name: string; party: string }; side?: "D" | "R" }) {
  const h = useKalshiHist(id);
  const ser = useMemo(() => {
    if (!h?.sides.length) return null;
    const all = h.sides.flatMap((x) => x.pts.map((p) => p.t)); if (!all.length) return null;
    const t0 = Math.min(...all), t1 = Math.max(...all), span = Math.max(1, t1 - t0);
    const find = (c: { name: string; party: string }) => h.sides.find((x) => x.name && sur(x.name).toLowerCase() === sur(c.name).toLowerCase()) ?? h.sides.find((x) => x.party === c.party);
    const a = find(me), b = find(op);
    const pts = (x: typeof a) => (x?.pts ?? []).map((p) => [(p.t - t0) / span, p.p] as [number, number]);
    return { a, b, pa: pts(a), pb: pts(b), days: Math.round(span / 86400) };
  }, [h, me, op]);
  if (!h) return <div className="px-chart wait"><span>Tuning in to Kalshi…</span></div>;
  if (!ser) return <div className="px-chart wait"><span>No Kalshi price history for this race yet.</span></div>;
  const col = (p: string) => (p === "R" ? "#ff3b5c" : p === "I" ? "#c9a8ff" : "#3d7bff");
  const last = (x: [number, number][]) => x[x.length - 1]?.[1];
  return (
    <PxChart label={`Kalshi price history, last ${ser.days} days`} series={[{ pts: ser.pb, col: col(op.party) }, { pts: ser.pa, col: col(me.party), thick: side ? 1 : 1 }]}
      tags={[ser.pa.length ? { x: 1, y: last(ser.pa)!, t: `${sur(me.name)} ${cents(last(ser.pa)!)}`, col: col(me.party) } : null, ser.pb.length ? { x: 1, y: last(ser.pb)!, t: `${sur(op.name)} ${cents(last(ser.pb)!)}`, col: col(op.party) } : null].filter(Boolean) as { x: number; y: number; t: string; col: string }[]} />
  );
}

/** The Kalshi tab: your line through the campaign, the real market, every race on a map, and Kalshi TV. */
export function MarketPane({ r, s, me, op, office, board, kx }: { r: E.RaceFile; s: E.State; me: E.Cand; op: E.Cand; office: "senate" | "governor"; board: Board; kx: KxMap }) {
  const k = s.mkt;
  const fc = s.side === "R" ? r.est.prob : 1 - r.est.prob;
  const odds = E.winOdds(s);
  const L = Math.max(1, E.lenOf(s));
  return (
    <div className="px-air px-mkt">
      {k ? (() => {
        const pts = k.hist, last = pts[pts.length - 1], wk = pts.length > 1 ? pts[pts.length - 2] : pts[0], d = Math.round((last.p - wk.p) * 100);
        return (
          <>
            <div className="px-mkt-top">
              <div><span className="px-k">Your Kalshi line</span><b className={last.p >= 0.5 ? "up" : "dn"}>{cents(last.p)}</b><small className={d > 0 ? "up" : d < 0 ? "dn" : ""}>{d === 0 ? "flat this week" : `${d > 0 ? "+" : ""}${d} this week`}</small></div>
              <div><span className="px-k">Opened at</span><b>{cents(k.open)}</b><small>live price {k.asOf.slice(5, 10)}</small></div>
              <div><span className="px-k">On Point forecast</span><b>{Math.round(fc * 100)}%</b><small>at the start</small></div>
              <div><span className="px-k">Your read</span><b>{odds ? `${Math.round(odds.p * 100)}%` : "No polls"}</b><small>from your polls</small></div>
            </div>
            <PxChart label={`${me.name}'s Kalshi line by week, now ${cents(last.p)}`} gw={120} gh={44}
              series={[{ pts: pts.map((q) => [q.w / L, q.p] as [number, number]), col: KX, thick: 1 }]}
              refs={[{ y: k.open, col: KX2, label: "open" }]} tags={[{ x: last.w / L, y: last.p, t: cents(last.p), col: KX }]} />
            <p className="px-note">The market trades on the public polls, never your internals. A move of eight cents or more in a week makes news, and now and then a whale moves the line on a single trade. A yes on {me.name} pays a dollar if {me.name} beats {op.name}.</p>
          </>
        );
      })() : <p className="px-note">Kalshi had no price for this race when the campaign began, so there is no market line in this run. Start a new campaign while Kalshi lists the race to trade it.</p>}
      <span className="px-k">The real market, last 60 days</span>
      <RealMarket id={r.id} me={me} op={op} side={s.side} />
      <span className="px-k">Every {office === "governor" ? "governor" : "Senate"} race on Kalshi</span>
      <KxBoard board={board} kx={kx} office={office} mine={r.id} />
      <span className="px-k">Kalshi TV</span>
      <div className="px-crts">
        {k ? <Crt src={eventChart(k.ev)} title={`Kalshi market: ${r.name}`} h={300} label="Live market" /> : null}
        <Crt src={forecastMap(office)} title={`Kalshi ${office} forecast map`} h={360} label={`${office === "governor" ? "Governor" : "Senate"} map`} />
      </div>
    </div>
  );
}
