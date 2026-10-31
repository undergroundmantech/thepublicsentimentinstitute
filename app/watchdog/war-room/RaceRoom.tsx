"use client";
// One race in the War Room. Vital signs for both campaigns, then the brief for whichever side the reader works for:
// the path to victory, the counties and groups that decide it, the scouting report on both candidates, and the
// forecast, polls, money, air war, early vote, media and trail behind all of it.
import React from "react";
import Link from "@/app/components/Link";
import type { Health, Intel, Side, WRace, County, Grp } from "./data";
import { OFFICE_NAME, healthTone, lead, pct, surname, usd, warHref, winP } from "./fmt";
import { LensToggle, useLens } from "./lens";

const PART_NOTE: Record<string, string> = { money: "Receipts against the opponent", cash: "Cash on hand against the opponent", air: "Outside spending for and against", early_vote: "Party share of ballots cast", tide: "Gallup party ID shift since 2024, by race elasticity", activity: "Stops, media, ads and headlines" };

function Gauge({ s, tone }: { s: number | null; tone: string }) {
  const v = Math.max(0, Math.min(100, s ?? 0)), a = Math.PI * (1 - v / 100);
  const x = 60 + 48 * Math.cos(a), y = 58 - 48 * Math.sin(a);
  return (
    <svg className={`wr-gauge ${tone}`} viewBox="0 0 120 66" role="img" aria-label={s == null ? "Not enough data" : `${s} of 100`}>
      <path d="M12 58 A48 48 0 0 1 108 58" className="trk" />
      {s != null && v > 0 ? <path d={`M12 58 A48 48 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`} className="val" /> : null}
      <text x="60" y="52" textAnchor="middle" className="num">{s == null ? "n/a" : s}</text>
      <text x="12" y="65" textAnchor="middle" className="ax">0</text><text x="108" y="65" textAnchor="middle" className="ax">100</text>
    </svg>
  );
}

function HealthCard({ h, name, party, mine, fileId }: { h: Health; name: string; party: string; mine: boolean; fileId?: string | null }) {
  const tone = healthTone(h.score);
  return (
    <div className={`wr-hc card ${party.toLowerCase()}${mine ? " mine" : ""}`}>
      <div className="wr-hc-top">
        <div>
          <span className="k">{mine ? "Your campaign" : party === "R" ? "Republican" : party === "D" ? "Democrat" : "Independent"}</span>
          <b className="nm">{name}</b>
          <span className={`wr-tone ${tone}`}>{h.label}</span>
          {h.pens.length ? <small className="pf-mute">Base {h.base}, minus {h.pens.reduce((a, p) => a + p.pts, 0)} for liabilities</small> : null}
        </div>
        <Gauge s={h.score} tone={tone} />
      </div>
      <ul className="wr-parts">
        {h.parts.map((p) => (
          <li key={p.key}>
            <div className="wr-part-h"><span>{p.label} <small>weight {p.w}</small></span><b>{Math.round(p.v * 100)}</b></div>
            <div className="wr-part-bar" title={PART_NOTE[p.key]}><i style={{ width: `${Math.round(p.v * 100)}%` }} /><em style={{ left: "50%" }} /></div>
            <p>{p.why.join(" ")}</p>
          </li>
        ))}
        {!h.parts.length ? <li><p>No money, cash or activity on file for this campaign yet.</p></li> : null}
      </ul>
      {h.pens.length ? <ul className="wr-pens">{h.pens.map((p) => <li key={p.key}><b>−{p.pts}</b> {p.label}. <span className="pf-mute">{p.why}</span></li>)}</ul> : null}
      {fileId ? <Link className="wr-file" href={`/watchdog/people/${fileId}`}>Open the people file</Link> : null}
    </div>
  );
}

function Spark({ r }: { r: WRace }) {
  const t = r.trend.filter((x) => typeof x.m === "number");
  if (t.length < 3) return null;
  const W = 320, H = 96, P = 22;
  const lo = Math.min(-2, ...t.map((x) => x.m)), hi = Math.max(2, ...t.map((x) => x.m));
  const X = (i: number) => Math.round(10 * (P + (i * (W - 2 * P)) / (t.length - 1))) / 10, Y = (m: number) => Math.round(10 * (8 + ((hi - m) * (H - 24)) / (hi - lo))) / 10;
  const d = t.map((x, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(x.m).toFixed(1)}`).join(" ");
  const last = t[t.length - 1];
  return (
    <svg className="wr-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Forecast margin over the last ${t.length} runs, now ${lead(last.m, r.dP)}`}>
      <line x1={P} x2={W - P} y1={Y(0)} y2={Y(0)} className="zero" />
      <text x={W - P + 3} y={Y(hi) + 4} className="ax">{lead(hi, r.dP)}</text>
      <text x={W - P + 3} y={Y(lo)} className="ax">{lead(lo, r.dP)}</text>
      <path d={d} className={last.m > 0 ? "r" : "d"} />
      <circle cx={X(t.length - 1)} cy={Y(last.m)} r="3.2" className={last.m > 0 ? "r" : "d"} />
      <text x={P} y={H - 2} className="ax">{t.length} runs ago</text>
      <text x={W - P} y={H - 2} textAnchor="end" className="ax">now</text>
    </svg>
  );
}

function Counties({ title, sub, rows, side, dP }: { title: string; sub: string; rows: County[]; side: Side; dP: string }) {
  if (!rows.length) return null;
  return (
    <div className="wr-ct">
      <b>{title}</b><small>{sub}</small>
      <table className="pf-t">
        <thead><tr><th>County</th><th className="n">Forecast</th><th className="n">Vote share</th><th className="n">{side === "D" ? "Net D" : "Net R"}</th></tr></thead>
        <tbody>{rows.map((c) => <tr key={c.name}><td>{c.name}</td><td className="n">{lead(c.m, dP)}</td><td className="n">{c.share}%</td><td className="n">{c.net > 0 ? `+${c.net.toLocaleString()}` : c.net.toLocaleString()}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function GroupBars({ gs, me, op }: { gs: Grp[]; me: string; op: string }) {
  return (
    <ul className="wr-grp">
      {gs.map((g) => (
        <li key={g.group + g.label}>
          <div className="wr-grp-h"><span>{g.label}</span><small>{g.share.toFixed(0)}% of voters · a 5 point gain is worth {g.lever.toFixed(1)}</small></div>
          <div className="wr-grp-bar" aria-label={`${me} ${g.mine.toFixed(0)}, ${op} ${g.theirs.toFixed(0)}`}>
            <i className="me" style={{ width: `${g.mine}%` }}>{g.mine.toFixed(0)}</i><i className="op" style={{ width: `${g.theirs}%` }}>{g.theirs.toFixed(0)}</i>
          </div>
        </li>
      ))}
    </ul>
  );
}

function IntelList({ items, bottom }: { items: Intel[]; bottom: string[] }) {
  if (!items.length && !bottom.length) return <p className="pf-mute">No researched file yet; this candidate is queued for the next people file batch.</p>;
  return (
    <ul className="wr-intel">
      {items.map((x, i) => <li key={i}>{x.l ? <b>{x.l}. </b> : null}{x.t} {x.u ? <a href={x.u} target="_blank" rel="noopener noreferrer">Source</a> : null}</li>)}
      {!items.length ? bottom.slice(0, 2).map((b, i) => <li key={i}>{b.replace(/\*\*/g, "").replace(/,?\s*https?:\/\/\S+/g, "")}</li>) : null}
    </ul>
  );
}

export default function RaceRoom({ r, similar }: { r: WRace; similar: { id: string; label: string; office: string; st: string }[] }) {
  const [lens, setLens] = useLens();
  const me: Side = lens === "R" ? "R" : "D", op: Side = me === "D" ? "R" : "D";
  const NM: Record<Side, string> = { D: r.dem, R: r.gop }, PT: Record<Side, string> = { D: r.dP, R: "R" };
  const order: Side[] = lens === "R" ? ["R", "D"] : ["D", "R"];
  const m = r.map[me], c = r.coalition[me];
  const ev = r.earlyVote;
  const money = (s: Side) => r.money[s];
  return (
    <div className="wr-room">
      <div className="wr-lensbar card">
        <LensToggle side={lens} set={setLens} />
        <p>{lens === "N" ? "Neutral view. Pick a side and the War Room briefs you as that campaign's operative." : `Briefing for the ${surname(NM[me])} campaign: ${pct(winP(r.est.prob, me))} to win, ${r.est.margin === 0 ? "even" : (me === "R") === (r.est.margin > 0) ? `ahead by ${Math.abs(r.est.margin).toFixed(1)}` : `behind by ${Math.abs(r.est.margin).toFixed(1)}`}.`}</p>
      </div>

      <section aria-label="Campaign health">
        <div className="wr-sh"><h2>Vital signs</h2><span className="pf-mute">Campaign health, 0 to 100, from public money, outside spending, ballots and activity</span></div>
        <div className="wr-hcs">
          {order.map((s) => <HealthCard key={s} h={r.health[s]} name={NM[s]} party={PT[s]} mine={lens !== "N" && s === me} fileId={r.people[s]?.hand ? r.people[s]!.id : null} />)}
        </div>
      </section>

      <section aria-label="Path to victory">
        <div className="wr-sh"><h2>{lens === "N" ? "How each side wins" : `How ${surname(NM[me])} wins`}</h2><span className="pf-mute">From the forecast, the polls, the county map, voter groups, money and ballots</span></div>
        <div className={lens === "N" ? "wr-paths two" : "wr-paths"}>
          {(lens === "N" ? (["D", "R"] as Side[]) : [me]).map((s) => (
            <div key={s} className={`wr-path card ${PT[s].toLowerCase()}`}>
              {lens === "N" ? <div className="wr-path-who">If you work for {NM[s]}</div> : null}
              <ol>{r.paths[s].map((x) => <li key={x.k}><b>{x.h}</b><p>{x.t}{x.u ? <> <a href={x.u} target="_blank" rel="noopener noreferrer">Source</a></> : null}</p></li>)}</ol>
            </div>
          ))}
        </div>
        {lens !== "N" ? (
          <details className="wr-their card">
            <summary>Their playbook: how {surname(NM[op])} plans to win</summary>
            <ol>{r.paths[op].map((x) => <li key={x.k}><b>{x.h}</b><p>{x.t}</p></li>)}</ol>
          </details>
        ) : null}
      </section>

      {m && (m.base.length || m.battle.length) ? (
        <section className="card wr-pad" aria-label="The map">
          <div className="wr-sh"><h2>The map for {surname(NM[me])}</h2><span className="pf-mute">County projections from the forecast</span></div>
          <div className="wr-cts">
            <Counties title="Vote banks" sub="Where the biggest net margins come from" rows={m.base} side={me} dP={r.dP} />
            <Counties title="Battlegrounds" sub="Large counties within 12 points" rows={m.battle} side={me} dP={r.dP} />
            <Counties title="Behind the 2024 map" sub="Running furthest behind the last presidential vote" rows={m.lag} side={me} dP={r.dP} />
          </div>
        </section>
      ) : null}

      {c && c.swing.length ? (
        <section className="card wr-pad" aria-label="Coalition">
          <div className="wr-sh"><h2>The coalition</h2><span className="pf-mute">{surname(NM[me])} against {surname(NM[op])} among the groups that can move it, from the forecast&apos;s voter group estimates</span></div>
          <div className="wr-coal">
            <div><b className="wr-sub">Swing groups</b><GroupBars gs={c.swing} me={NM[me]} op={NM[op]} /></div>
            <div><b className="wr-sub">Weakest groups</b><GroupBars gs={c.weak} me={NM[me]} op={NM[op]} /></div>
          </div>
          <div className="wr-legend"><span><i className={`me ${PT[me].toLowerCase()}`} />{surname(NM[me])}</span><span><i className={`op ${PT[op].toLowerCase()}`} />{surname(NM[op])}</span></div>
        </section>
      ) : null}

      <section aria-label="Scouting report">
        <div className="wr-sh"><h2>Scouting report</h2><span className="pf-mute">From the Watchdog people files, each line with its source</span></div>
        <div className="wr-hcs">
          {order.map((s) => (
            <div key={s} className={`card wr-pad wr-scout ${PT[s].toLowerCase()}`}>
              <div className="wr-scout-h"><b>{NM[s]}</b>{lens !== "N" ? <span className="wd-pill">{s === me ? "Your candidate" : "The opponent"}</span> : null}</div>
              <IntelList items={r.people[s]?.intel ?? []} bottom={r.people[s]?.bottom ?? []} />
              {r.people[s]?.blocs?.length ? <p className="pf-mute">Top donor blocs: {r.people[s]!.blocs.join(", ")}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="wr-two" aria-label="Forecast and polls">
        <div className="card wr-pad">
          <div className="wr-sh"><h2>The forecast</h2><span className="pf-mute">Margin over recent runs</span></div>
          <Spark r={r} />
          <dl className="wr-dl">
            <div><dt>Now</dt><dd>{lead(r.est.margin, r.dP)}</dd></div>
            <div><dt>8 in 10 land between</dt><dd>{lead(r.est.p10, r.dP)} and {lead(r.est.p90, r.dP)}</dd></div>
            <div><dt>Polling average</dt><dd>{lead(r.pollAvg, r.dP)}</dd></div>
            {r.pvi != null ? <div><dt>Partisan lean</dt><dd>{lead(r.pvi, "D")}</dd></div> : null}
            {r.ev?.shift ? <div><dt>Early vote effect</dt><dd>{lead(r.ev.shift, r.dP)}</dd></div> : null}
          </dl>
        </div>
        <div className="card wr-pad">
          <div className="wr-sh"><h2>Recent polls</h2><span className="pf-mute">Last 45 days</span></div>
          {r.polls.length ? (
            <div className="pf-tw"><table className="pf-t">
              <thead><tr><th>Pollster</th><th className="n">Days ago</th><th className="n">Sample</th><th className="n">Result</th></tr></thead>
              <tbody>{r.polls.map((p, i) => <tr key={i}><td>{p.pollster}</td><td className="n">{p.age}</td><td className="n">{p.n ? `${p.n.toLocaleString()} ${p.kind}` : p.kind}</td><td className={`n ${p.margin > 0 ? "r" : "d"}`}>{lead(p.margin, r.dP)}</td></tr>)}</tbody>
            </table></div>
          ) : <p className="pf-mute">No public polls in the last 45 days; the forecast leans on fundamentals and similar races.</p>}
        </div>
      </section>

      <section className="wr-two" aria-label="Money and early vote">
        <div className="card wr-pad">
          <div className="wr-sh"><h2>Money and the air war</h2><span className="pf-mute">{money("D")?.as_of || money("R")?.as_of ? `Reports as of ${money("D")?.as_of ?? money("R")?.as_of}` : "Latest reports"}</span></div>
          <div className="pf-tw"><table className="pf-t">
            <thead><tr><th /><th className="n">{surname(r.dem)}</th><th className="n">{surname(r.gop)}</th></tr></thead>
            <tbody>
              <tr><td>Raised</td><td className="n">{usd(money("D")?.receipts)}</td><td className="n">{usd(money("R")?.receipts)}</td></tr>
              <tr><td>Spent</td><td className="n">{usd(money("D")?.spent)}</td><td className="n">{usd(money("R")?.spent)}</td></tr>
              <tr><td>Cash on hand</td><td className="n">{usd(money("D")?.cash)}</td><td className="n">{usd(money("R")?.cash)}</td></tr>
              <tr><td>Outside money for</td><td className="n">{usd(money("D")?.outside_for)}</td><td className="n">{usd(money("R")?.outside_for)}</td></tr>
              <tr><td>Google ads</td><td className="n">{usd(money("D")?.google_ads)}</td><td className="n">{usd(money("R")?.google_ads)}</td></tr>
            </tbody>
          </table></div>
          {r.money.groups.length ? (
            <>
              <b className="wr-sub">Biggest outside spenders</b>
              <ul className="wr-groups">{r.money.groups.slice(0, 8).map((g, i) => <li key={i}><i className={`pf-dot ${g.side.toLowerCase()}`} /><span>{g.name} <small className="pf-mute">{g.kind === "oppose" ? `against ${g.target}` : `for ${g.target}`}</small></span><b>{usd(g.amount)}</b></li>)}</ul>
            </>
          ) : null}
          {r.money.adBuys.length ? (
            <>
              <b className="wr-sub">Ad buys</b>
              <ul className="wr-groups">{r.money.adBuys.map((a, i) => <li key={i}><span>{a.spender} {a.source?.startsWith("http") ? <a href={a.source.split(" ")[0]} target="_blank" rel="noopener noreferrer">Source</a> : null}</span><b>{usd(a.amount)}</b></li>)}</ul>
            </>
          ) : null}
          <Link className="wr-file" href="/watchdog/money">Follow the money</Link>
        </div>
        <div className="card wr-pad">
          <div className="wr-sh"><h2>The early vote</h2><span className="pf-mute">{ev ? `${r.state}, through ${ev.date}` : "Statewide"}</span></div>
          {ev ? (
            <>
              <div className="wr-evbar" role="img" aria-label={`Democrats ${Math.round(ev.party.d * 100)}%, Republicans ${Math.round(ev.party.r * 100)}%, others ${Math.round(ev.party.o * 100)}%`}>
                <i className="d" style={{ width: `${ev.party.d * 100}%` }}>{Math.round(ev.party.d * 100)}</i>
                <i className="o" style={{ width: `${ev.party.o * 100}%` }}>{Math.round(ev.party.o * 100)}</i>
                <i className="r" style={{ width: `${ev.party.r * 100}%` }}>{Math.round(ev.party.r * 100)}</i>
              </div>
              <dl className="wr-dl">
                <div><dt>Ballots cast</dt><dd>{ev.ballots.toLocaleString()}</dd></div>
                <div><dt>Party data</dt><dd>{ev.estimatedShare >= 0.5 ? "Modeled, the state does not report party" : "Reported by the state"}</dd></div>
                <div><dt>Ballot margin</dt><dd>{lead(ev.actualMargin, "D")}</dd></div>
                <div><dt>Forecast expected</dt><dd>{lead(ev.expectedMargin, "D")}</dd></div>
                <div><dt>Against expectation</dt><dd>{Math.abs(ev.delta) < 0.05 ? "On pace" : `${Math.abs(ev.delta).toFixed(1)} points better for ${ev.delta > 0 ? "Republicans" : "Democrats"}`}</dd></div>
              </dl>
              <p className="pf-mute">Party registration of who has voted, not how they voted.{r.office === "house" ? " Statewide figures; the district may differ." : ""}</p>
              <Link className="wr-file" href={`/maps/early-vote/${r.state.toLowerCase().replace(/[^a-z]+/g, "-")}`}>Open the early vote tracker</Link>
            </>
          ) : <p className="pf-mute">No early vote data for {r.state} yet.</p>}
        </div>
      </section>

      <section className="wr-two" aria-label="Media and trail">
        <div className="card wr-pad">
          <div className="wr-sh"><h2>Media watch</h2><span className="pf-mute">Who is putting this race in front of an audience</span></div>
          {r.media.length ? <ul className="wr-feed">{[...r.media].sort((a, b) => b.when.localeCompare(a.when)).map((a, i) => <li key={i}><span className="when">{a.when}</span><div><b>{a.who}</b> <small className="pf-mute">{a.role}{a.lean && a.lean !== "nonpartisan" ? `, leans ${a.lean}` : ""}</small><p>{a.what} {a.src ? <a href={a.src} target="_blank" rel="noopener noreferrer">Source</a> : null}</p></div></li>)}</ul> : <p className="pf-mute">Nothing logged yet for this race.</p>}
          <Link className="wr-file" href="/watchdog/media">Media watch</Link>
        </div>
        <div className="card wr-pad">
          <div className="wr-sh"><h2>On the trail</h2><span className="pf-mute">Rallies and events, newest first</span></div>
          {r.visits.length ? <ul className="wr-feed">{[...r.visits].sort((a, b) => b.date.localeCompare(a.date)).map((v, i) => <li key={i}><span className="when">{v.date}</span><div><b><i className={`pf-dot ${(v.party || "o").toLowerCase()}`} /> {v.who}</b> <small className="pf-mute">{v.kind} in {v.city}</small><p>{v.note} {v.src ? <a href={v.src} target="_blank" rel="noopener noreferrer">Source</a> : null}</p></div></li>)}</ul> : <p className="pf-mute">No stops logged yet for this race.</p>}
          {r.news.length ? (
            <>
              <b className="wr-sub">From the news desk</b>
              <ul className="wr-groups">{r.news.map((n) => <li key={n.id}><Link href={`/news/story/${n.id}`}>{n.title}</Link><small className="pf-mute">{n.date}</small></li>)}</ul>
            </>
          ) : null}
        </div>
      </section>

      {similar.length ? (
        <section className="card wr-pad" aria-label="Races that move together">
          <div className="wr-sh"><h2>Races that move with this one</h2><span className="pf-mute">When the polls miss here, they tend to miss there too</span></div>
          <div className="wr-sim">{similar.map((s) => <Link key={s.id} href={warHref(s.id)} className="wd-btn">{s.label}</Link>)}</div>
        </section>
      ) : null}
    </div>
  );
}
