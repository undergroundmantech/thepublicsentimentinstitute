"use client";
// Campaign 2028, after the polls close: the recount, the speech, what happened down the ballot, the campaign diary, the
// first hundred days and the 2030 midterm outlook, plus the daily challenge's scores on this device.
import React, { useState } from "react";
import * as E from "./engine28";
import * as MO from "./more28";
import { Face28, FEMALE } from "./ui28";
import { cls } from "../px/ui";
import { seedOf } from "../px/sprites";
import { sfx } from "../px/sound";

/** States inside half a point go to a recount: pick a strategy for each, then see what moved. */
export function Recount28({ d, s, res, seed, onDone }: { d: E.Data; s: E.GenS; res: E.NightRes; seed: number; onDone: (res: E.NightRes, legacy: number) => void }) {
  const [rcs, setRcs] = useState<MO.Recount[]>(() => MO.recountsFor(res));
  const [picks, setPicks] = useState<Record<string, string>>({});
  const ran = rcs.every((r) => r.after != null);
  const run = () => { const G = { rng: seed }; setRcs(rcs.map((r) => MO.runRecount(d, s, r, picks[r.st] ?? "accept", G))); sfx("whoosh"); };
  const legacy = rcs.reduce((a, r) => a + (MO.RC_OPTS[picks[r.st] ?? "accept"]?.legacy ?? 0), 0);
  const fin = ran ? MO.applyRecounts(d, res, rcs) : null;
  return (
    <div className="px-lobby y28-result">
      <section className="px-step">
        <span className="px-tag hot">Too close to call</span><h2 className="y28-big">The recount</h2>
        <p className="px-note">{rcs.length === 1 ? "One state finished" : `${rcs.length} states finished`} inside half a point. Recounts usually move a few hundred votes and court fights a few thousand, so only the very closest states can flip.{s.lawyers ? " Your election protection team is already in place." : " You never built an election protection team, so your lawyers start late."}</p>
        <ul className="y28-regs">{rcs.map((r) => (
          <li key={r.st} className="rc"><div><b>{E.nameOf(d, r.st)} · {r.ev} electoral votes</b><small>{r.m >= 0 ? "You lead" : "You trail"} by {(Math.abs(r.m) * (d.states.find((x) => x.st === r.st)?.votes ?? 3e6) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} votes, {Math.abs(r.m).toFixed(2)} points</small>
            {r.after == null ? <div className="px-chips">{Object.entries(MO.RC_OPTS).map(([k, o]) => <button key={k} type="button" className={(picks[r.st] ?? "accept") === k ? "on" : ""} title={o.blurb} onClick={() => setPicks({ ...picks, [r.st]: k })}>{o.l}</button>)}</div>
              : <small className={r.after > 0 ? "up" : "dn"}>After the recount: {r.after > 0 ? "yours" : "theirs"} by {Math.abs(r.after).toFixed(3)} points{(r.after > 0) !== (r.m > 0) ? ". The state flipped." : "."}</small>}</div></li>
        ))}</ul>
        {!ran ? <button type="button" className="px-press" onClick={run}>Start the recounts</button>
          : <div className="px-row"><b>{fin!.win ? `You hold ${fin!.ev} electoral votes. You win.` : `You finish with ${fin!.ev} electoral votes.`}</b><button type="button" className="px-press" onClick={() => onDone({ ...fin!, rc: rcs }, legacy)}>Certify the results</button></div>}
      </section>
    </div>
  );
}

/** The election night speech: how you win or lose is remembered. */
export function Speech28({ s, res, onPick }: { s: E.GenS; res: E.NightRes; onPick: (k: string, legacy: number) => void }) {
  const opts = res.win
    ? [{ k: "unity", l: "A unity speech", say: "I will be a president for the people who voted against me too.", v: 6 }, { k: "lap", l: "A victory lap", say: "They said we could not do it. Look at us now.", v: -2 }]
    : [{ k: "concede", l: "Concede graciously", say: "I called to congratulate my opponent. Our democracy is bigger than any of us.", v: 10 }, { k: "wait", l: "Wait for every vote", say: "We will not concede until every legal ballot is counted.", v: 0 }, { k: "contest", l: "Contest the result", say: "This election was stolen, and we will fight it.", v: -15 }];
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-sp-h">
      <div className="px-card ev y28-ev y28-speech">
        <div className="px-row"><Face28 seed={seedOf(s.me)} party={s.party} size={64} female={FEMALE.has(s.me)} talking /><div><span className={cls("px-tag", res.win ? "real" : "hot")}>Election night</span><h3 id="y28-sp-h">{res.win ? "Your victory speech" : "What you tell your supporters"}</h3></div></div>
        <div className="y28-opts">{opts.map((o) => <button key={o.k} type="button" className="px-btn" onClick={() => { sfx("card"); onPick(o.k, o.v); }}><small>{o.l}</small><span>“{o.say}”</span></button>)}</div>
      </div>
    </div>
  );
}

/** Down the ballot, the diary and the way forward, shown under the final map. */
export function AfterCard({ d, s, res, legacy, onGovern, iron }: { d: E.Data; s: E.GenS; res: E.NightRes; legacy: number; onGovern?: () => void; iron?: boolean }) {
  const sen = MO.senateCount(d, s, res.calls.slice().sort((a, b) => a.i - b.i).map((c) => c.m)); const house = MO.houseSeats(res.pop);
  const text = MO.diary(d, s, res, legacy); const [copied, setCopied] = useState(false);
  const flips = sen.races.filter((r) => (r.m > 0) !== r.mine);
  return (
    <div className="y28-after">
      <div className="y28-kvs">
        <span><small>Senate</small><b className={sen.mine >= 50 ? "up" : "dn"}>{sen.mine} to {sen.theirs}</b></span>
        <span><small>House, projected</small><b className={house >= 218 ? "up" : "dn"}>{house} to {435 - house}</b></span>
        <span><small>Legacy</small><b className={legacy >= 0 ? "up" : "dn"}>{legacy >= 0 ? "+" : ""}{legacy}</b></span>
        {res.rc?.length ? <span><small>Recounts</small><b>{res.rc.length}</b></span> : null}
        {iron ? <span><small>Ironman</small><b>On</b></span> : null}
      </div>
      {flips.length ? <p className="px-note">Senate seats that changed hands: {flips.map((r) => `${E.nameOf(d, r.st)} to ${r.m > 0 ? "your party" : "theirs"}`).join(", ")}.</p> : null}
      <span className="px-k">The campaign diary</span>
      <p className="y28-diary">{text}</p>
      <div className="px-row">
        <button type="button" className="px-btn sm" onClick={() => { try { void navigator.clipboard.writeText(`${text} Played on onpointpolitics.com/play`); setCopied(true); } catch { /* clipboard blocked */ } }}>{copied ? "Copied" : "Copy the diary to share"}</button>
        {onGovern ? <button type="button" className="px-press" onClick={onGovern}>Govern: the first hundred days</button> : null}
      </div>
    </div>
  );
}

/** The first hundred days: confirm the cabinet, pick three priorities, then see the 2030 midterm outlook. */
export function Hundred28({ d, s, res, seed, legacy, onDone }: { d: E.Data; s: E.GenS; res: E.NightRes; seed: number; legacy: number; onDone: (h: MO.Hundred) => void }) {
  const [picks, setPicks] = useState<number[]>([]); const [h, setH] = useState<MO.Hundred | null>(null);
  const sen = MO.senateCount(d, s, res.calls.slice().sort((a, b) => a.i - b.i).map((c) => c.m)); const house = MO.houseSeats(res.pop);
  const tog = (k: number) => setPicks(picks.includes(k) ? picks.filter((x) => x !== k) : picks.length < 3 ? [...picks, k] : picks);
  return (
    <div className="px-lobby y28-result">
      <section className="px-step">
        <span className="px-tag real">January 20, 2029</span><h2 className="y28-big">The first hundred days</h2>
        <p className="px-note">Your party has {sen.mine} Senate seats and about {house} House seats. {sen.mine >= 50 && house >= 218 ? "Unified control: you can pass things, if your party holds together." : sen.mine >= 50 ? "The Senate is yours, the House is not. Nominees get confirmed, bills stall." : house >= 218 ? "The House is yours, the Senate is not. Expect a fight over every nominee." : "Divided government. Every win will be hard."}</p>
        {!h ? <>
          <span className="px-k">Pick three priorities for your first hundred days</span>
          <div className="px-diffs">{d.issues.map((is, k) => { const said = s.story?.said?.[k]; return (
            <button key={is.k} type="button" className={cls("px-diff", picks.includes(k) && "on")} aria-pressed={picks.includes(k)} onClick={() => tog(k)}><b>{is.l}</b><small>{said ? `You promised: “${said.label}”` : "You never took a public stand on this."}</small></button>); })}</div>
          <span className="px-k">Your cabinet promises · {s.mo?.cabinet.length ?? 0}</span>
          <ul className="y28-brief">{(s.mo?.cabinet ?? []).map((c) => <li key={c.who}><span>{c.post}</span><b>{c.who}</b></li>)}</ul>
          <button type="button" className="px-press" disabled={picks.length < 3} onClick={() => { setH(MO.govern(d, s, res, picks, seed, legacy)); sfx("fanfare"); }}>Send it to Congress</button>
        </> : <>
          <div className="y28-kvs">
            <span><small>Approval after 100 days</small><b className={h.approval >= 50 ? "up" : "dn"}>{h.approval.toFixed(0)}%</b></span>
            <span><small>2030 House outlook</small><b className={h.midHouse >= 0 ? "up" : "dn"}>{h.midHouse >= 0 ? "+" : ""}{h.midHouse} seats</b></span>
            <span><small>2030 Senate outlook</small><b className={h.midSenate >= 0 ? "up" : "dn"}>{h.midSenate >= 0 ? "+" : ""}{h.midSenate} seats</b></span>
          </div>
          <ul className="y28-brief">
            {h.passed.map((x) => <li key={x}><span>{x}</span><b className="up">Signed into law</b></li>)}
            {h.stalled.map((x) => <li key={x}><span>{x}</span><b className="dn">Stalled in Congress</b></li>)}
            {h.confirmed.map((x) => <li key={x}><span>{x}</span><b className="up">Confirmed</b></li>)}
            {h.failed.map((x) => <li key={x}><span>{x}</span><b className="dn">Did not happen</b></li>)}
          </ul>
          <p className="px-note">The president&apos;s party has lost House seats in almost every midterm since the Second World War. Your approval decides how bad 2030 gets.</p>
          <button type="button" className="px-press" onClick={() => onDone(h)}>Finish</button>
        </>}
      </section>
    </div>
  );
}

// ------------------------------------------------------------- the daily challenge, kept on this device
const DKEY = "opp_play28_daily";
export type DailyRow = { day: number; me: string; ev: number; win: boolean; pop: number };
export function loadDaily(): DailyRow[] { try { return JSON.parse(localStorage.getItem(DKEY) ?? "[]") as DailyRow[]; } catch { return []; } }
export function saveDaily(r: DailyRow) { try { const a = [...loadDaily(), r].sort((x, y) => y.day - x.day || y.ev - x.ev).slice(0, 30); localStorage.setItem(DKEY, JSON.stringify(a)); } catch { /* storage blocked */ } }
export function DailyBoard({ onPlay }: { onPlay: () => void }) {
  const today = MO.dailySeed(); const rows = loadDaily().filter((r) => r.day === today).sort((a, b) => b.ev - a.ev).slice(0, 5);
  return (
    <div className="y28-daily">
      <button type="button" className="px-press ghost" onClick={() => { sfx("coin"); onPlay(); }}>Daily challenge</button>
      <small>Same race for everyone today: same candidates, same seed, toss up year. {rows.length ? `Your best today: ${rows.map((r) => `${r.ev} EV${r.win ? ", won" : ""}`).join(" · ")}` : "Scores stay on this device."}</small>
    </div>
  );
}
