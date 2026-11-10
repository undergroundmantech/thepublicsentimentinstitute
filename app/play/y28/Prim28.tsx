"use client";
// The primaries: work the early states, chase endorsements, take the debate stages, and win delegates state by state
// against a field that campaigns back, drops out and endorses.
import React, { useEffect, useMemo, useState } from "react";
import * as E from "./engine28";
import { dealCard, partyName } from "./cards28";
import TileMap28, { type Mark } from "./TileMap28";
import { CardModal, CrisisModal, Debate28, FxCard } from "./Scenes28";
import { DaysBar, DelBar, HorseRace, Ticker, FEMALE, type Game, pct, short, firstSentence, Face28 } from "./ui28";
import { Roll, cls, sur } from "../px/ui";
import { seedOf } from "../px/sprites";
import { sfx, music } from "../px/sound";
import { onRecord, storyOf, recordOn, recallText } from "./story28";

type Tab = "state" | "nat" | "field" | "wire";
export default function Prim28({ d, g, commit, onDone }: { d: E.Data; g: Game; commit: (x: Game) => void; onDone: (x: Game) => void }) {
  const P = g.P!; const me = P.field[0].n; const T = P.turns[Math.min(P.t, P.turns.length - 1)];
  const [sel, setSel] = useState<string | null>(T.states[0] ?? "IA");
  const [hov, setHov] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("state");
  const [toast, setToast] = useState<{ t: string; ok: boolean; k: number } | null>(null);
  const [fx, setFx] = useState<{ title: string; lines: { l: string; v: number }[] } | null>(null);
  const [report, setReport] = useState<E.LogItem[] | null>(null);
  const [debate, setDebate] = useState(false);
  const [burst, setBurst] = useState<Mark[]>([]);
  const [emailed, setEmailed] = useState(-1);
  useEffect(() => { music("trail"); }, []);
  // deal this turn's issue moment once
  useEffect(() => {
    if (P.done || P.cardT >= P.t) return;
    const x = structuredClone(g); const c = dealCard(x.seen, "prim", () => E.rand(x)); if (c) { x.P!.cards.push(c); x.seen.push(c.id); } x.P!.cardT = x.P!.t; commit(x);
  }, [P.t, P.done, P.cardT, g, commit]);
  const crisis = P.crisis && P.crisisT === P.t ? P.crisis : null;
  const curCard = !crisis && P.cards.length && P.ans !== P.t && P.cardT === P.t ? P.cards[P.cards.length - 1] : null;
  const shares = useMemo(() => (sel ? E.primShares(d, P, sel) : {}), [d, P, sel]);
  const nat = useMemo(() => E.natShares(d, P), [d, P]);
  const odds = useMemo(() => E.primOdds(d, P), [d, P]);
  const col = (n: string) => d.cands[P.party].find((c) => c.n === n)?.c ?? "#888";
  const leader = (st: string) => { const r = P.results[st]; if (r) return r.win; const x = E.primShares(d, P, st); return Object.entries(x).sort((a, b) => b[1] - a[1])[0]?.[0] ?? me; };
  const states = useMemo(() => d.states.map((x) => x.st).filter((st) => d.primary[P.party].shares[st] || P.results[st]), [d, P.party, P.results]);
  const run = (fn: (x: Game) => E.Res, at?: string) => {
    const x = structuredClone(g); const r = fn(x); setToast({ t: r.t, ok: r.ok, k: Date.now() });
    if (r.ok) { commit(x); sfx("good"); if (at) setBurst([{ st: at, kind: "burst", t0: performance.now() }]); } else sfx("buzz");
  };
  const answer = (i: number) => {
    const x = structuredClone(g); const c = x.P!.cards[x.P!.cards.length - 1]; const o = c.opts[i];
    const r = E.primStance(d, x.P!, c.k, o.pos); x.P!.ans = x.P!.t; onRecord(storyOf(x.P!), c.k, o.pos, o.say, 0, `the primary, ${c.title.toLowerCase()}`);
    x.log.push({ t: x.P!.t, kind: "you", s: `${c.title}: you said “${o.say}”`, fx: r.fx }); commit(x);
    setFx({ title: `${o.label}`, lines: [{ l: `${partyName(P.party)} primary voters`, v: r.fx }, { l: "Independents, remembered for November", v: r.gen }] });
    sfx(r.fx > 0 ? "good" : "bad");
  };
  const answerCrisis = (i: number) => {
    const x = structuredClone(g); const s = x.P!; const c = s.crisis!; const o = c.opts[i];
    const r = E.answerCrisis(c, i, x, s.mgr); const k = r.fx * 0.07; s.field[0].mom += k; s.crisis = null;
    x.log.push({ t: s.t, kind: r.fx >= 0 ? "you" : "bad", s: `${c.title}: ${o.label.toLowerCase()}. ${r.bad ? "It went badly." : "It held."}`, fx: k }); commit(x);
    setFx({ title: r.bad ? `${o.label}: it went badly` : `${o.label}: it held`, lines: [{ l: "Your momentum", v: k }] }); sfx(r.bad ? "bad" : "good");
  };
  const debated = P.debW === P.t;
  const endTurn = () => {
    if (T.debate && !debated) { setDebate(true); return; }
    const x = structuredClone(g); const items = E.primEnd(d, x.P!, x); x.log.push(...items);
    if (x.P!.done) { commit(x); setReport(items); return; }
    const nx = x.P!.turns[x.P!.t]; if (nx?.states[0]) setSel(nx.states[0]);
    commit(x); setReport(items); sfx("whoosh");
  };
  const finishDebate = (ans: { k: number; pos: number; mult: number; say?: string }[]) => {
    const x = structuredClone(g); let tot = 0, gen = 0;
    for (const a of ans) { if (a.say) onRecord(storyOf(x.P!), a.k, a.pos, a.say, 0, "a primary debate"); const r = E.primStance(d, x.P!, a.k, a.pos, a.mult); tot += r.fx + (a.mult - 1) * 0.04; gen += r.gen; x.P!.field[0].mom += (a.mult - 1) * 0.04 * (x.P!.mgr === "message" ? 1.25 : 1); if (a.mult >= 1.45) x.P!.perfect = (x.P!.perfect ?? 0) + 1; }
    // a rival has a moment too
    const riv = x.P!.field.filter((r) => r.alive && r.n !== me); const star = riv[Math.floor(E.rand(x) * riv.length)];
    if (star) { const k = E.gauss(x) * 0.05; star.mom += k; x.log.push({ t: x.P!.t, kind: "rival", s: `${star.n} ${k > 0 ? "had the night's viral moment" : "stumbled on a follow up"}.` }); }
    x.P!.debW = x.P!.t; x.P!.debates += 1; x.log.push({ t: x.P!.t, kind: "you", s: `Debate: ${tot >= 0 ? "a win on the stage" : "a rough night"}.`, fx: tot });
    commit(x); setDebate(false); setFx({ title: "Debate night", lines: [{ l: "Your momentum", v: tot }, { l: "Independents, for November", v: gen }] });
  };
  const sh = sel ? Object.entries(shares).sort((a, b) => b[1] - a[1]) : [];
  const delSel = sel ? d.primary[P.party].cal.find((c) => c[0] === sel) : null;
  const done = sel ? P.results[sel] : null;
  const upcoming = new Set(P.turns.slice(P.t).flatMap((x) => x.states));
  const marks: Mark[] = [...T.states.map((st) => ({ st, kind: "next" as const })), ...Object.entries(P.results).map(([st, r]) => ({ st, kind: r.win === me ? "won" as const : "lost" as const, col: col(r.win) })), ...burst];
  const lastVisit = Object.keys(P.visits).slice(-1)[0]; if (lastVisit) marks.push({ st: lastVisit, kind: "me" });
  const tot = d.primary[P.party].total;
  return (
    <div className="y28-hq">
      <header className="y28-top">
        <div className="who"><Face28 seed={seedOf(me)} party={P.party} size={44} female={FEMALE.has(me)} talking /><div><b>{me}</b><span className="px-k">{partyName(P.party)} primary · turn {P.t + 1} of {P.turns.length} · {E.mgrOf(P).name}</span></div></div>
        <div className="kv"><span className="px-k">{T.date}</span><b>{T.label}</b></div>
        <div className="kv"><span className="px-k">Time</span><DaysBar n={P.days} /></div>
        <div className="kv"><span className="px-k">Cash</span><b className="gold"><Roll v={P.cash} fmt={E.usd} /></b></div>
        <div className="kv"><span className="px-k">Delegates</span><b>{P.field[0].del.toLocaleString()} <small>/ {Math.floor(tot / 2) + 1}</small></b></div>
        <div className="kv"><span className="px-k">Nomination odds</span><b>{pct(odds[me] ?? 0)}</b></div>
        <div className="kv"><span className="px-k">Stamina</span><b>{Math.round(P.stamina)}</b></div>
      </header>
      <Ticker items={g.log.slice(-8).reverse().map((l) => l.s)} />
      <DelBar d={d} P={P} />
      <div className="y28-main">
        <div className="y28-mapcol">
          <TileMap28 states={states} title="The primary map: each state in its leader's color" sel={sel} hov={hov} onPick={(st) => { setSel(st); setTab("state"); sfx("click"); }} onHover={setHov}
            fill={(st) => col(leader(st))} dim={(st) => !upcoming.has(st) && !P.results[st]} marks={marks} />
          <p className="px-note">States voting this turn blink gold. Finished contests carry the winner&apos;s dot. Faded states have voted.</p>
          <div className="y28-schedule">{P.turns.map((x, k) => <span key={k} className={cls(k === P.t && "now", k < P.t && "past", x.debate && "deb")}><b>{x.date}</b>{x.label}{x.states.length > 1 ? ` · ${x.states.length} states` : ""}</span>)}</div>
        </div>
        <div className="y28-side">
          <div className="px-tabs" role="tablist">{([["state", "State"], ["nat", "National"], ["field", "Field"], ["wire", "Wire"]] as [Tab, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
          {tab === "state" && sel ? (
            <div className="y28-pane">
              <h3>{E.nameOf(d, sel)} <small>{delSel ? `${delSel[2]} delegates` : ""}</small></h3>
              <ul className="y28-shares">{sh.slice(0, 6).map(([n, v]) => <li key={n} className={n === me ? "me" : ""}><span>{sur(n)}</span><i style={{ width: `${v}%`, background: col(n) }} /><b>{v.toFixed(0)}%</b></li>)}</ul>
              {done ? <p className="px-note">Voted: {done.win} won. Delegates: {Object.entries(done.del).filter(([, v]) => v).map(([n, v]) => `${sur(n)} ${v}`).join(", ")}.</p> : (
                <div className="y28-acts">
                  <button type="button" className="px-btn" onClick={() => run((x) => E.primRally(d, x.P!, sel), sel)}><small>1 day · $150K</small>Rally</button>
                  <button type="button" className="px-btn" onClick={() => run((x) => E.primTownHall(d, x.P!, sel), sel)}><small>Half day · $40K</small>Diner and town hall</button>
                  <button type="button" className="px-btn" disabled={P.offices.includes(sel)} onClick={() => run((x) => E.primOffice(d, x.P!, sel), sel)}><small>Half day · $400K</small>{P.offices.includes(sel) ? "Organized" : "Build an operation"}</button>
                  {[1e6, 3e6, 8e6].map((a) => <button key={a} type="button" className="px-btn" onClick={() => run((x) => E.primTV(d, x.P!, sel, a), sel)}><small>Ads</small>{E.usd(a)} of TV</button>)}
                </div>
              )}
              {(d.groups ?? []).length ? <>
                <span className="px-k">Who votes in this primary</span>
                <div className="y28-tblwrap"><table className="y28-tbl"><thead><tr><th>Group</th><th>Share of primary voters</th><th>Court</th></tr></thead><tbody>
                  {(d.groups ?? []).filter((gr) => gr.fam !== "Vote history" && gr.k !== "mid" && gr.k !== "gx").map((gr) => { const sh = E.primGroupShare(d, P.party, gr.k, sel); return (
                    <tr key={gr.k}><td>{gr.l}{P.gused?.[gr.k] ? <small> · {P.gused[gr.k]}x</small> : null}</td><td>{Math.round(sh * 100)}%</td><td><button type="button" className="px-btn sm" onClick={() => run((x) => E.primGroup(d, x.P!, gr.k, sel), sel)}>1 day</button></td></tr>
                  ); })}
                </tbody></table></div>
                <p className="px-note y28-small">Courting a group helps most here and a little in every state where that group is a big part of the {P.party === "D" ? "Democratic" : "Republican"} primary vote.</p>
              </> : null}
            </div>
          ) : null}
          {tab === "nat" ? (
            <div className="y28-pane">
              <h3>National campaign</h3>
              <div className="y28-acts">
                <button type="button" className="px-btn" onClick={() => run((x) => E.primMedia(d, x.P!, x))}><small>Half day</small>Media blitz</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.primFund(d, x.P!, "call"))}><small>Half day</small>Call time</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.primFund(d, x.P!, "bundlers"))}><small>1 day</small>Bundlers dinner</button>
                <button type="button" className="px-btn" disabled={emailed === P.t} onClick={() => { setEmailed(P.t); run((x) => E.primFund(d, x.P!, "email")); }}><small>Once a turn</small>Email and text blast</button>
                <button type="button" className="px-btn" onClick={() => run((x) => E.primRest(x.P!))}><small>1 day</small>Rest</button>
              </div>
              <span className="px-k">Endorsements</span>
              <ul className="y28-end">{E.ENDORSERS[P.party].map((e) => { const by = P.field.find((r) => r.endorse.includes(e.id)); return (
                <li key={e.id}><div><b>{e.who}</b><small>{e.what}</small></div>{by ? <span className={cls("px-tag", by.n === me ? "real" : "hot")}>{by.n === me ? "Yours" : sur(by.n)}</span> : <button type="button" className="px-btn sm" onClick={() => run((x) => E.primEndorse(d, x.P!, e.id, x))}>Court · 1 day</button>}</li>
              ); })}</ul>
            </div>
          ) : null}
          {tab === "field" ? (
            <div className="y28-pane">
              <h3>The field</h3>
              <HorseRace d={d} P={P} />
              <table className="y28-tbl"><thead><tr><th>Candidate</th><th>Del</th><th>Wins</th><th>Nat</th><th>Odds</th></tr></thead><tbody>
                {P.field.slice().sort((a, b) => b.del - a.del || (nat[b.n] ?? 0) - (nat[a.n] ?? 0)).map((r) => <tr key={r.n} className={cls(r.n === me && "me", !r.alive && "out")}><td><i style={{ background: col(r.n) }} />{r.n}{!r.alive ? " · out" : ""}</td><td>{r.del}</td><td>{r.wins}</td><td>{r.alive ? `${(nat[r.n] ?? 0).toFixed(0)}%` : ""}</td><td>{pct(odds[r.n] ?? 0)}</td></tr>)}
              </tbody></table>
              <span className="px-k">Cut a deal</span>
              <p className="px-note y28-small">Ask a rival to drop out and endorse you. Your odds are best with candidates who trail you, are running out of money, or sit close to you on the issues. Promising the vice presidency helps a lot, but you only have one to give{P.vpPromise ? `, and it is promised to ${P.vpPromise}` : ""}.</p>
              <ul className="y28-end">{P.field.filter((r) => r.alive && r.n !== me).map((r) => (
                <li key={r.n}><div><b>{r.n}</b><small>{(nat[r.n] ?? 0).toFixed(0)}% nationally · {E.usd(r.cash)} cash</small></div>
                  {(P.deals ?? []).includes(r.n) ? <span className="px-tag dim">Said no</span> : <span className="px-row"><button type="button" className="px-btn sm" onClick={() => run((x) => E.primDeal(d, x.P!, r.n, "cabinet", x))}>Cabinet post</button>{!P.vpPromise && g.mode !== "primary" ? <button type="button" className="px-btn sm" onClick={() => run((x) => E.primDeal(d, x.P!, r.n, "vp", x))}>Running mate</button> : null}</span>}</li>
              ))}</ul>
              <p className="px-note">{d.primary[P.party].rule}. Starting standing from the On Point primary model; candidates who fall behind run out of money and drop out, and in every state their voters move mostly to the candidates most like them, more so to the one they endorse.</p>
            </div>
          ) : null}
          {tab === "wire" ? <ul className="y28-wire">{g.log.slice().reverse().slice(0, 40).map((l, k) => <li key={k} className={l.kind}><b>T{l.t + 1}</b> {l.s}</li>)}</ul> : null}
          <div className="y28-end-bar">{T.debate && !debated ? <span className="px-tag hot">Debate this turn</span> : null}<button type="button" className="px-press" onClick={endTurn}>{T.debate && !debated ? "Take the debate stage" : T.states.length ? `Voting day: ${T.label}` : "End the turn"}</button></div>
        </div>
      </div>
      {toast ? <div key={toast.k} className={cls("px-toast", toast.ok ? "ok" : "no")} role="status" onAnimationEnd={() => setToast(null)}>{toast.t}</div> : null}
      {crisis && !fx && !report && !debate ? <CrisisModal c={crisis} me={me} party={P.party} onPick={answerCrisis} /> : null}
      {curCard && !fx && !report && !debate ? <CardModal card={curCard} me={me} party={P.party} onPick={answer} record={(() => { const r = recordOn(P, curCard.k); return r ? recallText(r) : null; })()} /> : null}
      {fx ? <FxCard title={fx.title} lines={fx.lines} onDone={() => setFx(null)} /> : null}
      {debate ? <Debate28 me={me} op={P.field.filter((r) => r.alive && r.n !== me).sort((a, b) => b.del - a.del || (nat[b.n] ?? 0) - (nat[a.n] ?? 0))[0]?.n ?? me} party={P.party} opParty={P.party} title={`${partyName(P.party)} primary debate`} seed={g.seed + P.t * 31} onDone={finishDebate} record={(k) => { const r = recordOn(P, k); return r ? recallText(r) : null; }} /> : null}
      {report ? (
        <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-rep-h">
          <div className="px-card wide report">
            <span className="px-tag">{T.date}</span><h3 id="y28-rep-h">{P.done ? "The primaries are over" : "The turn in review"}</h3>
            <ul className="y28-wire">{report.map((l, k) => <li key={k} className={l.kind}>{l.s}</li>)}</ul>
            <button type="button" className="px-btn go" onClick={() => { setReport(null); if (P.done) onDone(g); }}>{P.done ? "On to the convention" : "Next turn"}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
export function PrimIntro({ d, party, me }: { d: E.Data; party: E.Party; me: string }) {
  const c = d.cands[party].find((x) => x.n === me)!;
  return <p className="px-note">{short(firstSentence(c.lane), 160)}</p>;
}
