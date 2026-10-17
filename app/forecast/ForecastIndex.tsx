// The forecast in brief: every race and chamber as plain server rendered text and links, under the
// interactive hub. Readers get a quick index; search engines and AI crawlers, which do not run the
// hub's scripts, get the numbers and a link to every forecast page.
import Link from "next/link";
import { isInd, type FRace } from "@/app/lib/forecastData";
import { lastName, raceHref, STATE_NAME } from "@/app/lib/opp";
import { hubNumbers } from "./seo";
import { slHref } from "./legislatures/data";
import { bmHref } from "./measures/data";
import { dbHref, getDownballot } from "./statewide/data";

const pc = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function lead(r: FRace) {
  const m = r.stages.rate;
  const pR = r.est?.prob ?? 0;
  const name = m < 0 ? r.dem : r.gop;
  const party = m < 0 ? (isInd(r) ? "i" : "d") : "r";
  return { name, party, p: m < 0 ? 1 - pR : pR, unc: Math.abs(m) >= 99 };
}

function RaceRow({ r, label }: { r: FRace; label: string }) {
  const l = lead(r);
  return (
    <li>
      <Link href={raceHref(r.id)}>{label}</Link>
      <span className={`fx-who ${l.party}`}>{l.unc ? `${lastName(l.name)} unopposed` : lastName(l.name)}</span>
      <b className={`mono fx-p ${l.party}`}>{l.unc ? "" : pc(l.p)}</b>
    </li>
  );
}

export default function ForecastIndex() {
  const { model, ch, sl, ms, favD, pass, updated } = hubNumbers();
  const races = model.races;
  const sen = races.filter((r) => r.office === "senate").sort((a, b) => a.state.localeCompare(b.state));
  const gov = races.filter((r) => r.office === "governor").sort((a, b) => a.state.localeCompare(b.state));
  const house = races.filter((r) => r.office === "house");
  const closeHouse = [...house].filter((r) => Math.abs(r.stages.rate) < 99).sort((a, b) => Math.abs(0.5 - (a.est?.prob ?? 0)) - Math.abs(0.5 - (b.est?.prob ?? 0))).slice(0, 24);
  const byState = new Map<string, FRace[]>();
  for (const r of house) byState.set(r.state, [...(byState.get(r.state) ?? []), r]);
  const states = [...byState.keys()].sort();
  const db = getDownballot().races.filter((r) => !r.uncontested).sort((a, b) => a.state.localeCompare(b.state) || a.office.localeCompare(b.office));
  const chambers = [...sl.chambers].sort((a, b) => a.state.localeCompare(b.state) || (a.chamber === "senate" ? -1 : 1));
  const measures = [...ms.measures].sort((a, b) => a.st.localeCompare(b.st));

  const senLine = ch.senate.demControl >= 0.5
    ? `Democrats win the Senate in ${pc(ch.senate.demControl)} of simulations, with ${ch.senate.demSeats.toFixed(0)} seats on average`
    : `Republicans hold the Senate in ${pc(ch.senate.gopControl)} of simulations, with ${ch.senate.gopSeats.toFixed(0)} seats on average`;
  const houseLine = ch.house.demControl >= 0.5
    ? `Democrats win the House in ${pc(ch.house.demControl)}, with ${ch.house.demSeats.toFixed(0)} seats on average`
    : `Republicans hold the House in ${pc(ch.house.gopControl)}, with ${ch.house.gopSeats.toFixed(0)} seats on average`;

  return (
    <section className="fx" aria-labelledby="fx-h">
      <div className="eye g">The forecast in brief</div>
      <h2 id="fx-h">Every 2026 forecast, <em>in one index</em></h2>
      <p className="fx-lede">
        {senLine}. {houseLine}. Democrats average {ch.governor.demSeats.toFixed(0)} of 50 governorships after the election, are favored to control {favD} of
        the {sl.chambers.length} state legislative chambers on the ballot, and {pass} of {ms.measures.length} statewide ballot measures are favored to pass.
        Every number comes from {model.meta.sims.toLocaleString()} simulated elections, updated {day(updated)}, {model.meta.daysOut} days before the November 3 election.
      </p>

      <div className="fx-grid">
        <div className="card">
          <div className="card-h"><h3>Senate races</h3><span className="eye" style={{ marginLeft: "auto" }}>Leader · chance to win</span></div>
          <ul className="fx-list">{sen.map((r) => <RaceRow key={r.id} r={r} label={r.name} />)}</ul>
        </div>
        <div className="card">
          <div className="card-h"><h3>Governor races</h3><span className="eye" style={{ marginLeft: "auto" }}>Leader · chance to win</span></div>
          <ul className="fx-list">{gov.map((r) => <RaceRow key={r.id} r={r} label={r.state} />)}</ul>
        </div>
        <div className="card">
          <div className="card-h"><h3>Closest House races</h3><span className="eye" style={{ marginLeft: "auto" }}>Leader · chance to win</span></div>
          <ul className="fx-list">{closeHouse.map((r) => <RaceRow key={r.id} r={r} label={r.name} />)}</ul>
        </div>
        <div className="card">
          <div className="card-h"><h3>State legislatures</h3><span className="eye" style={{ marginLeft: "auto" }}>Democratic control</span></div>
          <ul className="fx-list">
            {chambers.map((c) => (
              <li key={c.id}><Link href={slHref(c)}>{c.name}</Link><span /><b className={`mono fx-p ${c.demControl >= 0.5 ? "d" : "r"}`}>{pc(c.demControl)}</b></li>
            ))}
          </ul>
        </div>
        <div className="card">
          <div className="card-h"><h3>Ballot measures</h3><span className="eye" style={{ marginLeft: "auto" }}>Chance to pass</span></div>
          <ul className="fx-list">
            {measures.map((m) => (
              <li key={m.id}><Link href={bmHref(m)}>{STATE_NAME[m.st] ?? m.st} {m.label}</Link><span className="fx-who">{m.title}</span><b className="mono fx-p">{pc(m.est.prob)}</b></li>
            ))}
          </ul>
        </div>
        <div className="card">
          <div className="card-h"><h3>Statewide offices</h3><span className="eye" style={{ marginLeft: "auto" }}>Leader · chance to win</span></div>
          <ul className="fx-list">
            {db.map((r) => {
              const dLead = r.est.margin < 0;
              const p = dLead ? 1 - r.est.prob : r.est.prob;
              return (
                <li key={r.id}><Link href={dbHref(r)}>{r.state} {r.officeLabel.toLowerCase()}</Link><span className={`fx-who ${dLead ? "d" : "r"}`}>{lastName((dLead ? r.dem : r.gop) ?? "")}</span><b className={`mono fx-p ${dLead ? "d" : "r"}`}>{pc(p)}</b></li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="card fx-house">
        <div className="card-h"><h3>Every House race</h3><span className="eye" style={{ marginLeft: "auto" }}>{house.length} districts by state</span></div>
        <div className="card-b">
          {states.map((s) => (
            <div key={s} className="fx-st">
              <b>{s}</b>
              <span>
                {byState.get(s)!.sort((a, b) => a.district - b.district).map((r) => {
                  const l = lead(r);
                  return <Link key={r.id} href={raceHref(r.id)} className={`fx-d ${l.party}`} title={`${r.name}: ${l.unc ? `${l.name} unopposed` : `${l.name} ${pc(l.p)}`}`}>{byState.get(s)!.length === 1 ? "At large" : r.district}</Link>;
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
