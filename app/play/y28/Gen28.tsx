"use client";
// The general election: ten weeks to 270. Move the candidate and the running mate, buy television in the tone you
// choose, poll the states you are unsure of, build field programs, drive out the right voters by vote history, dig up
// and drop opposition research, answer the news and the scandals, take three debates and bank early votes, while
// the other campaign and both sides' super PACs chase the closest states.
import React, { useEffect, useMemo, useState } from "react";
import * as E from "./engine28";
import { dealCard, partyName } from "./cards28";
import TileMap28, { shade, type Mark } from "./TileMap28";
import { CardModal, CrisisModal, Debate28, FxCard } from "./Scenes28";
import { DaysBar, EVBar, Trend, Ticker, FEMALE, type Game, pct, ptsLead } from "./ui28";
import { Portrait, Roll, cls, sur } from "../px/ui";
import { seedOf } from "../px/sprites";
import { sfx, music } from "../px/sound";

type Tab = "state" | "nat" | "oppo" | "polls" | "wire";
const DEB_NAME = ["First presidential debate", "Vice presidential debate", "Final presidential debate"];

export default function Gen28({ d, g, commit, onDone }: { d: E.Data; g: Game; commit: (x: Game) => void; onDone: (x: Game) => void }) {
  const S = g.Gn!; const me = S.me, op = S.op; const opP: E.Party = S.party === "D" ? "R" : "D";
  const [sel, setSel] = useState<string | null>("PA");
  const [hov, setHov] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("state");
  const [tone, setTone] = useState<E.Tone>("contrast");
  const [toast, setToast] = useState<{ t: string; ok: boolean; k: number } | null>(null);
  const [fx, setFx] = useState<{ title: string; lines: { l: string; v: number }[] } | null>(null);
  const [report, setReport] = useState<E.LogItem[] | null>(null);
  const [debate, setDebate] = useState(false);
  const [burst, setBurst] = useState<Mark[]>([]);
  useEffect(() => { music("trail"); }, []);

  // one issue moment a week
  useEffect(() => {
    if (S.done || S.cardW >= S.week) return;
    const x = structuredClone(g); const c = dealCard(x.seen, "gen", () => E.rand(x)); if (c) { x.Gn!.cards.push(c); x.seen.push(c.id); } x.Gn!.cardW = x.Gn!.week; commit(x);
  }, [S.week, S.done, S.cardW, g, commit]);
  const crisis = S.crisis && S.crisisW === S.week ? S.crisis : null;
  const curCard = !crisis && S.cards.length && S.ans !== S.week && S.cardW === S.week ? S.cards[S.cards.length - 1] : null;

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

  const run = (fn: (x: Game) => E.Res, at?: string) => {
    const x = structuredClone(g); const r = fn(x); setToast({ t: r.t, ok: r.ok && (r.fx ?? 0) >= 0, k: Date.now() });
    if (r.ok) { commit(x); sfx((r.fx ?? 0) < 0 ? "bad" : "good"); if (at) setBurst([{ st: at, kind: "burst", t0: performance.now() }]); } else sfx("buzz");
  };
  const answer = (i: number) => {
    const x = structuredClone(g); const c = x.Gn!.cards[x.Gn!.cards.length - 1]; const o = c.opts[i];
    const r = E.genStance(d, x.Gn!, c.k, o.pos, x); x.Gn!.ans = x.Gn!.week;
    x.log.push({ t: x.Gn!.week, kind: "you", s: `${c.title}: you said “${o.say}”`, fx: r.fx }); commit(x);
    const lines = [{ l: "Your national margin", v: r.fx }, { l: "Your own voters", v: r.base * 0.25 }];
    if (r.flip) lines.push({ l: "Flip flop attacks", v: r.flip });
    setFx({ title: o.label, lines }); sfx(r.fx > 0 ? "good" : "bad");
  };
  const answerCrisis = (i: number) => {
    const x = structuredClone(g); const s = x.Gn!; const c = s.crisis!; const o = c.opts[i];
    const r = E.answerCrisis(c, i, x, s.mgr, E.DIFF[s.diff].neg); s.nat += r.fx; s.crisis = null;
    if (o.label === "Hit back" || o.label === "Counterattack") { s.enth[0] = Math.min(100, s.enth[0] + 1.5); s.enth[1] = Math.min(100, s.enth[1] + 1); }
    x.log.push({ t: s.week, kind: r.fx >= 0 ? "you" : "bad", s: `${c.title}: ${o.label.toLowerCase()}. ${r.bad ? "It went badly." : "It held."}`, fx: r.fx }); commit(x);
    setFx({ title: r.bad ? `${o.label}: it went badly` : `${o.label}: it held`, lines: [{ l: "Your national margin", v: r.fx }] }); sfx(r.bad ? "bad" : "good");
  };
  const finishDebate = (ans: { k: number; pos: number; mult: number }[]) => {
    const x = structuredClone(g); const s = x.Gn!; let tot = 0, del = 0;
    for (const a of ans) { const r = E.genStance(d, s, a.k, a.pos, x, a.mult); tot += r.fx; del += (a.mult - 1) * 0.45 * (s.mgr === "message" ? 1.25 : 1); if (a.mult >= 1.45) s.perfect = (s.perfect ?? 0) + 1; }
    { const cap = Math.max(-1.6, Math.min(1.6, tot)); s.nat += cap - tot; tot = cap; } // one night moves the race, it does not end it
    const prep = 0.14 * Math.min(3, s.prep); const rival = E.gauss(x) * 0.3 + 0.1 * (E.DIFF[s.diff].opp - 1);
    const score = del + prep - rival; s.nat += score; s.enth[0] = Math.min(100, s.enth[0] + score * 3); s.prep = 0;
    const j = s.debates.findIndex((y) => y.w === s.week && !y.done); if (j >= 0) { s.debates[j].done = true; s.debates[j].score = tot + score; }
    s.debW = s.week;
    x.log.push({ t: s.week, kind: tot + score >= 0 ? "you" : "bad", s: `${DEB_NAME[Math.max(0, j)]}: ${tot + score >= 0 ? "the snap polls give you the night" : `the snap polls give ${op} the night`}.`, fx: tot + score });
    commit(x); setDebate(false); sfx(tot + score >= 0 ? "fanfare" : "lose");
    setFx({ title: "Debate night", lines: [{ l: "Your answers, with independents", v: tot }, { l: "Delivery and prep", v: del + prep }, { l: `${sur(op)} on the night`, v: -rival }] });
  };
  const endWeek = () => {
    if (presDeb) { setDebate(true); return; }
    const x = structuredClone(g); const s = x.Gn!; const items: E.LogItem[] = [];
    const vd = s.debates.find((y) => y.w === s.week && !y.done && y.kind === "vp");
    if (vd) { const k = E.gauss(x) * 0.35 + (s.vp ? 0.05 : -0.1); s.nat += k; vd.done = true; vd.score = k; items.push({ t: s.week, kind: k >= 0 ? "you" : "bad", s: `Vice presidential debate: ${k >= 0 ? `${s.vp ?? "your running mate"} won the night` : `${s.opVp ?? "their running mate"} won the night`}.`, fx: k }); }
    items.push(...E.genEnd(d, s, x)); x.log.push(...items);
    if (s.crisis && s.crisisW === s.week) items.push({ t: s.week, kind: "bad", s: `Breaking as the week opens: ${s.crisis.title}.` });
    if (s.done) { x.night = E.election(d, s, x.seed * 7 + 2028); s.result = x.night; }
    commit(x); setReport(items); sfx("whoosh");
  };

  const i = sel ? idx(sel) : -1; const X = i >= 0 ? d.states[i] : null;
  const lastVisit = Object.keys(S.visits).slice(-1)[0];
  const marks: Mark[] = [...S.opVisits.map((st) => ({ st, kind: "opp" as const })), ...burst];
  if (lastVisit) marks.push({ st: lastVisit, kind: "me" });
  if (S.vpSt) marks.push({ st: S.vpSt, kind: "next" });
  const myPolls = S.polls.filter((p) => p.w === S.week - 1);
  const natPoll = S.natPolls[S.natPolls.length - 1];
  const tipping = useMemo(() => { const o = d.states.map((x, k) => ({ x, m: ms[k] })).sort((a, b) => b.m - a.m); let a = 0; for (const r of o) { a += r.x.ev; if (a >= 270) return r; } return o[0]; }, [d, ms]);
  const close = useMemo(() => d.states.map((x, k) => ({ x, m: ms[k] })).filter((r) => Math.abs(r.m) < 6).sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 10), [d, ms]);
  const p24 = (v: number | null) => (v == null ? "No 2024 result" : v > 0 ? `Trump +${v.toFixed(1)}` : `Harris +${Math.abs(v).toFixed(1)}`);
  const all = useMemo(() => d.states.map((x) => x.st), [d]);
  const age = sel ? E.pollAge(S, sel) : null;
  const fogSd = (a: number | null) => (a != null && a <= 1 ? 0.5 : Math.min(3.2, 1 + 0.35 * (a ?? 6))) * M.poll;
  const pollCost = 1.2e6 * M.poll;

  return (
    <div className="y28-hq">
      <header className="y28-top">
        <div className="who"><Portrait seed={seedOf(me)} role="cand" party={S.party} size={44} female={FEMALE.has(me)} talking /><div><b>{me}</b><span className="px-k">{S.vp ? `with ${S.vp}` : partyName(S.party)} · week {Math.min(S.week, S.weeks)} of {S.weeks} · {M.name}</span></div></div>
        <div className="kv"><span className="px-k">Time</span><DaysBar n={S.days} /></div>
        <div className="kv"><span className="px-k">Cash</span><b className="gold"><Roll v={S.cash} fmt={E.usd} /></b></div>
        <div className="kv"><span className="px-k">Electoral votes</span><b>{ev} <small>/ 270</small></b></div>
        <div className="kv"><span className="px-k">Win chance</span><b className={win >= 0.5 ? "up" : "dn"}>{pct(win)}</b></div>
        <div className="kv"><span className="px-k">Popular vote</span><b>{ptsLead(nat, sur(me), sur(op))}</b></div>
        <div className="kv"><span className="px-k">Stamina</span><b className={S.stamina < 35 ? "dn" : ""}>{Math.round(S.stamina)}</b></div>
        {S.banked > 0 ? <div className="kv"><span className="px-k">Early vote</span><b>{Math.round((S.banked / 0.6) * 45)}% in</b></div> : null}
      </header>
      <Ticker items={g.log.slice(-8).reverse().map((l) => l.s)} />
      <EVBar d={d} ms={ms} me={sur(me)} op={sur(op)} mine={S.party} />
      <div className="y28-main">
        <div className="y28-mapcol">
          <TileMap28 states={all} title="The electoral map, shaded by your campaign's read of each state" sel={sel} hov={hov} onPick={(st) => { setSel(st); setTab("state"); sfx("click"); }} onHover={setHov}
            fill={(st) => shade(rd[idx(st)])} marks={marks} />
          <p className="px-note">This is your campaign&apos;s read of the race, not the truth: states you have not polled lately can be off by a few points. The gold bus is your last stop, red marks are {sur(op)}&apos;s stops{S.vp ? `, and the blinking dot is ${sur(S.vp)}` : ""}.</p>
          <div className="y28-close" aria-label="Closest states">{close.map((r) => <button key={r.x.st} type="button" className={cls(r.m > 0 ? "me" : "op", sel === r.x.st && "on")} onClick={() => { setSel(r.x.st); setTab("state"); }}><b>{r.x.st}</b>{r.x.ev}<small>{r.m > 0 ? "+" : ""}{r.m.toFixed(1)}</small></button>)}</div>
          <p className="px-note">Tipping point: <b>{tipping.x.n}</b>, {tipping.m >= 0 ? `yours by ${tipping.m.toFixed(1)}` : `${sur(op)} by ${Math.abs(tipping.m).toFixed(1)}`}.{third ? ` ${third.n} is on the ballot at about ${third.share.toFixed(1)} percent.` : ""}</p>
        </div>
        <div className="y28-side">
          <div className="px-tabs" role="tablist">{([["state", "State"], ["nat", "National"], ["oppo", "Oppo"], ["polls", "Polls"], ["wire", "Wire"]] as [Tab, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
          {tab === "state" && X && sel ? (
            <div className="y28-pane">
              <h3>{X.n} <small>{X.ev} electoral votes</small></h3>
              <div className="y28-kvs">
                <span><small>Your read</small><b className={ms[i] >= 0 ? "up" : "dn"}>{ptsLead(ms[i], sur(me), sur(op))}</b></span>
                <span><small>Read accurate to</small><b>about {fogSd(age).toFixed(1)}</b></span>
                <span><small>2024</small><b>{p24(X.p24)}</b></span>
                <span><small>Visits · field</small><b>{S.visits[sel] ?? 0} · {S.offices.includes(sel) ? "on" : "none"}</b></span>
              </div>
              <div className="y28-acts">
                <button type="button" className="px-btn" onClick={() => run((x) => E.genRally(d, x.Gn!, sel), sel)}><small>1 day · $400K</small>Rally</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genHall(d, x.Gn!, sel), sel)}><small>Half day · $80K</small>Town hall</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genPoll(d, x.Gn!, sel, x), sel)}><small>{E.usd(pollCost)} · {age == null ? "never polled" : age === 0 ? "polled this week" : `${age} weeks old`}</small>Internal poll</button>
                <button type="button" className="px-btn" disabled={S.offices.includes(sel)} onClick={() => run((x) => E.genOffice(d, x.Gn!, sel), sel)}><small>$2.5M · pays weekly</small>{S.offices.includes(sel) ? "Field program on" : "Field program"}</button>
                {S.vp ? <button type="button" className={cls("px-btn", S.vpSt === sel && "on")} onClick={() => run((x) => { x.Gn!.vpSt = sel; return { ok: true, t: `${S.vp} will spend the week in ${X.n}.` }; })}><small>Free · all week</small>Send {sur(S.vp)}</button> : null}
              </div>
              <span className="px-k">Television</span>
              <div className="px-chips y28-tone" role="radiogroup" aria-label="Ad tone">{(Object.keys(E.TONES) as E.Tone[]).map((t) => <button key={t} type="button" role="radio" aria-checked={tone === t} className={tone === t ? "on" : ""} title={E.TONES[t].blurb} onClick={() => setTone(t)}>{E.TONES[t].name}</button>)}</div>
              <p className="px-note y28-small">{E.TONES[tone].blurb}</p>
              <div className="y28-acts">{[2e6, 6e6, 15e6].map((a) => <button key={a} type="button" className="px-btn" onClick={() => run((x) => E.genTV(d, x.Gn!, sel, a, tone, x), sel)}><small>{E.TONES[tone].name} ads</small>{E.usd(a)} of TV</button>)}</div>
              <span className="px-k">Turnout drives by vote history</span>
              <div className="y28-tblwrap"><table className="y28-tbl y28-segs"><thead><tr><th>Voters</th><th>Share</th><th>Yours</th><th>Turnout</th><th>Drive</th></tr></thead><tbody>
                {X.segs.map(([sh, dem, tu], k) => { const lean = S.party === "D" ? dem : 100 - dem; const used = S.segUsed[`${sel}:${k}`] ?? 0; return (
                  <tr key={k} className={lean >= 50 ? "good" : "bad"}><td>{d.seg[k]}{used ? <small> · {used}x</small> : null}</td><td>{sh.toFixed(0)}%</td><td>{lean.toFixed(0)}%</td><td>{tu.toFixed(0)}%</td>
                    <td><span className="px-row">{[2e6, 6e6].map((a) => <button key={a} type="button" className="px-btn sm" onClick={() => run((x) => E.genSegment(d, x.Gn!, sel, k, a), sel)}>{E.usd(a)}</button>)}</span></td></tr>
                ); })}
              </tbody></table></div>
              <p className="px-note y28-small">Six vote history groups from the On Point electorate model of 1,152 groups per county. Drives pay most where a group leans your way and has room to grow, and more from week 7 when ballots go out.</p>
            </div>
          ) : null}
          {tab === "nat" ? (
            <div className="y28-pane">
              <h3>National campaign</h3>
              <div className="y28-acts">
                {[20e6, 60e6].map((a) => <button key={a} type="button" className="px-btn" onClick={() => run((x) => E.genNatTV(d, x.Gn!, a))}><small>Air war</small>{E.usd(a)} national</button>)}
                <button type="button" className="px-btn" onClick={() => run((x) => E.genMedia(d, x.Gn!, x))}><small>Half day</small>Media blitz</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genFund(d, x.Gn!, "call"))}><small>Half day</small>Call time</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genFund(d, x.Gn!, "dinner"))}><small>1 day</small>Finance dinner</button>
                <button type="button" className="px-btn" disabled={S.emailW === S.week} onClick={() => run((x) => { x.Gn!.emailW = x.Gn!.week; return E.genFund(d, x.Gn!, "email"); })}><small>Once a week</small>Email and text blast</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genPrep(x.Gn!))}><small>1 day · prep {S.prep}</small>Debate prep</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.genRest(x.Gn!))}><small>1 day</small>Rest</button>
              </div>
              <span className="px-k">The other campaign</span>
              <div className="y28-kvs">
                <span><small>{sur(op)} cash</small><b><Roll v={S.opCash} fmt={E.usd} /></b></span>
                <span><small>Running mate</small><b>{S.opVp ?? "None"}</b></span>
                <span><small>Their base</small><b>{Math.round(S.enth[1])}</b></span>
                <span><small>Your base</small><b>{Math.round(S.enth[0])}</b></span>
                <span><small>Super PAC for you</small><b>{E.usd(S.pac?.[0] ?? 0)}</b></span>
                <span><small>Super PAC for them</small><b>{E.usd(S.pac?.[1] ?? 0)}</b></span>
              </div>
              <p className="px-note y28-small">Super PACs cannot take your orders. They spend more when your base is fired up, in the closest states, at worse ad rates than yours.</p>
              <span className="px-k">Debates</span>
              <ul className="y28-debs">{S.debates.map((x, k) => <li key={k} className={cls(x.done && "done", x.w === S.week && "now")}><b>Week {x.w}</b><span>{DEB_NAME[k]}</span><em>{x.done ? (x.score! >= 0 ? "Won" : "Lost") : x.w === S.week ? "This week" : ""}</em></li>)}</ul>
            </div>
          ) : null}
          {tab === "oppo" ? (
            <div className="y28-pane">
              <h3>Opposition research <small>on {op}</small></h3>
              <p className="px-note y28-small">Your researchers comb {sur(op)}&apos;s record for the positions independents like least, from the On Point dataset. A hit lands harder in the last three weeks, but a thinly sourced one can blow up in your face.</p>
              <div className="y28-acts"><button type="button" className="px-btn" onClick={() => run((x) => E.genDig(d, x.Gn!, x))}><small>1 day · $3M · {S.dug ?? 0} digs so far</small>Dig into {sur(op)}</button></div>
              <ul className="y28-end">{(S.oppo ?? []).map((h, k) => (
                <li key={k}><div><b>{h.t[0].toUpperCase() + h.t.slice(1)}</b><small>{h.solid > 0.75 ? "Well sourced" : h.solid > 0.6 ? "Decent sourcing" : "Thin sourcing"} · {h.power > 0.9 ? "could move the race" : h.power > 0.6 ? "real damage" : "a scratch"}</small></div>
                  {h.used ? <span className={cls("px-tag", h.hit ? "real" : "hot")}>{h.hit ? "Landed" : "Backfired"}</span> : <button type="button" className="px-btn sm" onClick={() => run((x) => E.genDrop(d, x.Gn!, k, x))}>Drop it · $2M</button>}</li>
              ))}</ul>
              {!(S.oppo ?? []).length ? <p className="px-note">Nothing in the file yet.</p> : null}
            </div>
          ) : null}
          {tab === "polls" ? (
            <div className="y28-pane">
              <h3>The race by week</h3>
              <Trend pts={S.trend.map((t) => ({ w: t.w, p: t.p, ev: t.ev }))} h={70} />
              <p className="px-note y28-small">Gold is your win chance, green your electoral votes, both on your campaign&apos;s read. Public polls carry an error nobody sees until election night.</p>
              {natPoll ? <p className="px-note">National poll average: <b>{ptsLead(natPoll.m, sur(me), sur(op))}</b></p> : <p className="px-note">The first polls land at the end of week 1.</p>}
              {myPolls.length ? <table className="y28-tbl"><thead><tr><th>Public state poll</th><th>Margin</th></tr></thead><tbody>{myPolls.map((p) => <tr key={p.st} className={p.m >= 0 ? "good" : "bad"}><td>{E.nameOf(d, p.st)}</td><td>{ptsLead(p.m, sur(me), sur(op))}</td></tr>)}</tbody></table> : null}
            </div>
          ) : null}
          {tab === "wire" ? <ul className="y28-wire">{g.log.slice().reverse().slice(0, 50).map((l, k) => <li key={k} className={l.kind}><b>W{l.t}</b> {l.s}</li>)}</ul> : null}
          <div className="y28-end-bar">{deb ? <span className="px-tag hot">{DEB_NAME[S.debates.indexOf(deb)]}</span> : null}<button type="button" className="px-press" onClick={endWeek}>{presDeb ? "Take the debate stage" : S.week >= S.weeks ? "Election Day" : "End the week"}</button></div>
        </div>
      </div>
      {toast ? <div key={toast.k} className={cls("px-toast", toast.ok ? "ok" : "no")} role="status" onAnimationEnd={() => setToast(null)}>{toast.t}</div> : null}
      {crisis && !fx && !report && !debate ? <CrisisModal c={crisis} me={me} party={S.party} onPick={answerCrisis} /> : null}
      {curCard && !fx && !report && !debate ? <CardModal card={curCard} me={me} party={S.party} onPick={answer} /> : null}
      {fx ? <FxCard title={fx.title} lines={fx.lines} onDone={() => setFx(null)} /> : null}
      {debate ? <Debate28 me={me} op={op} party={S.party} opParty={opP} title={deb ? DEB_NAME[S.debates.indexOf(deb)] : "Debate"} seed={g.seed + S.week * 53} onDone={finishDebate} /> : null}
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
