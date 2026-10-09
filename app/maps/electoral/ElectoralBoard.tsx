"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RATING_BANDS, inkOn, ratingFor,
  type Geo, type Model, type Office, type Race,
} from "@/app/forecast/lib";

const MONO = "var(--font-m)";

/* The scale runs Safe D to Safe R, so index 0 is Safe D and index 7 is Safe R.
   The board is painted with a brush: pick a party, pick a strength, click. A
   unit already held by the brush party steps to that party's next strength
   instead, so repeat clicks walk Safe, Likely and Lean and wrap. */
const SCALE = [...RATING_BANDS].reverse();          // Safe D … Safe R
const SAFE_D = 0, SAFE_R = SCALE.length - 1;
const isDem = (i: number) => SCALE[i].lo < 0;

type Party = "D" | "R";
const STRENGTHS = ["Safe", "Likely", "Lean"] as const;

/* A race inside two points is a toss up on the brand rating ramp, and a toss
   up belongs to neither party, so it is counted separately rather than folded
   into either total. TOSSUP is the index the board stores; the two inner scale
   entries (3 and 4, the toss up band either side of even) only arrive from links
   shared before the ramp changed, and read as a toss up too. The index layout
   is unchanged so every shared link still opens. */
const TOSSUP = 8;
const TOSSUP_BAND = { cat: "Toss up", color: "#e7b341" };
const isToss = (i: number) => i === TOSSUP || i === 3 || i === 4;
const bandAt = (i: number) => (isToss(i) ? TOSSUP_BAND : SCALE[i]);

/* Democratic strengths run 0..3 outward from Safe D; Republican strengths
   mirror them from the far end, so Safe R is 7 and Tilt R is 4. */
const bandIndex = (p: Party, strength: number) => (p === "D" ? strength : SAFE_R - strength);
const partyOf = (i: number): Party => (isDem(i) ? "D" : "R");
const strengthOf = (i: number) => (isDem(i) ? i : SAFE_R - i);

const OFFICES: { key: Office; label: string; total: number; control: number }[] = [
  { key: "governor", label: "Governors", total: 50, control: 26 },
  { key: "senate", label: "Senate", total: 100, control: 51 },
  { key: "house", label: "House", total: 435, control: 218 },
];

/** The forecast's own call for a unit, as the starting position. */
function bandOf(r: Race) {
  if (Math.abs(r.est.margin) < 2) return TOSSUP;
  const cat = ratingFor(r.est.margin).cat;
  const i = SCALE.findIndex((b) => b.cat === cat);
  return i < 0 ? (r.est.margin < 0 ? SAFE_D : SAFE_R) : i;
}

type Board = Record<string, number>;

export default function ElectoralBoard() {
  const [model, setModel] = useState<Model | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [office, setOffice] = useState<Office>("senate");
  const [kind, setKind] = useState<"geo" | "hex">("geo");
  const [board, setBoard] = useState<Board>({});
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [stage, setStage] = useState(false);          // capture mode
  const [party, setParty] = useState<Party | "T">("D");
  const [strength, setStrength] = useState(0);        // 0 Safe … 3 Tilt
  const loadedFromUrl = useRef(false);

  useEffect(() => {
    fetch("/forecast/model.json").then((r) => r.json()).then(setModel).catch(() => {});
    fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {});
  }, []);

  const races = useMemo(
    () => (model ? model.races.filter((r) => r.office === office) : []), [model, office]);

  // start from the forecast, then let a shared URL override it
  useEffect(() => {
    if (!races.length) return;
    const base: Board = {};
    for (const r of races) base[r.id] = bandOf(r);
    if (!loadedFromUrl.current) {
      const q = new URLSearchParams(window.location.search);
      const packed = q.get(office);
      if (packed) {
        const ids = races.map((r) => r.id).sort();
        [...packed].forEach((ch, i) => {
          const v = parseInt(ch, 16);
          if (ids[i] !== undefined && v >= 0 && v <= TOSSUP) base[ids[i]] = v;
        });
      }
    }
    setBoard(base);
  }, [races, office]);

  /* Paint with the brush. A unit the brush party does not already hold flips
     straight to the selected strength; one it does hold advances to the next
     strength, so clicking the same unit cycles Safe → Likely → Lean → Tilt.
     Shift-click walks the cycle backwards. */
  const paint = useCallback((id: string, back = false) => {
    setBoard((b) => {
      if (party === "T") return { ...b, [id]: TOSSUP };
      const cur = b[id];
      if (cur === undefined || isToss(cur) || partyOf(cur) !== party) {
        return { ...b, [id]: bandIndex(party, strength) };
      }
      const step = (strengthOf(cur) + (back ? -1 : 1) + STRENGTHS.length) % STRENGTHS.length;
      return { ...b, [id]: bandIndex(party, step) };
    });
  }, [party, strength]);

  /* Right-click puts one unit back where the forecast had it. */
  const revert = useCallback((id: string) => {
    const r = races.find((x) => x.id === id);
    if (!r) return;
    setBoard((b) => ({ ...b, [id]: bandOf(r) }));
  }, [races]);

  const resetToForecast = useCallback(() => {
    const base: Board = {};
    for (const r of races) base[r.id] = bandOf(r);
    setBoard(base);
    loadedFromUrl.current = true;
    const u = new URL(window.location.href); u.searchParams.delete(office);
    window.history.replaceState({}, "", u);
  }, [races, office]);

  const sweep = useCallback((toDem: boolean) => {
    const b: Board = {};
    for (const r of races) b[r.id] = toDem ? SAFE_D : SAFE_R;
    setBoard(b);
  }, [races]);

  // seat totals, counting the seats not on this year's ballot
  const meta = model?.meta;
  const tally = useMemo(() => {
    let d = 0, g = 0, t = 0;
    for (const r of races) {
      const i = board[r.id] ?? bandOf(r);
      if (isToss(i)) t++; else if (isDem(i)) d++; else g++;
    }
    if (office === "senate" && meta) { d += meta.senNotUpD; g += meta.senNotUpR; }
    if (office === "governor" && meta) { d += meta.govNotUpD; g += meta.govNotUpR; }
    return { d, g, t };
  }, [races, board, office, meta]);

  const cfg = OFFICES.find((o) => o.key === office)!;
  const brushBand = party === "T" ? TOSSUP_BAND : SCALE[bandIndex(party, strength)];

  // keep the URL in step so a scenario can be reloaded or sent to someone
  useEffect(() => {
    if (!races.length || !Object.keys(board).length) return;
    const ids = races.map((r) => r.id).sort();
    const packed = ids.map((id) => (board[id] ?? SAFE_D).toString(16)).join("");
    const u = new URL(window.location.href);
    u.searchParams.set(office, packed);
    window.history.replaceState({}, "", u);
  }, [board, races, office]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "d") setParty("D");
      if (e.key === "r") setParty("R");
      if (e.key === "t") setParty("T");
      if (e.key === "0") resetToForecast();
      if (e.key === "f") setStage((v) => !v);
      if (e.key === "c") setKind((k) => (k === "geo" ? "hex" : "geo"));
      const n = Number(e.key);
      if (n >= 1 && n <= STRENGTHS.length) setStrength(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetToForecast]);

  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);
  const hovered = hover ? byId.get(hover.id) : null;

  if (!model || !geo) {
    return <div className="opp eb-page"><style>{CSS}</style><BoardHeader updated={null} /><div className="card"><div className="empty">Loading the board</div></div></div>;
  }

  const [W, H] = geo.frame;
  const house = office === "house";
  // district shapes arrive as { d, box }; a few carry no path and are skipped
  const units: { id: string; d: string }[] = house
    ? Object.entries(geo.districts)
        .map(([id, v]) => ({ id, d: v?.d ?? "" }))
        .filter((u) => u.d)
    : races.map((r) => ({ id: r.id, d: geo.states[r.st] })).filter((u) => u.d);

  const fillFor = (id: string) => {
    const i = board[id];
    return i === undefined ? "var(--eb-idle)" : bandAt(i).color;
  };

  return (
    <div className={`opp eb-page${stage ? " stage" : ""}`}>
      <style>{CSS}</style>
      <BoardHeader updated={model.meta.updated} />

      <div className="card eb-card">
        <div className="card-h">
          <h3>{cfg.label} scenario</h3>
          <div className="eb-actions">
            <button onClick={() => sweep(true)} className="btn sm">All D</button>
            <button onClick={() => sweep(false)} className="btn sm">All R</button>
            <button onClick={resetToForecast} className="btn sm">Reset to forecast</button>
            <button onClick={() => setStage((v) => !v)} className="btn sm">{stage ? "Show controls" : "Capture mode"}</button>
          </div>
        </div>
        <div className="card-b">

        <p className="eb-lede">
          Pick a party and a strength, then click a {house ? "district" : "state"} to paint it.
          Clicking one the {party === "D" ? "Democrats" : "Republicans"} already hold walks it
          through Safe, Likely and Lean; shift click walks back and right click puts it
          back where the forecast had it. The page URL carries your scenario, so a reload or a
          shared link reopens the same board. Keys: <b>D</b> or <b>R</b> party,
          <b>T</b> toss up, <b>1</b> to <b>3</b> strength, <b>C</b> cartogram, <b>F</b> capture, <b>0</b> reset.
        </p>

        <div className="eb-controls">
          <div className="seg eb-seg" role="tablist" aria-label="Chamber">
            {OFFICES.map((o) => (
              <button key={o.key} role="tab" aria-selected={office === o.key}
                className={office === o.key ? "on" : ""} onClick={() => setOffice(o.key)}>{o.label}</button>
            ))}
          </div>
          <div className="seg eb-seg" role="tablist" aria-label="Map style">
            <button role="tab" aria-selected={kind === "geo"} className={kind === "geo" ? "on" : ""} onClick={() => setKind("geo")}>Map</button>
            <button role="tab" aria-selected={kind === "hex"} className={kind === "hex" ? "on" : ""} onClick={() => setKind("hex")}>Cartogram</button>
          </div>
        </div>

        {/* the brush: which party you are painting, and how strongly */}
        <div className="eb-brush">
          <span className="eb-brush-k">Painting</span>
          <div className="eb-party" role="radiogroup" aria-label="Party">
            {(["D", "R", "T"] as const).map((p) => (
              <button key={p} role="radio" aria-checked={party === p}
                className={`eb-pbtn ${p === "D" ? "d" : p === "R" ? "r" : "t"}${party === p ? " on" : ""}`}
                onClick={() => setParty(p)}>
                {p === "D" ? "Democratic" : p === "R" ? "Republican" : "Toss up"}
              </button>
            ))}
          </div>
          <div className="eb-strengths" role="radiogroup" aria-label="Strength"
               hidden={party === "T"}>
            {party !== "T" && STRENGTHS.map((label, i) => {
              const band = SCALE[bandIndex(party, i)];
              const on = strength === i;
              return (
                <button key={label} role="radio" aria-checked={on}
                  className={`eb-sbtn${on ? " on" : ""}`}
                  onClick={() => setStrength(i)}
                  style={on ? { background: band.color, color: inkOn(band.color), borderColor: band.color } : { borderColor: band.color }}>
                  <i style={{ background: band.color }} />{label}
                </button>
              );
            })}
          </div>
          <span className="eb-brush-now">
            Next click paints{" "}
            <b style={{ background: brushBand.color, color: inkOn(brushBand.color) }}>
              {brushBand.cat}
            </b>
          </span>
        </div>

      {/* the count, sized to read on video */}
        <div className="eb-score">
          <div className="eb-side d">
            <b>{tally.d}</b><span>Democrats</span>
          </div>
          <div className="eb-mid">
            <em>{cfg.control} to control</em>
            <div className="eb-bar">
              <i className="d" style={{ width: `${(tally.d / cfg.total) * 100}%` }} />
              <i className="t" style={{ width: `${(tally.t / cfg.total) * 100}%` }} />
              <i className="r" style={{ width: `${(tally.g / cfg.total) * 100}%` }} />
              <span className="tick" style={{ left: `${(cfg.control / cfg.total) * 100}%` }} />
            </div>
            <em className="win">
              {tally.d >= cfg.control ? "Democratic control"
                : tally.g >= cfg.control ? "Republican control"
                : tally.t > 0 ? `${tally.t} toss ups · neither side at ${cfg.control}`
                : "no majority"}
            </em>
          </div>
          <div className="eb-side r">
            <b>{tally.g}</b><span>Republicans</span>
          </div>
        </div>

      {/* the board */}
      <div className="eb-mapwrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="eb-map" role="img"
             aria-label={`${cfg.label} scenario board`}>
          {kind === "geo" ? (
            <>
              {units.map((u) => (
                <path key={u.id} d={u.d}
                  className={`eb-unit${house ? " cd" : ""}`}
                  fill={fillFor(u.id)}
                  onClick={(e) => paint(u.id, e.shiftKey)}
                  onContextMenu={(e) => { e.preventDefault(); revert(u.id); }}
                  onMouseMove={(e) => setHover({ id: u.id, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)} />
              ))}
            </>
          ) : (
            <>
              {(house ? Object.entries(geo.hexHouse) : Object.entries(geo.hexStates)).map(([key, pt]) => {
                const id = house ? key : (races.find((r) => r.st === key)?.id ?? "");
                if (!id) return null;
                const [cx, cy] = pt as unknown as [number, number];
                const rr = house ? geo.hexHouseR : geo.hexStatesR;
                return (
                  <circle key={key} cx={cx} cy={cy} r={rr * 0.92}
                    className="eb-unit hex"
                    fill={fillFor(id)}
                    onClick={(e) => paint(id, e.shiftKey)}
                    onContextMenu={(e) => { e.preventDefault(); revert(id); }}
                    onMouseMove={(e) => setHover({ id, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHover(null)} />
                );
              })}
            </>
          )}
        </svg>

        {hovered && hover ? (
          <div className="eb-tip" style={{ left: hover.x + 16, top: Math.min(hover.y - 12, (typeof window !== "undefined" ? window.innerHeight : 800) - 120) }}>
            <div className="n">{hovered.name}</div>
            <div className="c">
              <i style={{ background: bandAt(board[hovered.id] ?? bandOf(hovered)).color,
                          color: inkOn(bandAt(board[hovered.id] ?? bandOf(hovered)).color) }}>
                {bandAt(board[hovered.id] ?? bandOf(hovered)).cat}
              </i>
              {board[hovered.id] !== bandOf(hovered)
                ? <em>Moved from {bandAt(bandOf(hovered)).cat}</em>
                : <em>Forecast call</em>}
            </div>
          </div>
        ) : null}
      </div>

        <div className="eb-legend">
          {[...SCALE.map((b, i) => ({ b, i })).filter(({ i }) => !isToss(i)), { b: TOSSUP_BAND, i: TOSSUP }].map(({ b, i }) => {
            const active = i === TOSSUP ? party === "T" : party !== "T" && bandIndex(party, strength) === i;
            return (
              <button key={b.cat} className={`eb-leg${active ? " on" : ""}`}
                title={`Paint ${b.cat}`}
                onClick={() => {
                  if (i === TOSSUP) { setParty("T"); return; }
                  setParty(partyOf(i)); setStrength(strengthOf(i));
                }}>
                <i style={{ background: b.color }} />{b.cat}
                <u>{races.filter((r) => { const v = board[r.id] ?? bandOf(r); return i === TOSSUP ? isToss(v) : v === i; }).length}</u>
              </button>
            );
          })}
        </div>
        <p className="eb-note">
          Starting position is the OnPoint Politics forecast of {model.meta.updated}. Seats not on this
          year&rsquo;s ballot are counted in the totals: {meta?.senNotUpD} Democratic and{" "}
          {meta?.senNotUpR} Republican in the Senate, {meta?.govNotUpD} and {meta?.govNotUpR}{" "}
          among the governors. Moving a unit changes only your scenario, never the forecast.
        </p>
        </div>
      </div>
    </div>
  );
}

function BoardHeader({ updated }: { updated: string | null }) {
  const date = updated ? new Date(updated + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  return (
    <div className="eb-head">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/maps">Maps</Link><span className="sep">/</span><span>Electoral map</span>
      </nav>
      <header className="ph">
        <div className="eye g">Scenario board</div>
        <h1>Build your own <em>map</em></h1>
        <p className="lede">Start from the OnPoint Politics forecast, paint each state or district, and watch the Senate, House or governor count move. Your scenario lives in the page link, ready to share.</p>
        <div className="pmeta">
          {date ? <span>Starting from the forecast of <b>{date}</b></span> : null}
          <span>Three chambers</span>
          <Link className="btn sm" href="/forecast">The forecast</Link>
        </div>
      </header>
    </div>
  );
}

const CSS = `
/* Dark only, on the brand tokens. Capture mode drops the header, prose and
   controls and enlarges the count, which is what a screen recording needs. */
.eb-page { --eb-idle: rgba(var(--line-rgb),.08); color: var(--ink); }
.eb-card { min-width: 0; }
.eb-card .card-h h3 { font-family: var(--font-d); }
.eb-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }

.eb-lede { margin: 0; max-width: 80ch; font-size: 14px; line-height: 1.6; color: var(--ink2); }
.eb-lede b { font-family: ${MONO}; font-size: 12px; color: var(--ink); padding: 1px 5px; border: 1px solid var(--line2); border-radius: 5px; }

.eb-controls { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
.opp .eb-seg { margin-left: 0; }

.eb-brush { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; margin-top: 14px;
  padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r); background: var(--glass); }
.eb-brush-k { font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--mute); }
.eb-party { display: inline-flex; gap: 6px; }
.eb-pbtn { appearance: none; cursor: pointer; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--line2);
  background: transparent; font: 700 12.5px var(--font-b); color: var(--ink2); }
.eb-pbtn:hover { background: var(--glass2); color: var(--hi); }
.eb-pbtn.on { background: var(--hi); border-color: var(--hi); color: var(--bg); }
.eb-pbtn:focus-visible, .eb-sbtn:focus-visible, .eb-leg:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.eb-strengths { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.eb-sbtn { appearance: none; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
  padding: 6px 12px; border-radius: 999px; border: 1.5px solid var(--line2); background: none;
  font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink2); }
.eb-sbtn i { width: 10px; height: 10px; border-radius: 3px; }
.eb-sbtn.on i { display: none; }
.eb-brush-now { margin-left: auto; font-family: ${MONO}; font-size: 10.5px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--mute); }
.eb-brush-now b { padding: 3px 9px; border-radius: 6px; font-weight: 800; letter-spacing: 0.08em; }

.eb-score { display: grid; grid-template-columns: 1fr minmax(220px,2fr) 1fr; align-items: center; gap: clamp(14px,3vw,40px); margin-top: 22px; }
.eb-side { display: flex; flex-direction: column; }
.eb-side.r { text-align: right; }
.eb-side b { font-family: var(--font-d); font-size: clamp(44px,7vw,84px); font-weight: 800; line-height: 0.92; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.eb-side span { margin-top: 6px; font: 700 14px var(--font-b); color: var(--ink2); }
.eb-side.d b { color: var(--dem2); }
.eb-side.r b { color: var(--gop2); }
.eb-mid { text-align: center; }
.eb-mid em { font-style: normal; font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--mute); }
.eb-mid em.win { display: block; margin-top: 9px; color: var(--ink); }
.eb-bar { position: relative; display: flex; height: 14px; margin-top: 10px; border-radius: 99px; overflow: hidden; background: rgba(var(--line-rgb),0.06); }
.eb-bar i { display: block; height: 100%; transition: width 220ms cubic-bezier(0.16,1,0.3,1); }
.eb-bar i.d { background: var(--dem); }
.eb-bar i.t { background: var(--toss); }
.eb-bar i.r { background: var(--gop); margin-left: auto; }
.eb-bar .tick { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--hi); transform: translateX(-50%); }

.eb-mapwrap { position: relative; margin-top: 18px; }
.eb-map { display: block; width: 100%; height: auto; max-height: 72svh; margin: 0 auto; }
.eb-unit { stroke: rgba(var(--canvas-rgb),0.7); stroke-width: 0.8; cursor: pointer; transition: filter .12s ease; }
.eb-unit:hover { filter: brightness(1.25); stroke: var(--hi); }
.eb-unit.cd { stroke-width: 0.45; }
.eb-unit.hex { stroke-width: 1.2; }

.eb-tip { position: fixed; z-index: 80; pointer-events: none; width: 236px; padding: 10px 12px; border-radius: 10px;
  background: rgba(var(--bg2-rgb),.94); border: 1px solid var(--line2); box-shadow: 0 12px 40px rgba(0,0,0,.5); backdrop-filter: blur(10px); }
.eb-tip .n { font: 700 13px var(--font-d); color: var(--hi); }
.eb-tip .c { display: flex; align-items: center; gap: 9px; margin-top: 8px; }
.eb-tip .c i { font-style: normal; padding: 3px 8px; border-radius: 6px; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.eb-tip .c em { font-style: normal; font-size: 11.5px; color: var(--mute); }

.eb-legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; justify-content: center; }
.eb-leg { display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--line); background: var(--glass);
  font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--ink2); }
.eb-leg.on { border-color: var(--hi); color: var(--hi); }
.eb-leg i { width: 11px; height: 11px; border-radius: 3px; }
.eb-leg u { text-decoration: none; color: var(--hi); font-variant-numeric: tabular-nums; }

.eb-note { margin: 18px 0 0; max-width: 80ch; font-size: 12.5px; line-height: 1.65; color: var(--mute); }

/* capture mode: the board and the count, nothing else */
.eb-page.stage .eb-head,
.eb-page.stage .eb-lede,
.eb-page.stage .eb-note { display: none; }
.eb-page.stage .eb-brush { margin-top: 8px; }
.eb-page.stage .eb-map { max-height: 78svh; }
.eb-page.stage .eb-score { margin-top: 10px; }

@media (max-width: 760px) {
  .eb-score { grid-template-columns: 1fr 1fr; gap: 12px; }
  .eb-mid { grid-column: 1 / -1; order: 3; }
  .eb-side b { font-size: 44px; }
  .eb-brush-now { margin-left: 0; }
}
`;
