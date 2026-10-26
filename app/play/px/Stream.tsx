"use client";
// The loud parts for a live stream: the rival panel, the chat vote, the BREAKING banner, the chaos wheel, the crowd
// splash, trophy toasts, the chat box and the trophy case.
import React, { useEffect, useMemo, useRef, useState } from "react";

/** Keep the latest callback without restarting timers on every parent render. */
function useLatest<T>(v: T) { const r = useRef(v); useEffect(() => { r.current = v; }, [v]); return r; }
import * as E from "../engine";
import { PLAN, rivalIntel, rivalProfile, starsTxt } from "../rival";
import { TROPHIES, type Trophy } from "../achieve";
import type { ChatMsg, ChatStatus, StreamCfg } from "../stream";
import { Portrait, cls, sur, fxs } from "./ui";
import { seedOf } from "./sprites";
import { sfx } from "./sound";

// ============================================================ the rival
export function RivalPanel({ s, c }: { s: E.State; c: E.Ctx }) {
  const R = s.rival; const [open, setOpen] = useState(false);
  if (!R) return null;
  const intel = rivalIntel(c, s);
  const last = R.moves[R.moves.length - 1];
  const g = E.regionsOf(c.r)[R.region];
  return (
    <section className={cls("px-rival", open && "open")} aria-label="Your rival">
      <Portrait seed={seedOf(c.op.name)} role="cand" party={c.op.party} size={44} talking={!!last && last.w === s.week - 1} />
      <div className="who">
        <span className="px-k">Your rival · {R.arche}</span>
        <b>{c.op.name}</b>
        <span className="stars" aria-label={`${R.stars} of 5 stars`}>{starsTxt(R.stars)}</span>
      </div>
      <div className="plan">
        <span className="px-k">Their plan this week</span>
        {intel ? <><b className="hot">{PLAN[intel.plan].name}{intel.plan === "turf" && g ? `: ${g.name}` : ""}</b><small>{PLAN[intel.plan].counter}</small></>
          : <><b className="dim">Unknown</b><small>Hire opposition research to see their next move a week ahead.</small></>}
      </div>
      {last ? <div className={cls("last", last.fx > 0.005 ? "up" : last.fx < -0.005 ? "dn" : "")}><span className="px-k">Last week · {PLAN[last.plan].name}</span><em>&ldquo;{last.taunt}&rdquo;</em>{Math.abs(last.fx) > 0.005 ? <b>{fxs(last.fx)}</b> : null}</div> : null}
      <button type="button" className="px-icon" onClick={() => { setOpen((v) => !v); sfx("click"); }} aria-expanded={open}>{open ? "LESS" : "FILE"}</button>
      {open ? (
        <div className="more">
          <span className="px-k">Why they are this good</span>
          <ul>{R.why.map((w) => <li key={w}>{w}</li>)}</ul>
          <span className="px-k">Moves countered {R.countered} of {R.moves.filter((m) => m.plan !== "money" && m.plan !== "surprise" && m.plan !== "coast").length}</span>
          <ol className="moves">{[...R.moves].reverse().slice(0, 6).map((m, i) => <li key={i}><span>W{m.w}</span><b>{PLAN[m.plan].name}</b>{Math.abs(m.fx) > 0.005 ? <em className={m.fx >= 0 ? "up" : "dn"}>{fxs(m.fx)}</em> : <em>even</em>}</li>)}</ol>
        </div>
      ) : null}
    </section>
  );
}

/** The rival's move as the headline of the week report. */
export function RivalMoveCard({ s, c }: { s: E.State; c: E.Ctx }) {
  const m = s.rival?.moves[s.rival.moves.length - 1];
  if (!m || m.w !== s.week - 1) return null;
  const good = m.fx > 0.005, bad = m.fx < -0.005;
  return (
    <div className={cls("px-rmove", good && "good", bad && "bad")}>
      <Portrait seed={seedOf(c.op.name)} role="cand" party={c.op.party} size={48} talking />
      <div><span className="px-k">Rival move · {PLAN[m.plan].name}</span><p className="taunt">&ldquo;{m.taunt}&rdquo;</p><small>{m.t}</small></div>
      <b className={good ? "up" : bad ? "dn" : ""}>{Math.abs(m.fx) > 0.005 ? fxs(m.fx) : "even"}</b>
    </div>
  );
}

// ============================================================ chat vote
export function ChatVote({ labels, blocked, counts, left, total, onEnd }: { labels: string[]; blocked: boolean[]; counts: number[]; left: number; total: number; onEnd: () => void }) {
  const n = counts.reduce((a, b) => a + b, 0); const top = Math.max(0, ...counts);
  return (
    <div className="px-vote" role="status" aria-live="polite">
      <div className="hd"><span className="px-k">Chat decides · type 1 to {labels.length}</span><b className={cls("clock", left <= 5 && "hot")}>{left}s</b></div>
      <span className="timer"><i style={{ width: `${(100 * left) / Math.max(1, total)}%` }} /></span>
      <ul>{labels.map((l, i) => (
        <li key={i} className={cls(blocked[i] && "off", counts[i] === top && top > 0 && "lead")}>
          <b>{i + 1}</b><span className="l">{l}{blocked[i] ? " · not available" : ""}</span>
          <span className="bar"><i style={{ width: `${n ? (100 * counts[i]) / n : 0}%` }} /></span><em>{counts[i]}</em>
        </li>
      ))}</ul>
      <div className="ft"><small>{n} vote{n === 1 ? "" : "s"}. Keys 1 to {labels.length} add a vote from the room.</small><button type="button" className="px-ghost sm" onClick={onEnd}>Close the vote</button></div>
    </div>
  );
}

export function CrisisClock({ left, total }: { left: number; total: number }) {
  return <div className={cls("px-cclock", left <= 5 && "hot")} role="timer" aria-label={`${left} seconds to decide`}><b>{left}</b><span>seconds before the campaign answers for you</span><i style={{ width: `${(100 * left) / Math.max(1, total)}%` }} /></div>;
}

// ============================================================ breaking news
const LOUD: Record<string, string> = { flash: "Breaking news", shock: "The world moves", osurprise: "October surprise", crisis: "Crisis", chaos: "Chaos", attack: "Incoming attack", fringe: "Uh oh" };
export const isLoud = (k: string) => k in LOUD;
export function Breaking({ ev, onDone }: { ev: E.Ev; onDone: () => void }) {
  const done = useLatest(onDone);
  useEffect(() => { sfx(ev.kind === "chaos" ? "dice" : "alarm"); const id = setTimeout(() => done.current(), 2400); return () => clearTimeout(id); }, [ev, done]);
  return (
    <div className={cls("px-breaking", ev.kind)} role="alert" onClick={onDone}>
      <span className="bar"><b>{LOUD[ev.kind] ?? "Breaking"}</b></span>
      <span className="hl">{ev.title}</span>
      <span className="bar low" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <b key={i}>{LOUD[ev.kind] ?? "Breaking"}</b>)}</span>
    </div>
  );
}

// ============================================================ chaos wheel
export function ChaosWheel({ titles, land, onDone }: { titles: string[]; land: string; onDone: () => void }) {
  const [i, setI] = useState(0); const [stop, setStop] = useState(false);
  useEffect(() => {
    let n = 0, id = 0;
    const tick = () => { n++; setI((x) => x + 1); sfx("tick"); if (n < 18) id = window.setTimeout(tick, 40 + n * n * 0.7); else { setStop(true); sfx("dice"); } };
    id = window.setTimeout(tick, 60); return () => clearTimeout(id);
  }, []);
  const done = useLatest(onDone);
  useEffect(() => { if (!stop) return; const id = setTimeout(() => done.current(), 1500); return () => clearTimeout(id); }, [stop, done]);
  const show = stop ? land : titles[i % Math.max(1, titles.length)];
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-label="The chaos wheel">
      <button type="button" className="px-wheel" onClick={() => stop && onDone()}>
        <span className="px-tag hot">The chaos wheel</span>
        <span className={cls("disc", stop && "stop")} aria-hidden="true">{Array.from({ length: 12 }, (_, k) => <i key={k} style={{ transform: `rotate(${k * 30 + i * 17}deg)` }} />)}</span>
        <b className={cls("px-slot", stop && "stop")}>{show}</b>
        <em>{stop ? "Here it comes" : "Spinning"}</em>
      </button>
    </div>
  );
}

// ============================================================ crowd splash and trophies
const SPLASH = { viral: ["GONE VIRAL", "Millions of views overnight"], packed: ["PACKED HOUSE", "A line out the door"], dud: ["EMPTY SEATS", "The local news noticed"], hype: ["HYPE TRAIN", "Chat lit up: buzz and volunteers up"] } as const;
export type SplashKind = keyof typeof SPLASH;
export function Splash({ kind, onDone }: { kind: keyof typeof SPLASH; onDone: () => void }) {
  const done = useLatest(onDone);
  useEffect(() => { sfx(kind === "dud" ? "boo" : "crowd"); const f = kind === "viral" || kind === "hype" ? setTimeout(() => sfx("fanfare"), 250) : 0; const id = setTimeout(() => done.current(), 1900); return () => { clearTimeout(id); clearTimeout(f); }; }, [kind, done]);
  return <div className={cls("px-splash", kind)} role="status" onClick={onDone}><b>{SPLASH[kind][0]}</b><span>{SPLASH[kind][1]}</span></div>;
}

export function TrophyToasts({ list, onDone }: { list: Trophy[]; onDone: (id: string) => void }) {
  const t = list[0];
  const done = useLatest(onDone);
  useEffect(() => { if (!t) return; sfx("fanfare"); const id = setTimeout(() => done.current(t.id), 3600); return () => clearTimeout(id); }, [t, done]);
  if (!t) return null;
  return (
    <div key={t.id} className={cls("px-trophy", `t${t.tier}`)} role="status">
      <span className="ic" aria-hidden="true">{t.tier === 3 ? "★" : t.tier === 2 ? "◆" : "●"}</span>
      <div><span className="px-k">Trophy unlocked{list.length > 1 ? ` · ${list.length - 1} more` : ""}</span><b>{t.name}</b><small>{t.desc}</small></div>
    </div>
  );
}

export function TrophyCase({ have }: { have: string[] }) {
  const got = new Set(have);
  return (
    <details className="px-case">
      <summary className="px-k">Trophy case · {TROPHIES.filter((t) => got.has(t.id)).length} of {TROPHIES.length} unlocked</summary>
      <ul>{TROPHIES.map((t) => <li key={t.id} className={cls(`t${t.tier}`, got.has(t.id) ? "got" : "lock")} title={t.desc}><i aria-hidden="true">{got.has(t.id) ? (t.tier === 3 ? "★" : t.tier === 2 ? "◆" : "●") : "?"}</i><span>{t.name}</span><small>{t.desc}</small></li>)}</ul>
    </details>
  );
}

// ============================================================ chat on screen
export function ChatBox({ recent, status, channel }: { recent: ChatMsg[]; status: ChatStatus; channel: string }) {
  const lines = recent.slice(-6);
  return (
    <aside className="px-chat" aria-label="Twitch chat">
      <span className={cls("px-k", status)}>{status === "live" ? `Live · #${channel}` : status === "connecting" ? "Connecting to chat" : status === "error" ? "Chat unreachable" : "Chat off"}</span>
      <ul>{lines.map((m) => <li key={m.t + m.user}><b style={m.color ? { color: m.color } : undefined}>{m.user}</b> {m.text.slice(0, 90)}</li>)}</ul>
    </aside>
  );
}

export function Meters({ chaos, hype, hypeUsed }: { chaos: number; hype: number; hypeUsed: boolean }) {
  return (
    <div className="px-cmeters" aria-label="Chat meters">
      <div><span className="px-k">Chaos meter · !chaos</span><span className="m chaos"><i style={{ width: `${chaos}%` }} /></span></div>
      <div><span className="px-k">Hype train · !hype{hypeUsed ? ", used this week" : ""}</span><span className="m hype"><i style={{ width: `${hype}%` }} /></span></div>
    </div>
  );
}

// ============================================================ the stream tab
export function StreamPane({ cfg, setCfg, status, recent, chaos, hype, hypeUsed, canSpin, spin }: { cfg: StreamCfg; setCfg: (c: StreamCfg) => void; status: ChatStatus; recent: ChatMsg[]; chaos: number; hype: number; hypeUsed: boolean; canSpin: boolean; spin: () => void }) {
  const [ch, setCh] = useState(cfg.channel);
  const set = (p: Partial<StreamCfg>) => { setCfg({ ...cfg, ...p }); sfx("click"); };
  return (
    <div className="px-air px-stream">
      <label className="px-check" htmlFor="px-st-on"><input id="px-st-on" type="checkbox" checked={cfg.on} onChange={(e) => set({ on: e.target.checked })} />Stream mode: chat votes, crisis clocks, BREAKING banners, the chat box</label>
      <div className="px-row wrap"><label className="px-k" htmlFor="px-st-ch">Twitch channel</label>
        <input id="px-st-ch" className="px-sel" placeholder="yourchannel" value={ch} onChange={(e) => setCh(e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 25))} />
        <button type="button" className="px-btn sm" onClick={() => set({ channel: ch, on: true })}>Connect</button>
        <b className={cls("px-live", status)}>{status === "live" ? "LIVE" : status === "connecting" ? "..." : status === "error" ? "ERROR" : "OFF"}</b></div>
      <p className="px-note">Reads public chat with no login. Nothing is posted to your channel.</p>
      <div className="px-row wrap"><span className="px-k">Vote length</span>{[15, 30, 45, 60].map((v) => <button key={v} type="button" className={cls("px-chipb", cfg.voteSec === v && "on")} onClick={() => set({ voteSec: v })}>{v}s</button>)}</div>
      <div className="px-row wrap"><span className="px-k">Crisis clock</span>{[0, 15, 20, 30].map((v) => <button key={v} type="button" className={cls("px-chipb", cfg.crisisSec === v && "on")} onClick={() => set({ crisisSec: v })}>{v ? `${v}s` : "Off"}</button>)}</div>
      <label className="px-check" htmlFor="px-st-box"><input id="px-st-box" type="checkbox" checked={cfg.chatBox} onChange={(e) => set({ chatBox: e.target.checked })} />Show chat on the game screen</label>
      <label className="px-check" htmlFor="px-st-auto"><input id="px-st-auto" type="checkbox" checked={!!cfg.auto} onChange={(e) => set({ auto: e.target.checked })} />Chat votes on every card automatically</label>
      <Meters chaos={chaos} hype={hype} hypeUsed={hypeUsed} />
      <button type="button" className="px-act wide" disabled={!canSpin} onClick={spin}><b>Spin the chaos wheel</b><span>Once a week, plus a free spin every time chat fills the chaos meter. Something loud and strange happens; how it plays depends on your answer.</span></button>
      <span className="px-k">Chat commands</span>
      <ul className="px-cmds"><li><b>1 to 4</b> vote on the card while a vote is open</li><li><b>!chaos</b> fills the chaos meter; full spins the wheel</li><li><b>!hype</b> fills the hype train; full gives buzz and volunteers once a week</li></ul>
      {recent.length ? <ul className="px-log">{recent.slice(-8).reverse().map((m) => <li key={m.t + m.user} className="news"><p><b>{m.user}</b> {m.text}</p></li>)}</ul> : null}
    </div>
  );
}

/** The opponent's rating for the lobby. */
export function RivalBadge({ r, side }: { r: E.RaceFile; side: E.Side }) {
  const v = useMemo(() => { try { const c = E.ctx(r, side); return { ...rivalProfile(c), name: c.op.name }; } catch { return null; } }, [r, side]);
  if (!v) return null;
  return <span className="px-rbadge" title={v.why.join(". ")}><em>Your rival {sur(v.name)}: {v.arche}</em><b>{starsTxt(v.stars)}</b></span>;
}
