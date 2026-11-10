"use client";
// Campaign 2028: the title, the setup, and the road from the first debate stage to election night, played full screen.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as E from "./engine28";
import { partyName } from "./cards28";
import Prim28 from "./Prim28";
import Gen28 from "./Gen28";
import { Title28, VPPick, Convention, Night28, Result28, Trophies } from "./Scenes28";
import { FEMALE, type Game, type Mode, load28, save28, pct, short, firstSentence } from "./ui28";
import { TROPHIES, earned, addTrophies, trophyCase } from "./trophies28";
import PlayApp, { type PIndex } from "../PlayApp";
import { Portrait, cls } from "../px/ui";
import { seedOf } from "../px/sprites";
import { sfx, unlock } from "../px/sound";

type Screen = "title" | "setup" | "game" | "classic";
const MODES: { k: Mode; name: string; blurb: string }[] = [
  { k: "full", name: "The whole road", blurb: "Run the primaries, win the nomination, pick a running mate and take it to November." },
  { k: "primary", name: "Primaries only", blurb: "Fight for the nomination state by state, from the first debates to the last delegates." },
  { k: "general", name: "General election", blurb: "Skip to the nominee. Pick your opponent, your running mate and ten weeks to 270." },
];
const FULL_KEY = "opp_play28_windowed";

function otherNominee(d: E.Data, p: E.Party, seed: number): { op: string; opVp: string | null } {
  const cs = d.cands[p].slice().sort((a, b) => b.nom - a.nom); const g = { rng: seed };
  let r = E.rand(g) * cs.reduce((a, c) => a + Math.max(0.002, c.nom), 0); let op = cs[0].n;
  for (const c of cs) { r -= Math.max(0.002, c.nom); if (r <= 0) { op = c.n; break; } }
  const vp = cs.find((c) => c.n !== op)?.n ?? null;
  return { op, opVp: vp };
}
const label = (g: Game) => `${g.me}, ${g.phase === "primary" ? `primaries turn ${(g.P?.t ?? 0) + 1}` : g.phase === "general" ? `general week ${g.Gn?.week ?? 1}` : g.phase === "night" ? "election night" : g.phase === "vp" ? "picking a running mate" : g.phase}`;

export default function App28({ idx }: { idx: PIndex }) {
  const root = useRef<HTMLDivElement>(null);
  const [d, setD] = useState<E.Data | null>(null);
  const [err, setErr] = useState("");
  const [screen, setScreen] = useState<Screen>("title");
  const [g, setG] = useState<Game | null>(null);
  const [saved, setSaved] = useState<Game | null>(null);
  const [full, setFull] = useState(true);
  const [owned, setOwned] = useState<string[]>([]);
  // setup
  const [mode, setMode] = useState<Mode>("full");
  const [party, setParty] = useState<E.Party>("D");
  const [me, setMe] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [third, setThird] = useState<string>("none");
  const [diff, setDiff] = useState<E.Diff>("lean");
  const [mgr, setMgr] = useState<E.Mgr>("data");

  useEffect(() => { fetch("/play/2028.json").then((r) => r.json()).then((j: E.Data) => setD(j)).catch(() => setErr("The 2028 campaign data did not load. Refresh to try again.")); }, []);
  useEffect(() => {
    const s = load28(); const w = (() => { try { return localStorage.getItem(FULL_KEY) === "1"; } catch { return false; } })();
    // read once from this device after the page mounts
    queueMicrotask(() => { if (s && s.v === 28) setSaved(s); if (w) setFull(false); setOwned(trophyCase()); });
  }, []);
  // full screen covers the site, so the page behind it should not scroll
  useEffect(() => {
    if (!full || screen === "classic") return; const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = o; };
  }, [full, screen]);
  const commit = useCallback((x: Game) => {
    if (x.phase === "over" && !x.trophies) { const t = d ? earned(d, x) : []; x.trophies = t; addTrophies(t); setOwned(trophyCase()); }
    setG(x); save28(x);
  }, [d]);
  const goFull = (on: boolean) => {
    setFull(on); try { localStorage.setItem(FULL_KEY, on ? "0" : "1"); } catch { /* storage blocked */ }
    try { if (on && root.current?.requestFullscreen && !document.fullscreenElement) root.current.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch { /* not allowed */ }
  };
  const enter = () => { unlock(); if (full) { try { if (root.current?.requestFullscreen && !document.fullscreenElement) root.current.requestFullscreen().catch(() => {}); } catch { /* not allowed */ } } };

  const opP: E.Party = party === "D" ? "R" : "D";
  const mine = useMemo(() => (d ? d.cands[party].slice().sort((a, b) => b.nom - a.nom || b.field - a.field) : []), [d, party]);
  const theirs = useMemo(() => (d ? d.cands[opP].slice().sort((a, b) => b.nom - a.nom || b.field - a.field) : []), [d, opP]);

  const shell = (body: React.ReactNode, foot?: React.ReactNode) => (
    <div ref={root} className={cls("px-app y28-app", full && "y28-full")}>
      <div className="y28-screen">{body}</div>
      <div className="y28-foot">{foot ?? <span className="px-k">Campaign 2028 · On Point Politics</span>}<button type="button" className="px-btn sm" onClick={() => goFull(!full)}>{full ? "Windowed" : "Full screen"}</button></div>
    </div>
  );

  if (screen === "classic") return (
    <div className="y28-classicwrap">
      <div className="y28-back"><button type="button" className="px-btn sm" onClick={() => setScreen("title")}>Back to Campaign 2028</button></div>
      <PlayApp idx={idx} />
    </div>
  );
  if (!d) return shell(<div className="px-lobby"><p className="px-note">{err || "Loading the 2028 map…"}</p></div>);

  const start = () => {
    if (!me) return; enter(); sfx("fanfare");
    const seed = (Date.now() % 1e9) | 0; const t = third === "none" ? null : third;
    const base: Game = { v: 28, mode, phase: "primary", party, me, diff, seed, rng: seed ^ 0x2028, third: t, seen: [], log: [], mgr };
    if (mode === "general") {
      const o = op ?? theirs[0].n; base.op = o; base.opVp = theirs.find((c) => c.n !== o)?.n ?? null; base.phase = "vp";
    } else {
      base.P = E.newPrimary(d, party, me, diff, seed); base.P.mgr = mgr;
      base.log.push({ t: 0, kind: "event", s: `${me} announces a run for the ${partyName(party)} nomination, with ${E.MGR[mgr].name.toLowerCase()} running the campaign.` });
    }
    commit(base); setScreen("game");
  };
  const toGeneral = (x: Game, vp: string | null) => {
    const shifts = x.P?.shifts ?? {}; const cashAdd = x.P ? Math.max(0, x.P.cash) * 0.5 : 0;
    if (!x.op) { const o = otherNominee(d, x.party === "D" ? "R" : "D", x.seed + 77); x.op = o.op; x.opVp = o.opVp; }
    x.Gn = E.newGeneral(d, x.party, x.me, x.op!, vp, x.opVp ?? null, x.third, x.diff, x.seed + 5, shifts, cashAdd, x.mgr ?? "data");
    x.phase = "general"; x.log = [{ t: 1, kind: "event", s: `The general election begins: ${x.me}${vp ? ` and ${vp}` : ""} against ${x.op}${x.opVp ? ` and ${x.opVp}` : ""}.` }];
    const promise = x.P?.vpPromise;
    if (promise && vp !== promise) { x.Gn.nat -= 0.4; x.Gn.enth[0] = Math.max(0, x.Gn.enth[0] - 3); x.log.push({ t: 1, kind: "bad", s: `${promise} says you broke your promise of the vice presidency, and their voters are not happy.`, fx: -0.4 }); }
    commit(x);
  };
  const primDone = (x0: Game) => {
    const x = structuredClone(x0); const P = x.P!;
    if (P.contested) { x.phase = "convention"; commit(x); return; }
    if (P.nominee === x.me) { if (x.mode === "primary") { x.phase = "over"; x.lost = undefined; } else x.phase = "vp"; }
    else { x.phase = "over"; x.lost = `${P.nominee} won the ${partyName(x.party)} nomination.`; }
    commit(x);
  };
  const convDone = (won: boolean, note: string) => {
    const x = structuredClone(g!); const P = x.P!;
    if (won) { P.nominee = x.me; x.log.push({ t: P.t, kind: "result", s: note }); x.phase = x.mode === "primary" ? "over" : "vp"; }
    else { P.nominee = P.field.filter((r) => r.n !== x.me).sort((a, b) => b.del - a.del)[0]?.n; x.phase = "over"; x.lost = `${note} ${P.nominee} is the nominee.`; }
    commit(x);
  };

  if (screen === "title") return shell(
    <div className="y28-titlewrap">
      <Title28 saved={saved ? label(saved) : null} onNew={() => { enter(); setScreen("setup"); }} onResume={() => { enter(); if (saved) { setG(saved); setScreen("game"); } }} onClassic={() => { goFull(false); setScreen("classic"); }} />
      <div className="y28-asof"><span className="px-k">Model data as of {d.asOf} · Election Day {d.election}</span><span className="px-k">Trophies {owned.length} of {TROPHIES.length}</span></div>
    </div>,
  );

  if (screen === "setup") return shell(
    <div className="y28-setup">
      <div className="px-lobby">
        <section className="px-step">
          <div className="px-sh"><span className="px-n">1</span><h2>How far do you want to run</h2></div>
          <div className="px-diffs len">{MODES.map((m) => <button key={m.k} type="button" className={cls("px-diff", mode === m.k && "on")} aria-pressed={mode === m.k} onClick={() => { setMode(m.k); sfx("click"); }}><b>{m.name}</b><small>{m.blurb}</small></button>)}</div>
        </section>
        <section className="px-step">
          <div className="px-sh"><span className="px-n">2</span><h2>Pick a party</h2></div>
          <div className="px-chips y28-party">{(["D", "R"] as E.Party[]).map((p) => <button key={p} type="button" className={cls(party === p && "on", p.toLowerCase())} onClick={() => { setParty(p); setMe(null); setOp(null); sfx("click"); }}>{partyName(p)}s</button>)}</div>
        </section>
        <section className="px-step">
          <div className="px-sh"><span className="px-n">3</span><h2>Pick your candidate</h2><span className="px-k">Sorted by the On Point nomination odds</span></div>
          <div className="y28-cands">{mine.map((c) => (
            <button key={c.n} type="button" className={cls("y28-cand", me === c.n && "on")} aria-pressed={me === c.n} onClick={() => { setMe(c.n); sfx("card"); }} style={{ ["--cc" as string]: c.c } as React.CSSProperties}>
              <Portrait seed={seedOf(c.n)} role="cand" party={party} size={64} female={FEMALE.has(c.n)} talking={me === c.n} />
              <b>{c.n}</b><small>{short(firstSentence(c.lane), 96)}</small>
              <span className="px-k">Nomination {c.nom >= 0.005 ? pct(c.nom) : "long shot"} · vs field {c.nat >= 0 ? "+" : ""}{c.nat.toFixed(1)}</span>
            </button>
          ))}</div>
        </section>
        <section className="px-step">
          <div className="px-sh"><span className="px-n">4</span><h2>Hire a campaign manager</h2></div>
          <div className="px-diffs y28-mgrs">{(Object.keys(E.MGR) as E.Mgr[]).map((k) => <button key={k} type="button" className={cls("px-diff", mgr === k && "on")} aria-pressed={mgr === k} onClick={() => { setMgr(k); sfx("click"); }}><Portrait seed={seedOf(`mgr2028${k}`)} role="staff" party={party} size={44} /><b>{E.MGR[k].name}</b><small>{E.MGR[k].blurb}</small></button>)}</div>
        </section>
        {mode === "general" ? (
          <section className="px-step">
            <div className="px-sh"><span className="px-n">5</span><h2>Pick your opponent</h2></div>
            <div className="px-chips">{theirs.slice(0, 16).map((c) => <button key={c.n} type="button" className={(op ?? theirs[0].n) === c.n ? "on" : ""} onClick={() => { setOp(c.n); sfx("click"); }}>{c.n}</button>)}</div>
          </section>
        ) : null}
        {mode !== "primary" ? (
          <section className="px-step">
            <div className="px-sh"><span className="px-n">{mode === "general" ? 6 : 5}</span><h2>Third party on the ballot</h2></div>
            <div className="px-chips"><button type="button" className={third === "none" ? "on" : ""} onClick={() => setThird("none")}>Two way race</button>{d.third.map((t) => <button key={t.n} type="button" className={third === t.n ? "on" : ""} onClick={() => { setThird(t.n); sfx("click"); }}>{t.n}</button>)}</div>
            {third !== "none" ? (() => { const t = d.third.find((x) => x.n === third)!; return <p className="px-note"><b>{t.n}</b>: {short(t.lane, 200)} About {t.share.toFixed(1)} percent nationally, drawing {t.rlean > t.dlean ? "more from Republicans" : t.rlean < t.dlean ? "more from Democrats" : "evenly"}. {t.status}</p>; })() : null}
          </section>
        ) : null}
        <section className="px-step">
          <div className="px-sh"><span className="px-n">{mode === "general" ? 7 : mode === "full" ? 6 : 5}</span><h2>The year</h2></div>
          <div className="px-diffs">{(Object.keys(E.DIFF) as E.Diff[]).map((k) => <button key={k} type="button" className={cls("px-diff", diff === k && "on")} aria-pressed={diff === k} onClick={() => { setDiff(k); sfx("click"); }}><b>{E.DIFF[k].name}</b><small>{E.DIFF[k].blurb}</small></button>)}</div>
        </section>
      </div>
      <div className="px-gobar"><span>{me ? <><b>{me}</b> for president · {E.MGR[mgr].name}</> : "Choose a candidate"}</span><div className="px-row"><button type="button" className="px-btn sm" onClick={() => setScreen("title")}>Back</button><button type="button" className="px-press" disabled={!me} onClick={start}>Launch the campaign</button></div></div>
    </div>,
  );

  // the game
  if (!g) return null;
  const menu = () => { setScreen("title"); setSaved(load28()); };
  const again = () => { save28(null); setSaved(null); setG(null); setScreen("setup"); };
  const foot = <><button type="button" className="px-btn sm" onClick={menu}>Save and quit</button><span className="px-k">{g.me} · {partyName(g.party)} · {E.DIFF[g.diff].name}</span></>;
  return shell(
    <>
      {g.phase === "primary" && g.P ? <Prim28 d={d} g={g} commit={commit} onDone={primDone} /> : null}
      {g.phase === "convention" && g.P ? <Convention d={d} P={g.P} onDone={convDone} /> : null}
      {g.phase === "vp" ? <VPPick d={d} party={g.party} me={g.me} promised={g.P?.vpPromise} onPick={(vp) => { sfx("fanfare"); toGeneral(structuredClone(g), vp); }} /> : null}
      {g.phase === "general" && g.Gn ? <Gen28 d={d} g={g} commit={commit} onDone={(x) => { const y = structuredClone(x); y.phase = "night"; commit(y); }} /> : null}
      {g.phase === "night" && g.Gn && g.night ? <Night28 d={d} s={g.Gn} res={g.night} onDone={() => { const y = structuredClone(g); y.phase = "over"; commit(y); }} /> : null}
      {g.phase === "over" && g.Gn && g.night ? <Result28 d={d} s={g.Gn} res={g.night} trophies={g.trophies} start={{ p: g.Gn.trend[0]?.p ?? 0.5, ev: g.Gn.trend[0]?.ev ?? 269 }} onAgain={again} onMenu={menu} /> : null}
      {g.phase === "over" && !g.night ? (
        <div className="px-lobby y28-result">
          <section className="px-step">
            <span className={cls("px-tag", g.lost ? "hot" : "real")}>{g.lost ? "Campaign over" : "Nominee"}</span>
            <h2 className="y28-big">{g.lost ? "The road ends here" : `${g.me} is the ${partyName(g.party)} nominee`}</h2>
            <p className="px-note">{g.lost ?? `You won ${g.P?.field[0].del.toLocaleString() ?? 0} delegates and ${g.P?.field[0].wins ?? 0} contests.`}</p>
            <Trophies ids={g.trophies ?? []} />
            <div className="px-row">
              {!g.lost ? <button type="button" className="px-press" onClick={() => { const y = structuredClone(g); y.mode = "full"; y.phase = "vp"; y.trophies = undefined; setG(y); save28(y); }}>Keep going to November</button> : null}
              <button type="button" className="px-press ghost" onClick={again}>Run again</button><button type="button" className="px-press ghost" onClick={menu}>Main menu</button>
            </div>
          </section>
        </div>
      ) : null}
    </>,
    foot,
  );
}
