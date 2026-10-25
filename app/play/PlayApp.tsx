"use client";
// Campaign 2026, the game. Pick a close Senate or governor race, pick a side and a difficulty, and run the last eight
// weeks of the campaign: raise the money, work the counties, staff up, buy the air war, build the turnout operation
// and answer what the week throws at you. Voters respond the way the site's own data says they would: the forecast,
// the county map, the voter group estimates, the polls, the money books and the people files. Then election night.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { marginColor, marginColorInd, raceHref } from "@/app/lib/opp";
import { fit, pathsBox, type CountyPath } from "@/app/components/home/countyGeo";
import { ev as track } from "@/app/lib/ev";
import * as E from "./engine";
import { dealWeek, resolve, type Outcome } from "./events";

export type PIndex = { asOf: string; election: string; races: { id: string; office: string; st: string; state: string; name: string; m: number; p: number; c: [string, string, boolean][] }[] };
type Save = { s: E.State };
const KEY = "opp_play_v1";
const DIFFS: E.Diff[] = ["safe", "lean", "tossup", "wave"];
const PARTY: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent" };
const sur = (n: string) => n.replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ").slice(-1)[0];
const pct = (p: number) => `${Math.round(p * 100)}%`;
const fxs = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;

function load(): Save | null { try { const j = localStorage.getItem(KEY); return j ? (JSON.parse(j) as Save) : null; } catch { return null; } }
function store(x: Save | null) { try { if (x) localStorage.setItem(KEY, JSON.stringify(x)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } }

// ============================================================ lobby
function Lobby({ idx, onStart, saved, onResume }: { idx: PIndex; onStart: (id: string, side: E.Side, d: E.Diff) => void; saved: Save | null; onResume: () => void }) {
  const [office, setOffice] = useState<"all" | "senate" | "governor">("all");
  const [pick, setPick] = useState<string | null>(null);
  const [side, setSide] = useState<E.Side | null>(null);
  const [diff, setDiff] = useState<E.Diff>("lean");
  const list = idx.races.filter((r) => office === "all" || r.office === office);
  const race = idx.races.find((r) => r.id === pick);
  const sr = saved ? idx.races.find((r) => r.id === saved.s.race) : null;
  return (
    <div className="pg-lobby">
      {saved && sr && !saved.s.done ? (
        <div className="pg-resume glass">
          <div><span className="pg-k">Campaign in progress</span><b>{saved.s.side === "D" ? sr.c[0][0] : sr.c[1][0]} for {sr.name}</b><small>Week {saved.s.week} of {E.WEEKS} · {E.DIFF[saved.s.diff].name}</small></div>
          <button type="button" className="btn g" onClick={onResume}>Back to headquarters</button>
        </div>
      ) : null}
      <section className="pg-step">
        <div className="pg-sh"><span className="pg-n">1</span><h2>Pick your race</h2>
          <div className="pg-chips" role="group" aria-label="Office">{(["all", "senate", "governor"] as const).map((o) => <button key={o} type="button" aria-pressed={office === o} className={office === o ? "on" : ""} onClick={() => setOffice(o)}>{o === "all" ? "All" : o === "senate" ? "Senate" : "Governor"}</button>)}</div>
        </div>
        <p className="pg-note">Every Senate and governor race the On Point forecast has within 15 points, closest first. Updated {idx.asOf}.</p>
        <div className="pg-races">
          {list.map((r) => {
            const ind = r.c.some((x) => x[1] === "I");
            return (
              <button key={r.id} type="button" className={`pg-race${pick === r.id ? " on" : ""}`} aria-pressed={pick === r.id} onClick={() => { setPick(r.id); setSide(null); }}>
                <span className="k">{r.office === "senate" ? "Senate" : "Governor"} · {r.st}</span>
                <b>{r.state}</b>
                <span className="who"><i className={(r.c[0][1] || "D").toLowerCase()}>{sur(r.c[0][0])}</i> vs <i className="r">{sur(r.c[1][0])}</i></span>
                <span className="m" style={{ color: r.m > 0 ? "var(--gop2)" : ind ? "#b78cff" : "var(--dem2)" }}>{Math.abs(r.m) < 0.05 ? "Even" : r.m > 0 ? `R +${r.m.toFixed(1)}` : `${r.c[0][1]} +${Math.abs(r.m).toFixed(1)}`}</span>
              </button>
            );
          })}
        </div>
      </section>
      {race ? (
        <section className="pg-step">
          <div className="pg-sh"><span className="pg-n">2</span><h2>Pick your candidate</h2></div>
          <div className="pg-cands">
            {race.c.map(([name, party, inc], k) => {
              const sd: E.Side = k === 0 ? "D" : "R";
              const odds = sd === "R" ? race.p : 1 - race.p;
              return (
                <button key={name} type="button" className={`pg-cand ${party.toLowerCase()}${side === sd ? " on" : ""}`} aria-pressed={side === sd} onClick={() => setSide(sd)}>
                  <span className="k">{PARTY[party] ?? party}{inc ? " · incumbent" : ""}</span>
                  <b>{name}</b>
                  <span>Forecast chance to win: <strong>{pct(odds)}</strong></span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
      {race && side ? (
        <section className="pg-step">
          <div className="pg-sh"><span className="pg-n">3</span><h2>Pick the year you are running in</h2></div>
          <div className="pg-diffs">
            {DIFFS.map((d, i) => (
              <button key={d} type="button" className={`pg-diff${diff === d ? " on" : ""}`} aria-pressed={diff === d} onClick={() => setDiff(d)}>
                <span className="pg-bars" aria-hidden="true">{[0, 1, 2, 3].map((j) => <i key={j} className={j <= i ? "f" : ""} />)}</span>
                <b>{E.DIFF[d].name}</b><small>{E.DIFF[d].blurb}</small>
              </button>
            ))}
          </div>
          <div className="pg-go">
            <button type="button" className="btn g pg-start" onClick={() => onStart(race.id, side, diff)}>Launch the campaign</button>
            <span className="pg-note">Eight weeks, Labor Day to Election Day. Six days on the trail a week.</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ============================================================ the state map
function StateMap({ r, s, paths, sel, onSel, mode }: { r: E.RaceFile; s: E.State; paths: CountyPath[] | null; sel: string | null; onSel: (f: string) => void; mode: "plan" | "night"; }) {
  const byF = useMemo(() => new Map(r.counties.map((c, i) => [c[0], i])), [r]);
  const ind = r.cands[0].party === "I";
  const W = 760, H = 470;
  const box = useMemo(() => (paths ? fit(pathsBox(paths), W, H, 24, 24) : null), [paths]);
  if (!paths || !box) return <div className="pg-map-ph">Loading the map of {r.state}</div>;
  const g = E.globalShift(s);
  const night = mode === "night" && s.result ? new Map(s.result.counties.map((x) => [x.f, x])) : null;
  return (
    <svg className="pg-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${r.state}'s counties`}>
      <g transform={`translate(${box.ox},${box.oy}) scale(${box.sc})`}>
        {paths.map((p) => {
          const i = byF.get(p.id);
          let fill = "var(--pg-none)";
          if (i != null) {
            if (night) { const x = night.get(p.id); fill = x ? (ind ? marginColorInd : marginColor)(s.side === "R" ? x.m : -x.m) : fill; }
            else { const v = E.countyVotes(r, s, i, g); const pm = (100 * (v.me - v.op)) / Math.max(1, v.t); fill = (ind ? marginColorInd : marginColor)(s.side === "R" ? pm : -pm); }
          }
          return <path key={p.id} d={p.d} fill={fill} className={`pg-c${sel === p.id ? " sel" : ""}`} strokeWidth={(sel === p.id ? 2.4 : 0.6) / box.sc}
            onClick={() => i != null && onSel(p.id)} />;
        })}
      </g>
    </svg>
  );
}

// ============================================================ small parts
function Parts({ parts }: { parts: E.Part[] }) {
  const max = Math.max(0.01, ...parts.map((p) => Math.abs(p.fx)));
  return (
    <ul className="pg-parts">
      {parts.slice(0, 6).map((p, i) => (
        <li key={i}>
          <span className="l">{p.label} <small>{Math.round(p.share)}% of voters{p.lean ? `, lean ${p.lean > 0 ? "R" : "D"} +${Math.round(Math.abs(p.lean) * 100)}` : ""}</small></span>
          <span className="bar"><i className={p.fx >= 0 ? "up" : "dn"} style={{ width: `${(50 * Math.abs(p.fx)) / max}%`, [p.fx >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /></span>
          <b className={p.fx >= 0 ? "up" : "dn"}>{fxs(p.fx)}</b>
        </li>
      ))}
    </ul>
  );
}

function PollChart({ s, me, op }: { s: E.State; me: string; op: string }) {
  const W = 520, H = 190, P = 34;
  const ps = s.polls;
  const vals = [...ps.map((p) => p.m), 0];
  const lo = Math.min(-4, ...vals) - 1, hi = Math.max(4, ...vals) + 1;
  const X = (w: number) => P + (w * (W - 2 * P)) / E.WEEKS, Y = (m: number) => 10 + ((hi - m) * (H - 34)) / (hi - lo);
  const avg: { w: number; m: number }[] = [];
  for (let w = 0; w < s.week; w++) { const near = ps.filter((p) => p.w <= w && p.w >= w - 2); if (near.length) avg.push({ w, m: near.reduce((a, p) => a + p.m * (p.internal ? 1.6 : 1), 0) / near.reduce((a, p) => a + (p.internal ? 1.6 : 1), 0) }); }
  return (
    <svg className="pg-pc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Polls of the race by week">
      <line x1={P} x2={W - P} y1={Y(0)} y2={Y(0)} className="z" />
      <text x={4} y={Y(hi - 1) + 4} className="ax">{sur(me)} +{Math.round(hi - 1)}</text>
      <text x={4} y={Y(lo + 1)} className="ax">{sur(op)} +{Math.round(-(lo + 1))}</text>
      {Array.from({ length: E.WEEKS + 1 }, (_, w) => <text key={w} x={X(w)} y={H - 4} textAnchor="middle" className="ax">{w === 0 ? "Start" : `W${w}`}</text>)}
      {avg.length > 1 ? <path d={avg.map((a, i) => `${i ? "L" : "M"}${X(a.w).toFixed(1)} ${Y(a.m).toFixed(1)}`).join(" ")} className="avg" /> : null}
      {ps.map((p, i) => <circle key={i} cx={X(p.w) + ((i * 7) % 11) - 5} cy={Y(p.m)} r={p.internal ? 4.5 : 3.2} className={p.internal ? "int" : "pub"}><title>{`${p.src}: ${E.lead(p.m, sur(me), sur(op))}`}</title></circle>)}
    </svg>
  );
}

// ============================================================ headquarters
type Tab = "trail" | "air" | "staff" | "ground" | "polls" | "intel" | "log";
function HQ({ r, s, commit, paths, onNight, quit }: { r: E.RaceFile; s: E.State; commit: (x: E.State) => void; paths: CountyPath[] | null; onNight: () => void; quit: () => void }) {
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("trail");
  const [toast, setToast] = useState<{ t: string; ok: boolean; k: number } | null>(null);
  const [out, setOut] = useState<{ ev: E.Ev; o: Outcome; choice: number } | null>(null);
  const [week, setWeek] = useState<E.LogItem[] | null>(null);
  const [tvAmt, setTvAmt] = useState(0.5);
  const [tone, setTone] = useState<"positive" | "contrast" | "attack">("contrast");
  const [dg, setDg] = useState<string>("");
  useEffect(() => { if (s.evw < s.week && !s.done) { const x = structuredClone(s); dealWeek(c, x); commit(x); } }, [s, c, commit]);
  const run = (f: (x: E.State) => E.ActResult, ev?: string) => {
    const x = structuredClone(s); const res = f(x);
    if (res.ok) commit(x);
    setToast({ t: res.t, ok: res.ok, k: Date.now() }); if (res.ok && ev) track("Play action", { a: ev, race: r.id });
  };
  const ci = sel ? r.counties.findIndex((x) => x[0] === sel) : -1;
  const co = ci >= 0 ? r.counties[ci] : null;
  const avg = E.polledAvg(s);
  const me = c.me, op = c.op;
  const pend = s.cur[0];
  const debate = s.week === E.DEBATE_WEEK && s.cur.length > 0;
  const tvSteps = [0.25, 0.5, 1, 2].map((k) => Math.round((k * c.cost) / 50000) * 50000).filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  const digGroups = c.groups.filter((g) => !["Party ID", "2024 presidential vote", "Trump job approval", "Direction of the country", "Race and gender", "Race and education"].includes(g.dim) && g.share >= 5);
  const endWeek = () => {
    const x = structuredClone(s); const items = E.endWeek(c, x); commit(x);
    setWeek(items); track("Play week", { race: r.id, week: s.week });
  };
  const choose = (i: number) => {
    const x = structuredClone(s); const e = x.cur.shift()!; const o = resolve(c, x, e, i, e.kind === "debate"); commit(x);
    setOut({ ev: e, o, choice: i });
  };
  const stam = s.stamina;
  return (
    <div className="pg-hq">
      <header className="pg-top glass">
        <div className="pg-id">
          <span className="pg-k">{r.name} · {E.DIFF[s.diff].name}</span>
          <b className={me.party.toLowerCase()}>{me.name}</b>
        </div>
        <div className="pg-stat"><span>Week {Math.min(s.week, E.WEEKS)} of {E.WEEKS}</span><b>{E.weekLabel(Math.min(s.week, E.WEEKS))}</b></div>
        <div className="pg-stat"><span>Days left</span><b className="pg-days" aria-label={`${s.days} days left`}>{Array.from({ length: E.DAYS }, (_, i) => <i key={i} className={i < s.days ? "f" : ""} />)}</b></div>
        <div className="pg-stat"><span>Cash</span><b className={s.cash < 0 ? "dn" : ""}>{E.usd(s.cash)}</b></div>
        <div className="pg-stat"><span>Candidate energy</span><b className="pg-stam"><i style={{ width: `${stam}%` }} className={stam < 30 ? "lo" : stam < 60 ? "md" : ""} /></b></div>
        <div className="pg-stat"><span>Your polling average</span><b className={avg == null ? "" : avg >= 0 ? "up" : "dn"}>{avg == null ? "No poll yet" : E.lead(avg, sur(me.name), sur(op.name))}</b></div>
        <div className="pg-acts">
          <button type="button" className="btn g" onClick={endWeek} disabled={!!pend}>{s.week >= E.WEEKS ? "Go to Election Day" : "End the week"}</button>
          <button type="button" className="btn sm" onClick={quit}>Menu</button>
        </div>
      </header>

      <div className="pg-main">
        <section className="pg-mapw glass">
          <div className="pg-mh"><b>{r.state}</b><span className="pg-note">Counties shaded by where your campaign thinks they stand. Click one to campaign there.</span></div>
          <StateMap r={r} s={s} paths={paths} sel={sel} onSel={setSel} mode="plan" />
          {co ? (
            <div className="pg-county">
              <div className="pg-ch"><b>{co[1]}</b><span>{((100 * co[5]) / c.total).toFixed(1)}% of the vote · forecast {E.lead(c.sign * co[2] + s.pers[ci], sur(me.name), sur(op.name))}{co[6] != null ? ` · 2024 president ${co[6] > 0 ? "R" : "D"} +${Math.abs(co[6]).toFixed(1)}` : ""}</span>
                <span>Your visits {s.visits[co[0]] ?? 0} · theirs {s.oppVisits[co[0]] ?? 0}{s.offices.includes(co[0]) ? " · field office open" : ""}</span></div>
              <div className="pg-cacts">
                <button type="button" className="btn" disabled={s.days < 1} onClick={() => run((x) => E.rally(c, x, co[0]), "rally")}>Rally <small>1 day · $35K</small></button>
                <button type="button" className="btn" disabled={s.days < 1} onClick={() => run((x) => E.townHall(c, x, co[0]), "town hall")}>Town hall <small>1 day · $12K</small></button>
                <button type="button" className="btn" disabled={s.offices.includes(co[0])} onClick={() => run((x) => E.openOffice(c, x, co[0]), "office")}>Field office <small>$60K</small></button>
              </div>
            </div>
          ) : <div className="pg-county pg-note">Pick a county. Rallies in your strongholds fire up turnout, in battlegrounds they persuade, and on the other side&apos;s turf they win a little and make news.</div>}
        </section>

        <section className="pg-side glass">
          <div className="pg-tabs" role="tablist">
            {([["trail", "Campaign"], ["air", "Air war"], ["staff", "Staff"], ["ground", "Turnout"], ["polls", "Polls"], ["intel", "Intel"], ["log", "Log"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} role="tab" type="button" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="pg-pane">
            {tab === "trail" ? (
              <div className="pg-grid">
                <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.fundraise(c, x, "call"), "call")}><b>Call time</b><span>1 day. Dial donors for about {E.usd(c.weekly * 0.38 * E.DIFF[s.diff].fund)}.</span></button>
                <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.fundraise(c, x, "donors"), "donors")}><b>Big dollar fundraiser</b><span>1 day. About {E.usd(c.weekly * 0.85 * E.DIFF[s.diff].fund)}; {Math.round(c.costsHard)}% of voters here say daily costs are hard to afford, so a bad photo can hurt.</span></button>
                <button type="button" className="pg-act" disabled={s.fatigue >= 3} onClick={() => run((x) => E.fundraise(c, x, "email"), "email")}><b>Small dollar blast</b><span>No days. Email and text your list; each blast in a week brings in less.</span></button>
                <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.media(c, x), "media")}><b>Media tour</b><span>1 day. Local TV, talk radio and podcasts.</span></button>
                {s.week <= E.DEBATE_WEEK ? <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.debatePrep(c, x), "prep")}><b>Debate prep</b><span>1 day. The debate is week {E.DEBATE_WEEK}; prep sessions so far: {s.prep}.</span></button> : null}
                <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.rest(x))}><b>Day off</b><span>1 day. Restores energy. Below 30 the candidate starts making mistakes.</span></button>
              </div>
            ) : null}
            {tab === "air" ? (
              <div className="pg-air">
                <p className="pg-note">A week of statewide television in {r.state} runs about {E.usd(c.cost)}. A normal campaign with your money would run about {E.usd(s.weekCash * E.SCHED[Math.min(E.WEEKS, s.week) - 1])} this week; spending above that is what moves the race. Booked so far this week: {E.usd(s.tvWeek)}.</p>
                <div className="pg-row"><span className="pg-k">Tone</span>{(["positive", "contrast", "attack"] as const).map((t) => <button key={t} type="button" className={`chip${tone === t ? " on" : ""}`} aria-pressed={tone === t} onClick={() => setTone(t)}>{t === "positive" ? "Positive bio" : t === "contrast" ? "Contrast" : "Attack"}</button>)}</div>
                <div className="pg-row"><span className="pg-k">Buy</span>{tvSteps.map((v) => <button key={v} type="button" className="btn" disabled={s.cash < v} onClick={() => run((x) => E.buyTV(c, x, v, tone), "tv")}>{E.usd(v)}</button>)}</div>
                <p className="pg-note">Attack ads hit hardest but can draw a fact check unless you have an opposition research firm. Outside groups spend for both sides on their own: {E.usd(c.outMe)} a week for you, {E.usd(c.outOp)} for {sur(op.name)}.</p>
                <div className="pg-sep" />
                <span className="pg-k">Targeted digital</span>
                <div className="pg-row">
                  <select className="pg-sel" value={dg} onChange={(e) => setDg(e.target.value)} aria-label="Voter group to target">
                    <option value="">Pick a voter group</option>
                    {digGroups.map((g) => <option key={g.dim + g.label} value={g.label}>{g.label}: {Math.round(g.share)}% of voters, {Math.round(g.d)} D to {Math.round(g.r)} R</option>)}
                  </select>
                  {[100000, 250000].map((v) => <button key={v} type="button" className="btn" disabled={!dg || s.cash < v} onClick={() => run((x) => E.buyDigital(c, x, v, dg), "digital")}>{E.usd(v)}</button>)}
                </div>
                <p className="pg-note">Closely divided groups move most. The splits are the On Point forecast&apos;s own voter group estimates for this race.</p>
              </div>
            ) : null}
            {tab === "staff" ? (
              <div className="pg-grid">
                <div className="pg-act static"><b>Pollster</b><span>{s.staff.pollster ? `${E.POLLSTERS[s.staff.pollster]!.name}, ${E.usd(E.POLLSTERS[s.staff.pollster]!.wk)} a poll each week.` : "None. You only see public polls, when they come out."}</span>
                  <span className="pg-row">{([1, 2, 3] as const).map((t) => <button key={t} type="button" className={`chip${s.staff.pollster === t ? " on" : ""}`} onClick={() => run((x) => E.hire(c, x, "pollster", t), "pollster")}>{["C", "B", "A"][t - 1]} rated, {E.usd(E.POLLSTERS[t]!.wk)}/wk</button>)}</span>
                  <small className="pg-note">Better pollsters miss by less: about {E.POLLSTERS[1]!.sd}, {E.POLLSTERS[2]!.sd} and {E.POLLSTERS[3]!.sd} points, and show you how each voter group is moving.</small></div>
                {(Object.keys(E.STAFF_COST) as (keyof typeof E.STAFF_COST)[]).map((k) => (
                  <button key={k} type="button" className={`pg-act${s.staff[k] ? " done" : ""}`} disabled={s.staff[k]} onClick={() => run((x) => E.hire(c, x, k), k)}>
                    <b>{E.STAFF_COST[k].name}{s.staff[k] ? ", on staff" : ""}</b><span>{E.STAFF_COST[k].what} {E.usd(E.STAFF_COST[k].hire)} to hire{E.STAFF_COST[k].wk ? `, ${E.usd(E.STAFF_COST[k].wk)} a week` : ""}.</span>
                  </button>
                ))}
              </div>
            ) : null}
            {tab === "ground" ? (
              <div className="pg-air">
                <p className="pg-note">{r.earlyVote ? `${r.earlyVote.ballots.toLocaleString()} ballots were already cast in ${r.state} by ${r.earlyVote.date} in real life. ` : ""}Early voting opens in week {E.EARLY_FROM}; from then on every dollar of turnout work also banks votes, which protects you from a late polling miss.</p>
                <div className="pg-bank"><span className="pg-k">Votes banked</span><span className="bar"><i style={{ width: `${Math.round(s.banked * 100)}%` }} /></span><b>{Math.round(s.banked * 100)}%</b></div>
                <div className="pg-row"><span className="pg-k">Turnout program</span>{[0.15, 0.4, 0.8].map((k) => { const v = Math.round((k * c.total) / 10000) * 10000; return <button key={k} type="button" className="btn" disabled={s.cash < v} onClick={() => run((x) => E.fundGotv(c, x, v), "gotv")}>{E.usd(v)}</button>; })}</div>
                <p className="pg-note">Paid canvassers, rides to the polls and ballot chase in the counties you win. It pays out at the end of the week; a field director makes it go 40 percent further.</p>
                <span className="pg-k">Field offices {s.offices.length ? `(${s.offices.length})` : ""}</span>
                <p className="pg-note">{s.offices.length ? s.offices.map((f) => r.counties.find((x) => x[0] === f)?.[1]).join(", ") : "None yet. Open them from the map."}</p>
              </div>
            ) : null}
            {tab === "polls" ? (
              <div className="pg-air">
                <PollChart s={s} me={me.name} op={op.name} />
                <ul className="pg-plist">{[...s.polls].reverse().slice(0, 8).map((p, i) => <li key={i} className={p.internal ? "int" : ""}><span>{p.w === 0 ? "Before you started" : `Week ${p.w}`}</span><span>{p.src}</span><b className={p.m >= 0 ? "up" : "dn"}>{E.lead(p.m, sur(me.name), sur(op.name))}</b></li>)}</ul>
                {s.polls.filter((p) => p.internal).slice(-1).map((p) => (
                  <div key="x"><span className="pg-k">Your internal crosstabs, week {p.w}</span>
                    <ul className="pg-plist">{(p.groups ?? []).map((g) => <li key={g.label}><span>{g.label}</span><span /><b className={g.m >= 0 ? "up" : "dn"}>{E.lead(g.m, sur(me.name), sur(op.name))}</b></li>)}</ul></div>
                ))}
                {!s.staff.pollster ? <p className="pg-note">Hire a pollster to see a poll every week and how each group is moving.</p> : null}
              </div>
            ) : null}
            {tab === "intel" ? (
              <div className="pg-air">
                {[me, op].map((x) => (
                  <div key={x.side} className="pg-intel">
                    <span className="pg-k">{x === me ? "Your candidate" : "The opponent"}: {x.name}</span>
                    <ul>{x.intel.slice(0, 5).map((it, i) => <li key={i}>{it.l ? <b>{it.l}. </b> : null}{it.t} {it.u ? <a href={it.u} target="_blank" rel="noopener noreferrer">Source</a> : null}</li>)}</ul>
                    {!x.intel.length ? <p className="pg-note">No researched file yet.</p> : null}
                    <small className="pg-note">Real money: raised {E.usd(x.money.receipts ?? 0)}, cash {E.usd(x.money.cash ?? 0)}{x.money.as_of ? ` as of ${x.money.as_of}` : ""}, outside groups {E.usd(x.money.outside_for ?? 0)}.{x.file ? <> <Link href={`/watchdog/people/${x.file}`}>People file</Link></> : null}</small>
                  </div>
                ))}
                {r.media.length ? <><span className="pg-k">Media watch</span><ul className="pg-intel">{r.media.slice(0, 4).map((m, i) => <li key={i}><b>{m.who}</b>: {m.what}</li>)}</ul></> : null}
              </div>
            ) : null}
            {tab === "log" ? (
              <ul className="pg-log">{[...s.log].reverse().slice(0, 40).map((l, i) => <li key={i} className={l.kind}><span>W{l.w}</span><p>{l.t}</p>{l.fx != null && Math.abs(l.fx) >= 0.01 ? <b className={l.fx >= 0 ? "up" : "dn"}>{fxs(l.fx)}</b> : null}</li>)}</ul>
            ) : null}
          </div>
        </section>
      </div>
      {toast ? <div key={toast.k} className={`pg-toast${toast.ok ? "" : " bad"}`} role="status" onAnimationEnd={() => setToast(null)}>{toast.t}</div> : null}

      {pend && !out ? (
        <div className="pg-modal" role="dialog" aria-modal="true" aria-labelledby="pg-ev-h">
          <div className="pg-card glass">
            <span className="pg-k">{debate ? `Debate night · question ${4 - s.cur.length} of 3` : pend.kind === "attack" ? "Incoming" : pend.kind === "opening" ? "Opportunity" : pend.kind === "news" ? "In the news" : `Week ${s.week} decision`}</span>
            <h3 id="pg-ev-h">{pend.title}</h3>
            <p>{pend.prompt} {pend.src ? (pend.src.startsWith("/") ? <Link href={pend.src}>Read it</Link> : <a href={pend.src} target="_blank" rel="noopener noreferrer">Source</a>) : null}</p>
            {debate ? <p className="pg-note">Prep sessions: {s.prep}. Answers count half again as much on a debate stage, and prep sharpens them.</p> : null}
            <div className="pg-opts">
              {pend.opts.map((o, i) => {
                const blocked = (o.need === "oppo" && !s.staff.oppo) || (o.cash != null && s.cash < o.cash) || (o.days != null && s.days < o.days);
                return <button key={i} type="button" className="pg-opt" disabled={blocked} onClick={() => choose(i)}><b>{o.label}</b><span>{o.say}{o.cash ? ` ${E.usd(o.cash)}.` : ""}{o.days ? ` ${o.days} day.` : ""}{o.need === "oppo" && !s.staff.oppo ? " Needs an opposition research firm." : ""}</span></button>;
              })}
            </div>
          </div>
        </div>
      ) : null}
      {out ? (
        <div className="pg-modal" role="dialog" aria-modal="true" aria-labelledby="pg-out-h">
          <div className="pg-card glass">
            <span className="pg-k">How it played</span>
            <h3 id="pg-out-h">{out.ev.opts[out.choice].label}: <span className={out.o.fx >= 0 ? "up" : "dn"}>{fxs(out.o.fx)} points</span></h3>
            <p>{out.o.t}</p>
            {out.o.parts.length ? <><span className="pg-k">Who moved, from {r.state}&apos;s voter data</span><Parts parts={out.o.parts} /></> : null}
            <button type="button" className="btn g" onClick={() => setOut(null)}>{s.cur.length ? "Next question" : "Back to work"}</button>
          </div>
        </div>
      ) : null}
      {week ? (
        <div className="pg-modal" role="dialog" aria-modal="true" aria-labelledby="pg-wk-h">
          <div className="pg-card glass">
            <span className="pg-k">{s.done ? "The polls are closed" : `End of week ${s.week - 1}`}</span>
            <h3 id="pg-wk-h">{s.done ? "Election Day is here" : "The week in review"}</h3>
            <ul className="pg-log">{week.map((l, i) => <li key={i} className={l.kind}><p>{l.t}</p>{l.fx != null && Math.abs(l.fx) >= 0.01 ? <b className={l.fx >= 0 ? "up" : "dn"}>{fxs(l.fx)}</b> : null}</li>)}</ul>
            {(() => { const p = s.polls.filter((x) => x.w === s.week - 1); return p.length ? <p>New polling: {p.map((x) => `${x.src}, ${E.lead(x.m, sur(me.name), sur(op.name))}`).join("; ")}.</p> : <p className="pg-note">No new polls this week{s.staff.pollster ? "" : "; you do not have a pollster"}.</p>; })()}
            <button type="button" className="btn g" onClick={() => { setWeek(null); if (s.done) onNight(); }}>{s.done ? "Watch the returns" : `On to week ${s.week}`}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================ election night
function Night({ r, s, paths, again, menu }: { r: E.RaceFile; s: E.State; paths: CountyPath[] | null; again: () => void; menu: () => void }) {
  const res = s.result!;
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const [n, setN] = useState(0);
  const total = res.order.length;
  useEffect(() => {
    if (n >= total) return;
    const id = setTimeout(() => setN((x) => Math.min(total, x + Math.max(1, Math.ceil(total / 60)))), 140);
    return () => clearTimeout(id);
  }, [n, total]);
  const shown = useMemo(() => new Set(res.order.slice(0, n)), [res.order, n]);
  const tally = useMemo(() => {
    let me = 0, op = 0, t = 0;
    for (const x of res.counties) if (shown.has(x.f)) { me += (x.t * (1 + x.m / 100)) / 2; op += (x.t * (1 - x.m / 100)) / 2; t += x.t; }
    return { me, op, t };
  }, [shown, res.counties]);
  const allT = res.counties.reduce((a, x) => a + x.t, 0) || 1;
  const rep = tally.t / allT;
  const lead = tally.me - tally.op;
  const called = n >= total || (rep > 0.55 && Math.abs(lead) / allT > (1 - rep) * 0.35 && (lead > 0) === res.win);
  const sNight: E.State = useMemo(() => ({ ...s, result: { ...res, counties: res.counties.filter((x) => shown.has(x.f)) } }), [s, res, shown]);
  const g = E.grade(s);
  const done = n >= total;
  const share = `I ran ${c.me.name}'s campaign for ${r.name} on ${E.DIFF[s.diff].name} and ${res.win ? "won" : "lost"} by ${Math.abs(res.m).toFixed(1)} points. Grade: ${g.letter}. Play at onpointpolitics.com/play`;
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (done) track("Play finished", { race: r.id, side: s.side, diff: s.diff, win: res.win, m: Math.round(res.m * 10) / 10 }); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pg-night">
      <div className="pg-nh">
        <span className="pg-k pg-live"><i />Election night · {r.state}</span>
        <h2>{called ? (res.win ? `${c.me.name} wins` : `${c.op.name} wins`) : "Too early to call"}</h2>
      </div>
      <div className="pg-nmain">
        <section className="glass pg-mapw"><StateMap r={r} s={sNight} paths={paths} sel={null} onSel={() => {}} mode="night" /></section>
        <section className="glass pg-tally">
          <span className="pg-k">{Math.round(rep * 100)}% of the vote counted</span>
          {[{ n: c.me.name, v: tally.me, p: c.me.party, me: true }, { n: c.op.name, v: tally.op, p: c.op.party, me: false }].sort((a, b) => b.v - a.v).map((x) => (
            <div key={x.n} className={`pg-tl ${x.p.toLowerCase()}`}>
              <div><b>{x.n}{called && ((x.me && res.win) || (!x.me && !res.win)) ? " ✓" : ""}</b><span>{Math.round(x.v).toLocaleString()}</span></div>
              <span className="bar"><i style={{ width: `${tally.t ? (100 * x.v) / tally.t : 0}%` }} /></span>
              <small>{tally.t ? ((100 * x.v) / tally.t).toFixed(1) : "0.0"}%</small>
            </div>
          ))}
          {done ? (
            <div className="pg-final">
              <div className="pg-grade"><b>{g.letter}</b><span>{res.win ? "You won" : "You lost"} by {Math.abs(res.m).toFixed(1)} points. {g.line}</span></div>
              <dl>
                <div><dt>The forecast had you at</dt><dd>{E.lead(res.forecast, sur(c.me.name), sur(c.op.name))}</dd></div>
                <div><dt>You started at</dt><dd>{E.lead(res.start, sur(c.me.name), sur(c.op.name))}</dd></div>
                <div><dt>Raised and spent</dt><dd>{E.usd(s.raised)} · {E.usd(s.spent)}</dd></div>
                <div><dt>Counties visited</dt><dd>{Object.keys(s.visits).length}</dd></div>
              </dl>
              <div className="pg-row">
                <button type="button" className="btn" onClick={() => { navigator.clipboard?.writeText(share).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "Copied" : "Copy your result"}</button>
                <button type="button" className="btn g" onClick={again}>Run it again</button>
                <button type="button" className="btn" onClick={menu}>Pick another race</button>
              </div>
              <p className="pg-note">Now watch the real one: <Link href={raceHref(r.id)}>the {r.name} forecast</Link> · <Link href={`/watchdog/war-room/${r.id}`}>War Room</Link> · <Link href="/results">results desk on November 3</Link></p>
            </div>
          ) : <button type="button" className="btn sm" onClick={() => setN(total)}>Skip to the end</button>}
        </section>
      </div>
    </div>
  );
}

// ============================================================ the app
export default function PlayApp({ idx }: { idx: PIndex }) {
  const [screen, setScreen] = useState<"lobby" | "hq" | "night">("lobby");
  const [race, setRace] = useState<E.RaceFile | null>(null);
  const [st, setSt] = useState<E.State | null>(null);
  const [paths, setPaths] = useState<CountyPath[] | null>(null);
  const [saved, setSaved] = useState<Save | null>(null);
  const [err, setErr] = useState("");
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { setSaved(load()); }, []);
  useEffect(() => { if (st) store({ s: st }); }, [st]);
  const open = useCallback(async (id: string) => {
    const r = (await fetch(`/play/r/${id}.json`).then((x) => x.json())) as E.RaceFile;
    setRace(r); setPaths(null);
    fetch(`/forecast/states/${r.st}.json`).then((x) => x.json()).then((j) => setPaths(j.counties as CountyPath[])).catch(() => setPaths([]));
    return r;
  }, []);
  const start = async (id: string, side: E.Side, d: E.Diff) => {
    try { const r = await open(id); setSt(E.newGame(r, side, d)); setScreen("hq"); track("Play start", { race: id, side, diff: d }); top.current?.scrollIntoView({ behavior: "smooth" }); }
    catch { setErr("The race file did not load. Check your connection and try again."); }
  };
  const resume = async () => { if (!saved) return; try { await open(saved.s.race); setSt(saved.s); setScreen(saved.s.done ? "night" : "hq"); } catch { setErr("The saved campaign could not load."); } };
  const commit = useCallback((x: E.State) => setSt(x), []);
  const menu = () => { setScreen("lobby"); setSaved(load()); };
  return (
    <div ref={top} className="pg-app">
      {err ? <p className="pg-err" role="alert">{err}</p> : null}
      {screen === "lobby" ? <Lobby idx={idx} onStart={start} saved={saved} onResume={resume} /> : null}
      {screen === "hq" && race && st ? <HQ r={race} s={st} commit={commit} paths={paths} onNight={() => setScreen("night")} quit={menu} /> : null}
      {screen === "night" && race && st?.result ? <Night r={race} s={st} paths={paths} again={() => start(race.id, st.side, st.diff)} menu={() => { store(null); menu(); }} /> : null}
    </div>
  );
}
