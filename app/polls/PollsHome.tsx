"use client";
// The top of the polls home: the two national averages first, the generic ballot and Trump's approval, each with its
// number today, its month and its year, and the timeline of the term right under them, which you can switch on and
// off. Every race's average follows on the whiteboard below.
import React, { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/Link";
import Timeline, { type TLData } from "./timeline/Timeline";

const DAY = 86400000;
const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Card({ d, on, onPick }: { d: TLData; on: boolean; onPick: () => void }) {
  const isApp = d.kind === "approval";
  const last = d.daily[d.daily.length - 1];
  const net = (x: [number, number, number]) => x[1] - x[2];
  const fmt = (n: number) => (isApp ? `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}` : Math.abs(n) < 0.05 ? "Even" : `${n > 0 ? "D" : "R"} +${Math.abs(n).toFixed(1)}`);
  const ago = (days: number) => { const t = last[0] - days * DAY; return d.daily.find((x) => x[0] >= t) ?? d.daily[0]; };
  const m30 = net(last) - net(ago(30)), m365 = net(last) - net(ago(365));
  const chg = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
  // the past year as a line of the net number, with the timeline's events as ticks
  const spark = useMemo(() => {
    const t0 = last[0] - 365 * DAY; const pts = d.daily.filter((x) => x[0] >= t0);
    const vs = pts.map(net); const lo = Math.min(...vs) - 1, hi = Math.max(...vs) + 1;
    const X = (t: number) => ((t - t0) / (last[0] - t0)) * 300, Y = (v: number) => 64 - ((v - lo) / (hi - lo || 1)) * 60;
    const path = pts.map((x, i) => `${i ? "L" : "M"}${X(x[0]).toFixed(1)},${Y(net(x)).toFixed(1)}`).join("");
    const zero = lo < 0 && hi > 0 ? Y(0) : null;
    const evs = d.events.map((e) => ({ ...e, t: Date.parse(e.date + "T00:00:00Z") })).filter((e) => e.t >= t0 && e.t <= last[0]).map((e) => ({ x: X(e.t), title: `${e.title}, ${fmtDate(e.t)}`, kind: e.kind }));
    return { path, zero, evs, end: [X(last[0]), Y(net(last))] as [number, number] };
  }, [d, last]); // eslint-disable-line react-hooks/exhaustive-deps
  const good = (v: number) => (isApp ? v >= 0 : v > 0);
  return (
    <article className={`ph-card k-${d.kind}${on ? " on" : ""}`}>
      <div className="ph-ch"><span className="eye">{isApp ? "Trump job approval" : "Generic congressional ballot"}</span><span className="upd">Updated {d.updated}</span></div>
      <div className="ph-big">
        <b className={isApp ? (net(last) >= 0 ? "pos" : "neg") : net(last) > 0 ? "d" : "r"}>{fmt(net(last))}</b>
        <span>{isApp ? "net approval" : "On Point average"}</span>
      </div>
      <div className="ph-sides">
        <div style={{ ["--c" as string]: d.a.color }}><i /><span>{d.a.label}</span><b>{last[1].toFixed(1)}%</b></div>
        <div style={{ ["--c" as string]: d.b.color }}><i /><span>{d.b.label}</span><b>{last[2].toFixed(1)}%</b></div>
      </div>
      <svg className="ph-spark" viewBox="0 0 300 70" preserveAspectRatio="none" role="img" aria-label={`${d.title} over the past year`}>
        {spark.zero != null ? <line x1="0" x2="300" y1={spark.zero} y2={spark.zero} className="z" /> : null}
        {spark.evs.map((e, i) => <line key={i} x1={e.x} x2={e.x} y1="2" y2="68" className={`ev k-${e.kind}`}><title>{e.title}</title></line>)}
        <path d={spark.path} className="ln" vectorEffect="non-scaling-stroke" />
        <circle cx={spark.end[0]} cy={spark.end[1]} r="3.2" className="dot" />
      </svg>
      <div className="ph-chg">
        <span>30 days <b className={good(m30) ? "up" : "dn"}>{chg(m30)}</b></span>
        <span>One year <b className={good(m365) ? "up" : "dn"}>{chg(m365)}</b></span>
      </div>
      <div className="ph-act">
        <Link className="btn sm" href={d.avgHref}>Full average</Link>
        <button type="button" className={`btn sm${on ? " g" : ""}`} onClick={onPick} aria-pressed={on}>{on ? "On the timeline below" : "Walk its timeline"}</button>
      </div>
    </article>
  );
}

export default function PollsHome({ approval, generic }: { approval: TLData; generic: TLData }) {
  const [show, setShow] = useState(true);
  const [pick, setPick] = useState<"approval" | "generic">("generic");
  useEffect(() => { try { const v = localStorage.getItem("opp.polls.tl"); if (v === "0") setShow(false); const p = localStorage.getItem("opp.polls.tlpick"); if (p === "approval" || p === "generic") setPick(p); } catch { /* storage off */ } }, []);
  const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage off */ } };
  const toggle = () => setShow((s) => { save("opp.polls.tl", s ? "0" : "1"); return !s; });
  const choose = (p: "approval" | "generic") => { setPick(p); save("opp.polls.tlpick", p); if (!show) { setShow(true); save("opp.polls.tl", "1"); } try { document.getElementById("ph-tl")?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* no scroll */ } };
  const d = pick === "approval" ? approval : generic;
  return (
    <div className="opp ph">
      <header className="ph-hero">
        <span className="eye g">Polling averages · 2026</span>
        <h1>The national mood, <em>poll by poll.</em></h1>
        <p>The two numbers every race moves with: the generic congressional ballot and Donald Trump&rsquo;s job approval, each a robust LOWESS fit through every public poll, weighted by recency, sample size, voter screen and pollster grade. Below them, walk the whole term day by day, then every Senate, governor and House race on the board.</p>
      </header>
      <div className="ph-cards">
        <Card d={generic} on={show && pick === "generic"} onPick={() => choose("generic")} />
        <Card d={approval} on={show && pick === "approval"} onPick={() => choose("approval")} />
      </div>
      <div className="ph-tlbar" id="ph-tl">
        <button type="button" role="switch" aria-checked={show} className={`ph-sw${show ? " on" : ""}`} onClick={toggle}><i /><span>Timeline {show ? "on" : "off"}</span></button>
        <div className="ph-seg" role="group" aria-label="Timeline of">
          <button aria-pressed={pick === "generic"} onClick={() => choose("generic")}>Generic ballot</button>
          <button aria-pressed={pick === "approval"} onClick={() => choose("approval")}>Trump approval</button>
        </div>
        <span className="ph-hint">{show ? "Scroll through the term with Pointy. Every stop is an event that made news." : "Switch it on to walk the term day by day."}</span>
      </div>
      {show ? <Timeline key={d.id} data={d} embedded /> : null}
    </div>
  );
}
