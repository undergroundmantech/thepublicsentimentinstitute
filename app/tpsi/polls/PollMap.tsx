"use client";
// The On Point Polling state map: every state we have polled, in the field or considering next.
// Pick Senate or governor, then click a state to see its full results.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { STATE_POLLS, FUND_LINE, FUND_URL, type StatePoll, type PollRace } from "./pollMapData";
import "./pollmap.css";

type Geo = { frame: [number, number]; states: Record<string, string>; box: Record<string, [number, number, number, number]> };
type Office = "Governor" | "Senate";

const margin = (r: PollRace) => {
  const d = r.cands.find((c) => c.p === "d"), g = r.cands.find((c) => c.p === "r");
  return d && g ? d.leaned - g.leaned : 0;
};
const WORD = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const mlabel = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m > 0 ? "D" : "R"}+${Math.abs(m).toFixed(1)}`);
const leader = (r: PollRace) => {
  const top = [...r.cands].sort((a, b) => b.leaned - a.leaned)[0];
  return top ? top.n.split(" ").slice(-1)[0] : "";
};
// label nudges for small or oddly shaped states, in map units
const NUDGE: Record<string, [number, number]> = { FL: [26, 6], MI: [14, 18], OH: [0, 4], TX: [10, 0], SC: [6, 4] };

function RaceRow({ r, big }: { r: PollRace; big?: boolean }) {
  const m = margin(r);
  return (
    <div className={`pm-race${big ? " big" : ""}`}>
      <div className="pm-rh"><span>{r.race}</span><b className={`pm-pill mono ${m >= 0 ? "d" : "r"}`}>{mlabel(m)}</b></div>
      <div className="pm-cands">
        {r.cands.map((c) => (
          <div key={c.n} className={`pm-c ${c.p}`}>
            <span className="nm">{c.n}</span>
            <b className="mono">{c.leaned.toFixed(1)}%</b>
            {big && c.asked != null ? <small className="mono">{c.asked.toFixed(1)}% as asked</small> : null}
          </div>
        ))}
      </div>
      {big ? <div className="pm-bar"><i className="d" style={{ width: `${r.cands.find((c) => c.p === "d")?.leaned ?? 0}%` }} /><i className="r" style={{ width: `${r.cands.find((c) => c.p === "r")?.leaned ?? 0}%` }} /></div> : null}
    </div>
  );
}

export default function PollMap() {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [office, setOffice] = useState<Office>("Governor");
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  useEffect(() => { fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {}); }, []);

  const by = useMemo(() => Object.fromEntries(STATE_POLLS.map((s) => [s.st, s])), []);
  const released = STATE_POLLS.filter((s) => s.status === "released");
  const raceOf = (s: StatePoll) => s.races.find((r) => r.race === office);
  const fill = (st: string) => {
    const s = by[st];
    if (!s) return "var(--pm-empty)";
    if (s.status === "field") return "var(--gold)";
    if (s.status === "next") return "url(#pm-hatch)";
    const r = raceOf(s);
    if (!r) return "var(--pm-released)";
    return margin(r) >= 0 ? "var(--dem)" : "var(--gop)";
  };
  const cur = sel ? by[sel] : null;
  const field = STATE_POLLS.filter((s) => s.status === "field"), next = STATE_POLLS.filter((s) => s.status === "next");
  const count = released.filter((s) => raceOf(s)).length;

  return (
    <section className="pm card" aria-label="Map of On Point Polling state polls">
      <div className="pm-top">
        <div>
          <div className="eye">On Point Polling · {office} polls · Oct. 2026</div>
          <h2>{WORD[count] ?? count} {office === "Governor" ? "governor" : "Senate"} races polled. {field.length ? <>{field.map((f) => f.name).join(" and ")} is <em>in the field.</em></> : null}</h2>
        </div>
        <div className="pm-tog" role="tablist" aria-label="Race">
          {(["Governor", "Senate"] as Office[]).map((o) => (
            <button key={o} role="tab" aria-selected={office === o} className={office === o ? "on" : ""} onClick={() => setOffice(o)}>{o}</button>
          ))}
        </div>
      </div>
      <div className="pm-body">
        <div className="pm-mapwrap">
          {geo ? (
            <svg viewBox={`0 0 ${geo.frame[0]} ${geo.frame[1]}`} className="pm-map" role="img" aria-label={`States colored by the leader in On Point Polling ${office.toLowerCase()} polls`}>
              <defs>
                <pattern id="pm-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="8" height="8" fill="var(--pm-hatch-bg)" />
                  <rect width="3" height="8" fill="var(--gold)" opacity="0.55" />
                </pattern>
              </defs>
              {Object.entries(geo.states).map(([st, d]) => {
                const has = !!by[st];
                return (
                  <path key={st} d={d} fill={fill(st)} className={`pm-st${has ? " has" : ""}${sel === st ? " sel" : ""}${hov === st ? " hov" : ""}${by[st]?.status === "next" ? " next" : ""}`}
                    onMouseEnter={() => has && setHov(st)} onMouseLeave={() => setHov(null)}
                    onClick={() => has && setSel(sel === st ? null : st)}
                    tabIndex={has ? 0 : -1} role={has ? "button" : undefined} aria-label={has ? `${by[st].name}, ${by[st].status === "released" ? "results" : by[st].status === "field" ? "in the field" : "considering next"}` : undefined}
                    onKeyDown={(e) => { if (has && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSel(sel === st ? null : st); } }} />
                );
              })}
              {STATE_POLLS.map((s) => {
                const b = geo.box[s.st]; if (!b) return null;
                const [nx, ny] = NUDGE[s.st] ?? [0, 0];
                const cx = b[0] + b[2] / 2 + nx, cy = b[1] + b[3] / 2 + ny;
                if (s.status === "next") return <text key={s.st} x={cx} y={cy + 9} className="pm-q" textAnchor="middle">?</text>;
                if (s.status === "field") return (
                  <g key={s.st} className="pm-tag field" transform={`translate(${cx},${cy})`} onClick={() => setSel(s.st)}>
                    <rect x={-44} y={-13} width={88} height={26} rx={4} /><text y={5} textAnchor="middle">IN FIELD</text>
                  </g>
                );
                const r = raceOf(s); if (!r) return null;
                const m = margin(r);
                return (
                  <g key={s.st} className={`pm-tag ${m >= 0 ? "d" : "r"}`} transform={`translate(${cx},${cy})`} onClick={() => setSel(s.st)}>
                    <rect x={-50} y={-24} width={100} height={48} rx={6} />
                    <text y={-4} textAnchor="middle" className="n">{leader(r)}</text>
                    <text y={15} textAnchor="middle" className="m">{mlabel(m)}</text>
                  </g>
                );
              })}
            </svg>
          ) : <div className="pm-load">Loading the map…</div>}
          <div className="pm-key">
            <span><i style={{ background: "var(--dem)" }} />Dem leads</span>
            <span><i style={{ background: "var(--gop)" }} />GOP leads</span>
            <span><i style={{ background: "var(--gold)" }} />In the field</span>
            <span><i className="hatch" />Not yet funded</span>
            {released.some((s) => !raceOf(s)) ? <span><i style={{ background: "var(--pm-released)" }} />Polled, no {office.toLowerCase()} result yet</span> : null}
          </div>
        </div>

        <aside className="pm-side">
          {cur ? (
            <div className="pm-panel">
              <div className="pm-ph">
                <button className="pm-back" onClick={() => setSel(null)}>All states</button>
                <h3>{cur.name}</h3>
                {cur.status === "released" ? <div className="pm-meta mono">{[cur.dates, cur.sample, cur.moe].filter(Boolean).join(" · ")}</div> : null}
              </div>
              {cur.status === "released" ? (
                <>
                  <div className="eye pm-sub">Likely voters, undecideds leaned</div>
                  {cur.races.map((r) => <RaceRow key={r.race} r={r} big />)}
                  {cur.note ? <p className="pm-note">{cur.note}</p> : null}
                  <div className="pm-links">
                    {cur.href ? (cur.href.startsWith("/") ? <Link className="btn" href={cur.href}>{cur.hrefLabel ?? "Full results"}</Link> : <a className="btn" href={cur.href} target="_blank" rel="noopener noreferrer">{cur.hrefLabel ?? "Full results"}</a>) : null}
                    {cur.release ? <a className="btn ghost" href={cur.release} target="_blank" rel="noopener noreferrer">Read on Substack</a> : null}
                  </div>
                </>
              ) : (
                <div className="pm-fund">
                  <p>{cur.note}</p>
                  <p>{FUND_LINE}</p>
                  <a className="btn g" href={FUND_URL} target="_blank" rel="noopener noreferrer">Fund the next poll</a>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="pm-panel">
                <div className="eye pm-sub">Released · likely voters, leaned</div>
                {released.map((s) => {
                  const r = raceOf(s);
                  return (
                    <button key={s.st} className="pm-row" onClick={() => setSel(s.st)}>
                      <div className="pm-rh"><span className="st">{s.name}</span>{r ? <b className={`pm-pill mono ${margin(r) >= 0 ? "d" : "r"}`}>{mlabel(margin(r))}</b> : <b className="pm-pill mono n">No {office.toLowerCase()} result</b>}</div>
                      {r ? <div className="pm-cands">{r.cands.map((c) => <div key={c.n} className={`pm-c ${c.p}`}><span className="nm">{c.n.split(" ").slice(-1)[0]}</span><b className="mono">{c.leaned.toFixed(1)}%</b></div>)}</div> : null}
                    </button>
                  );
                })}
              </div>
              <div className="pm-panel gold">
                {field.length ? <div className="pm-kv"><span className="eye">In the field</span><span>{field.map((f) => <button key={f.st} className="pm-chip on" onClick={() => setSel(f.st)}>{f.st}</button>)}</span></div> : null}
                {next.length ? <div className="pm-kv"><span className="eye">Considering next</span><span>{next.map((f) => <button key={f.st} className="pm-chip" onClick={() => setSel(f.st)}>{f.st}</button>)}</span></div> : null}
                <p>{FUND_LINE}</p>
                <a className="btn g" href={FUND_URL} target="_blank" rel="noopener noreferrer">Fund the next poll</a>
              </div>
            </>
          )}
        </aside>
      </div>
      <p className="pm-src mono">On Point Polling likely voters with undecideds leaned. {released.map((s) => `${s.name} ${[s.sample, s.dates, s.moe].filter(Boolean).join(", ")}`).join(". ")}.</p>
    </section>
  );
}
