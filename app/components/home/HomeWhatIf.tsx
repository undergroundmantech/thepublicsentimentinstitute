"use client";
// The home page What if band: call the closest races yourself and watch control of the Senate, the House and the
// governorships move, using the same joint simulations as the full What if page.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { prep, compute, type Data, type Model, type Pin } from "@/app/forecast/what-if/WhatIf";
import { Pointy } from "./Mascot";

const pc = (p: number) => (p > 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
const last = (n: string) => n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/, "").split(" ").slice(-1)[0];

export default function HomeWhatIf() {
  const [M, setM] = useState<Model | null>(null);
  const [pins, setPins] = useState<Record<string, Pin>>({});
  useEffect(() => { fetch("/forecast/whatif.json").then((r) => r.json()).then((d: Data) => setM(prep(d))).catch(() => {}); }, []);
  const out = useMemo(() => (M ? compute(M, pins, 0) : null), [M, pins]);
  const picks = useMemo(() => (M ? M.R.map((r, k) => ({ r, k })).filter(({ r }) => Math.abs(r.m) < 99).sort((a, b) => Math.abs(a.r.p - 0.5) - Math.abs(b.r.p - 0.5)).slice(0, 12) : []), [M]);
  const [joy, setJoy] = useState(false);
  const toggle = (id: string, side: "D" | "R") => { setJoy(true); setPins((o) => { const n = { ...o }; if (n[id]?.side === side) delete n[id]; else n[id] = { side, by: null }; return n; }); };
  useEffect(() => { if (!joy) return; const t = setTimeout(() => setJoy(false), 1500); return () => clearTimeout(t); }, [joy, pins]);
  const npin = Object.keys(pins).length;
  const sen = out?.ch.senate;
  const say = !out ? "Loading the simulations" : !npin ? <>Call a race below and I will rerun all <b>{M!.N.toLocaleString()}</b> simulations.</>
    : sen ? <>With your {npin} {npin === 1 ? "pick" : "picks"}, <span className={sen.now >= 0.5 ? "d" : "r"}><b>{sen.now >= 0.5 ? "Democrats" : "Republicans"}</b></span> win the Senate in <b>{pc(sen.now >= 0.5 ? sen.now : 1 - sen.now)}</b>.</> : null;
  const q = Object.entries(pins).map(([id, p]) => `${id}:${p.side}`).join(",");
  const Ch = ({ k, label }: { k: "senate" | "house" | "governor"; label: string }) => {
    const c = out?.ch[k]; if (!c) return <div className="hw-ch sx-skel" style={{ height: 104 }} />;
    const d = c.now - c.base;
    return (
      <div className="hw-ch">
        <span>{label}</span>
        <b className={c.now >= 0.5 ? "d" : "r"}>{pc(c.now >= 0.5 ? c.now : 1 - c.now)} {c.now >= 0.5 ? "D" : "R"}</b>
        <small>{Math.abs(d) < 0.005 ? "As forecast" : `${d > 0 ? "+" : "-"}${Math.abs(d * 100).toFixed(0)} pts for Democrats`}</small>
        <i className="bar"><s style={{ width: `${c.now * 100}%` }} /></i>
      </div>
    );
  };
  return (
    <section className="hw" aria-labelledby="hw-h">
      <Pointy className="hw-mascot pty-side" pose={joy ? "cheer" : npin ? "point" : "think"} prop={joy ? "flag" : npin ? "none" : "ballot"} size={130} look={-1} flip={!!npin && !joy} say={say} />
      <div className="hw-grid">
        <div>
          <div className="eye g">What if</div>
          <h2 id="hw-h">You call the races. <em>Watch the map move.</em></h2>
          <p>Pick a winner in any of the closest races below. Every other race and control of each chamber moves with it, because the forecast&apos;s {M ? M.N.toLocaleString() : "2,000"} simulations tie the races together through one national environment, regional swings and shifts among groups of voters.</p>
          <div className="hw-chs"><Ch k="senate" label="Senate" /><Ch k="house" label="House" /><Ch k="governor" label="Governors" /></div>
          <div className="hw-acts">
            <Link className="btn g" href={`/forecast/what-if${q ? `?p=${encodeURIComponent(q)}` : ""}`}>Open the full What if</Link>
            <button className="btn" onClick={() => setPins({})}>Reset</button>
            {out && Object.keys(pins).length ? <span className="mute">{out.mode === "filter" ? `${out.n.toLocaleString()} simulations match your picks` : "Held at typical winning margins"}</span> : null}
          </div>
        </div>
        <div className="hw-races">
          {picks.map(({ r, k }) => {
            const p = pins[r.id];
            return (
              <div key={r.id} className={`hw-race${p ? " on" : ""}`}>
                <span className="nm"><b>{r.name}</b><small>{last(r.dem)} vs {last(r.gop)} · {out ? pc(r.ind ? out.p[k] : out.p[k]) : pc(r.p)} {r.ind ? "I" : "D"}</small></span>
                <span className="bt">
                  <button className={p?.side === "D" ? "on d" : ""} onClick={() => toggle(r.id, "D")} aria-pressed={p?.side === "D"}>{last(r.dem)}</button>
                  <button className={p?.side === "R" ? "on r" : ""} onClick={() => toggle(r.id, "R")} aria-pressed={p?.side === "R"}>{last(r.gop)}</button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
