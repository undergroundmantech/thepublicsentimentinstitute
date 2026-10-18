"use client";

// Early vote against past years: is 2026 running ahead of or behind 2022 and 2024 at the same number of days before
// Election Day, and how much of a past year's whole vote is already in. Baselines come from
// public/earlyvote-history.json, built by scripts/earlyvote/build_history.py from state counts reported during early
// voting in 2022 and 2024, final turnout and the EAC's count of ballots cast by mail and early in person.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { STATE_NAME, commas, compact, sumRow, type CategoryPayload, type RegionRow } from "./lib";

type Yr = "2022" | "2024";
type Cp = [number, number] | [number, number, "r"];
type HYear = {
  turnout: number | null; early: number | null; earlyBasis: "reported" | "eavs" | null;
  mail?: number; inperson?: number; cps?: Cp[]; evStart?: number; party?: [number, number, number][]; src?: string[];
};
type History = { meta: { electionDay: Record<string, string> }; us: Record<Yr, HYear>; states: Record<string, Record<Yr, HYear>> };

let histP: Promise<History | null> | null = null;
const getHistory = () => (histP ??= fetch("/earlyvote-history.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));

const ELECTION_2026 = Date.UTC(2026, 10, 3);
export const daysOutOf = (snap?: string | null) => {
  if (!snap) return null;
  const t = Date.parse(`${snap.slice(0, 10)}T00:00:00Z`);
  return isFinite(t) ? Math.max(0, Math.round((ELECTION_2026 - t) / 864e5)) : null;
};

type At = { n: number; how: "exact" | "between" | "final"; span: number; rounded: boolean };
/** Ballots cast before Election Day by a given number of days out: a reported count on that day, or between the two
 *  nearest reported counts on a steady growth rate, or the last count once early voting has ended. */
export function atDay(cps: Cp[] | undefined, d: number): At | null {
  if (!cps?.length) return null;
  const c = [...cps].sort((a, b) => b[0] - a[0]);
  const ex = c.find((x) => x[0] === d);
  if (ex) return { n: ex[1], how: "exact", span: 0, rounded: ex.length > 2 };
  if (d > c[0][0]) return null;
  const last = c[c.length - 1];
  if (d < last[0]) return last[0] <= 4 ? { n: last[1], how: "final", span: last[0] - d, rounded: last.length > 2 } : null;
  for (let i = 0; i < c.length - 1; i++) {
    const [d1, n1] = c[i], [d2, n2] = c[i + 1];
    if (d1 > d && d > d2) {
      const t = (d1 - d) / (d1 - d2);
      const n = n1 > 0 && n2 > 0 ? n1 * Math.pow(n2 / n1, t) : n1 + (n2 - n1) * t;
      return { n, how: "between", span: d1 - d2, rounded: c[i].length > 2 || c[i + 1].length > 2 };
    }
  }
  return null;
}

type Tone = "up2" | "up" | "even" | "down" | "down2";
export function verdict(r: number): { word: string; tone: Tone } {
  if (r >= 1.25) return { word: "Well ahead", tone: "up2" };
  if (r >= 1.05) return { word: "Ahead", tone: "up" };
  if (r > 0.95) return { word: "On pace", tone: "even" };
  if (r > 0.75) return { word: "Behind", tone: "down" };
  return { word: "Well behind", tone: "down2" };
}
const chg = (r: number) => { const p = Math.round((r - 1) * 100); return p === 0 ? "even" : `${p > 0 ? "+" : "−"}${Math.abs(p)}%`; };
const moreFewer = (r: number) => {
  const p = Math.round(Math.abs(r - 1) * 100);
  return p === 0 ? "about the same number of ballots as" : `${p}% ${r > 1 ? "more ballots than" : "fewer ballots than"}`;
};
const vsWord = (w: string, y: string) => (w === "On pace" ? `On pace with ${y}` : w === "Behind" || w === "Well behind" ? `${w} ${y}` : `${w} of ${y}`);
const sharePct = (x: number) => (x < 0.095 ? `${(x * 100).toFixed(1)}%` : `${Math.round(x * 100)}%`);
const NUMWORD = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const daysWord = (d: number) => (d === 0 ? "On Election Day" : d === 1 ? "With one day to go" : `With ${d <= 20 ? NUMWORD[d] : d} days to go`);
const lead = (dd: number, rr: number) => { const m = (dd - rr) * 100; return Math.abs(m) < 0.5 ? "even" : `${m > 0 ? "D" : "R"}+${Math.abs(m).toFixed(0)}`; };

type Row = {
  st: string; name: string; now: number; hasMail: boolean; hasIn: boolean; partial: string | null;
  at: Partial<Record<Yr, At | null>>; ratio: Partial<Record<Yr, number | null>>; usable: Partial<Record<Yr, boolean>>;
  h: Record<Yr, HYear> | null; partyNow: { d: number; r: number } | null;
};

function buildRow(st: string, ret: RegionRow | undefined, inp: RegionRow | undefined, d: number, H: History): Row {
  const h = H.states[st] ?? null;
  const now = sumRow(ret) + sumRow(inp);
  const hasMail = sumRow(ret) > 0, hasIn = sumRow(inp) > 0;
  // A state whose feed is missing a way of voting it relies on would read as far behind when it is not.
  let partial: string | null = null;
  const h22 = h?.["2022"];
  if (h22 && h22.mail != null && h22.inperson != null) {
    const pre = h22.mail + h22.inperson;
    const mailSh = pre > 0 ? h22.mail / pre : 0;
    if (!hasMail && mailSh > 0.15) partial = "no mail ballots reported yet";
    else if (!hasIn && 1 - mailSh > 0.15 && (h22.evStart ?? 0) > d + 1) partial = "no in person ballots reported yet";
  }
  const at: Row["at"] = {}, ratio: Row["ratio"] = {}, usable: Row["usable"] = {};
  for (const y of ["2022", "2024"] as Yr[]) {
    const a = h ? atDay(h[y]?.cps, d) : null;
    at[y] = a;
    ratio[y] = a && a.n > 0 && now > 0 ? now / a.n : null;
    usable[y] = !!a && !partial && (a.how !== "between" || a.span <= 8);
  }
  let pd = 0, pr = 0, pu = 0;
  for (const row of [ret, inp]) for (const [g, b] of Object.entries(row ?? {})) {
    const v = b?.votes ?? 0;
    if (g === "Democratic") pd += v; else if (g === "Republican") pr += v; else if (g === "Unspecified") pu += v;
  }
  const partyNow = now > 0 && pu / now < 0.1 && pd + pr > 0 ? { d: pd / now, r: pr / now } : null;
  return { st, name: STATE_NAME[st] ?? st, now, hasMail, hasIn, partial, at, ratio, usable, h, partyNow };
}

/* ── the pace chart: cumulative ballots by days out, past years as lines, 2026 as today's point ── */
function PaceChart({ h, d, now }: { h: Record<Yr, HYear>; d: number; now: number }) {
  // the drawing is sized to its box, so labels stay the same size on a phone and on a wide screen
  const box = useRef<HTMLDivElement | null>(null);
  const [bw, setBw] = useState(860);
  useEffect(() => {
    const el = box.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setBw(Math.round(e.contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const W = Math.max(300, Math.min(860, bw || 860)), H = W < 520 ? 230 : 290, L = 46, R = 16, T = 20, B = 34;
  const c22 = [...(h["2022"].cps ?? [])].sort((a, b) => b[0] - a[0]);
  const c24 = [...(h["2024"].cps ?? [])].sort((a, b) => b[0] - a[0]);
  const first = Math.max(d + 3, ...[c22[0]?.[0] ?? 0, c24[0]?.[0] ?? 0].map((x) => Math.min(x, 35)), 21);
  const ymax = Math.max(now, ...c22.map((c) => c[1]), ...c24.map((c) => c[1])) * 1.08 || 1;
  const x = (dd: number) => L + ((first - dd) / first) * (W - L - R);
  const y = (n: number) => T + (1 - n / ymax) * (H - T - B);
  const path = (c: Cp[]) => c.filter((p) => p[0] <= first).map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const step = ymax > 4e6 ? 1e6 : ymax > 2e6 ? 5e5 : ymax > 8e5 ? 2e5 : ymax > 4e5 ? 1e5 : ymax > 1.5e5 ? 5e4 : 2e4;
  const yt: number[] = []; for (let v = 0; v <= ymax; v += step) yt.push(v);
  const xt: number[] = []; for (let v = Math.floor(first / 7) * 7; v >= 0; v -= 7) xt.push(v);
  const xl = (v: number) => (v === 0 ? (W < 520 ? "Elec. Day" : "Election Day") : W < 520 ? `${v}d out` : `${v} days out`);
  const lastOf = (c: Cp[]) => c[c.length - 1];
  return (
    <div ref={box} className="pc-chartbox"><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="pc-chart" role="img" aria-label="Ballots cast before Election Day by days out, 2022, 2024 and 2026">
      {yt.map((v) => (
        <g key={`y${v}`}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="pc-grid" />
          <text x={L - 8} y={y(v)} dy="0.32em" textAnchor="end" className="pc-tick">{v === 0 ? "0" : compact(v)}</text>
        </g>
      ))}
      {xt.map((v) => (
        <text key={`x${v}`} x={x(v)} y={H - B + 18} textAnchor={v === 0 ? "end" : "middle"} className="pc-tick">{xl(v)}</text>
      ))}
      <line x1={x(d)} x2={x(d)} y1={T - 6} y2={H - B} className="pc-today" />
      {c22.length ? <path d={path(c22)} className="pc-l22" /> : null}
      {c24.length ? <path d={path(c24)} className="pc-l24" /> : null}
      {c22.filter((p) => p[0] <= first).map((p) => <circle key={`a${p[0]}`} cx={x(p[0])} cy={y(p[1])} r={3} className={`pc-d22${p.length > 2 ? " rnd" : ""}`} />)}
      {c24.filter((p) => p[0] <= first).map((p) => <circle key={`b${p[0]}`} cx={x(p[0])} cy={y(p[1])} r={3} className={`pc-d24${p.length > 2 ? " rnd" : ""}`} />)}
      {c22.length ? <text x={x(lastOf(c22)[0]) - 6} y={y(lastOf(c22)[1])} dy="-0.6em" textAnchor="end" className="pc-lab l22">2022</text> : null}
      {c24.length ? <text x={x(lastOf(c24)[0]) - 6} y={y(lastOf(c24)[1])} dy="-0.6em" textAnchor="end" className="pc-lab l24">2024</text> : null}
      {now > 0 ? <>
        <circle cx={x(d)} cy={y(now)} r={7} className="pc-now" />
        <text x={x(d) + (x(d) > W * 0.7 ? -12 : 12)} y={y(now)} dy="0.32em" textAnchor={x(d) > W * 0.7 ? "end" : "start"} className="pc-lab now">2026 · {compact(now)}</text>
      </> : null}
    </svg></div>
  );
}

/* ── one share bar: ballots in, against a past year's whole vote, with where its early vote ended ── */
function ShareBar({ now, y }: { now: number; y: HYear }) {
  if (!y.turnout) return <span className="pc-na">no baseline</span>;
  const f = Math.min(1, now / y.turnout);
  const e = y.early ? Math.min(1, y.early / y.turnout) : null;
  return (
    <span className="pc-share" title={e !== null ? `${sharePct(f)} of the total vote is in. ${sharePct(e)} voted early by Election Day.` : undefined}>
      <span className="bar"><i style={{ width: `${f * 100}%` }} />{e !== null ? <u style={{ left: `${e * 100}%` }} /> : null}</span>
      <b>{sharePct(f)}</b>
    </span>
  );
}

export default function PaceCompare({ scope, ret, inp, snapshot, onOpen }: {
  scope: string; ret: CategoryPayload | null | undefined; inp: CategoryPayload | null | undefined; snapshot?: string | null;
  onOpen: (st: string) => void;
}) {
  const [H, setH] = useState<History | null>(null);
  const [yr, setYr] = useState<Yr>("2022");
  useEffect(() => { getHistory().then(setH); }, []);
  const d = daysOutOf(snapshot ?? ret?.snapshot_date ?? inp?.snapshot_date);
  const rows = useMemo(() => {
    if (!H || d === null) return [];
    const sts = new Set([...Object.keys(ret?.regions ?? {}), ...Object.keys(inp?.regions ?? {})]);
    return [...sts].filter((s) => STATE_NAME[s]).map((s) => buildRow(s, ret?.regions[s], inp?.regions[s], d, H));
  }, [H, d, ret, inp]);
  if (!H || d === null || !rows.length) return null;
  return scope === "US"
    ? <NationalPace rows={rows} d={d} yr={yr} setYr={setYr} onOpen={onOpen} />
    : <StatePace row={rows.find((r) => r.st === scope) ?? null} st={scope} d={d} yr={yr} />;
}

function YearSeg({ yr, setYr }: { yr: Yr; setYr: (y: Yr) => void }) {
  return (
    <div className="ev-seg pc-seg" role="tablist" aria-label="Compare with">
      <button role="tab" aria-selected={yr === "2022"} className={yr === "2022" ? "on" : ""} onClick={() => setYr("2022")}>vs 2022 midterm</button>
      <button role="tab" aria-selected={yr === "2024"} className={yr === "2024" ? "on" : ""} onClick={() => setYr("2024")}>vs 2024 presidential</button>
    </div>
  );
}

function aggOf(rows: Row[], y: Yr) {
  const use = rows.filter((r) => r.usable[y] && r.ratio[y]);
  const now = use.reduce((a, r) => a + r.now, 0), then = use.reduce((a, r) => a + (r.at[y]?.n ?? 0), 0);
  return { n: use.length, now, then, r: then > 0 ? now / then : null };
}

function NationalPace({ rows, d, yr, setYr, onOpen }: { rows: Row[]; d: number; yr: Yr; setYr: (y: Yr) => void; onOpen: (st: string) => void }) {
  const a22 = aggOf(rows, "2022"), a24 = aggOf(rows, "2024");
  const a = yr === "2022" ? a22 : a24;
  const sorted = [...rows].sort((x, y) => {
    const rx = x.usable[yr] ? x.ratio[yr] ?? -1 : -1, ry = y.usable[yr] ? y.ratio[yr] ?? -1 : -1;
    return ry - rx || y.now - x.now;
  });
  const ahead = rows.filter((r) => r.usable[yr] && (r.ratio[yr] ?? 0) >= 1.05).length;
  const behind = rows.filter((r) => r.usable[yr] && (r.ratio[yr] ?? 9) <= 0.95).length;
  const tot = rows.reduce((s, r) => s + r.now, 0);
  return (
    <section className="pc" aria-label="Early vote compared with 2022 and 2024">
      <div className="pc-head">
        <div>
          <div className="eye">The short version</div>
          <h2 className="pc-h2">Is early voting running ahead of past years?</h2>
        </div>
        <YearSeg yr={yr} setYr={setYr} />
      </div>
      <p className="pc-lede">
        {daysWord(d)}, {commas(tot)} ballots have been cast in the {rows.length} states reporting.
        {a22.r !== null ? <> In the {a22.n} states that also posted counts at this point in 2022, that is <b>{moreFewer(a22.r)}</b> back then.</> : null}
        {a24.r !== null ? <> In the {a24.n} states with counts at this point in 2024, it is <b>{moreFewer(a24.r)}</b> in 2024.</> : null}
      </p>
      <div className="pc-tiles">
        {([["2022", a22, "Last midterm, the closest match for 2026"], ["2024", a24, "Presidential year, when far more people vote"]] as const).map(([y, x, sub]) => (
          <button key={y} className={`pc-tile${yr === y ? " on" : ""}`} onClick={() => setYr(y)} aria-pressed={yr === y}>
            <em>Same day in {y}</em>
            {x.r !== null ? <b className={`t-${verdict(x.r).tone}`}>{chg(x.r)}</b> : <b className="t-even">no match</b>}
            <small>{x.r !== null ? `${compact(x.now)} now against ${compact(x.then)} then, in ${x.n} states` : "no state published counts this early"}</small>
            <small className="sub">{sub}</small>
          </button>
        ))}
        <div className="pc-tile static">
          <em>Against {yr}</em>
          <b className="t-even">{ahead} ahead · {behind} behind</b>
          <small>states more than 5% above or below their {yr} pace</small>
        </div>
      </div>

      <div className="pc-table" role="table" aria-label={`Early vote by state against ${yr}`}>
        <div className="pc-tr th" role="row">
          <span role="columnheader">State</span>
          <span role="columnheader" className="num">Cast so far</span>
          <span role="columnheader" className="num">Same day {yr}</span>
          <span role="columnheader">Pace against {yr}</span>
          <span role="columnheader">Share of {yr} total vote in</span>
        </div>
        {sorted.map((r) => {
          const at = r.at[yr], ra = r.ratio[yr], ok = r.usable[yr] && ra != null;
          const v = ok ? verdict(ra!) : null;
          const w = ok ? Math.max(-1, Math.min(1, (ra! - 1) / 0.6)) : 0;
          return (
            <button key={r.st} className="pc-tr" role="row" onClick={() => onOpen(r.st)}>
              <span className="nm" role="cell">{r.name}</span>
              <span className="num" role="cell">{commas(r.now)}</span>
              <span className="num mute" role="cell">{at ? `${at.how === "exact" && !at.rounded ? "" : "about "}${compact(at.n)}` : "not published"}</span>
              <span className="pace" role="cell">
                {ok ? <>
                  <span className="div" aria-hidden><span className="mid" /><i className={`t-${v!.tone}`} style={w >= 0 ? { left: "50%", width: `${w * 50}%` } : { right: "50%", width: `${-w * 50}%` }} /></span>
                  <span className={`pc-chip t-${v!.tone}`}>{v!.word} <b>{chg(ra!)}</b></span>
                </> : <span className="pc-na">{r.partial ? r.partial
                  : r.h?.[yr].early ? <>already <b>{sharePct(r.now / r.h[yr].early!)}</b> of {yr}&apos;s whole early vote</>
                  : "no count this early"}</span>}
              </span>
              <span className="sh" role="cell"><em className="mlab">Share of the {yr} total vote already in</em>{r.h ? <ShareBar now={r.now} y={r.h[yr]} /> : <span className="pc-na">no baseline</span>}</span>
            </button>
          );
        })}
      </div>
      <p className="pc-foot">
        The white tick on each share bar marks how much of that year&apos;s whole vote had been cast early by Election Day.
        Pace compares ballots cast before Election Day, mail and early in person together, on the same number of days before the election. Election Day is
        always a Tuesday, so it is the same day of the week. Click a state for its chart.
      </p>
      <HowToRead yr={yr} />
    </section>
  );
}

function HowToRead({ yr }: { yr: Yr }) {
  return (
    <details className="pc-how">
      <summary>How to read this, in plain terms</summary>
      <ul>
        <li><b>Ahead does not mean winning.</b> More early ballots can mean more people voting, or the same people voting earlier. Since 2020 many voters,
          Republicans especially, have moved from Election Day to early voting, so a big early vote can shrink Election Day without growing the total.</li>
        <li><b>2022 is the fair comparison.</b> It was the last midterm, with no president on the ballot, like 2026. 2024 drew far more voters, so most states will trail it.</li>
        <li><b>Rules change.</b> Some states added, lengthened or shortened early voting since {yr}, which moves the pace without saying anything about enthusiasm.</li>
        <li><b>Party is registration, not vote.</b> Where a state reports party, it is the party voters registered with. Independents and crossover voters decide close races.</li>
        <li><b>Counts are what states have posted.</b> A state that is slow to count mail ballots can look behind for a day or two. Past counts marked about were
          rounded by their source or fall between two reported days.</li>
      </ul>
    </details>
  );
}

function StatePace({ row, st, d, yr }: { row: Row | null; st: string; d: number; yr: Yr }) {
  const name = STATE_NAME[st] ?? st;
  if (!row || !row.h) return null;
  const h = row.h;
  const main: Yr = row.usable["2022"] ? "2022" : row.usable["2024"] ? "2024" : yr;
  const r22 = row.usable["2022"] ? row.ratio["2022"] ?? null : null, r24 = row.usable["2024"] ? row.ratio["2024"] ?? null : null;
  const rm = main === "2022" ? r22 : r24;
  const v = rm !== null ? verdict(rm) : null;
  const head = row.partial ? `${name} has ${row.partial}`
    : v ? `${name} is ${v.word === "On pace" ? "on pace with" : v.word.toLowerCase() === "well ahead" ? "well ahead of" : v.word.toLowerCase() === "ahead" ? "ahead of" : v.word.toLowerCase() === "behind" ? "behind" : "well behind"} its ${main} pace`
    : `${name} early vote against past years`;
  const sentence = (y: Yr) => {
    const at = row.at[y]; const ra = row.ratio[y];
    if (!at || !row.usable[y] || ra == null) return null;
    return <>At this point in {y}, {at.how === "exact" && !at.rounded ? commas(at.n) : `about ${compact(at.n)}`} had voted, so 2026 has <b>{moreFewer(ra)}</b> {y}. </>;
  };
  const sh = (y: Yr) => (h[y].turnout ? row.now / h[y].turnout! : null);
  const ee = (y: Yr) => (h[y].early && h[y].turnout ? h[y].early! / h[y].turnout! : null);
  const ofEarly = (y: Yr) => (h[y].early ? row.now / h[y].early! : null);
  const partyAt = (y: Yr) => {
    const p = h[y].party; if (!p?.length) return null;
    const same = p.find((x) => Math.abs(x[0] - d) <= 2);
    const fin = [...p].sort((a, b) => a[0] - b[0])[0];
    return { same, fin };
  };
  const hasChart = !!(h["2022"].cps?.length || h["2024"].cps?.length);
  return (
    <section className="pc" aria-label={`${name} early vote compared with 2022 and 2024`}>
      <div className="pc-head">
        <div>
          <div className="eye">The short version</div>
          <h2 className="pc-h2">{head}</h2>
        </div>
      </div>
      <p className="pc-lede">
        {daysWord(d)}, <b>{commas(row.now)}</b> {name} voters have cast a ballot by mail or in person.{" "}
        {sentence("2022")}{sentence("2024")}
        {!row.usable["2022"] && !row.usable["2024"] && ofEarly("2022") !== null
          ? <>{name} did not publish counts we can match to this day in past years. So far 2026 has reached <b>{sharePct(ofEarly("2022")!)}</b> of
            the {compact(h["2022"].early!)} ballots cast early in all of 2022{ofEarly("2024") !== null ? <> and {sharePct(ofEarly("2024")!)} of 2024&apos;s {compact(h["2024"].early!)}</> : null}.</> : null}
        {row.partial ? <> The feed for {name} has {row.partial}, so these numbers undercount and are not compared.</> : null}
      </p>
      <div className="pc-tiles">
        {(["2022", "2024"] as Yr[]).map((y) => {
          const ra = y === "2022" ? r22 : r24;
          return (
            <div key={y} className="pc-tile static">
              <em>Same day in {y}</em>
              {ra !== null ? <b className={`t-${verdict(ra).tone}`}>{chg(ra)}</b> : <b className="t-even">no match</b>}
              <small>{ra !== null ? vsWord(verdict(ra).word, y) : row.partial ? "feed incomplete" : "no count published for this day"}</small>
            </div>
          );
        })}
        <div className="pc-tile static">
          <em>Share of 2022&apos;s whole vote</em>
          <b className="t-even">{sh("2022") !== null ? sharePct(sh("2022")!) : "n/a"}</b>
          <small>{ee("2022") !== null ? `by Election Day 2022, ${sharePct(ee("2022")!)} had voted early` : "of every 2022 ballot is already in"}</small>
        </div>
      </div>
      {hasChart ? (
        <div className="pc-chartwrap">
          <PaceChart h={h} d={d} now={row.partial ? 0 : row.now} />
          <div className="pc-leg">
            <span><i className="k22" />2022 reported counts</span>
            <span><i className="k24" />2024 reported counts</span>
            <span><i className="know" />2026 today</span>
            <span><i className="krnd" />hollow dots were rounded by their source</span>
          </div>
        </div>
      ) : null}
      <div className="pc-bars">
        {(["2022", "2024"] as Yr[]).map((y) => h[y].turnout ? (
          <div key={y} className="pc-barrow">
            <span className="lab">Already in, share of {y}&apos;s {compact(h[y].turnout!)} total vote</span>
            <ShareBar now={row.now} y={h[y]} />
            {ee(y) !== null ? <small>tick: {sharePct(ee(y)!)} voted early by Election Day {y}</small> : null}
          </div>
        ) : null)}
      </div>
      {row.partyNow ? (() => {
        const p22 = partyAt("2022"), p24 = partyAt("2024");
        const bits: React.ReactNode[] = [];
        for (const [y, p] of [["2022", p22], ["2024", p24]] as const) {
          if (!p) continue;
          if (p.same) bits.push(<span key={`${y}s`}>At this point in {y} it was <b>{lead(p.same[1], p.same[2])}</b>. </span>);
          if (p.fin && p.fin !== p.same && (!p.same || p.fin[0] <= 2)) bits.push(<span key={`${y}f`}>{p.fin[0] <= 2 ? `By the end of early voting in ${y}` : `With ${p.fin[0]} days to go in ${y}`} it was <b>{lead(p.fin[1], p.fin[2])}</b>. </span>);
        }
        return (
          <div className="pc-party">
            <div className="eye">Registered party of the ballots cast</div>
            <p>
              Registered Democrats have cast <b>{sharePct(row.partyNow.d)}</b> of ballots so far and registered Republicans <b>{sharePct(row.partyNow.r)}</b>,
              an edge of <b>{lead(row.partyNow.d, row.partyNow.r)}</b>. {bits.length ? bits : <>{name} did not publish a party split we could match from past years.</>}
              {" "}Party registration is not a vote: independents and voters who cross over decide close races.
            </p>
          </div>
        );
      })() : null}
      {h["2022"].src?.length || h["2024"].src?.length ? (
        <p className="pc-foot">Past counts: {[...(h["2022"].src ?? []).map((u, i) => [u, `2022 source ${i + 1}`]), ...(h["2024"].src ?? []).map((u, i) => [u, `2024 source ${i + 1}`])].map(([u, l], i, arr) => (
          <React.Fragment key={u}><a href={u} target="_blank" rel="noreferrer">{l}</a>{i < arr.length - 1 ? " · " : ""}</React.Fragment>
        ))}. Total votes: US Elections Project turnout files. Early vote totals without dated counts: EAC Election Administration and Voting Survey.</p>
      ) : null}
      <HowToRead yr={main} />
    </section>
  );
}

export const PACE_CSS = `
.pc { margin-top: 18px; padding: 18px 20px 16px; border-radius: 16px; border: 1px solid var(--line); background: var(--glass); display: flex; flex-direction: column; gap: 14px; }
.pc { --pc-up: #3ddc97; --pc-down: #e3a83a; }
:root[data-theme="light"] .pc { --pc-up: #12955f; --pc-down: #b8770c; }
.pc-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; }
.pc-h2 { margin: 4px 0 0; font-family: var(--font-d); font-weight: 800; font-size: clamp(20px, 2.4vw, 28px); letter-spacing: -0.02em; color: var(--hi); text-wrap: balance; }
.pc-lede { margin: 0; max-width: 78ch; font-size: 15px; line-height: 1.55; color: var(--ink2); }
.pc-lede b { color: var(--hi); }
.pc-seg button { white-space: nowrap; }
.pc-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.pc-tile { appearance: none; font: inherit; color: inherit; text-align: left; display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--glass); min-width: 0; }
button.pc-tile { cursor: pointer; }
button.pc-tile:hover { border-color: var(--line2); }
.pc-tile.on { border-color: #9b8cff; box-shadow: inset 0 0 0 1px rgba(155,140,255,.35); }
.pc-tile:focus-visible, .pc-tr:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.pc-tile em { font-style: normal; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--mute); }
.pc-tile b { font-family: var(--font-d); font-size: clamp(22px, 2.6vw, 30px); font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.pc-tile small { font-size: 12px; line-height: 1.35; color: var(--ink2); }
.pc-tile small.sub { color: var(--mute); }
.t-up2, .t-up { color: var(--pc-up); } .t-down2, .t-down { color: var(--pc-down); } .t-even { color: var(--hi); }
.pc-table { display: flex; flex-direction: column; border-top: 1px solid var(--line); }
.pc-tr { appearance: none; font: inherit; color: inherit; text-align: left; background: none; border: 0; border-bottom: 1px solid var(--line); cursor: pointer;
  display: grid; grid-template-columns: minmax(110px, 1.1fr) minmax(80px, .8fr) minmax(90px, .8fr) minmax(190px, 1.6fr) minmax(150px, 1.3fr); gap: 12px; align-items: center; padding: 9px 4px; }
.pc-tr:hover { background: var(--glass2); }
.pc-tr.th { cursor: default; font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--mute); padding-block: 8px; }
.pc-tr.th:hover { background: none; }
.pc-tr .nm { font-weight: 700; color: var(--ink); }
.pc-tr .num { font-family: var(--font-m); font-variant-numeric: tabular-nums; text-align: right; font-size: 13px; }
.pc-tr .num.mute { color: var(--ink2); }
.pc-tr .sh { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.pc-tr .mlab { display: none; font-style: normal; font-size: 11px; color: var(--mute); }
.pc-tr .pace { display: flex; align-items: center; gap: 10px; min-width: 0; }
.pc-tr .div { position: relative; flex: 1 1 70px; height: 8px; border-radius: 4px; background: rgba(var(--line-rgb), .08); min-width: 50px; }
.pc-tr .div .mid { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--line2); }
.pc-tr .div i { position: absolute; top: 0; bottom: 0; border-radius: 4px; background: currentColor; }
.pc-tr .pc-chip { flex-shrink: 0; font-size: 12px; font-weight: 700; white-space: nowrap; min-width: 112px; }
.pc-tr .pc-chip b { font-family: var(--font-m); font-weight: 700; margin-left: 2px; }
.pc-na { font-size: 12px; color: var(--mute); }
.pc-na b { color: var(--ink); font-family: var(--font-m); }
.pc-share { display: flex; align-items: center; gap: 8px; min-width: 0; width: 100%; }
.pc-share .bar { position: relative; flex: 1 1 auto; height: 8px; border-radius: 4px; background: rgba(var(--line-rgb), .08); min-width: 60px; }
.pc-share .bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #9b8cff; }
.pc-share .bar u { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--hi); border-radius: 1px; }
.pc-share b { font-family: var(--font-m); font-size: 12.5px; font-variant-numeric: tabular-nums; min-width: 38px; text-align: right; }
.pc-foot { margin: 0; font-size: 12px; line-height: 1.5; color: var(--mute); max-width: 95ch; }
.pc-foot a { color: var(--ink2); text-decoration: underline; text-underline-offset: 2px; }
.pc-how { border-top: 1px solid var(--line); padding-top: 10px; }
.pc-how summary { cursor: pointer; font-weight: 700; font-size: 13.5px; color: var(--ink); }
.pc-how ul { margin: 10px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; max-width: 85ch; font-size: 13.5px; line-height: 1.5; color: var(--ink2); }
.pc-how b { color: var(--hi); }
.pc-chartwrap { display: flex; flex-direction: column; gap: 6px; }
.pc-chartbox { width: 100%; max-width: 860px; }
.pc-chart { width: 100%; height: auto; display: block; }
.pc-grid { stroke: var(--line); stroke-width: 1; }
.pc-tick { font-family: var(--font-m); font-size: 10.5px; fill: var(--mute); }
.pc-today { stroke: #9b8cff; stroke-width: 1; stroke-dasharray: 3 4; }
.pc-l22 { fill: none; stroke: var(--ink2); stroke-width: 2; }
.pc-l24 { fill: none; stroke: var(--mute); stroke-width: 2; stroke-dasharray: 6 5; }
.pc-d22 { fill: var(--ink2); } .pc-d24 { fill: var(--mute); }
.pc-d22.rnd, .pc-d24.rnd { fill: var(--bg); stroke-width: 1.5; } .pc-d22.rnd { stroke: var(--ink2); } .pc-d24.rnd { stroke: var(--mute); }
.pc-now { fill: #9b8cff; stroke: var(--bg); stroke-width: 2; }
.pc-lab { font-family: var(--font-m); font-size: 11px; font-weight: 700; }
.pc-lab.l22 { fill: var(--ink2); } .pc-lab.l24 { fill: var(--mute); } .pc-lab.now { fill: var(--hi); font-size: 12px; }
.pc-leg { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 11.5px; color: var(--mute); }
.pc-leg i { display: inline-block; width: 14px; height: 0; border-top: 2px solid; vertical-align: middle; margin-right: 6px; }
.pc-leg .k22 { border-color: var(--ink2); } .pc-leg .k24 { border-color: var(--mute); border-top-style: dashed; }
.pc-leg .know { width: 10px; height: 10px; border: 0; border-radius: 50%; background: #9b8cff; }
.pc-leg .krnd { width: 8px; height: 8px; border: 1.5px solid var(--ink2); border-radius: 50%; }
.pc-bars { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; }
.pc-barrow { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.pc-barrow .lab { font-size: 12.5px; font-weight: 600; color: var(--ink); }
.pc-barrow small { font-size: 11.5px; color: var(--mute); }
.pc-party { padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--glass); }
.pc-party p { margin: 6px 0 0; font-size: 14px; line-height: 1.55; color: var(--ink2); max-width: 85ch; }
.pc-party b { color: var(--hi); font-variant-numeric: tabular-nums; }
@media (max-width: 860px) {
  .pc-tiles { grid-template-columns: 1fr 1fr; }
  .pc-tiles .pc-tile:last-child { grid-column: 1 / -1; }
  .pc-tr { grid-template-columns: 1fr auto; gap: 6px 12px; }
  .pc-tr.th { display: none; }
  .pc-tr .num.mute { display: none; }
  .pc-tr .pace, .pc-tr .sh { grid-column: 1 / -1; }
  .pc-tr .mlab { display: block; }
  .pc-tiles .pc-tile small.sub { display: none; }
  .pc-bars { grid-template-columns: 1fr; }
}
@media (max-width: 480px) { .pc { padding: 14px 14px 12px; } .pc-tile b { font-size: 22px; } }
`;
