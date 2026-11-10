"use client";
// The general election. Week by week to 270: move the candidate and the running mate, buy television market by
// market or book it ahead, poll the states you are unsure of, court nine voter groups, register voters before the
// deadline, build a volunteer army, chase ballots once early voting opens and bank them, hire senior staff, take
// meetings with the people who matter, dig up and drop opposition research, answer the news and the scandals, take
// three debates and close the final weekend, while the other campaign and both sides' super PACs fight back. Every
// Monday a department head briefs you, and every public word and private deal is remembered and comes back later.
import React, { useEffect, useMemo, useState } from "react";
import * as E from "./engine28";
import * as X2 from "./deep28";
import { dealCard, partyName } from "./cards28";
import TileMap28, { shade, type Mark } from "./TileMap28";
import { CardModal, CrisisModal, Debate28, FxCard } from "./Scenes28";
import { DaysBar, EVBar, Trend, Ticker, FEMALE, type Game, pct, ptsLead, Face28 } from "./ui28";
import { Roll, cls, sur } from "../px/ui";
import { seedOf } from "../px/sprites";
import { sfx, music } from "../px/sound";
import * as SY from "./story28";
import * as TM from "./team28";
import * as MO from "./more28";

type Tab = "state" | "groups" | "early" | "camp" | "ticket" | "oppo" | "polls" | "wire";
/** A debate's name from the calendar, which negotiations can change. */
const debName = (S: E.GenS, x?: { w: number; kind: "pres" | "vp" }) => {
  if (!x) return "Debate"; if (x.kind === "vp") return "Vice presidential debate";
  const pres = S.debates.filter((y) => y.kind === "pres"); const k = pres.indexOf(x as E.GenS["debates"][number]);
  return k === pres.length - 1 && k > 0 ? "Final presidential debate" : `${["First", "Second", "Third", "Fourth"][k] ?? "Another"} presidential debate`;
};
const TM_KEYS = Object.keys(TM.DEPTS) as TM.Dept[];
const TABS: [Tab, string][] = [["state", "State"], ["groups", "Groups"], ["early", "Early vote"], ["camp", "Campaign"], ["ticket", "Ticket"], ["oppo", "Oppo"], ["polls", "Polls"], ["wire", "Wire"]];

export default function Gen28({ d, g, commit, onDone }: { d: E.Data; g: Game; commit: (x: Game) => void; onDone: (x: Game) => void }) {
  const S = g.Gn!; const me = S.me, op = S.op; const opP: E.Party = S.party === "D" ? "R" : "D";
  const [sel, setSel] = useState<string | null>("PA");
  const [hov, setHov] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("state");
  const [tone, setTone] = useState<E.Tone>("contrast");
  const [resW, setResW] = useState<number>(0);
  const [toast, setToast] = useState<{ t: string; ok: boolean; k: number } | null>(null);
  const [fx, setFx] = useState<{ title: string; lines: { l: string; v: number }[] } | null>(null);
  const [report, setReport] = useState<E.LogItem[] | null>(null);
  const [debate, setDebate] = useState(false);
  const [inv, setInv] = useState<X2.Invite | null>(null);
  const [finalOpen, setFinalOpen] = useState(false);
  const [burst, setBurst] = useState<Mark[]>([]);
  useEffect(() => { music("trail"); }, []);

  // one issue moment a week
  useEffect(() => {
    if (S.done || (S.cardW >= S.week && S.meetW === S.week)) return;
    const x = structuredClone(g); const s = x.Gn!;
    if (s.cardW < s.week) { const c = dealCard(x.seen, "gen", () => E.rand(x)); if (c) { s.cards.push(c); x.seen.push(c.id); } s.cardW = s.week; }
    if (!s.invites?.length && s.week === 1) s.invites = X2.dealInvites(d, s, x);
    // Monday senior staff: the department that most needs the candidate this week
    MO.moreOf(d, s); if (!s.mo!.wk0) MO.weekStart(d, s);
    if (s.meetW !== s.week) { s.meetW = s.week; TM.openMeeting(d, s, TM.pickDept(d, s, x)); }
    commit(x);
  }, [S.week, S.done, S.cardW, S.meetW, g, commit, d]);
  const crisis = S.crisis && S.crisisW === S.week ? S.crisis : null;
  const story = !crisis ? S.story?.due?.[0] ?? null : null;
  const curCard = !crisis && !story && S.cards.length && S.ans !== S.week && S.cardW === S.week ? S.cards[S.cards.length - 1] : null;
  const [meetHide, setMeetHide] = useState(-1);
  const meeting = S.meeting && !S.meeting.done ? S.meeting : null;
  const showMeet = meeting && !crisis && !story && !curCard && meetHide !== S.week * 100 + TM_KEYS.indexOf(meeting.dept);

  const sg = S.party === "R" ? 1 : -1;
  const ms = useMemo(() => E.readMargins(d, S), [d, S]); // what the campaign believes, positive is yours
  const rd = useMemo(() => ms.map((m) => sg * m), [ms, sg]);
  const ev = useMemo(() => E.evCount(d, S, ms), [d, S, ms]);
  const win = useMemo(() => E.winProb(d, S, 400, 7, ms), [d, S, ms]);
  const nat = useMemo(() => E.natMargin(d, ms), [d, ms]);
  const idx = (st: string) => d.states.findIndex((x) => x.st === st);
  const deb = S.debates.find((x) => x.w === S.week && !x.done);
  const presDeb = deb && deb.kind === "pres" && S.debW !== S.week;
  const third = S.third ? d.third.find((t) => t.n === S.third) : null;
  const M = E.mgrOf(S);
  const togo = X2.toGo(S); const finalWeek = togo === 1;
  const groups = X2.groupsOf(d);

  const run = (fn: (x: Game) => E.Res, at?: string) => {
    const x = structuredClone(g); const c0 = x.Gn!.cash; const r = fn(x); setToast({ t: r.t, ok: r.ok && (r.fx ?? 0) >= 0, k: Date.now() });
    { const dc = x.Gn!.cash - c0; if (dc > 0) x.Gn!.raised = (x.Gn!.raised ?? 0) + dc; else x.Gn!.spent = (x.Gn!.spent ?? 0) - dc; }
    if (r.ok && x.Gn!.days < S.days) { const t = MO.tired(x.Gn!, x); if (t) { x.log.push({ t: x.Gn!.week, kind: "bad", s: t, fx: -0.12 }); r.t = `${r.t} ${t}`; r.fx = -0.12; } }
    if (r.ok) { commit(x); sfx((r.fx ?? 0) < 0 ? "bad" : "good"); if (at) setBurst([{ st: at, kind: "burst", t0: performance.now() }]); } else sfx("buzz");
  };
  const answer = (i: number) => {
    const x = structuredClone(g); const c = x.Gn!.cards[x.Gn!.cards.length - 1]; const o = c.opts[i];
    const F = SY.storyOf(x.Gn!).flags; const mt = F.msgTest ? 1.2 : 1; if (F.msgTest) delete F.msgTest;
    const r = E.genStance(d, x.Gn!, c.k, o.pos, x, mt); x.Gn!.ans = x.Gn!.week;
    const prev = SY.afterStance(d, x.Gn!, c.k, o.pos, o.say, c.title); SY.afterCard(x.Gn!, c.id);
    x.log.push({ t: x.Gn!.week, kind: "you", s: `${c.title}: you said “${o.say}”`, fx: r.fx });
    if (prev) x.log.push({ t: x.Gn!.week, kind: "bad", s: `That contradicts what you said ${prev.w ? `in week ${prev.w}` : "in the primary"}: “${prev.label}” ${sur(op)}'s ad makers noticed.` });
    commit(x);
    const lines = [{ l: "Your national margin", v: r.fx }, { l: "Your own voters", v: r.base * 0.25 }];
    if (mt > 1) lines.push({ l: "Message test", v: r.fx - r.fx / mt });
    if (r.flip) lines.push({ l: "Flip flop attacks", v: r.flip });
    for (const gr of r.groups.slice(0, 3)) lines.push({ l: gr.g, v: gr.v });
    setFx({ title: prev ? `${o.label}, and it is on tape` : o.label, lines }); sfx(r.fx > 0 ? "good" : "bad");
  };
  const answerCrisis = (i: number) => {
    const x = structuredClone(g); const s = x.Gn!; const c = s.crisis!; const o = c.opts[i];
    const r = E.answerCrisis(c, i, x, s.mgr, E.DIFF[s.diff].neg); const F = SY.storyOf(s).flags; let soft = 1;
    if (r.fx < 0 && F.prebuttal) { soft *= 0.6; delete F.prebuttal; } if (r.fx < 0 && F.vetted === 1) { soft *= 0.75; F.vetted = 2; }
    r.fx *= soft; s.nat += r.fx; s.crisis = null; SY.afterCrisis(s, c.id, o.label, r.bad);
    if (o.label === "Hit back" || o.label === "Counterattack") { s.enth[0] = Math.min(100, s.enth[0] + 1.5); s.enth[1] = Math.min(100, s.enth[1] + 1); }
    x.log.push({ t: s.week, kind: r.fx >= 0 ? "you" : "bad", s: `${c.title}: ${o.label.toLowerCase()}. ${r.bad ? "It went badly." : "It held."}`, fx: r.fx }); commit(x);
    setFx({ title: r.bad ? `${o.label}: it went badly` : `${o.label}: it held`, lines: [{ l: "Your national margin", v: r.fx }, ...(soft < 1 ? [{ l: "Your team was ready", v: -r.fx / soft + r.fx }] : [])] }); sfx(r.bad ? "bad" : "good");
  };
  const finishDebate = (ans: { k: number; pos: number; mult: number; say?: string }[]) => {
    const x = structuredClone(g); const s = x.Gn!; let tot = 0, del = 0; const F = SY.storyOf(s).flags; const mt = F.msgTest ? 1.2 : 1; if (F.msgTest) delete F.msgTest;
    const nm = debName(s, s.debates.find((y) => y.w === s.week && !y.done));
    for (const a of ans) { const r = E.genStance(d, s, a.k, a.pos, x, a.mult * mt); if (a.say) { const prev = SY.afterStance(d, s, a.k, a.pos, a.say, nm); if (prev) x.log.push({ t: s.week, kind: "bad", s: `On the debate stage you said “${a.say}” ${prev.w ? `In week ${prev.w}` : "In the primary"} you said “${prev.label}”` }); } tot += r.fx; del += (a.mult - 1) * 0.45 * (s.mgr === "message" ? 1.25 : 1); if (a.mult >= 1.45) s.perfect = (s.perfect ?? 0) + 1; }
    { const cap = Math.max(-1.6, Math.min(1.6, tot)); s.nat += cap - tot; tot = cap; } // one night moves the race, it does not end it
    const prep = 0.14 * Math.min(3, s.prep); const rival = E.gauss(x) * 0.3 + 0.1 * (E.DIFF[s.diff].opp - 1);
    const score = del + prep - rival; s.nat += score; s.enth[0] = Math.min(100, s.enth[0] + score * 3); s.prep = 0;
    const j = s.debates.findIndex((y) => y.w === s.week && !y.done); if (j >= 0) { s.debates[j].done = true; s.debates[j].score = tot + score; }
    s.debW = s.week; SY.afterDebate(s, tot + score >= 0);
    x.log.push({ t: s.week, kind: tot + score >= 0 ? "you" : "bad", s: `${nm}: ${tot + score >= 0 ? "the snap polls give you the night" : `the snap polls give ${op} the night`}.`, fx: tot + score });
    commit(x); setDebate(false); sfx(tot + score >= 0 ? "fanfare" : "lose");
    setFx({ title: "Debate night", lines: [{ l: "Your answers, with independents", v: tot }, { l: "Delivery, rebuttals and prep", v: del + prep }, { l: `${sur(op)} on the night`, v: -rival }] });
  };
  const endWeek = () => {
    if (presDeb) { setDebate(true); return; }
    if (finalWeek && !S.finalDone) { setFinalOpen(true); return; }
    const x = structuredClone(g); const s = x.Gn!; const items: E.LogItem[] = [];
    const vd = s.debates.find((y) => y.w === s.week && !y.done && y.kind === "vp");
    if (vd) { const k = E.gauss(x) * 0.35 + (s.vp ? 0.05 : -0.1); s.nat += k; vd.done = true; vd.score = k; items.push({ t: s.week, kind: k >= 0 ? "you" : "bad", s: `Vice presidential debate: ${k >= 0 ? `${s.vp ?? "your running mate"} won the night` : `${s.opVp ?? "their running mate"} won the night`}.`, fx: k }); }
    items.push(...E.genEnd(d, s, x)); x.log.push(...items);
    if (s.crisis && s.crisisW === s.week) items.push({ t: s.week, kind: "bad", s: `Breaking as the week opens: ${s.crisis.title}.` });
    if (s.done) { x.night = E.election(d, s, x.seed * 7 + 2028); s.result = x.night; }
    commit(x); setReport(items); sfx("whoosh");
  };

  const i = sel ? idx(sel) : -1; const XS = i >= 0 ? d.states[i] : null;
  const lastVisit = Object.keys(S.visits).slice(-1)[0];
  const marks: Mark[] = [...S.opVisits.map((st) => ({ st, kind: "opp" as const })), ...burst];
  if (lastVisit) marks.push({ st: lastVisit, kind: "me" });
  if (S.vpSt) marks.push({ st: S.vpSt, kind: "next" });
  const myPolls = S.polls.filter((p) => p.w === S.week - 1);
  const natPoll = S.natPolls[S.natPolls.length - 1];
  const tipping = useMemo(() => { const o = d.states.map((x, k) => ({ x, m: ms[k] })).sort((a, b) => b.m - a.m); let a = 0; for (const r of o) { a += r.x.ev; if (a >= 270) return r; } return o[0]; }, [d, ms]);
  const close = useMemo(() => d.states.map((x, k) => ({ x, m: ms[k] })).filter((r) => Math.abs(r.m) < 6).sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 10), [d, ms]);
  const battle = useMemo(() => d.states.map((x, k) => ({ x, k, m: ms[k], w: x.ev / (1 + Math.abs(ms[k]) ** 1.4) })).filter((r) => !r.x.st.includes("-")).sort((a, b) => b.w - a.w).slice(0, 12), [d, ms]);
  const p24 = (v: number | null) => (v == null ? "No 2024 result" : v > 0 ? `Trump +${v.toFixed(1)}` : `Harris +${Math.abs(v).toFixed(1)}`);
  const all = useMemo(() => d.states.map((x) => x.st), [d]);
  const age = sel ? E.pollAge(S, sel) : null;
  const fogSd = (a: number | null) => (a != null && a <= 1 ? 0.5 : Math.min(3.2, 1 + 0.35 * (a ?? 6))) * M.poll * X2.pollSd(S);
  const pollCost = 1.2e6 * M.poll * (S.staff?.pollster ? 0.7 : 1);
  const dates = X2.weekDates(d, S, Math.min(S.week, S.weeks));
  const earlyLead = (S.ballots ?? 0) > 0 ? (S.ballotsM ?? 0) / (S.ballots ?? 1) : null;
  const partySplit = (m: number) => { const ii = 0.17; const dd = (1 - ii) * (0.5 + (S.party === "D" ? m : -m) / 200); return { D: dd * 100, R: (1 - ii - dd) * 100, I: ii * 100 }; };
  const resWeeks = Array.from({ length: Math.max(0, S.weeks - S.week) }, (_, k) => S.week + 1 + k);
  const markets = sel ? X2.marketsFor(d, sel) : [];
  const mo = useMemo(() => S.mo ?? MO.moreOf(d, structuredClone(S)), [d, S]);
  const senRaces = useMemo(() => MO.senate(d, S, ms), [d, S, ms]);
  const senCount = useMemo(() => MO.senateCount(d, S, ms), [d, S, ms]);
  const regions = sel ? MO.regionsOf(d, sel) : null;

  return (
    <div className="y28-hq">
      <header className="y28-top">
        <div className="who"><Face28 seed={seedOf(me)} party={S.party} size={48} female={FEMALE.has(me)} talking /><div><b>{me}</b><span className="px-k">{S.vp ? `with ${S.vp}` : partyName(S.party)} · week {Math.min(S.week, S.weeks)} of {S.weeks} · {dates}</span></div></div>
        <div className="kv"><span className="px-k">Days · stamina {Math.round(S.stamina)}</span><DaysBar n={S.days} /></div>
        <div className="kv"><span className="px-k">Cash</span><b className="gold"><Roll v={S.cash} fmt={E.usd} /></b></div>
        <div className="kv"><span className="px-k">EV</span><b>{ev} <small>/ 270</small></b></div>
        <div className="kv"><span className="px-k">Win</span><b className={win >= 0.5 ? "up" : "dn"}>{pct(win)}</b></div>
        <div className="kv"><span className="px-k">Popular</span><b>{ptsLead(nat, sur(me), sur(op))}</b></div>
        {S.mkt ? <div className="kv"><span className="px-k">Line</span><b>{Math.round(S.mkt.p * 100)}¢</b></div> : null}
        {S.ballots ? <div className="kv"><span className="px-k">Banked</span><b>{(S.ballots / 1e6).toFixed(1)}M</b></div> : <div className="kv"><span className="px-k">Volunteers</span><b>{Math.round((S.vol ?? 0) / 1000)}K</b></div>}
      </header>
      <Ticker items={g.log.slice(-8).reverse().map((l) => l.s)} />
      <EVBar d={d} ms={ms} me={sur(me)} op={sur(op)} mine={S.party} />
      <div className="y28-main">
        <div className="y28-mapcol">
          <TileMap28 states={all} title="The electoral map, shaded by your campaign's read of each state" sel={sel} hov={hov} onPick={(st) => { setSel(st); setTab("state"); sfx("click"); }} onHover={setHov}
            fill={(st) => shade(rd[idx(st)])} marks={marks} />
          <div className="y28-close" aria-label="Closest states">{close.map((r) => <button key={r.x.st} type="button" className={cls(r.m > 0 ? "me" : "op", sel === r.x.st && "on")} onClick={() => { setSel(r.x.st); setTab("state"); }}><b>{r.x.st}</b>{r.x.ev}<small>{r.m > 0 ? "+" : ""}{r.m.toFixed(1)}</small></button>)}</div>
          <p className="px-note y28-small">Your campaign&apos;s read of the race, not the truth: states you have not polled lately can be off by a few points. Tipping point: <b>{tipping.x.n}</b>, {tipping.m >= 0 ? `yours by ${tipping.m.toFixed(1)}` : `${sur(op)} by ${Math.abs(tipping.m).toFixed(1)}`}.{third ? ` ${third.n} is on the ballot at about ${third.share.toFixed(1)} percent.` : ""} {X2.earlyOpen(S) ? "Early voting is open." : `Early voting opens in week ${S.weeks - X2.EARLY_FROM + 1}.`} {S.week <= X2.regDeadline(S) ? `Registration closes after week ${X2.regDeadline(S)}.` : "Registration has closed."}</p>
        </div>
        <div className="y28-side">
          {S.invites?.length || meeting ? <div className="y28-invites" aria-label="Invitations and meetings this week">
            {meeting ? (() => { const h = TM.headOf(S, meeting.dept); return <button type="button" className="px-btn sm y28-meetbtn" title={meeting.title} onClick={() => setMeetHide(-1)}><Face28 seed={h.seed} party="O" size={24} role="staff" female={h.female} /><span>Staff: {meeting.title}</span></button>; })() : null}
            {(S.invites ?? []).map((x) => <button key={x.id} type="button" className="px-btn sm" title={x.title} onClick={() => setInv(x)}><Face28 seed={seedOf(x.who)} party="O" size={24} role="staff" /><span>{x.title}</span></button>)}</div> : null}
          <div className="px-tabs" role="tablist">{TABS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>

          {tab === "state" && XS && sel ? (
            <div className="y28-pane">
              <h3>{XS.n} <small>{XS.ev} electoral votes</small></h3>
              <div className="y28-kvs">
                <span><small>Your read</small><b className={ms[i] >= 0 ? "up" : "dn"}>{ptsLead(ms[i], sur(me), sur(op))}</b></span>
                <span><small>Accurate to</small><b>about {fogSd(age).toFixed(1)}</b></span>
                <span><small>2024</small><b>{p24(XS.p24)}</b></span>
                <span><small>Early vote</small><b>{Math.round(X2.earlyOf(XS.st) * 100)}% of ballots</b></span>
              </div>
              {(() => { const sr = senRaces.find((r) => r.st === XS.st); const me0 = mo.measures.find((m) => m.st === XS.st); const rg = mo.reg[XS.st]; if (!sr && !me0 && !rg) return null; return (
                <ul className="y28-brief">
                  {sr ? <li><span>Senate race · {sr.hold === S.party ? "your party's seat" : "their party's seat"}</span><b className={sr.m >= 0 ? "up" : "dn"}>{sr.m >= 0 ? "Yours" : "Theirs"} {sr.m >= 0 ? "+" : ""}{sr.m.toFixed(1)}</b></li> : null}
                  {me0 ? <li><span>On the ballot: {MO.MEASURES[me0.k].l}</span><b className={MO.MEASURES[me0.k].side === S.party ? "up" : "dn"}>{MO.MEASURES[me0.k].side === S.party ? "Brings out your voters" : "Brings out theirs"}</b></li> : null}
                  {rg ? <li><span>Registered voters</span><b>D {rg[0].toFixed(1)} · R {rg[1].toFixed(1)} · other {rg[2].toFixed(1)}</b></li> : null}
                </ul>); })()}
              <div className="y28-acts">
                <button type="button" className="px-btn" onClick={() => run((x) => { const r = E.genRally(d, x.Gn!, sel); if (r.ok) x.Gn!.vol = (x.Gn!.vol ?? 0) + Math.round(1200 * (0.6 + x.Gn!.enth[0] / 100)); return r; }, sel)}><small>1 day · $400K · recruits</small>Rally</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genHall(d, x.Gn!, sel), sel)}><small>Half day · $80K</small>Town hall</button>
                <button type="button" className="px-btn" onClick={() => run((x) => X2.canvass(d, x.Gn!, sel), sel)}><small>1 day · volunteers</small>Canvass weekend</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genPoll(d, x.Gn!, sel, x), sel)}><small>{E.usd(pollCost)} · {age == null ? "never polled" : age === 0 ? "this week" : `${age} weeks old`}</small>Internal poll</button>
                <button type="button" className="px-btn" disabled={S.offices.includes(sel)} onClick={() => run((x) => E.genOffice(d, x.Gn!, sel), sel)}><small>$2.5M · pays weekly</small>{S.offices.includes(sel) ? "Field program on" : "Field program"}</button>
                {senRaces.some((r) => r.st === sel) ? <button type="button" className="px-btn" onClick={() => run((x) => MO.senStump(d, x.Gn!, sel), sel)}><small>Half day · coattails</small>Stump with the Senate candidate</button> : null}
                {mo.measures.some((m) => m.st === sel) ? <button type="button" className="px-btn" onClick={() => run((x) => MO.measureStump(d, x.Gn!, sel), sel)}><small>Half day</small>Campaign on the ballot measure</button> : null}
                {S.vp ? <button type="button" className={cls("px-btn", S.vpSt === sel && "on")} onClick={() => run((x) => { x.Gn!.vpSt = sel; return { ok: true, t: `${S.vp} will spend the week in ${XS.n}.` }; })}><small>Free · all week</small>Send {sur(S.vp)}</button> : null}
              </div>
              {regions ? <><span className="px-k">Inside {XS.n} · from 2024 county returns</span>
                <ul className="y28-regs">{regions.r.map((r, k) => { const m = MO.regionMargin(S, ms[i], regions, r); const n = S.gused?.[`rg:${XS.st}:${k}`] ?? 0; return (
                  <li key={r.n}><div><b>{r.n}</b><small>{Math.round(r.sh * 100)}% of the vote · {r.a === "City" ? "city" : r.a === "Suburban" ? "suburbs" : "rural"}{n ? ` · worked ${n}x` : ""}</small></div><b className={m >= 0 ? "up" : "dn"}>{ptsLead(m, sur(me), sur(op))}</b>
                    <button type="button" className="px-btn sm" onClick={() => run((x) => MO.workRegion(d, x.Gn!, XS.st, k), XS.st)}>1 day</button></li>); })}</ul></> : null}
              <span className="px-k">Television, market by market</span>
              <div className="px-chips y28-tone" role="radiogroup" aria-label="Ad tone">{(Object.keys(E.TONES) as E.Tone[]).map((t) => <button key={t} type="button" role="radio" aria-checked={tone === t} className={tone === t ? "on" : ""} title={E.TONES[t].blurb} onClick={() => setTone(t)}>{E.TONES[t].name}</button>)}</div>
              <p className="px-note y28-small">{E.TONES[tone].blurb} Air time costs {X2.rateAt(S).toFixed(2)} times the base rate this week and rises toward Election Day. Booking ahead locks today&apos;s rate.</p>
              <div className="y28-reserve"><label htmlFor="y28-resw">Air</label><select id="y28-resw" value={resW} onChange={(e) => setResW(Number(e.target.value))}><option value={0}>this week</option>{resWeeks.map((w) => <option key={w} value={w}>in week {w}, at {X2.rateAt(S, w).toFixed(2)}x</option>)}</select></div>
              <ul className="y28-mkts">{markets.map(({ m, sh }) => (
                <li key={m.n}><div><b>{m.n}</b><small>{Math.round(sh * 100)}% of {XS.st}{m.s.length > 1 ? ` · also ${m.s.filter((z) => z[0] !== XS.st.split("-")[0]).map((z) => `${z[0]} ${Math.round(z[1] * 100)}%`).join(", ")}` : ""}</small></div>
                  <span className="px-row">{[2e6, 6e6].map((a) => <button key={a} type="button" className="px-btn sm" onClick={() => run((x) => resW ? X2.reserveMarket(d, x.Gn!, m.n, a, resW, tone) : X2.buyMarket(d, x.Gn!, m.n, a, tone, x), sel)}>{E.usd(a)}</button>)}</span></li>
              ))}</ul>
              <span className="px-k">Who votes here</span>
              <div className="y28-tblwrap"><table className="y28-tbl"><thead><tr><th>Group</th><th>Share</th><th>Yours</th><th>Event</th></tr></thead><tbody>
                {groups.map((gr) => ({ gr, x: gr.st[XS.st] ?? gr.st[XS.st.split("-")[0]] ?? gr.us })).sort((a, b) => b.x[0] - a.x[0]).slice(0, 10).map(({ gr, x }) => { const yours = S.party === "D" ? x[1] : 100 - x[1]; return (
                  <tr key={gr.k} className={yours >= 50 ? "good" : "bad"}><td>{gr.l}</td><td>{x[0].toFixed(0)}%</td><td>{yours.toFixed(0)}%</td><td><button type="button" className="px-btn sm" onClick={() => run((y) => X2.groupEvent(d, y.Gn!, gr.k, sel), sel)}>1 day</button></td></tr>
                ); })}
              </tbody></table></div>
              <span className="px-k">Turnout drives by vote history</span>
              <div className="y28-tblwrap"><table className="y28-tbl y28-segs"><thead><tr><th>Voters</th><th>Share</th><th>Yours</th><th>Turnout</th><th>Drive</th></tr></thead><tbody>
                {XS.segs.map(([sh, dem, tu], k) => { const lean = S.party === "D" ? dem : 100 - dem; const used = S.segUsed[`${sel}:${k}`] ?? 0; return (
                  <tr key={k} className={lean >= 50 ? "good" : "bad"}><td>{d.seg[k]}{used ? <small> · {used}x</small> : null}</td><td>{sh.toFixed(0)}%</td><td>{lean.toFixed(0)}%</td><td>{tu.toFixed(0)}%</td>
                    <td><span className="px-row">{[2e6, 6e6].map((a) => <button key={a} type="button" className="px-btn sm" onClick={() => run((x) => E.genSegment(d, x.Gn!, sel, k, a), sel)}>{E.usd(a)}</button>)}</span></td></tr>
                ); })}
              </tbody></table></div>
            </div>
          ) : null}

          {tab === "groups" ? (
            <div className="y28-pane">
              <h3>The coalition <small>{groups.length} groups, nationwide</small></h3>
              <p className="px-note y28-small">Each group&apos;s share of the 2028 vote and how it splits come from the On Point electorate model. Your stances, your outreach and {sur(op)}&apos;s move them. Events land hardest in the state you hold on the map{sel ? `, now ${E.nameOf(d, sel)}` : ""}. Registration closes after week {X2.regDeadline(S)}.</p>
              <ul className="y28-grps">{groups.map((gr, gi) => { const yours = X2.groupShare(d, S, gr); const work = (S.gsup?.[gr.k] ?? 0) - (S.opGsup?.[gr.k] ?? 0); const base = S.party === "D" ? gr.us[1] : 100 - gr.us[1]; return (
                <React.Fragment key={gr.k}>{gr.fam && gr.fam !== groups[gi - 1]?.fam ? <li className="fam"><span className="px-k">{gr.fam}</span></li> : null}<li>
                  <div className="gh"><b>{gr.l}</b><small>{gr.us[0].toFixed(0)}% of voters · {X2.OUTREACH[gr.k]?.where}</small></div>
                  <div className="gbar" aria-label={`Your share ${yours.toFixed(0)} percent`}><i style={{ width: `${yours}%` }} className={S.party.toLowerCase()} /><em style={{ left: "50%" }} /><span>{yours.toFixed(0)}%</span></div>
                  <small className={work >= 0 ? "up" : "dn"}>{work >= 0 ? "+" : ""}{work.toFixed(1)} from the campaigns · model start {base.toFixed(0)}%</small>
                  <span className="px-row">
                    {[4e6, 12e6].map((a) => <button key={a} type="button" className="px-btn sm" onClick={() => run((x) => X2.groupAds(d, x.Gn!, gr.k, a))}>Ads {E.usd(a)}</button>)}
                    {sel ? <button type="button" className="px-btn sm" onClick={() => run((x) => X2.groupEvent(d, x.Gn!, gr.k, sel), sel)}>Event in {sel}</button> : null}
                    {sel && S.week <= X2.regDeadline(S) ? <button type="button" className="px-btn sm" onClick={() => run((x) => { const r = X2.groupReg(d, x.Gn!, gr.k, sel, 2e6); if (r.ok) { const M = MO.moreOf(d, x.Gn!); const k0 = sel.split("-")[0]; if (M.reg[k0]) M.regWork[k0] = (M.regWork[k0] ?? 0) + 2e6 * Math.max(0, r.fx ?? 0) / Math.max(0.01, Math.abs(r.fx ?? 1)); } return r; }, sel)}>Register in {sel} · $2M</button> : null}
                  </span>
                </li></React.Fragment>
              ); })}</ul>
            </div>
          ) : null}

          {tab === "early" ? (
            <div className="y28-pane">
              <h3>Early vote <small>{X2.earlyOpen(S) ? "open" : `opens week ${S.weeks - X2.EARLY_FROM + 1}`}</small></h3>
              <div className="y28-kvs">
                <span><small>Ballots banked</small><b>{((S.ballots ?? 0) / 1e6).toFixed(1)}M</b></span>
                <span><small>Your lead among them</small><b className={(earlyLead ?? 0) >= 0 ? "up" : "dn"}>{earlyLead == null ? "None yet" : ptsLead(earlyLead, sur(me), sur(op))}</b></span>
                <span><small>Share of the vote in</small><b>{Math.round(S.banked * 100)}%</b></span>
              </div>
              <p className="px-note y28-small">Ballots are banked at the margin of the week they are cast, so the race can move later and they stay put. Ballot chase money finds your supporters, gets them to vote early and cures rejected ballots. Early voters lean Democratic, and Election Day voters lean Republican.</p>
              {Object.keys(mo.reg).length ? <><span className="px-k">Registration race · approximate party registration{S.week > X2.regDeadline(S) ? ", final" : ""}</span>
                <ul className="y28-brief">{Object.entries(mo.reg).map(([st, r]) => { const lead0 = S.party === "D" ? r[0] - r[1] : r[1] - r[0]; const base = MO.REG0[st]; const ch = S.party === "D" ? (r[0] - base[0]) - (r[1] - base[1]) : (r[1] - base[1]) - (r[0] - base[0]); return (
                  <li key={st}><span>{st} · D {r[0].toFixed(1)} R {r[1].toFixed(1)}</span><b className={ch >= 0 ? "up" : "dn"}>{lead0 >= 0 ? "You +" : "Them +"}{Math.abs(lead0).toFixed(1)} · {ch >= 0 ? "+" : ""}{ch.toFixed(2)} since start</b></li>); })}</ul></> : null}
              <ul className="y28-evl">{battle.map(({ x, k }) => { const b = X2.bankOf(S, k); const ex = Math.min(0.95, X2.earlyOf(x.st)); const sp = b.cast > 0 ? partySplit(b.m) : null; return (
                <li key={x.st} className={b.cast > 0 ? (b.m >= 0 ? "good" : "bad") : ""}>
                  <button type="button" className="y28-link" onClick={() => { setSel(x.st); setTab("state"); }}>{x.st}</button>
                  <span className="pb" title={`${Math.round((b.cast / ex) * 100)} percent of the expected early vote is in`}><i style={{ width: `${Math.min(100, (b.cast / ex) * 100)}%` }} /></span>
                  <b className={b.cast > 0 ? (b.m >= 0 ? "up" : "dn") : ""}>{b.cast > 0 ? ptsLead(b.m, sur(me), sur(op)) : "No ballots yet"}</b>
                  <small>{Math.round(ex * 100)}% vote early{sp ? ` · D ${sp.D.toFixed(0)} R ${sp.R.toFixed(0)} I ${sp.I.toFixed(0)}` : ""}{S.chase?.[k] ? ` · ${E.usd(S.chase[k])} chase` : ""}</small>
                  <span className="px-row">{[2e6, 5e6].map((a) => <button key={a} type="button" className="px-btn sm" onClick={() => run((y) => X2.chase(d, y.Gn!, x.st, a), x.st)}>Chase {E.usd(a)}</button>)}</span>
                </li>
              ); })}</ul>
            </div>
          ) : null}

          {tab === "camp" ? (
            <div className="y28-pane">
              <h3>The campaign <small>{M.name}</small></h3>
              <div className="y28-kvs"><span><small>Volunteers</small><b>{Math.round(S.vol ?? 0).toLocaleString("en-US")}</b></span><span><small>Stamina</small><b className={S.stamina < 35 ? "dn" : ""}>{Math.round(S.stamina)}</b></span><span><small>Ballots banked</small><b>{((S.ballots ?? 0) / 1e6).toFixed(1)}M</b></span></div>
              <div className="y28-acts">
                {[20e6, 60e6].map((a) => <button key={a} type="button" className="px-btn" onClick={() => run((x) => E.genNatTV(d, x.Gn!, a))}><small>Air war</small>{E.usd(a)} national</button>)}
                <button type="button" className="px-btn" onClick={() => run((x) => E.genFund(d, x.Gn!, "call"))}><small>Half day</small>Call time</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genFund(d, x.Gn!, "dinner"))}><small>1 day</small>Finance dinner</button>
                <button type="button" className="px-btn" disabled={S.emailW === S.week} onClick={() => run((x) => { x.Gn!.emailW = x.Gn!.week; return E.genFund(d, x.Gn!, "email"); })}><small>Once a week</small>Email and text blast</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genPrep(x.Gn!))}><small>1 day · prep {S.prep}</small>Debate prep</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genRest(x.Gn!))}><small>1 day</small>Rest</button>
                <button type="button" className="px-btn" disabled={!!S.lawyers} onClick={() => run((x) => X2.hireLawyers(x.Gn!))}><small>$6M · Election Day</small>{S.lawyers ? "Lawyers in place" : "Election protection"}</button>
              </div>
              <span className="px-k">The media · half a day each, and the same outlet pays less each time</span>
              <div className="y28-acts">{MO.OUTLETS.map((o) => <button key={o.k} type="button" className="px-btn" title={o.blurb} disabled={o.local && !sel} onClick={() => run((x) => MO.outlet(d, x.Gn!, o.k, sel, x), o.local ? sel ?? undefined : undefined)}><small>{o.risk ? "Some risk" : "Half day"}{(S.gused?.[`out:${o.k}`] ?? 0) ? ` · ${S.gused?.[`out:${o.k}`]}x` : ""}</small>{o.local && sel ? `Local TV in ${sel}` : o.l}</button>)}</div>
              <div className="y28-kvs"><span><small>Meme risk</small><b className={mo.meme > 30 ? "dn" : ""}>{Math.round(mo.meme)}</b></span><span><small>Small dollar raised</small><b>{E.usd(S.raised ?? 0)}</b></span></div>
              {S.vp ? <><span className="px-k">{S.vp}&apos;s job</span>
                <div className="px-chips" role="radiogroup" aria-label="Running mate role">{(Object.keys(MO.VP_ROLES) as MO.More["vpRole"][]).map((k) => <button key={k} type="button" role="radio" aria-checked={mo.vpRole === k} className={mo.vpRole === k ? "on" : ""} title={MO.VP_ROLES[k].blurb} onClick={() => run((x) => { MO.moreOf(d, x.Gn!).vpRole = k; return { ok: true, t: `${S.vp}: ${MO.VP_ROLES[k].l.toLowerCase()}. ${MO.VP_ROLES[k].blurb}` }; })}>{MO.VP_ROLES[k].l}</button>)}</div>
                {mo.vpRole === "groups" ? <select aria-label="Group for the running mate" value={mo.vpGroup} onChange={(e) => { const v = e.target.value; run((x) => { MO.moreOf(d, x.Gn!).vpGroup = v; return { ok: true, t: `${S.vp} will court ${groups.find((g0) => g0.k === v)?.l.toLowerCase()}.` }; }); }}>{groups.map((g0) => <option key={g0.k} value={g0.k}>{g0.l}</option>)}</select> : null}</> : null}
              <span className="px-k">Senior staff · payroll {E.usd(X2.payroll(S))} a week</span>
              <ul className="y28-end">
                <li><div><b>Pollster</b><small>{S.staff?.pollster ? X2.STAFF.pollster.tiers[S.staff.pollster]!.name : "None: your read of the states is fuzzy"}</small></div><span className="px-row">{([1, 2, 3] as const).map((t) => <button key={t} type="button" className={cls("px-btn sm", S.staff?.pollster === t && "on")} onClick={() => run((x) => X2.hireStaff(x.Gn!, "pollster", t))}>{"CBA"[t - 1]} · {E.usd(X2.STAFF.pollster.tiers[t]!.wk)}</button>)}</span></li>
                {(["media", "field", "digital", "oppo"] as X2.StaffKey[]).map((k) => <li key={k}><div><b>{X2.STAFF[k].name}</b><small>{X2.STAFF[k].what}</small></div><button type="button" className={cls("px-btn sm", S.staff?.[k] && "on")} onClick={() => run((x) => X2.hireStaff(x.Gn!, k))}>{S.staff?.[k] ? "On staff" : `Hire · ${E.usd(X2.STAFF[k].wk)}/wk`}</button></li>)}
              </ul>
              <span className="px-k">Department heads · call one in for half a day</span>
              <ul className="y28-staff">{TM_KEYS.map((k) => { const h = TM.headOf(S, k); const met = S.metDept?.[k] === S.week; return (
                <li key={k}><Face28 seed={h.seed} party="O" size={32} role="staff" female={h.female} /><div><b>{h.n}</b><small>{TM.DEPTS[k].role} · morale {Math.round(mo.morale[k] ?? 65)}{(mo.hires[k] ?? 0) ? " · new hire" : ""}</small></div>
                  <button type="button" className="px-btn sm" disabled={met || !!meeting || S.days < 1} onClick={() => run((x) => { const m = TM.openMeeting(d, x.Gn!, k, true); setMeetHide(-1); return { ok: true, t: `${h.n} comes in: ${m.title.toLowerCase()}.` }; })}>{met ? "Met this week" : "Call in"}</button></li>
              ); })}</ul>
              <span className="px-k">The other campaign</span>
              <div className="y28-kvs">
                <span><small>{sur(op)} cash</small><b><Roll v={S.opCash} fmt={E.usd} /></b></span>
                <span><small>Running mate</small><b>{S.opVp ?? "None"}</b></span>
                <span><small>Their base</small><b>{Math.round(S.enth[1])}</b></span>
                <span><small>Your base</small><b>{Math.round(S.enth[0])}</b></span>
                <span><small>Super PAC for you</small><b>{E.usd(S.pac?.[0] ?? 0)}</b></span>
                <span><small>Super PAC for them</small><b>{E.usd(S.pac?.[1] ?? 0)}</b></span>
                <span><small>Doors knocked</small><b>{(S.contacts ?? 0).toLocaleString("en-US")}</b></span>
                <span><small>Meetings taken</small><b>{S.met ?? 0}</b></span>
              </div>
              <span className="px-k">Debates</span>
              <ul className="y28-debs">{S.debates.map((x, k) => <li key={k} className={cls(x.done && "done", x.w === S.week && "now")}><b>Week {x.w}</b><span>{debName(S, x)}</span><em>{x.done ? (x.score! >= 0 ? "Won" : "Lost") : x.w === S.week ? "This week" : ""}</em></li>)}</ul>
            </div>
          ) : null}

          {tab === "ticket" ? (
            <div className="y28-pane">
              <h3>Down the ballot <small>Senate {senCount.mine} to {senCount.theirs}</small></h3>
              <div className="y28-kvs">
                <span><small>Your party&apos;s Senate seats</small><b className={senCount.mine >= 50 ? "up" : "dn"}>{senCount.mine}</b></span>
                <span><small>House seats, projected</small><b className={MO.houseSeats(nat) >= 218 ? "up" : "dn"}>{MO.houseSeats(nat)}</b></span>
                <span><small>Endorsements</small><b>{mo.endorsed.length} of {MO.ENDORSE.length}</b></span>
              </div>
              <p className="px-note y28-small">Thirty four Senate seats are up. Seats not on the ballot are counted as they stood before the 2026 midterms. Your margin at the top of the ticket pulls these races along, and stumping with a candidate lengthens your coattails. A Senate majority decides whether your cabinet gets confirmed.</p>
              <ul className="y28-regs">{senRaces.slice().sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).map((r) => (
                <li key={r.st}><div><b>{E.nameOf(d, r.st)}</b><small>{r.hold === S.party ? "Your party holds it" : "Their party holds it"}{mo.senHelp[r.st] ? ` · stumped ${mo.senHelp[r.st]}x` : ""}</small></div><b className={r.m >= 0 ? "up" : "dn"}>{r.m >= 0 ? "+" : ""}{r.m.toFixed(1)}</b>
                  <button type="button" className="px-btn sm" disabled={S.days < 1} onClick={() => run((x) => MO.senStump(d, x.Gn!, r.st), r.st)}>Stump</button></li>))}</ul>
              <span className="px-k">Cabinet promises · {mo.cabinet.length} made</span>
              <p className="px-note y28-small">Promise a job to someone in your party and their voters come aboard now. In January the Senate has to confirm them, and a job promised twice makes an enemy.</p>
              <CabinetPicker d={d} S={S} onPick={(post, who) => run((x) => MO.promisePost(d, x.Gn!, post, who))} />
              {mo.cabinet.length ? <ul className="y28-brief">{mo.cabinet.map((c) => <li key={c.who}><span>{c.post}</span><b>{c.who}</b></li>)}</ul> : null}
              <span className="px-k">The endorsement chase</span>
              <ul className="y28-brief">{MO.ENDORSE.map((e) => <li key={e.k}><span>{e.who}<br /><small>{e.need}</small></span><b className={mo.endorsed.includes(e.k) ? "up" : ""}>{mo.endorsed.includes(e.k) ? "Endorsed" : "Not yet"}</b></li>)}</ul>
            </div>
          ) : null}

          {tab === "oppo" ? (
            <div className="y28-pane">
              <h3>Opposition research <small>on {op}</small></h3>
              <p className="px-note y28-small">Your researchers comb {sur(op)}&apos;s record for the positions independents like least, from the On Point dataset. A hit lands harder in the last three weeks, but a thinly sourced one can blow up in your face.{S.staff?.oppo ? " Your research director improves the odds and the sourcing." : ""}</p>
              <div className="y28-acts"><button type="button" className="px-btn" onClick={() => run((x) => E.genDig(d, x.Gn!, x))}><small>1 day · $3M · {S.dug ?? 0} digs so far</small>Dig into {sur(op)}</button></div>
              <ul className="y28-end">{(S.oppo ?? []).map((h, k) => (
                <li key={k}><div><b>{h.t[0].toUpperCase() + h.t.slice(1)}</b><small>{h.solid > 0.75 ? "Well sourced" : h.solid > 0.6 ? "Decent sourcing" : "Thin sourcing"} · {h.power > 0.9 ? "could move the race" : h.power > 0.6 ? "real damage" : "a scratch"}</small></div>
                  {h.used ? <span className={cls("px-tag", h.hit ? "real" : "hot")}>{h.hit ? "Landed" : "Backfired"}</span> : <button type="button" className="px-btn sm" onClick={() => run((x) => { const r = E.genDrop(d, x.Gn!, k, x); if (r.ok) SY.afterDrop(x.Gn!, !!x.Gn!.oppo?.[k]?.hit); return r; })}>Drop it · $2M</button>}</li>
              ))}</ul>
              {!(S.oppo ?? []).length ? <p className="px-note">Nothing in the file yet.</p> : null}
              <span className="px-k">Your public record · what {sur(op)}&apos;s researchers have on you</span>
              {Object.keys(S.story?.said ?? {}).length ? <ul className="y28-end">{Object.entries(S.story!.said).map(([k, r]) => <li key={k}><div><b>{d.issues[Number(k)]?.l}</b><small>{r.w ? `Week ${r.w} · ${r.where}` : r.where}</small></div><span className="y28-said">“{r.label}”</span></li>)}</ul> : <p className="px-note">You have not taken a public stand yet. Every answer to an issue or a debate question goes on the record, and contradicting it later becomes an ad.</p>}
              {S.story?.facts?.length ? <><span className="px-k">What the campaign remembers</span><ul className="y28-wire">{S.story.facts.slice(-8).reverse().map((f, k) => <li key={k} className="you">{f}</li>)}</ul></> : null}
            </div>
          ) : null}

          {tab === "polls" ? (
            <div className="y28-pane">
              <h3>The race by week</h3>
              <Trend pts={S.trend.map((t) => ({ w: t.w * (10 / S.weeks), p: t.p, ev: t.ev }))} h={70} />
              <p className="px-note y28-small">Gold is your win chance, green your electoral votes, both on your campaign&apos;s read.</p>
              {S.mkt ? <div className="y28-line"><span className="px-k">Betting line on your win</span><div className="spark">{S.mkt.hist.map((p, k) => <i key={k} style={{ height: `${Math.round(p * 100)}%` }} title={`${Math.round(p * 100)} cents`} />)}</div><b>{Math.round(S.mkt.p * 100)}¢</b></div> : null}
              {natPoll ? <p className="px-note">National poll average: <b>{ptsLead(natPoll.m, sur(me), sur(op))}</b></p> : <p className="px-note">The first polls land at the end of week 1.</p>}
              {myPolls.length ? <table className="y28-tbl"><thead><tr><th>Public state poll</th><th>Pollster</th><th>Margin</th></tr></thead><tbody>{myPolls.map((p) => { const P = E.pollsterOf(p.by); return <tr key={p.st} className={p.m >= 0 ? "good" : "bad"}><td>{E.nameOf(d, p.st)}</td><td>{p.by ?? "Public poll"}{P ? <small> · {P.g}{Math.abs(P.h) >= 1 ? `, leans ${P.h > 0 ? "R" : "D"}` : ""}</small> : null}</td><td>{ptsLead(p.m, sur(me), sur(op))}</td></tr>; })}</tbody></table> : null}
              <p className="px-note y28-small">Public pollsters are graded on their past accuracy. Some lean one way in every poll they release, so read them together.</p>
              {S.econ ? <><span className="px-k">The economy · the White House is Republican</span><div className="y28-kvs">
                <span><small>Last jobs report</small><b className={S.econ.jobs >= 120 ? "up" : "dn"}>{S.econ.jobs >= 0 ? "+" : ""}{S.econ.jobs}K</b></span>
                <span><small>Unemployment</small><b>{S.econ.u.toFixed(1)}%</b></span><span><small>Inflation</small><b>{S.econ.cpi.toFixed(1)}%</b></span><span><small>Gas</small><b>${S.econ.gas.toFixed(2)}</b></span></div></> : null}
            </div>
          ) : null}
          {tab === "wire" ? <ul className="y28-wire">{g.log.slice().reverse().slice(0, 60).map((l, k) => <li key={k} className={l.kind}><b>W{l.t}</b> {l.s}</li>)}</ul> : null}
          <div className="y28-end-bar">{deb ? <span className="px-tag hot">{debName(S, deb)}</span> : finalWeek ? <span className="px-tag hot">Final week</span> : null}<button type="button" className="px-press" onClick={endWeek}>{presDeb ? "Take the debate stage" : finalWeek && !S.finalDone ? "Plan the final weekend" : finalWeek ? "Election Day" : "End the week"}</button></div>
        </div>
      </div>
      {toast ? <div key={toast.k} className={cls("px-toast", toast.ok ? "ok" : "no")} role="status" onAnimationEnd={() => setToast(null)}>{toast.t}</div> : null}
      {crisis && !fx && !report && !debate ? <CrisisModal c={crisis} me={me} party={S.party} onPick={answerCrisis} /> : null}
      {story && !fx && !report && !debate && !inv ? <StoryModal ev={story} me={me} party={S.party} S={S} onPick={(k) => run((x) => { const r = SY.resolveStory(d, x.Gn!, k, x); if (!r) return { ok: false, t: "" }; x.log.push({ t: x.Gn!.week, kind: r.v >= 0 ? "you" : "bad", s: r.t, fx: r.v }); return { ok: true, t: r.t, fx: r.v }; })} /> : null}
      {curCard && !crisis && !fx && !report && !debate ? <CardModal card={curCard} me={me} party={S.party} onPick={answer} record={(() => { const r = SY.recordOn(S, curCard.k); return r ? SY.recallText(r) : null; })()} /> : null}
      {showMeet && meeting && !fx && !report && !debate && !inv ? <MeetingModal m={meeting} S={S} onPick={(k) => run((x) => { const r = TM.decide(d, x.Gn!, k, x); if (r.ok && x.Gn!.meeting?.opts[k]?.act !== "none") x.log.push({ t: x.Gn!.week, kind: (r.fx ?? 0) < 0 ? "bad" : "you", s: `${TM.DEPTS[meeting.dept].name}: ${r.t}`, fx: r.fx }); return r; })} onLater={() => setMeetHide(S.week * 100 + TM_KEYS.indexOf(meeting.dept))} /> : null}
      {fx ? <FxCard title={fx.title} lines={fx.lines} onDone={() => setFx(null)} /> : null}
      {inv && !fx ? <InviteModal inv={inv} d={d} days={S.days} onPick={(k) => { run((x) => X2.answerInvite(d, x.Gn!, inv, k, x), inv.st); setInv(null); }} onClose={() => setInv(null)} /> : null}
      {finalOpen ? <FinalWeekend d={d} S={S} ms={ms} onDone={(mine, vp, c) => { const x = structuredClone(g); const r = X2.finalPush(d, x.Gn!, mine, vp, c, x); x.log.push({ t: x.Gn!.week, kind: "you", s: r.t }); commit(x); setFinalOpen(false); setToast({ t: r.t, ok: true, k: Date.now() }); sfx("fanfare"); }} onClose={() => setFinalOpen(false)} /> : null}
      {debate ? <Debate28 me={me} op={op} party={S.party} opParty={opP} title={debName(S, deb)} record={(k) => { const r = SY.recordOn(S, k); return r ? SY.recallText(r) : null; }} seed={g.seed + S.week * 53} onDone={finishDebate} /> : null}
      {report ? (
        <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-grep-h">
          <div className="px-card wide report">
            <span className="px-tag">Week {Math.min(S.week - (S.done ? 0 : 1), S.weeks)}</span><h3 id="y28-grep-h">{S.done ? "The polls are open" : "The week in review"}</h3>
            <ul className="y28-wire">{report.map((l, k) => <li key={k} className={l.kind}>{l.s}</li>)}</ul>
            <button type="button" className="px-btn go" onClick={() => { setReport(null); if (S.done) onDone(g); }}>{S.done ? "Watch the returns" : "Next week"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Pick a job and a person to promise it to. */
function CabinetPicker({ d, S, onPick }: { d: E.Data; S: E.GenS; onPick: (post: string, who: string) => void }) {
  const [post, setPost] = useState(MO.POSTS[0]); const pool = d.cands[S.party].filter((c) => c.n !== S.me && c.n !== S.vp && !(S.mo?.cabinet ?? []).some((x) => x.who === c.n));
  const [who, setWho] = useState(""); const w = pool.some((c) => c.n === who) ? who : pool[0]?.n ?? "";
  if (!pool.length) return null;
  return (
    <div className="y28-reserve"><label htmlFor="y28-post">Job</label><select id="y28-post" value={post} onChange={(e) => setPost(e.target.value)}>{MO.POSTS.map((p) => <option key={p} value={p}>{p}{S.mo?.cabinet.some((c) => c.post === p) ? ", promised" : ""}</option>)}</select>
      <label htmlFor="y28-who">to</label><select id="y28-who" value={w} onChange={(e) => setWho(e.target.value)}>{pool.map((c) => <option key={c.n} value={c.n}>{c.n}</option>)}</select>
      <button type="button" className="px-btn sm" onClick={() => onPick(post, w)}>Promise</button></div>
  );
}

/** Something the campaign set in motion comes back: what you did, and what happens now. */
function StoryModal({ ev, me, party, S, onPick }: { ev: SY.StoryEv; me: string; party: E.Party; S: E.GenS; onPick: (k: number) => void }) {
  useEffect(() => { sfx(ev.kind === "decision" ? "alarm" : "bell"); }, [ev.id]);
  const h = TM.headOf(S, "comms");
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-st-h">
      <div className="px-card ev y28-ev y28-story">
        <div className="px-row">{ev.kind === "decision" ? <Face28 seed={h.seed} party="O" size={56} role="staff" female={h.female} talking /> : <Face28 seed={seedOf(me)} party={party} size={56} female={FEMALE.has(me)} />}<div><span className={cls("px-tag", ev.kind === "decision" && "hot")}>{ev.kind === "decision" ? `${h.n} needs a call` : "The story so far"}</span><h3 id="y28-st-h">{ev.title}</h3></div></div>
        {ev.recall ? <p className="y28-recall">{ev.recall}</p> : null}
        <p>{ev.prompt}</p>
        <div className="y28-opts">{ev.opts.map((o, k) => (
          <button key={o.label} type="button" className="px-btn" onClick={() => { sfx("card"); onPick(k); }}>
            <small>{k + 1} · {o.fx.risk ? "Some risk" : ev.kind === "decision" ? "Decision" : "Continue"}</small><span>{o.label}{o.say ? `: “${o.say}”` : ""}</span>
          </button>
        ))}</div>
      </div>
    </div>
  );
}

/** The Monday meeting: one department head, the numbers, and a decision. */
function MeetingModal({ m, S, onPick, onLater }: { m: TM.Meeting; S: E.GenS; onPick: (k: number) => void; onLater: () => void }) {
  useEffect(() => { sfx("bell"); }, [m.dept, m.w]);
  const h = TM.headOf(S, m.dept);
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-mt-h">
      <div className="px-card wide y28-ev y28-meet">
        <div className="px-row"><Face28 seed={h.seed} party="O" size={64} role="staff" female={h.female} talking /><div><span className="px-tag">{m.called ? "You called this meeting" : `Monday senior staff · week ${m.w}`}</span><h3 id="y28-mt-h">{m.title}</h3><span className="px-k">{h.n} · {TM.DEPTS[m.dept].role}</span></div></div>
        <p>{m.say}</p>
        {m.rows.length ? <ul className="y28-brief">{m.rows.map((r, k) => <li key={k}><span>{r.l}</span><b className={r.tone ?? ""}>{r.v}</b></li>)}</ul> : null}
        <div className="y28-opts">{m.opts.map((o, k) => (
          <button key={o.label} type="button" className="px-btn" disabled={(o.cost ?? 0) > S.cash || (o.days ?? 0) > S.days} onClick={() => { sfx("card"); onPick(k); }}>
            <small>{o.note}</small><span>{o.label}</span>
          </button>
        ))}</div>
        <button type="button" className="px-btn sm" onClick={onLater}>Come back to this later this week</button>
      </div>
    </div>
  );
}

/** A meeting someone has asked for: who they are, what they want, and the ways to answer. */
function InviteModal({ inv, d, days, onPick, onClose }: { inv: X2.Invite; d: E.Data; days: number; onPick: (k: number) => void; onClose: () => void }) {
  useEffect(() => { sfx("bell"); }, []);
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-inv-h">
      <div className="px-card ev y28-ev">
        <div className="px-row"><Face28 seed={seedOf(inv.who)} party="O" size={64} role="staff" talking /><div><span className="px-tag">{E.nameOf(d, inv.st)} · invitation</span><h3 id="y28-inv-h">{inv.title}</h3><span className="px-k">{inv.who}</span></div></div>
        <p>{inv.intro}</p>
        <div className="y28-opts">{inv.opts.map((o, k) => (
          <button key={o.label} type="button" className="px-btn" disabled={o.days * 2 > days} onClick={() => { sfx("card"); onPick(k); }}>
            <small>{o.days ? `${o.days} day${o.days > 1 ? "s" : ""}` : "No time"}{o.risk ? " · some risk" : ""}{o.cash ? ` · ${E.usd(o.cash)}` : ""}{o.vol ? ` · ${o.vol.toLocaleString("en-US")} volunteers` : ""}</small><span>{o.label}{o.say ? `: “${o.say}”` : ""}</span>
          </button>
        ))}</div>
        <button type="button" className="px-btn sm" onClick={onClose}>Decide later this week</button>
      </div>
    </div>
  );
}

/** The final weekend: three stops for you, two for your running mate, and the message you close on. */
function FinalWeekend({ d, S, ms, onDone, onClose }: { d: E.Data; S: E.GenS; ms: number[]; onDone: (me: string[], vp: string[], c: X2.Closing) => void; onClose: () => void }) {
  const opts = d.states.map((x, k) => ({ x, m: ms[k], w: x.ev / (1 + Math.abs(ms[k]) ** 1.4) })).filter((r) => !r.x.st.includes("-")).sort((a, b) => b.w - a.w).slice(0, 10);
  const [mine, setMine] = useState<string[]>([]); const [vp, setVp] = useState<string[]>([]); const [c, setC] = useState<X2.Closing>("contrast");
  const tog = (arr: string[], set: (v: string[]) => void, st: string, max: number) => set(arr.includes(st) ? arr.filter((z) => z !== st) : arr.length < max ? [...arr, st] : arr);
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-fin-h">
      <div className="px-card wide">
        <span className="px-tag hot">The final weekend</span><h3 id="y28-fin-h">Where do you close?</h3>
        <p className="px-note">Pick three states for {sur(S.me)}{S.vp ? ` and two for ${sur(S.vp)}` : ""}, then the closing message every ad and speech will carry.</p>
        <div className="y28-fin">{opts.map(({ x, m }) => (
          <div key={x.st} className="row"><b>{x.n}</b><small className={m >= 0 ? "up" : "dn"}>{m >= 0 ? "+" : ""}{m.toFixed(1)} · {x.ev} EV</small>
            <button type="button" className={cls("px-btn sm", mine.includes(x.st) && "on")} onClick={() => tog(mine, setMine, x.st, 3)}>{sur(S.me)}</button>
            {S.vp ? <button type="button" className={cls("px-btn sm", vp.includes(x.st) && "on")} onClick={() => tog(vp, setVp, x.st, 2)}>{sur(S.vp)}</button> : null}</div>
        ))}</div>
        <div className="px-diffs">{(Object.keys(X2.CLOSINGS) as X2.Closing[]).map((k) => <button key={k} type="button" className={cls("px-diff", c === k && "on")} onClick={() => setC(k)}><b>{X2.CLOSINGS[k].name}</b><small>{X2.CLOSINGS[k].blurb}</small></button>)}</div>
        <div className="px-row"><button type="button" className="px-press" disabled={!mine.length} onClick={() => onDone(mine, vp, c)}>Close the campaign</button><button type="button" className="px-btn sm" onClick={onClose}>Not yet</button></div>
      </div>
    </div>
  );
}
