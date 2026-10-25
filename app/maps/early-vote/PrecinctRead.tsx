// Early vote by precinct: where a state publishes each early voter's precinct, the ballots so far are matched to
// the precinct's 2024 presidential vote, so the page can show whether Democratic, middle or Republican precincts
// are turning out faster than at the same point in 2024. Built by scripts/earlyvote/precinct/pull_<state>_precinct.py.
import fs from "node:fs";
import path from "node:path";
import { STATE_NAME } from "./lib";
import "./precinct.css";

type Band = { band: string; lo: number; hi: number; precincts: number; ev26: number; ev24: number; votes24: number; pace: number | null; relPace: number | null;
  party: { dem: number; rep: number; una: number; oth: number } };
type Read = { state: string; asof: string; daysOut: number; cut2024: string; matched: { ev26: number; ev24: number };
  precinctLean: { ev26: number; ev24: number; shift: number; state2024: number }; total: { ev26: number; ev24: number; pace: number | null }; bands: Band[] };

export function readPrecinct(st: string): Read | null {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/earlyvote-precinct", `${st}.json`), "utf8")) as Read; } catch { return null; }
}
const n = (x: number) => x.toLocaleString("en-US");
const lean = (m: number) => (Math.abs(m) < 0.05 ? "even" : `${m > 0 ? "R" : "D"}+${Math.abs(m).toFixed(1)}`);
const bl = (m: number) => (m === 0 ? "even" : `${m > 0 ? "R" : "D"}+${Math.abs(m)}`);
const day = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const TONE: Record<string, string> = { "Safe D": "#2f62e8", "Lean D": "#7fa6ff", Middle: "#b9a8d9", "Lean R": "#ff8399", "Safe R": "#d81f45" };

export default function PrecinctRead({ st }: { st: string }) {
  const r = readPrecinct(st);
  if (!r || !r.bands?.length) return null;
  const name = STATE_NAME[st] ?? st, s = r.precinctLean.shift;
  const word = Math.abs(s) < 0.3 ? "about the same as" : s < 0 ? `${Math.abs(s).toFixed(1)} points bluer than` : `${s.toFixed(1)} points redder than`;
  const max = Math.max(1.4, ...r.bands.map((b) => b.relPace ?? 0));
  return (
    <section className="pr-read" aria-labelledby="pr-h">
      <div className="pr-eye">Early vote by precinct · {name} · through {day(r.asof)}</div>
      <h2 id="pr-h">{name}&rsquo;s early voters come from precincts {word} at this point in 2024</h2>
      <p className="pr-lede">Every accepted ballot is matched to the voter&rsquo;s precinct and that precinct&rsquo;s 2024 presidential vote. So far the early vote comes from precincts that voted {lean(r.precinctLean.ev26)} for president in 2024; on {day(r.cut2024)} 2024, {r.daysOut} days out, it came from precincts that voted {lean(r.precinctLean.ev24)}. The state voted {lean(r.precinctLean.state2024)}.</p>
      <div className="pr-bands">
        {r.bands.filter((b) => b.precincts > 0).map((b) => {
          const rp = b.relPace ?? 0, t = b.ev26 || 1;
          return (
            <div key={b.band} className="pr-band">
              <div className="pr-bh"><b style={{ color: TONE[b.band] }}>{b.band}</b><span>{b.lo <= -999 ? `D+30 or more` : b.hi >= 999 ? `R+30 or more` : `${bl(b.lo)} to ${bl(b.hi)}`} in 2024 · {n(b.precincts)} precincts</span></div>
              <div className="pr-bar" aria-label={`${b.band} precincts are at ${Math.round(rp * 100)} percent of the state's pace`}>
                <i style={{ width: `${(100 * rp) / max}%`, background: TONE[b.band] }} /><em style={{ left: `${100 / max}%` }} />
              </div>
              <div className="pr-bf">
                <span>{b.pace != null ? `${Math.round(b.pace * 100)}% of its same day 2024 vote` : "no 2024 ballots yet"} · {rp ? `${rp >= 1 ? "+" : ""}${Math.round((rp - 1) * 100)}% against the state` : ""}</span>
                <span>{n(b.ev26)} ballots · D {Math.round((100 * b.party.dem) / t)}% R {Math.round((100 * b.party.rep) / t)}% U {Math.round((100 * b.party.una) / t)}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="pr-foot">The line marks the state&rsquo;s own pace. Bands are precincts grouped by Trump&rsquo;s 2024 margin. {Math.round(r.matched.ev26 * 100)}% of 2026 ballots matched to a precinct. Source: {name} State Board of Elections absentee and early voting files, 2024 precinct results and voter file.</p>
    </section>
  );
}
