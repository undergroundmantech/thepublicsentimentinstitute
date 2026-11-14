"use client";
// The replay transport, on every results page while a replay runs: choose the night (source), the start time, play,
// pause, step between observations, seek, and speed (1x, 10x, 60x, 360x, 3600x). Every page reads the same engine
// clock (engineClient.ts), so the dashboard, the monitor, race pages and the Calls Desk always show the same moment.
// SIMULATED sources say so on the dock, on every chart and in the page header.
import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { REPLAY_SPEEDS } from "@/app/lib/engine/replay";
import type { Moment, MomentKind } from "@/app/lib/engine/moments";
import { engine, useEngine } from "./engineClient";
import "./replayDock.css";

const ET = "America/New_York";
const etClock = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: ET });
const etDay = (ms: number) => new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: ET });
const hourLabel = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", timeZone: ET }).replace(":00", "").replace(" ", "");
/** "YYYY-MM-DDTHH:MM" in Eastern time <-> epoch ms. Election night falls after the November 1 change to standard time (UTC-5). */
const toLocal = (ms: number) => new Date(ms - 5 * 3_600_000).toISOString().slice(0, 16);
const fromLocal = (s: string) => Date.parse(`${s}:00-05:00`);
const dayLabel = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: ET });
const NIGHT_END = Date.parse("2026-11-04T12:00:00Z");
/** a moment's time as text: the clock on election night, the day as well afterwards */
const momentTime = (ms: number) => (ms <= NIGHT_END ? new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET }) : `${dayLabel(ms)}, ${new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET })}`);
const KIND_LABEL: Record<MomentKind, string> = { POLLS_CLOSE: "Polls close", FIRST_VOTES: "First returns", OFFICIAL_CALL: "civicAPI call", OFFICIAL_CALL_CHANGED: "Call changed", OFFICIAL_CALL_WITHDRAWN: "Call withdrawn", MODEL_CALL: "Model call",
  MODEL_ALERT: "Alert", LEAD_CHANGE: "Lead change", FAVORITE_CHANGE: "Favourite flips", CHAMBER_FAVORITE: "Chamber", CHAMBER_THRESHOLD: "Chamber", CHAMBER_DECIDED: "Chamber decided", BIG_UPDATE: "Big update" };
const FILTERS: [string, string, (m: Moment) => boolean][] = [
  ["top", "Headlines", (m) => m.imp === 3],
  ["calls", "Calls", (m) => m.kind === "OFFICIAL_CALL" || m.kind === "MODEL_CALL" || m.kind === "OFFICIAL_CALL_CHANGED" || m.kind === "OFFICIAL_CALL_WITHDRAWN" || m.kind === "CHAMBER_DECIDED"],
  ["flips", "Leads and favourites", (m) => m.kind === "LEAD_CHANGE" || m.kind === "FAVORITE_CHANGE" || m.kind === "CHAMBER_FAVORITE" || m.kind === "CHAMBER_THRESHOLD"],
  ["polls", "Polls and first returns", (m) => m.kind === "POLLS_CLOSE" || m.kind === "FIRST_VOTES"],
  ["all", "Everything", () => true],
];
const NOT_RACE = new Set(["calls", "races", "map", "senate", "house", "governors", "measures"]);
const SPEED_LABEL: Record<number, string> = { 1: "1×", 10: "10×", 60: "60×", 360: "360×", 3600: "3600×" };
const SPEED_TITLE: Record<number, string> = { 1: "Real time", 10: "1 minute of the night every 6 seconds", 60: "1 minute of the night per second", 360: "6 minutes per second", 3600: "1 hour per second" };

/** The LIVE / REPLAY switch, for page headers. */
export function ModeSwitch() {
  const e = useEngine(); const [open, setOpen] = useState(false);
  const replayable = e.sources.filter((s) => s.ns !== "live" && s.ns !== "live-ondemand");
  if (!replayable.length && e.mode === "LIVE") return null;
  return (
    <div className="rp-switch" role="group" aria-label="Live or replay">
      <button type="button" aria-pressed={e.mode === "LIVE"} className={e.mode === "LIVE" ? "on live" : ""} onClick={() => e.mode !== "LIVE" && engine.exitReplay()}><i aria-hidden /> Live</button>
      <button type="button" aria-pressed={e.mode === "REPLAY"} aria-expanded={open} className={e.mode === "REPLAY" ? "on" : ""} onClick={() => (e.mode === "REPLAY" ? null : replayable.length === 1 ? engine.enterReplay(replayable[0].id) : setOpen(!open))}>Replay</button>
      {open && e.mode === "LIVE" ? (
        <ul className="rp-pick" role="menu">
          {replayable.map((s) => <li key={s.id}><button type="button" role="menuitem" onClick={() => { setOpen(false); void engine.enterReplay(s.id); }}><b className={s.mode === "SIMULATED" ? "sim" : ""}>{s.mode === "SIMULATED" ? "SIMULATED" : "Recorded"}</b> {s.label}<small>{s.times.length} observations</small></button></li>)}
        </ul>
      ) : null}
    </div>
  );
}

export default function ReplayDock() {
  const e = useEngine(); const c = e.clock;
  const [startText, setStartText] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [list, setList] = useState(false); const [filter, setFilter] = useState("top"); const [scopeWant, setScope] = useState<"all" | "race" | "state">("all"); const [upTo, setUpTo] = useState(false);
  const path = usePathname() ?? "";
  // what the visitor is looking at: the race a page reports (the monitor's open race), else the race page's own id
  const pm = path.match(/^\/results\/2026\/([^/]+)\/?$/); const pathRace = pm && !NOT_RACE.has(pm[1]) ? decodeURIComponent(pm[1]) : null;
  const focusRace = e.focus.raceId ?? pathRace, focusSt = e.focus.st ?? focusRace?.match(/^[a-z]+-([A-Z]{2})(-|$)/)?.[1] ?? null;
  // a scope whose race or state is no longer in view falls back to everything
  const scope = (scopeWant === "race" && !focusRace) || (scopeWant === "state" && !focusSt) ? "all" : scopeWant;
  useEffect(() => { const on = e.mode === "REPLAY"; document.body.classList.toggle("rp-on", on); document.documentElement.dataset.replay = on ? (e.info?.mode === "SIMULATED" ? "sim" : "on") : "off"; return () => { document.body.classList.remove("rp-on"); }; }, [e.mode, e.info?.mode]);
  useEffect(() => {
    if (e.mode !== "REPLAY") return;
    const onKey = (k: KeyboardEvent) => { const t = k.target as HTMLElement; if (t?.closest?.("input,select,textarea,[contenteditable]")) return;
      if (k.key === " ") { k.preventDefault(); if (engine.get().clock?.playing) engine.pause(); else engine.play(); }
      else if (k.key === "ArrowRight" && k.shiftKey) engine.step(1); else if (k.key === "ArrowLeft" && k.shiftKey) engine.step(-1); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [e.mode]);
  const long = !!c && c.endMs - c.startMs > 48 * 3_600_000;
  const hours = useMemo(() => { if (!c) return []; const out: number[] = []; const span = c.endMs - c.startMs;
    if (span > 48 * 3_600_000) { for (let t = Date.parse("2026-11-04T05:00:00Z"); t <= c.endMs; t += 24 * 3_600_000) if (t >= c.startMs) out.push(t); return out; }   // midnight Eastern, each day
    const stepH = span > 10 * 3_600_000 ? 2 : 1; for (let t = Math.ceil(c.startMs / 3_600_000) * 3_600_000; t <= c.endMs; t += stepH * 3_600_000) out.push(t); return out; }, [c?.startMs, c?.endMs]); // eslint-disable-line react-hooks/exhaustive-deps
  const scoped = useMemo(() => e.moments.filter((m) => (scope === "race" ? m.raceId === focusRace : scope === "state" ? m.st === focusSt : true)), [e.moments, scope, focusRace, focusSt]);
  const picked = useMemo(() => { const f = scope === "race" ? () => true : FILTERS.find((x) => x[0] === filter)?.[2] ?? (() => true); return scoped.filter(f); }, [scoped, filter, scope]);
  if (e.mode !== "REPLAY" || !c || !e.info) return null;
  const sim = e.info.mode === "SIMULATED";
  const pos = (t: number) => (100 * (t - c.startMs)) / Math.max(1, c.endMs - c.startMs);
  const events = (e.view?.ledger.events ?? []).filter((x) => x.kind === "MODEL_CALLED" || x.kind === "OFFICIAL_CALL").slice(-3).reverse();
  const shown = e.frame >= 0 ? e.timesMs[e.frame] : null;
  // markers: the headline moments of the span in view (or every moment of the race or state in focus)
  const marks = (scope === "all" ? scoped.filter((m) => m.imp === 3) : picked).map((m) => ({ m, t: Date.parse(m.t) })).filter((x) => x.t >= c.startMs && x.t <= c.endMs);
  const visible = (upTo ? picked.filter((m) => Date.parse(m.t) <= c.tMs) : picked);
  const nextM = picked.find((m) => Date.parse(m.t) > c.tMs + 500), prevM = [...picked].reverse().find((m) => Date.parse(m.t) < (shown ?? c.tMs) - 500);
  const mClass = (m: Moment) => (m.kind === "MODEL_CALL" ? "o" : m.kind === "OFFICIAL_CALL" || m.kind === "CHAMBER_DECIDED" ? "c" : m.kind === "POLLS_CLOSE" || m.kind === "FIRST_VOTES" ? "p" : m.kind === "LEAD_CHANGE" || m.kind === "FAVORITE_CHANGE" || m.kind.startsWith("CHAMBER") ? "f" : "a");
  return (
    <aside className={`rp-dock${sim ? " sim" : ""}${more ? " open" : " compact"}`} role="region" aria-label="Election night replay controls">
      <div className="rp-row">
        <span className="rp-badge" aria-live="polite"><i aria-hidden />{sim ? "Simulated replay · not actual results" : "Recorded replay"}</span>
        <div className="rp-clock" aria-live="off"><b>{etClock(c.tMs)}</b><small> ET</small><span>{etDay(c.tMs)} · {shown != null ? `as of ${new Date(shown).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET })}` : "before the first observation"}</span></div>
        <div className="rp-xport" role="group" aria-label="Playback">
          <button type="button" onClick={() => engine.step(-1)} title="Previous observation (Shift + Left)" aria-label="Previous observation">‹</button>
          <button type="button" className="play" onClick={() => (c.playing ? engine.pause() : engine.play())} aria-label={c.playing ? "Pause" : "Play"} title="Play or pause (Space)">{c.playing ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg> : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>}</button>
          <button type="button" onClick={() => engine.step(1)} title="Next observation (Shift + Right)" aria-label="Next observation">›</button>
        </div>
        <div className="rp-speed" role="group" aria-label="Playback speed">
          {REPLAY_SPEEDS.map((s) => <button key={s} type="button" aria-pressed={c.speed === s} title={SPEED_TITLE[s]} aria-label={`${s} times: ${SPEED_TITLE[s]}`} onClick={() => engine.speed(s)}>{SPEED_LABEL[s]}</button>)}
        </div>
        {e.moments.length ? (
          <div className="rp-xport rp-mom" role="group" aria-label="Key moments">
            <button type="button" disabled={!prevM} onClick={() => prevM && engine.jump(Date.parse(prevM.t))} title={prevM ? `Back to: ${prevM.title}` : "No earlier moment"} aria-label="Previous key moment">« </button>
            <button type="button" aria-expanded={list} className={list ? "on" : ""} onClick={() => setList(!list)}>Key moments</button>
            <button type="button" disabled={!nextM} onClick={() => nextM && engine.jump(Date.parse(nextM.t))} title={nextM ? `Next: ${nextM.title}` : "No later moment"} aria-label="Next key moment"> »</button>
          </div>
        ) : null}
        <button type="button" className="rp-more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Less" : "More"}</button>
        <button type="button" className="rp-exit" onClick={() => engine.exitReplay()}>Back to live</button>
        {e.windows.length > 1 ? (
          <div className="rp-speed rp-win rp-x" role="group" aria-label="Span of the replay">
            {e.windows.map((w) => <button key={w.id} type="button" aria-pressed={e.window === w.id} onClick={() => engine.setWindow(w.id)}>{w.label}</button>)}
          </div>
        ) : null}
        <label className="rp-start rp-x"><span>Start at (ET)</span>
          <input type="datetime-local" step={60} value={startText ?? toLocal(c.tMs)} min={toLocal(c.startMs)} max={toLocal(c.endMs)} onChange={(x) => setStartText(x.target.value)} onBlur={() => { if (startText) { const t = fromLocal(startText); if (Number.isFinite(t)) engine.seek(t); } setStartText(null); }} onKeyDown={(x) => { if (x.key === "Enter") (x.target as HTMLInputElement).blur(); }} />
        </label>
        <button type="button" className="rp-link rp-x" onClick={() => { const u = `${window.location.origin}${window.location.pathname}?replay=${encodeURIComponent(e.source)}&at=${new Date(c.tMs).toISOString()}`; void navigator.clipboard?.writeText(u); }} title="Copy a link to this moment">Copy link</button>
      </div>
      <div className="rp-scrub">
        <input type="range" min={c.startMs} max={c.endMs} step={1000} value={c.tMs} aria-label="Replay time" aria-valuetext={`${etClock(c.tMs)} Eastern`} onChange={(x) => engine.seek(Number(x.target.value))} style={{ ["--pos" as string]: `${pos(c.tMs)}%` }} />
        <div className="rp-marks" aria-hidden>
          {e.info.gaps.map((g) => <span key={g.from} className="gap" style={{ left: `${pos(Date.parse(g.from))}%`, width: `${pos(Date.parse(g.to)) - pos(Date.parse(g.from))}%` }} title={`${g.minutes} minutes with no observation`} />)}
          {e.timesMs.length <= 200 ? e.timesMs.map((t) => <i key={t} className="ob" style={{ left: `${pos(t)}%` }} />) : null}
        </div>
        {marks.length ? <div className="rp-marks rp-moms">{marks.slice(0, 400).map(({ m, t }, i) => <button key={`${m.t}${m.kind}${m.raceId ?? m.chamber ?? i}`} type="button" tabIndex={-1} className={`mk k-${mClass(m)}`} style={{ left: `${pos(t)}%` }} title={`${momentTime(t)} ET: ${m.title}`} aria-label={`${momentTime(t)} Eastern: ${m.title}`} onClick={() => engine.jump(t)} />)}</div> : null}
        <div className="rp-hours" aria-hidden>{hours.map((t) => <span key={t} style={{ left: `${pos(t)}%` }}>{long ? dayLabel(t) : hourLabel(t)}</span>)}</div>
      </div>
      {list && e.moments.length ? (
        <section className="rp-list" aria-label="Key moments of the night">
          <div className="rp-chips" role="group" aria-label="Which moments">
            {focusRace ? <button type="button" aria-pressed={scope === "race"} onClick={() => setScope(scope === "race" ? "all" : "race")}>This race</button> : null}
            {focusSt ? <button type="button" aria-pressed={scope === "state"} onClick={() => setScope(scope === "state" ? "all" : "state")}>{focusSt} only</button> : null}
            {scope !== "race" ? FILTERS.map(([k, l]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>) : null}
            <label><input type="checkbox" checked={upTo} onChange={(x) => setUpTo(x.target.checked)} /> Hide what has not happened yet</label>
            <span className="n">{visible.length.toLocaleString("en-US")} moment{visible.length === 1 ? "" : "s"}</span>
          </div>
          <ol>
            {visible.slice(0, 500).map((m, i) => { const t = Date.parse(m.t), past = t <= c.tMs; return (
              <li key={`${m.t}${m.kind}${m.raceId ?? m.chamber ?? m.st ?? i}`} className={`${past ? "past" : "next"}${shown === t ? " now" : ""}`}>
                <button type="button" onClick={() => engine.jump(t)} title="Go to this moment">
                  <time>{momentTime(t)}</time><em className={`k-${mClass(m)}`}>{KIND_LABEL[m.kind]}</em><b>{m.title}</b>
                  {m.detail || m.at ? <small>{m.at && m.kind !== "POLLS_CLOSE" ? `civicAPI's stated time ${momentTime(Date.parse(m.at))} ET. ` : ""}{m.detail ?? ""}</small> : null}
                </button>
              </li>); })}
            {!visible.length ? <li className="none">No moments in this view.</li> : null}
          </ol>
          {visible.length > 500 ? <p className="rp-note">Showing the first 500. Narrow the list with a filter, a race or a state.</p> : null}
        </section>
      ) : null}
      <div className="rp-foot rp-x">
        <ol className="rp-calls" aria-label="Latest calls">
          {events.length ? events.map((x) => <li key={x.seq} className={x.kind === "MODEL_CALLED" ? "o" : "d"}><time>{etClock(Date.parse(x.at))}</time>{x.kind === "MODEL_CALLED" ? "Model call" : "Official call"}: {x.name} ({x.raceId})</li>) : <li className="none">No calls at this moment.</li>}
        </ol>
        <p className="rp-note">{sim ? <><b>Simulated.</b> Interpolated test data for checking the replay. These are not actual returns, and call times here say nothing about the real night.</> : <>Recorded observations replayed as they arrived; between observations a figure holds. Projections are model estimates, not results. {e.info.notes[0] ?? ""}</>}</p>
      </div>
    </aside>
  );
}
