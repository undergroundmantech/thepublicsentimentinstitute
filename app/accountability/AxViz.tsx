"use client";
// The Accountability Index charts: the two chambers drawn seat by seat, the money map of lobby money against PAC
// money, and the strip that places one member among all of Congress. Hover any dot for the member, click to open.
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FloatTip from "@/app/components/opp/FloatTip";

export type Dot = { slug: string; name: string; seat: string; party: "D" | "R" | "I"; ch: "S" | "H"; index: number | null; grade: string | null; rank: number | null; lobby: number | null; pac: number | null; trades: number; cross: number | null; sL: number | null; sR: number | null };
const GC: Record<string, string> = { A: "var(--gA)", B: "var(--gB)", C: "var(--gC)", D: "var(--gD)", F: "var(--gF)" };
const PC: Record<string, string> = { D: "var(--dem)", R: "var(--gop)", I: "var(--ind)" };
const money = (n: number | null) => n == null ? "not listed" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;

function Tip({ d, x, y }: { d: Dot; x: number; y: number }) {
  return (
    <FloatTip x={x} y={y} className="ax-tip" scope="opp ax">
      <div className="h"><span className={`pt p-${d.party}`}>{d.party}</span><b>{d.name}</b></div>
      <div className="s">{d.seat}{d.rank ? ` · rank ${d.rank}` : ""}</div>
      <div className="g"><b>{d.index != null ? d.index.toFixed(1) : "Not scored"}</b>{d.grade ? <span className={`ax-g g-${d.grade}`}>{d.grade}</span> : null}</div>
      <div className="r"><span>Lobby money</span><b>{money(d.lobby)}</b></div>
      <div className="r"><span>PAC share</span><b>{d.pac != null ? `${Math.round(d.pac * 100)}%` : "none filed"}</b></div>
      <div className="r"><span>Trades, last year</span><b>{d.trades ? d.trades.toLocaleString() : "none listed"}</b></div>
      <div className="r"><span>Crossing the aisle</span><b>{d.cross != null ? d.cross.toFixed(1) : "not scored"}</b></div>
      <div className="r"><span>Left cards · right cards</span><b>{d.sL != null ? Math.round(d.sL) : "?"} · {d.sR != null ? Math.round(d.sR) : "?"}</b></div>
      <small>Click for the full record</small>
    </FloatTip>
  );
}

/** Seats of a half circle: rows outward, each row holding seats in proportion to its length. */
function seats(n: number, rows: number) {
  const r0 = 0.38, R = Array.from({ length: rows }, (_, i) => r0 + ((1 - r0) * i) / (rows - 1));
  const tot = R.reduce((a, b) => a + b, 0);
  const k = R.map((r) => Math.round((n * r) / tot)); k[rows - 1] += n - k.reduce((a, b) => a + b, 0);
  const out: { x: number; y: number; a: number; r: number }[] = [];
  R.forEach((r, i) => { for (let j = 0; j < k[i]; j++) { const a = Math.PI * (1 - (k[i] === 1 ? 0.5 : j / (k[i] - 1))); out.push({ x: Math.round(r * Math.cos(a) * 1e4) / 1e4, y: Math.round(-r * Math.sin(a) * 1e4) / 1e4, a, r }); } });
  return out.sort((p, q) => q.a - p.a || p.r - q.r);
}

export function Chambers({ dots }: { dots: Dot[] }) {
  const [by, setBy] = useState<"grade" | "party">("grade");
  const [hov, setHov] = useState<{ d: Dot; x: number; y: number } | null>(null);
  const router = useRouter();
  const ch = (c: "S" | "H") => {
    const list = dots.filter((d) => d.ch === c).sort((a, b) => (a.index ?? -1) - (b.index ?? -1));
    const pos = seats(list.length, c === "S" ? 5 : 11);
    return list.map((d, i) => ({ d, ...pos[i] }));
  };
  const S = useMemo(() => ch("S"), [dots]); // eslint-disable-line react-hooks/exhaustive-deps
  const H = useMemo(() => ch("H"), [dots]); // eslint-disable-line react-hooks/exhaustive-deps
  const avg = (l: { d: Dot }[]) => { const x = l.filter((p) => p.d.index != null); return x.reduce((s, p) => s + p.d.index!, 0) / (x.length || 1); };
  const draw = (l: typeof S, title: string, r: number) => (
    <figure className={`ax-hemi ${title === "House" ? "h" : "s"}`}>
      <svg viewBox="-1.06 -1.06 2.12 1.16" role="img" aria-label={`${title}, every member as a seat, from the lowest index on the left to the highest on the right`}>
        {l.map((p) => (
          <circle key={p.d.slug} cx={p.x} cy={p.y} r={r} fill={p.d.index == null ? "rgba(255,255,255,.12)" : by === "grade" ? GC[p.d.grade ?? "F"] : PC[p.d.party]}
            className={hov?.d.slug === p.d.slug ? "on" : ""}
            onMouseMove={(e) => setHov({ d: p.d, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHov(null)} onClick={() => router.push(`/accountability/${p.d.slug}`)} />
        ))}
        <text x="0" y="-0.12" textAnchor="middle" className="big">{avg(l).toFixed(1)}</text>
        <text x="0" y="0.0" textAnchor="middle" className="lab">average</text>
        <text x="-1" y="0.1" textAnchor="start" className="lab">Least independent</text>
        <text x="1" y="0.1" textAnchor="end" className="lab">Most independent</text>
      </svg>
      <figcaption><b>{title}</b><span>{l.length} members</span></figcaption>
    </figure>
  );
  return (
    <div className="ax-chambers">
      <div className="ax-ch-top">
        <div className="ax-seg" role="group" aria-label="Colour seats by">
          <button aria-pressed={by === "grade"} onClick={() => setBy("grade")}>By grade</button>
          <button aria-pressed={by === "party"} onClick={() => setBy("party")}>By party</button>
        </div>
        <span className="ax-hint">Every seat is a member, ordered by index. Hover for the record, click to open it.</span>
      </div>
      <div className="ax-hemis">{draw(S, "Senate", 0.05)}{draw(H, "House", 0.026)}</div>
      {hov ? <Tip {...hov} /> : null}
    </div>
  );
}

/** Lobby money across, PAC share up: the corner nearest the origin is the most independent. */
export function MoneyMap({ dots }: { dots: Dot[] }) {
  const [hov, setHov] = useState<{ d: Dot; x: number; y: number } | null>(null);
  const [party, setParty] = useState<"all" | "D" | "R">("all");
  const router = useRouter();
  const W = 1000, H = 460, L = 70, B = 44, T = 18, Rm = 20;
  const lx = (v: number) => L + ((W - L - Rm) * Math.log10(1 + v / 1000)) / Math.log10(1 + 40000);
  const ly = (v: number) => H - B - ((H - B - T) * Math.min(v, 0.85)) / 0.85;
  const pts = dots.filter((d) => d.lobby != null && d.pac != null);
  return (
    <div className="ax-map">
      <div className="ax-ch-top">
        <div className="ax-seg" role="group" aria-label="Party">{(["all", "D", "R"] as const).map((k) => <button key={k} aria-pressed={party === k} onClick={() => setParty(k)}>{k === "all" ? "Everyone" : k === "D" ? "Democrats" : "Republicans"}</button>)}</div>
        <span className="ax-hint">Dot size is stock trades in the last year.</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Members placed by career pro-Israel lobby money and the share of campaign money from PACs">
        <rect x={L} y={ly(0.25)} width={lx(2e4) - L} height={H - B - ly(0.25)} className="zone" />
        <text x={L + 10} y={ly(0.25) - 8} className="zl">More independent</text>
        <text x={W - Rm - 10} y={T + 18} className="zl" textAnchor="end">More dependent on outside money</text>
        {[0, 1e4, 1e5, 1e6, 1e7, 4e7].map((v) => <g key={v}><line x1={lx(v)} x2={lx(v)} y1={T} y2={H - B} className="gr" /><text x={lx(v)} y={H - B + 18} textAnchor="middle" className="tk">{v === 0 ? "$0" : money(v).replace(".00", "")}</text></g>)}
        {[0, 0.2, 0.4, 0.6, 0.8].map((v) => <g key={v}><line x1={L} x2={W - Rm} y1={ly(v)} y2={ly(v)} className="gr" /><text x={L - 10} y={ly(v) + 4} textAnchor="end" className="tk">{Math.round(v * 100)}%</text></g>)}
        <text x={(W + L) / 2} y={H - 6} textAnchor="middle" className="al">Career pro-Israel lobby money, TrackAIPAC</text>
        <text x={16} y={(H - B) / 2} textAnchor="middle" className="al" transform={`rotate(-90 16 ${(H - B) / 2})`}>Share of campaign money from PACs</text>
        {pts.map((d) => {
          const off = party !== "all" && d.party !== party;
          return <circle key={d.slug} cx={Math.round(lx(d.lobby!) * 10) / 10} cy={Math.round(ly(d.pac!) * 10) / 10} r={Math.round((3 + Math.min(12, Math.sqrt(d.trades) * 0.55)) * 10) / 10} fill={PC[d.party]} className={`p${off ? " off" : ""}${hov?.d.slug === d.slug ? " on" : ""}`}
            onMouseMove={(e) => setHov({ d, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHov(null)} onClick={() => router.push(`/accountability/${d.slug}`)} />;
        })}
      </svg>
      {hov ? <Tip {...hov} /> : null}
    </div>
  );
}

/** One member among all of Congress: every index as a dot, stacked where they crowd. */
let DOTS: Promise<Dot[]> | null = null;
export function Strip({ me, avgD, avgR }: { me: string; avgD: number; avgR: number }) {
  const [hov, setHov] = useState<{ d: Dot; x: number; y: number } | null>(null);
  const [dots, setDots] = useState<Dot[]>([]);
  useEffect(() => { (DOTS ??= fetch("/accountability/dots.json").then((r) => r.json())).then(setDots).catch(() => {}); }, []);
  const router = useRouter();
  const W = 1000, base = 128;
  const { placed, step } = useMemo(() => {
    const col: Record<number, number> = {};
    const l = dots.filter((d) => d.index != null).sort((a, b) => a.index! - b.index!).map((d) => { const b = Math.round(d.index! / 0.9); const k = (col[b] = (col[b] ?? 0) + 1) - 1; return { d, k }; });
    const st = Math.min(7.2, 112 / Math.max(1, ...Object.values(col)));
    return { step: st, placed: l.map(({ d, k }) => ({ d, x: 20 + ((W - 40) * d.index!) / 100, y: base - k * st })) };
  }, [dots]);
  const x = (v: number) => 20 + ((W - 40) * v) / 100;
  const mine = placed.find((p) => p.d.slug === me);
  return (
    <div className="ax-strip">
      <svg viewBox={`0 0 ${W} 178`} role="img" aria-label="Every member's index, with this member marked">
        {[0, 25, 50, 75, 100].map((v) => <g key={v}><line x1={x(v)} x2={x(v)} y1={10} y2={136} className="gr" /><text x={x(v)} y={152} textAnchor="middle" className="tk">{v}</text></g>)}
        <line x1={x(avgD)} x2={x(avgD)} y1={10} y2={162} className="avg d" /><text x={x(avgD) - 4} y={174} textAnchor="end" className="tk d">Democrats {avgD.toFixed(1)}</text>
        <line x1={x(avgR)} x2={x(avgR)} y1={10} y2={162} className="avg r" /><text x={x(avgR) + 4} y={174} textAnchor="start" className="tk r">Republicans {avgR.toFixed(1)}</text>
        {placed.map((p) => <circle key={p.d.slug} cx={p.x} cy={p.y} r={Math.min(3.1, step * 0.46)} fill={PC[p.d.party]} className={p.d.slug === me ? "me" : "o"} onMouseMove={(e) => setHov({ d: p.d, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHov(null)} onClick={() => router.push(`/accountability/${p.d.slug}`)} />)}
        {mine ? <g className="mk"><circle cx={mine.x} cy={mine.y} r={9} /><line x1={mine.x} x2={mine.x} y1={mine.y + 9} y2={138} /></g> : null}
      </svg>
      {hov ? <Tip {...hov} /> : null}
    </div>
  );
}
