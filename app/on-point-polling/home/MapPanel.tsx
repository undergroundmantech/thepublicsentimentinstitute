"use client";
// Hover or tap a polled state on the server drawn map to see our final poll in each race against the count.
// The national poll is the resting card. State buttons under the card give keyboard and screen reader access.
import { useEffect, useState } from "react";

export type MapRace = { office: string; d: string; r: string; ind: boolean; dv: number; rv: number; poll: number; result: number | null; miss: number | null; right: boolean; winner: string | null };
export type MapState = { st: string; name: string; date: string; n: number; sponsor: string | null; races: MapRace[] };
export type MapNational = { date: string; n: number; d: number; r: number; poll: number; result: number; averages: number; polls: number };

/** R minus D margin as text; the D side reads I for an independent */
const pm = (m: number, ind = false) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(1)}`);
const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
const last = (n: string) => n.split(" ").slice(-1)[0];

export default function MapPanel({ states, national }: { states: MapState[]; national: MapNational }) {
  const [hover, setHover] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const cur = hover ?? pick;
  const s = states.find((x) => x.st === cur) ?? null;

  useEffect(() => {
    const svg = document.getElementById("oph-us"); if (!svg) return;
    const over = (e: Event) => { const st = (e.target as Element).getAttribute?.("data-st"); setHover(st); };
    const out = () => setHover(null);
    const click = (e: Event) => { const st = (e.target as Element).getAttribute?.("data-st"); setPick((p) => (st && p !== st ? st : null)); };
    svg.addEventListener("pointerover", over); svg.addEventListener("pointerleave", out); svg.addEventListener("click", click);
    return () => { svg.removeEventListener("pointerover", over); svg.removeEventListener("pointerleave", out); svg.removeEventListener("click", click); };
  }, []);
  useEffect(() => {
    document.querySelectorAll("#oph-us path.on").forEach((p) => p.classList.toggle("sel", p.getAttribute("data-st") === cur));
    document.getElementById("oph-us")?.classList.toggle("has-sel", !!cur);
  }, [cur]);

  return (
    <aside className="oph-panel" aria-live="polite">
      {s ? (
        <div className="oph-card" key={s.st}>
          <div className="oph-card-h"><h3>{s.name}</h3><span className="eye">{day(s.date)} · n {s.n.toLocaleString("en-US")}</span></div>
          <ul className="oph-races">
            {s.races.map((r) => (
              <li key={r.office}>
                <div className="top"><b>{r.office}</b><span className={`pill ${r.right ? "ok" : "miss"}`}>{r.right ? "Winner called" : "Missed"}</span></div>
                <div className="who">{last(r.d)} <span className="dim">vs</span> {last(r.r)}</div>
                <div className="nums">
                  <span><i>Our poll</i><b className={r.poll < 0 ? (r.ind ? "i" : "d") : "r"}>{pm(r.poll, r.ind)}</b></span>
                  <span><i>Result</i><b className={r.result == null ? "" : r.result < 0 ? (r.ind ? "i" : "d") : "r"}>{r.result == null ? "Counting" : pm(r.result, r.ind)}</b></span>
                  <span><i>Miss</i><b>{r.miss == null ? "" : `${Math.abs(r.miss).toFixed(1)} pts`}</b></span>
                </div>
              </li>
            ))}
          </ul>
          {s.sponsor ? <p className="note">Sponsored by the {s.sponsor}, disclosed on the release.</p> : null}
        </div>
      ) : (
        <div className="oph-card lit" key="us">
          <div className="oph-card-h"><h3>The nation</h3><span className="eye">{day(national.date)} · n {national.n.toLocaleString("en-US")}</span></div>
          <div className="big"><span><i>Our final poll</i><b className="d">D +{national.poll.toFixed(1)}</b></span><span><i>The result</i><b>D +{national.result.toFixed(1)}</b></span></div>
          <p className="sub">Our final generic ballot, {national.d.toFixed(1)} to {national.r.toFixed(1)} among likely voters with undecideds leaned, missed the result by {Math.abs(national.poll - national.result).toFixed(1)} points. The polling averages finished near D +{national.averages.toFixed(1)}.</p>
          <p className="hint">Hover or tap a state to see every race we polled there.</p>
        </div>
      )}
      <div className="oph-chips" role="group" aria-label="Pick a polled state">
        <button type="button" className={!cur ? "on" : ""} onClick={() => setPick(null)}>Nation</button>
        {states.map((x) => (
          <button key={x.st} type="button" className={cur === x.st ? "on" : ""} aria-pressed={pick === x.st} onClick={() => setPick((p) => (p === x.st ? null : x.st))} onFocus={() => setHover(x.st)} onBlur={() => setHover(null)}>{x.name}</button>
        ))}
      </div>
    </aside>
  );
}
