"use client";
// The loud parts for a live stream: the rival panel, the chat vote, the BREAKING banner, the chaos wheel, the crowd
// splash, trophy toasts, the chat box and the trophy case.
import React, { useEffect, useMemo, useRef, useState } from "react";

/** Keep the latest callback without restarting timers on every parent render. */
function useLatest<T>(v: T) { const r = useRef(v); useEffect(() => { r.current = v; }, [v]); return r; }
import * as E from "../engine";
import { PLAN, rivalIntel, rivalProfile, starsTxt } from "../rival";
import { TROPHIES, type Trophy } from "../achieve";
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
const SPLASH = { viral: ["GONE VIRAL", "Millions of views overnight"], packed: ["PACKED HOUSE", "A line out the door"], dud: ["EMPTY SEATS", "The local news noticed"], wild: ["CROWD GOES WILD", "Every applause line landed"], flop: ["CRICKETS", "The applause lines fell flat"], bull: ["KALSHI SURGE", "Traders are buying you"], bear: ["KALSHI SELLOFF", "Traders are dumping you"], whale: ["WHALE ALERT", "One trade just moved your line"], ad: ["AD IS LIVE", "Your spot hits the airwaves"] } as const;
export type SplashKind = keyof typeof SPLASH;
export function Splash({ kind, sub, onDone }: { kind: keyof typeof SPLASH; sub?: string; onDone: () => void }) {
  const done = useLatest(onDone);
  useEffect(() => { sfx(kind === "dud" || kind === "flop" ? "boo" : kind === "bear" ? "bad" : kind === "bull" || kind === "whale" ? "coin" : kind === "ad" ? "whoosh" : "crowd"); const f = kind === "viral" || kind === "wild" || kind === "bull" || kind === "whale" ? setTimeout(() => sfx("fanfare"), 250) : 0; const id = setTimeout(() => done.current(), 1900); return () => { clearTimeout(id); clearTimeout(f); }; }, [kind, done]);
  return <div className={cls("px-splash", kind)} role="status" onClick={onDone}><b>{SPLASH[kind][0]}</b><span>{sub ?? SPLASH[kind][1]}</span></div>;
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

// ============================================================ the show tab: settings for playing on camera
export type ShowCfg = { clock: number; loud: boolean; keys: boolean; crowd: boolean; ads: boolean };
export const DEF_SHOW: ShowCfg = { clock: 20, loud: true, keys: true, crowd: true, ads: true };
const SHOW_KEY = "opp_play_show";
export function loadShow(): ShowCfg { try { return { ...DEF_SHOW, ...JSON.parse(localStorage.getItem(SHOW_KEY) || "{}") }; } catch { return DEF_SHOW; } }
export function saveShow(c: ShowCfg) { try { localStorage.setItem(SHOW_KEY, JSON.stringify(c)); } catch { /* storage blocked */ } }
export function ShowPane({ cfg, setCfg, canSpin, spin }: { cfg: ShowCfg; setCfg: (c: ShowCfg) => void; canSpin: boolean; spin: () => void }) {
  const set = (p: Partial<ShowCfg>) => { setCfg({ ...cfg, ...p }); sfx("click"); };
  return (
    <div className="px-air px-stream">
      <p className="px-note">Settings for playing on camera. Most change only how loud the game is; working the crowd and the ad studio can also add a little to a rally or an ad, or cost you when they flop.</p>
      <div className="px-row wrap"><span className="px-k">Crisis clock</span>{[0, 10, 20, 30].map((v) => <button key={v} type="button" className={cls("px-chipb", cfg.clock === v && "on")} onClick={() => set({ clock: v })}>{v ? `${v}s` : "Off"}</button>)}</div>
      <p className="px-note">A crisis card starts a countdown. Run out of time and the campaign puts out a flat denial for you.</p>
      <label className="px-check" htmlFor="px-sh-loud"><input id="px-sh-loud" type="checkbox" checked={cfg.loud} onChange={(e) => set({ loud: e.target.checked })} />BREAKING banners, crowd splashes and Kalshi alerts</label>
      <label className="px-check" htmlFor="px-sh-crowd"><input id="px-sh-crowd" type="checkbox" checked={cfg.crowd} onChange={(e) => set({ crowd: e.target.checked })} />Work the crowd after every rally: hit the applause lines</label>
      <label className="px-check" htmlFor="px-sh-ads"><input id="px-sh-ads" type="checkbox" checked={cfg.ads} onChange={(e) => set({ ads: e.target.checked })} />Ad studio: watch your TV ad and the focus group dial before it airs</label>
      <label className="px-check" htmlFor="px-sh-keys"><input id="px-sh-keys" type="checkbox" checked={cfg.keys} onChange={(e) => set({ keys: e.target.checked })} />Show the 1 to 4 key numbers on cards</label>
      <button type="button" className="px-act wide" disabled={!canSpin} onClick={spin}><b>Spin the chaos wheel</b><span>Once a week. Something loud and strange happens; how it plays depends on your answer.</span></button>
      <span className="px-k">Keys</span>
      <ul className="px-cmds"><li><b>1 to 4</b> answer the card on screen</li><li><b>Space</b> hits the applause line when you work the crowd</li><li><b>On election night</b> call the race yourself before the desk does</li></ul>
    </div>
  );
}

/** The opponent's rating for the lobby. */
export function RivalBadge({ r, side }: { r: E.RaceFile; side: E.Side }) {
  const v = useMemo(() => { try { const c = E.ctx(r, side); return { ...rivalProfile(c), name: c.op.name }; } catch { return null; } }, [r, side]);
  if (!v) return null;
  return <span className="px-rbadge" title={v.why.join(". ")}><em>Your rival {sur(v.name)}: {v.arche}</em><b>{starsTxt(v.stars)}</b></span>;
}
