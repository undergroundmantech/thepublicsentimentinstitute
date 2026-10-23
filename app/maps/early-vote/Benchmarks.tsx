"use client";
// Early vote benchmarks for one state: where the party lead of the early vote has to be by now for each side to beat
// the On Point forecast by a lot or flip the race, how far each side is from that mark, how the ballots so far would
// vote once defections and independents are counted, and where that leaves the race against the forecast, the polls
// and the 2024 presidential result. The math is in bench.ts. For the nation, a board of every competitive race.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pointy } from "@/app/components/home/Mascot";
import type { Pose, Prop } from "@/app/components/home/Mascot";
import type { EvConsole, EvRow } from "./consoleData";
import { baseBeh, benchmark, leadOf, voteM, type Beh, type BenchOut } from "./bench";

const commas = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (n: number) => { const a = Math.abs(n); return a >= 1e6 ? `${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M` : a >= 1e4 ? `${Math.round(n / 1e3)}K` : commas(n); };
const pc = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const lab = (m: number, ind = false, d = 1) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(d)}`);
const side = (m: number) => (m < 0 ? "d" : "r");
const last = (n: string) => n.trim().split(/\s+/).pop() || n;

function useSeen<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el); return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

/** place labels on rows so none overlap: each label takes the first row whose last label ends far enough to its left */
function rows<T extends { x: number; w: number }>(L: T[], gap = 6): (T & { row: number })[] {
  const ends: number[] = [];
  return [...L].sort((a, b) => a.x - b.x).map((l) => {
    let r = 0; while (ends[r] != null && ends[r] > l.x - l.w / 2 - gap) r++;
    ends[r] = l.x + l.w / 2; return { ...l, row: r };
  });
}

// ── ruler one: the party lead of the early vote ────────────────────────────────────────────────────────────────
/** on a phone the rulers scroll sideways: start them centered on the mark that matters */
function useCenter(ref: React.RefObject<SVGSVGElement | null>, frac: number) {
  useEffect(() => { const f = ref.current?.parentElement; if (f && f.scrollWidth > f.clientWidth + 4) f.scrollLeft = Math.max(0, frac * f.scrollWidth - f.clientWidth / 2); }, [ref, frac]);
}

function LeadRuler({ o, seen }: { o: BenchOut; seen: boolean }) {
  const W = 860, P = 26;
  const svg = useRef<SVGSVGElement | null>(null);
  const T = o.targets.filter((t) => t.reach);
  const vals = [o.lead, o.expLead, ...T.map((t) => t.lead)];
  let lo = Math.min(...vals) - 4, hi = Math.max(...vals) + 4;
  if (hi - lo < 16) { const c = (hi + lo) / 2; lo = c - 8; hi = c + 8; }
  lo = Math.max(-70, lo); hi = Math.min(70, hi);
  const X = (v: number) => P + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 2 * P);
  const get = (k: string) => o.targets.find((t) => t.key === k);
  const dB = get("dbig"), rB = get("rbig"), tr = get("track"), fl = get("flip");
  const ind = o.race.ind;
  // zones: deep blue past D +5, pale blue to the forecast line, pale red to R +5, deep red past it
  const z = [lo, dB ? dB.lead : lo, tr ? tr.lead : (lo + hi) / 2, rB ? rB.lead : hi, hi].map((v) => X(Math.max(lo, Math.min(hi, v))));
  const ticks: number[] = []; const step = hi - lo > 50 ? 10 : 5;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const top = rows([
    { key: "now", x: X(o.lead), w: 118, t: `Now ${lab(o.lead)}`, cls: "now" },
    { key: "exp", x: X(o.expLead), w: 138, t: `Expected ${lab(o.expLead)}`, cls: "exp" },
  ]);
  const bot = rows(T.filter((t) => t.key !== "track").map((t) => ({ key: t.key, x: X(t.lead), w: Math.max(96, t.short.length * 7.2 + 12), t: t.short, v: lab(t.lead), cls: `t-${t.key} ${t.side.toLowerCase()}` })));
  const nb = Math.max(1, ...bot.map((b) => b.row + 1)), nt = Math.max(1, ...top.map((b) => b.row + 1));
  const y0 = 18 + nt * 30, H = y0 + 46 + nb * 34;
  useCenter(svg, X((o.lead + o.expLead) / 2) / W);
  return (
    <svg ref={svg} className={`evb-ruler${seen ? " go" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Party lead of the early vote, now ${lab(o.lead)}, expected ${lab(o.expLead)}`}>
      <defs>
        <linearGradient id="evb-zd" x1="0" x2="1"><stop offset="0" stopColor="var(--evb-d2)" /><stop offset="1" stopColor="var(--evb-d1)" /></linearGradient>
        <linearGradient id="evb-zr" x1="0" x2="1"><stop offset="0" stopColor="var(--evb-r1)" /><stop offset="1" stopColor="var(--evb-r2)" /></linearGradient>
      </defs>
      <rect x={z[0]} y={y0} width={Math.max(0, z[1] - z[0])} height={16} rx={3} className="zd2" />
      <rect x={z[1]} y={y0} width={Math.max(0, z[2] - z[1])} height={16} className="zd1" />
      <rect x={z[2]} y={y0} width={Math.max(0, z[3] - z[2])} height={16} className="zr1" />
      <rect x={z[3]} y={y0} width={Math.max(0, z[4] - z[3])} height={16} rx={3} className="zr2" />
      {ticks.map((v) => <g key={v}><line x1={X(v)} x2={X(v)} y1={y0 + 16} y2={y0 + 21} className="tk" /><text x={X(v)} y={y0 + 32} className="ax">{v === 0 ? "Even" : `${v < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(v)}`}</text></g>)}
      {tr ? <g><line x1={X(tr.lead)} x2={X(tr.lead)} y1={y0 - 6} y2={y0 + 22} className="trk" /></g> : null}
      {fl && fl.reach ? <line x1={X(fl.lead)} x2={X(fl.lead)} y1={y0 - 8} y2={y0 + 24} className="flip" /> : null}
      {bot.map((b) => { const y = y0 + 56 + b.row * 34; return (
        <g key={b.key} className={`bl ${b.cls}`}>
          <line x1={b.x} x2={b.x} y1={y0 + 16} y2={y - 12} className="lead" />
          <text x={b.x} y={y} className="bt">{b.t}</text><text x={b.x} y={y + 13} className="bv">{b.v}</text>
        </g>); })}
      {top.map((t) => { const y = y0 - 10 - t.row * 30; return (
        <g key={t.key} className={`tl ${t.cls}`} style={{ ["--dx" as string]: `${X(o.expLead) - t.x}px` }}>
          <line x1={t.x} x2={t.x} y1={y + 4} y2={y0 + 8} className="lead" />
          {t.key === "now" ? <circle cx={t.x} cy={y0 + 8} r={9} className="dot" /> : <circle cx={t.x} cy={y0 + 8} r={7} className="ring" />}
          <text x={t.x} y={y} className="tt">{t.t}</text>
        </g>); })}
    </svg>
  );
}

// ── ruler two: where the race lands ────────────────────────────────────────────────────────────────────────────
function RaceRuler({ o, pres24, seen }: { o: BenchOut; pres24: number | null; seen: boolean }) {
  const W = 860, P = 26, r = o.race, ind = r.ind;
  const svg = useRef<SVGSVGElement | null>(null);
  const vals = [r.p10, r.p90, o.implied, o.impliedLo, o.impliedHi, 0, ...(r.polls ? [r.polls.lo, r.polls.hi] : []), ...(pres24 != null ? [pres24] : [])];
  let lo = Math.min(...vals) - 3, hi = Math.max(...vals) + 3;
  lo = Math.max(-60, lo); hi = Math.min(60, hi);
  const X = (v: number) => P + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 2 * P);
  const step = hi - lo > 50 ? 10 : 5; const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const L = rows([
    { key: "f", x: X(r.F), w: 128, t: `Forecast ${lab(r.F, ind)}`, cls: "f" },
    { key: "e", x: X(o.implied), w: 150, t: `Early vote read ${lab(o.implied, ind)}`, cls: "e" },
    ...(pres24 != null ? [{ key: "p", x: X(pres24), w: 126, t: `2024 president ${lab(pres24)}`, cls: "p" }] : []),
  ], 8);
  const nr = Math.max(1, ...L.map((l) => l.row + 1));
  const y0 = 22 + nr * 26, H = y0 + 84;
  useCenter(svg, X((r.F + o.implied) / 2) / W);
  return (
    <svg ref={svg} className={`evb-race${seen ? " go" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Forecast ${lab(r.F, ind)}, early vote read ${lab(o.implied, ind)}`}>
      <rect x={P} y={y0} width={W - 2 * P} height={22} rx={5} className="bed" />
      <rect x={X(0)} y={y0} width={Math.max(0, X(hi) - X(0))} height={22} className="rside" />
      <rect x={X(lo)} y={y0} width={Math.max(0, X(0) - X(lo))} height={22} className="dside" />
      <rect x={X(r.p10)} y={y0 + 3} width={Math.max(2, X(r.p90) - X(r.p10))} height={16} rx={8} className="band" />
      {r.polls ? <rect x={X(r.polls.lo)} y={y0 + 26} width={Math.max(3, X(r.polls.hi) - X(r.polls.lo))} height={6} rx={3} className="polls" /> : null}
      <line x1={X(0)} x2={X(0)} y1={y0 - 6} y2={y0 + 36} className="zero" />
      {ticks.map((v) => <text key={v} x={X(v)} y={y0 + 50} className="ax">{v === 0 ? "Even" : `${v < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(v)}`}</text>)}
      {r.polls ? <text x={(X(r.polls.lo) + X(r.polls.hi)) / 2} y={y0 + 66} className="pl">Polls, last 30 days: {lab(r.polls.lo, ind)} to {lab(r.polls.hi, ind)}</text> : null}
      {L.map((l) => { const y = y0 - 8 - l.row * 26; return (
        <g key={l.key} className={`ml ${l.cls}`} style={{ ["--dx" as string]: `${X(r.F) - l.x}px` }}>
          <line x1={l.x} x2={l.x} y1={y + 4} y2={y0 + 11} className="lead" />
          {l.key === "e" ? <circle cx={l.x} cy={y0 + 11} r={8} className="dot" /> : l.key === "f" ? <rect x={l.x - 3} y={y0 - 2} width={6} height={26} rx={2} className="fm" /> : <path d={`M${l.x} ${y0 + 3}l6 8l-6 8l-6 -8z`} className="pm" />}
          <text x={l.x} y={y} className="tt">{l.t}</text>
        </g>); })}
    </svg>
  );
}

// ── Election Day: who is left to vote and how they have to break ─────────────────────────────────────────────
function EdayCard({ o, seen, dN, rN }: { o: BenchOut; seen: boolean; dN: string; rN: string }) {
  const e = o.eday!; const ind = o.race.ind;
  const W = 860, P = 26;
  const flip = e.need.find((n) => n.key === "flip")!, track = e.need.find((n) => n.key === "track")!;
  const vals = [e.dayExp, ...e.need.map((n) => n.day), 0];
  let lo = Math.min(...vals) - 4, hi = Math.max(...vals) + 4; lo = Math.max(-70, lo); hi = Math.min(70, hi);
  const X = (v: number) => P + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 2 * P);
  const step = hi - lo > 50 ? 10 : 5; const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  const marks = rows([
    { key: "exp", x: X(e.dayExp), w: 170, t: `Forecast expects ${lab(e.dayExp, ind)}`, cls: "exp" },
    ...e.need.filter((n) => n.key !== "track").map((n) => ({ key: n.key, x: X(n.day), w: n.key === "flip" ? 140 : 150, t: `${n.key === "flip" ? "Flip line" : n.side === "D" ? "D +5 on forecast" : "R +5 on forecast"} ${lab(n.day)}`, cls: `${n.key} ${n.side.toLowerCase()}` })),
  ], 8);
  const nr = Math.max(1, ...marks.map((m) => m.row + 1));
  const y0 = 16, H = y0 + 40 + nr * 26 + 14;
  const svg = useRef<SVGSVGElement | null>(null);
  useCenter(svg, X((e.dayExp + flip.day) / 2) / W);
  const under = flip.side === "R" ? rN : dN;
  const more = flip.side === "R" ? flip.day - e.dayExp : e.dayExp - flip.day;
  const seg = (g: number[], label: string, m: number, cls: string) => (
    <div className={`evb-gr ${cls}`}>
      <div className="l"><span>{label}</span><b className={side(m)}>votes {lab(m, ind)}</b></div>
      <div className="bar"><i className="t" style={{ width: pc(g[0], 1) }}><em>{pc(g[0])}</em></i><i className="h" style={{ width: pc(g[1], 1) }}><em>{pc(g[1])}</em></i><i className="n" style={{ width: pc(g[2], 1) }} /></div>
    </div>
  );
  return (
    <figure className="evb-fig evb-day">
      <figcaption><b>How Election Day voters have to break</b><span>Election Day is about {pc(e.dayShare)} of the vote the forecast expects. Its voters are whoever the forecast expects to vote, minus the early voters, sorted by how they voted in 2024</span></figcaption>
      <div className="evb-grs">
        {seg(e.gEarly, "Early voters", e.earlyNow, "ge")}
        {seg(e.gDay, "Election Day voters", e.dayExp, "gd")}
        <div className="evb-grk"><span><i className="t" />Trump 2024 voters</span><span><i className="h" />Harris 2024 voters</span><span><i className="n" />New voters</span></div>
      </div>
      <svg ref={svg} className={`evb-race evb-dayr${seen ? " go" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Election Day margin: the forecast expects ${lab(e.dayExp, ind)}, the flip line is ${lab(flip.day)}`}>
        <rect x={P} y={y0 + nr * 26} width={W - 2 * P} height={18} rx={5} className="bed" />
        <rect x={X(lo)} y={y0 + nr * 26} width={Math.max(0, X(flip.day) - X(lo))} height={18} className="dside" />
        <rect x={X(flip.day)} y={y0 + nr * 26} width={Math.max(0, X(hi) - X(flip.day))} height={18} className="rside" />
        <line x1={X(flip.day)} x2={X(flip.day)} y1={y0 + nr * 26 - 4} y2={y0 + nr * 26 + 24} className="fl" />
        {ticks.map((v) => <text key={v} x={X(v)} y={y0 + nr * 26 + 36} className="ax">{v === 0 ? "Even" : `${v < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(v)}`}</text>)}
        {marks.map((m) => { const y = y0 + (nr - 1 - m.row) * 26 + 6; return (
          <g key={m.key} className={`ml ${m.cls}`}>
            <line x1={m.x} x2={m.x} y1={y + 4} y2={y0 + nr * 26 + 9} className="lead" />
            {m.key === "exp" ? <circle cx={m.x} cy={y0 + nr * 26 + 9} r={8} className="dot" /> : <rect x={m.x - 2} y={y0 + nr * 26 - 1} width={4} height={20} rx={1} className="fm" />}
            <text x={m.x} y={y} className="tt">{m.t}</text>
          </g>); })}
      </svg>
      <p className="evb-dayt">If the early vote ends where it is pointing, <b>{under}</b> needs Election Day voters to break <b className={flip.side === "R" ? "r" : "d"}>{lab(flip.day)}</b> to win, {Math.abs(more).toFixed(1)} points {more > 0 ? (flip.side === "R" ? "redder" : "bluer") : (flip.side === "R" ? "bluer" : "redder")} than the <b className={side(e.dayExp)}>{lab(e.dayExp, ind)}</b> the forecast expects of them. With the forecast holding, Election Day lands near {lab(track.day, ind)}.</p>
    </figure>
  );
}

type Topic = "signal" | "behind" | "eday" | "habits" | "defect" | "ind" | "base";
const TOPIC: [Topic, string, Pose, Prop][] = [["signal", "The signal", "point", "chart"], ["behind", "Margin behind", "think", "clipboard"], ["eday", "Election Day", "wave", "flag"], ["habits", "Voting habits", "idle", "ballot"],
  ["defect", "Defections", "think", "magnifier"], ["ind", "Independents", "wave", "megaphone"], ["base", "2024 baseline", "point", "flag"]];

export default function Benchmarks({ row, data, m24, m26, geo24 }: { row: EvRow; data: EvConsole; m24: number | null; m26: number | null; geo24: number | null }) {
  const races = row.bench?.races ?? [];
  const [ri, setRi] = useState(0);
  const base = useMemo(() => baseBeh(data.xo), [data.xo]);
  const [beh, setBeh] = useState<Beh>(base);
  const [topic, setTopic] = useState<Topic>("signal");
  const [ref, seen] = useSeen<HTMLDivElement>();
  useEffect(() => { setRi(0); setBeh(base); setTopic("signal"); }, [row.st, base]);
  const race = races[Math.min(ri, races.length - 1)];
  const o = useMemo(() => (row.bench && race ? benchmark(row.bench, race, beh, base, data.xo) : null), [row.bench, race, beh, base, data.xo]);
  if (!row.bench || !race || !o) {
    return (
      <section className="evb card" aria-label="Early vote benchmarks">
        <div className="evb-head"><div><span className="eye g">Early vote benchmarks</span><h2>No statewide race to benchmark in {row.name}</h2>
          <p className="evc-note">{row.name} has no Senate or governor race in the On Point forecast{row.bench ? "" : ", or the party model has not read its ballots yet"}, so there is no forecast to measure these ballots against.</p></div></div>
      </section>
    );
  }
  const r = o.race, ind = r.ind, dN = ind ? last(r.dem) : last(r.dem), rN = last(r.gop);
  const fav = o.race.F + o.behDelta < 0 ? "D" : "R";
  const dWho = ind ? "the independent" : "Democrats";
  const flip = o.targets.find((t) => t.key === "flip")!;
  const big = o.targets.find((t) => t.key === (fav === "D" ? "rbig" : "dbig"))!;
  const bigF = o.targets.find((t) => t.key === (fav === "D" ? "dbig" : "rbig"))!;
  const behind = (t: { lead: number; side: "D" | "R" }) => (t.side === "R" ? t.lead - o.lead : o.lead - t.lead);
  const under = fav === "D" ? "Republicans" : ind ? "The independent" : "Democrats";
  const fb = behind(flip);
  const simN = o.sim.reduce((a, s) => a + s.n, 0), simD = o.sim.reduce((a, s) => a + s.n * s.dv, 0);
  const iEven = voteM(row.bench.expFull, { ...beh, iD: 0.5 }) - voteM(row.bench.expFull, beh);
  const changed = Math.abs(beh.dLoyal - base.dLoyal) + Math.abs(beh.rLoyal - base.rLoyal) + Math.abs(beh.iD - base.iD) > 0.001;
  const moveTxt = `${lab(o.implied - o.F0 - o.behDelta, false).replace("Even", "nothing")}`;

  const say: Record<Topic, React.ReactNode> = {
    signal: <>{o.signal.strength === 0 ? <><b>No clear signal yet.</b> </> : <><b className={o.signal.side === "D" ? "d" : "r"}>{o.signal.word}.</b> </>}
      {row.name}&apos;s ballots so far are <b>{lab(o.lead)}</b> by party, against <b>{lab(o.expLead)}</b> the forecast expected by now. The early vote is about {pc(o.s)} of the electorate and a party point is worth {o.k.toFixed(2)} vote points, so if that gap holds the race moves {moveTxt === "nothing" ? "almost nothing" : <b className={side(o.gap)}>{moveTxt}</b>}: <b>{lab(o.implied, ind)}</b> against the forecast&apos;s {lab(r.F, ind)}.{o.share < 0.25 ? ` Only about ${pc(o.share)} of the expected early vote is in, so this read can still swing.` : ""}</>,
    behind: <>{fb <= 0 ? <><b>{under} are past their flip line.</b> They need the early vote at <b>{lab(flip.lead)}</b> by now and it sits at {lab(o.lead)}. If that holds, {fav === "D" ? rN : dN} wins.</>
      : flip.reach ? <><b>{under} are {fb.toFixed(1)} points behind</b> the early vote it takes to flip this race. They need <b>{lab(flip.lead)}</b> by now; it is <b>{lab(o.lead)}</b>.</>
      : <><b>Out of reach on early ballots alone.</b> Flipping this race would take an early vote past {lab(flip.lead)}, so {under.toLowerCase()} need Election Day to break far from the forecast.</>}
      {" "}To beat the forecast by 5, {fav === "D" ? "Republicans" : dWho} need {big.reach ? <b>{lab(big.lead)}</b> : "more than any early vote has shown"}; {fav === "D" ? dWho : "Republicans"} need {bigF.reach ? <b>{lab(bigF.lead)}</b> : "a historic early vote"}.</>,
    eday: o.eday ? <>The voters still to come lean differently. Early voters so far are <b>{pc(o.eday.gEarly[1])}</b> Harris 2024 voters; the Election Day crowd the forecast expects is <b>{pc(o.eday.gDay[0])}</b> Trump 2024 voters, so it is expected to vote <b className={side(o.eday.dayExp)}>{lab(o.eday.dayExp, ind)}</b>. {(() => { const f = o.eday!.need.find((n) => n.key === "flip")!; return <>To flip the race, Election Day has to break <b className={f.side === "R" ? "r" : "d"}>{lab(f.day)}</b>, which is how strong the late vote has to be to undo the early lead.</>; })()}</> : <>There is no electorate model for {row.name} yet, so Election Day cannot be split out.</>,
    habits: <>Party splits in the early vote are not the tell they were in 2020. Republicans have moved a big share of their vote to early and mail ballots since then, so these benchmarks start from what the forecast expected given that shift, not from an even split.
      {m24 != null && m26 != null ? <> At this point in 2024 {row.name}&apos;s early vote was <b>{lab(m24)}</b>; it is <b>{lab(m26)}</b> now, {Math.abs(m26 - m24).toFixed(1)} points {m26 < m24 ? "bluer" : "redder"}.</> : null}</>,
    defect: <>A registered voter is not a vote. On Point Polling likely voters put <b>{pc(1 - beh.dLoyal)}</b> of Democrats and <b>{pc(1 - beh.rLoyal)}</b> of Republicans on the other side of the ballot, which is why a one point party lead is worth only <b>{o.k.toFixed(2)}</b> points of vote. Move the sliders to try a year when one party breaks harder.{changed ? <> With your settings the whole electorate moves <b className={side(o.behDelta)}>{lab(o.behDelta)}</b> before a single early ballot is counted.</> : null}</>,
    ind: <>Independents and other voters cast <b>{pc(row.bench.now.o)}</b> of these ballots, about {short(row.bench.now.o * row.bench.ballots)}. On Point Polling has them voting <b>{pc(beh.iD)}</b> Democratic. If they split evenly instead, the race moves <b className={side(iEven)}>{lab(iEven)}</b>. They are the swing inside the early vote that party counts cannot see.</>,
    base: <>{data.pres24 != null && row.bench.pres24 != null ? <>{row.bench.pres24 > 0 ? "Trump" : "Harris"} carried {row.name} by <b>{Math.abs(row.bench.pres24).toFixed(1)}</b> in 2024. The forecast has {r.F < 0 ? dN : rN} up <b>{Math.abs(r.F).toFixed(1)}</b>, a <b className={side(r.F - row.bench.pres24)}>{Math.abs(r.F - row.bench.pres24).toFixed(1)} point</b> swing toward {r.F - row.bench.pres24 < 0 ? (ind ? "the independent" : "Democrats") : "Republicans"}.</> : null}
      {geo24 != null ? <> The counties casting these ballots voted <b>{lab(geo24)}</b> for president in 2024, so the early vote so far comes from {Math.abs(geo24 - (row.bench.pres24 ?? geo24)) < 1 ? "places that look like the state as a whole" : geo24 < (row.bench.pres24 ?? 0) ? "bluer places than the state as a whole" : "redder places than the state as a whole"}.</> : null}</>,
  };
  const t = TOPIC.find((x) => x[0] === topic)!;
  const Tbl = o.targets.filter((x) => x.key !== "track");

  return (
    <section className="evb card" aria-labelledby="evb-h" ref={ref}>
      <div className="evb-head">
        <div>
          <span className="eye g">Early vote benchmarks · {row.name}</span>
          <h2 id="evb-h"><span className={o.signal.side ? (o.signal.side === "D" ? "d" : "r") : ""}>{o.signal.word}</span> in the {row.name} {r.office === "senate" ? "Senate" : "governor"} race</h2>
          <p className="evb-lede">Where the party lead of the early vote has to be by now for each side to beat the On Point forecast by a lot or to prove the favorite wrong, and how far each side is from it.</p>
        </div>
        <div className="evb-races">
          {races.length > 1 ? <div className="evc-chips" role="group" aria-label="Race">{races.map((x, i) => <button key={x.id} className={i === ri ? "on" : ""} onClick={() => setRi(i)}>{x.label}</button>)}</div> : null}
          <Link className="btn sm" href={r.href}>{r.label} forecast</Link>
        </div>
      </div>

      <div className="evb-match">
        <div className="c d"><span>{ind ? "Independent" : "Democrat"}</span><b>{r.dem}</b></div>
        <div className="fc"><span>On Point forecast</span><b className={side(r.F)}>{lab(r.F, ind)}</b><small>{pc(r.F < 0 ? 1 - r.prob : r.prob)} chance for {r.F < 0 ? dN : rN}</small></div>
        <div className="c r"><span>Republican</span><b>{r.gop}</b></div>
      </div>

      <div className="evb-grid">
        <div className="evb-main">
          <figure className="evb-fig">
            <figcaption><b>Party lead of the early vote, by now</b><span>Each mark is the lead the ballots need for that result, if Election Day goes as the forecast expects</span></figcaption>
            <LeadRuler o={o} seen={seen} />
          </figure>
          <div className="evb-tw">
            <table className="evb-t">
              <thead><tr><th>For this result</th><th className="n">Early vote needs</th><th className="n">It is</th><th className="n">Gap</th></tr></thead>
              <tbody>
                {Tbl.map((x) => { const g = behind(x); return (
                  <tr key={x.key} className={x.key === "flip" ? "hot" : ""}>
                    <td><i className={`sw ${x.side.toLowerCase()}${x.key.endsWith("big") || x.key === "flip" ? " deep" : ""}`} />{x.label}<small>race lands {lab(x.margin, ind)}</small></td>
                    <td className={`n mono ${x.side.toLowerCase()}`}>{x.reach ? lab(x.lead) : "Out of reach"}</td>
                    <td className="n mono">{lab(o.lead)}</td>
                    <td className="n">{!x.reach ? <span className="gp far">Not on early ballots</span> : g <= 0 ? <span className="gp met">Met</span> : <span className="gp">{g.toFixed(1)} short</span>}</td>
                  </tr>); })}
              </tbody>
            </table>
          </div>
          <figure className="evb-fig">
            <figcaption><b>Where that leaves the race</b><span>Vote margin: the forecast and its 80 percent range, the polls, the early vote read and the 2024 presidential result</span></figcaption>
            <RaceRuler o={o} pres24={row.bench.pres24} seen={seen} />
            <div className="evb-key"><span><i className="k-band" />Forecast 80% range</span><span><i className="k-polls" />Poll range</span><span><i className="k-e" />Early vote read</span>{row.bench.pres24 != null ? <span><i className="k-p" />2024 president</span> : null}</div>
          </figure>
          {o.eday ? <EdayCard o={o} seen={seen} dN={dN} rN={rN} /> : null}
        </div>

        <aside className="evb-side">
          <div className="evb-pointy">
            <div className="evb-topics" role="tablist" aria-label="Pointy explains">
              {TOPIC.map(([k, l]) => <button key={k} role="tab" aria-selected={topic === k} className={topic === k ? "on" : ""} onClick={() => setTopic(k)}>{l}</button>)}
            </div>
            <Pointy key={topic} className="evb-pty pty-side keep" pose={t[2]} prop={t[3]} size={96} look={-1} say={say[topic]} />
          </div>

          <div className="evb-sim">
            <div className="evb-simh"><b>How these ballots vote</b><span>{commas(row.bench.ballots)} ballots, by registration</span></div>
            {o.sim.map((x) => (
              <div key={x.k} className={`evb-srow ${x.k}`}>
                <div className="l"><span>{x.label}</span><b>{short(x.n)}</b></div>
                <div className="bar"><i className="d" style={{ width: pc(x.dv, 1) }} /><i className="r" style={{ width: pc(1 - x.dv, 1) }} /></div>
                <div className="v"><span className="d">D {pc(x.dv)}</span><span className="r">R {pc(1 - x.dv)}</span></div>
              </div>
            ))}
            <div className="evb-stot"><span>These ballots vote about</span><b className={side(o.simM)}>{lab(o.simM, ind)}</b><small>{short(simD)} D · {short(simN - simD)} R, against a party lead of {lab(o.lead)}</small></div>
            <div className="evb-sl">
              {([["dLoyal", "Democrats who stay Democratic", 0.7, 0.99], ["rLoyal", "Republicans who stay Republican", 0.7, 0.99], ["iD", "Independents who vote Democratic", 0.3, 0.7]] as [keyof Beh, string, number, number][]).map(([k, l, a, b]) => (
                <label key={k} htmlFor={`evb-${k}`}>
                  <span>{l}<b>{pc(beh[k])}</b></span>
                  <input id={`evb-${k}`} type="range" min={a * 100} max={b * 100} step={0.5} value={beh[k] * 100} onChange={(e) => setBeh((v) => ({ ...v, [k]: +e.target.value / 100 }))} />
                  <small>On Point Polling: {pc(base[k])}</small>
                </label>
              ))}
              {changed ? <button className="btn sm" onClick={() => setBeh(base)}>Back to On Point Polling rates</button> : null}
            </div>
          </div>
        </aside>
      </div>
      <p className="evc-note evb-foot">Benchmarks assume the rest of the early vote keeps the gap seen so far and Election Day votes as the forecast expects. Party is registration where {row.name} publishes it and the On Point party model where it does not. Crossover rates are On Point Polling likely voters nationwide; the forecast itself already carries an early vote correction of {lab(r.evShift, ind, 2)}, which is taken out of the baseline here so the same ballots are not counted twice. Polls of the last 30 days leave out Rasmussen, ActiVote and Wedgewood, as the site average does.</p>
    </section>
  );
}

/** The national board: every competitive race with its early vote signal and how far the underdog is from flipping it. */
export function BenchBoard({ data, onOpen }: { data: EvConsole; onOpen: (st: string) => void }) {
  const base = useMemo(() => baseBeh(data.xo), [data.xo]);
  const L = useMemo(() => {
    const out: (BenchOut & { st: string; name: string })[] = [];
    for (const r of data.rows) {
      if (!r.bench) continue;
      for (const race of r.bench.races) if (Math.abs(race.F) < 8) out.push({ ...benchmark(r.bench, race, base, base, data.xo), st: r.st, name: r.name });
    }
    return out.sort((a, b) => Math.abs(a.race.F) - Math.abs(b.race.F));
  }, [data.rows, base, data.xo]);
  const [ref, seen] = useSeen<HTMLDivElement>();
  if (!L.length) return null;
  return (
    <section className="evb card" aria-labelledby="evbb-h" ref={ref}>
      <div className="evb-head">
        <div><span className="eye g">Early vote benchmarks · close races</span><h2 id="evbb-h">Which way the early vote is pointing</h2>
          <p className="evb-lede">Every Senate and governor race the forecast has within 8 points, in a state reporting ballots. The bar runs from the early vote the underdog needs to flip the race to where it is now. Open a state for its full benchmarks.</p></div>
      </div>
      <div className={`evbb${seen ? " go" : ""}`}>
        {L.map((o, i) => {
          const fl = o.targets.find((t) => t.key === "flip")!, ind = o.race.ind;
          const gap = fl.side === "R" ? fl.lead - o.lead : o.lead - fl.lead;
          const pct = fl.reach ? Math.max(0, Math.min(1, 1 - gap / 20)) : 0;
          return (
            <button key={o.race.id} className="evbb-r" onClick={() => onOpen(o.st)} style={{ ["--i" as string]: i }}>
              <span className="nm"><b>{o.name}</b><small>{o.race.label} · {lab(o.race.F, ind)}</small></span>
              <span className={`sig s${o.signal.strength} ${o.signal.side ? o.signal.side.toLowerCase() : ""}`}>{o.signal.strength === 0 ? "No clear signal" : `${["", "Slight", "Clear", "Strong"][o.signal.strength]} ${o.signal.side === "D" ? (ind ? "I" : "D") : "R"}`}</span>
              <span className="trk"><i className={fl.side.toLowerCase()} style={{ width: `${(pct * 100).toFixed(1)}%` }} /></span>
              <span className="gp">{!fl.reach ? `${fl.side === "R" ? "R" : ind ? "I" : "D"} flip out of reach` : gap <= 0 ? `${fl.side === "R" ? "R" : ind ? "I" : "D"} past flip line` : `${fl.side === "R" ? "R" : ind ? "I" : "D"} ${gap.toFixed(1)} short of flip`}</span>
              <span className="ld mono">{lab(o.lead)}<small>needs {fl.reach ? lab(fl.lead) : "n/a"}</small></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
export { leadOf };
