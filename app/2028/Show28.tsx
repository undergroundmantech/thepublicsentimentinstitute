"use client";
// Who shows up in 2028 and why, for the matchup on screen. The candidate independent part reads the turnout model on
// the 1,152 voter groups; the matchup part reads each nominee's turnout effect by voter group from the respondent model,
// anchored to the dashboard's matchup turnout; the third party part reads each ticket's new voters from the engine.
import { last, fmtN, type Res } from "./lib";

export type Why = {
  base_turnout: number; elig: number;
  effects: { factor: string; level: string; vs: string; pts: number }[];
  segments: { segment: string; eligible: number; voters: number; turnout: number; third: number; dem: number; share: number }[];
  groups: Record<string, { group: string; turnout: number; share: number; third: number; pull: number }[]>;
  issues: { group: string; set: string; low_prop: number; turnout: number; top: string[] }[];
  notes: { kind: string; item: string; value: number }[];
  flow: { from: string; to: string; share: number }[];
  states: Record<string, { voters: number; elig: number; habit: number; irregular: number }>;
  dim_mean: Record<string, number>;
  coef: Record<string, { nat: number; b: number[]; basis: string }>;
  third: { key: string; name: string; base: number; share: number; m_message: number; m_media: number; m_coalition: number; new_voters: number; reach: number | null }[];
};
const DIM = ["pR", "pI", "rB", "rH", "rA", "a3044", "a4564", "a65", "col", "nv24"];
// each voter group's turnout change for a nominee: the national effect moved by the group's own coefficient against the
// average voter, dimension by dimension
const GROUPS: { label: string; dim: string; levels: [string, string | null][] }[] = [
  { label: "Party", dim: "party", levels: [["Democrats", null], ["Republicans", "pR"], ["Independents", "pI"]] },
  { label: "Race", dim: "race", levels: [["White", null], ["Black", "rB"], ["Hispanic", "rH"], ["Asian and other", "rA"]] },
  { label: "Age", dim: "age", levels: [["18 to 29", null], ["30 to 44", "a3044"], ["45 to 64", "a4564"], ["65 and up", "a65"]] },
  { label: "College", dim: "col", levels: [["No degree", null], ["Degree", "col"]] },
  { label: "2024 vote", dim: "nv24", levels: [["Voted in 2024", null], ["Sat out 2024", "nv24"]] },
];
const sign = (x: number, d = 1) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(d)}`;
const SEG: Record<string, string> = { "every election": "Vote every election", "presidential only": "Presidential years only", "new in 2024": "First voted in 2024", "2026 surge": "Came out in 2026", lapsed: "Lapsed voters", "not voting": "Rarely or never vote" };

export default function Show28({ why, res, dp, rp, dvp, rvp }: { why: Why; res: Res; dp: string; rp: string; dvp: string; rvp: string }) {
  const all = res.VD + res.VR + res.VI + res.VO;
  const E = res.turnout?.elig || why.elig;
  const cD = why.coef[`D|${dp}`], cR = why.coef[`R|${rp}`], cDV = dvp ? why.coef[`D|${dvp}`] : null, cRV = rvp ? why.coef[`R|${rvp}`] : null;
  const nat = (c: typeof cD | null, w = 1) => (c ? c.nat * w : 0);
  const effD = nat(cD) + nat(cDV, 0.25), effR = nat(cR) + nat(cRV, 0.25);
  const tks = res.tickets ?? [];
  const newT = tks.reduce((a, t) => a + (t.newV ?? 0), 0);
  const groupEff = (c: typeof cD | null, w: number, dim: string, key: string | null) => {
    if (!c) return 0; const b = c.b; const idx = (k: string) => DIM.indexOf(k) + 1;
    const lv = GROUPS.find((g) => g.dim === dim)!.levels; const mean = lv.reduce((a, [, k]) => a + (k ? b[idx(k)] * why.dim_mean[k] : 0), 0);
    return w * (c.nat + (key ? b[idx(key)] : 0) - mean);
  };
  const low = why.issues.find((x) => x.group === "Low propensity"), high = why.issues.find((x) => x.group === "High propensity");
  const habit = why.effects.filter((e) => e.factor === "segment"), demo = why.effects.filter((e) => e.factor !== "segment");
  const LBL: Record<string, string> = { col: "Cost of living", health: "Health care", corruption: "Corruption", immig: "Immigration", civil: "Civil rights", crime: "Crime", educ: "Schools and housing", energy: "Energy and climate", guns: "Guns", foreign: "Foreign policy" };
  const issueRows = low && high ? Object.keys(LBL).map((k) => ({ k, lo: (low as unknown as Record<string, number>)[k], hi: (high as unknown as Record<string, number>)[k] })).sort((a, b) => (b.lo - b.hi) - (a.lo - a.hi)) : [];
  const open = why.notes.filter((n) => n.kind.startsWith("Openness"));
  const drivers = why.notes.filter((n) => n.kind.startsWith("2026 turnout"));
  const DRV: Record<string, string> = { college: "College graduates", hisp: "Hispanic voters", black: "Black voters", young: "Young voters", old: "Seniors", rural: "Rural voters", evang: "Evangelicals" };
  return (
    <section className="s28-card g28-show" aria-labelledby="g28-sh">
      <div className="g28-show-h"><h2 id="g28-sh">Who shows up, and why</h2><span>Every voter group&apos;s chance to vote, for this ballot</span></div>
      <div className="g28-show-k">
        <div><em>Turnout of eligible citizens</em><b>{((100 * all) / E).toFixed(1)}%</b><small>{fmtN(all)} votes of {fmtN(E)} eligible</small></div>
        <div><em>With generic nominees</em><b>{((100 * (res.turnout?.base ?? (why.base_turnout * E) / 100)) / E).toFixed(1)}%</b><small>the electorate before any candidate</small></div>
        <div><em>{last(dp)}</em><b className={effD >= 0 ? "up" : "dn"}>{sign(effD, 2)} pts</b><small>{cD?.basis ?? "no turnout data"}{dvp ? `, ${dvp} a quarter` : ""}</small></div>
        <div><em>{last(rp)}</em><b className={effR >= 0 ? "up" : "dn"}>{sign(effR, 2)} pts</b><small>{cR?.basis ?? "no turnout data"}{rvp ? `, ${rvp} a quarter` : ""}</small></div>
        {tks.length ? <div><em>Third party new voters</em><b className="up">+{fmtN(newT)}</b><small>people who stay home without them on the ballot</small></div> : null}
      </div>

      <div className="g28-show-grid">
        <div>
          <h3>Who turns out more or less for this ballot</h3>
          <p className="s28-say">Points of turnout against generic nominees, by voter group, from every modeled respondent&apos;s turnout with each candidate. The same voters do not show up for every matchup.</p>
          <div className="g28-scroll"><table className="g28-show-t">
            <thead><tr><th>Group</th><th>{last(dp)}</th><th>{last(rp)}</th><th>Together</th></tr></thead>
            <tbody>{GROUPS.map((g) => g.levels.map(([nm, k], i) => { const a = groupEff(cD, 1, g.dim, k) + groupEff(cDV, 0.25, g.dim, k), b = groupEff(cR, 1, g.dim, k) + groupEff(cRV, 0.25, g.dim, k); return (
              <tr key={g.dim + nm} className={i === 0 ? "first" : undefined}><td>{i === 0 ? <small>{g.label}</small> : null}{nm}</td><td className={a >= 0 ? "up" : "dn"}>{sign(a, 2)}</td><td className={b >= 0 ? "up" : "dn"}>{sign(b, 2)}</td><td className={a + b >= 0 ? "up" : "dn"}><b>{sign(a + b, 2)}</b></td></tr>
            ); }))}</tbody>
          </table></div>
        </div>
        <div>
          <h3>Why anyone votes, whoever is running</h3>
          <p className="s28-say">A turnout model on the 1,152 voter groups. Habit is most of it: points of turnout against people who rarely or never vote, with everything else held the same.</p>
          <ul className="g28-bars">{habit.map((e) => <li key={e.level}><span>{SEG[e.level] ?? e.level}</span><i style={{ width: `${Math.max(2, e.pts)}%` }} /><b>+{e.pts.toFixed(0)}</b></li>)}</ul>
          <p className="s28-say">Then, for voters with the same vote history:</p>
          <ul className="g28-chipsx">{demo.map((e) => <li key={e.factor + e.level} className={e.pts >= 0 ? "up" : "dn"}><b>{sign(e.pts)}</b> {e.level} <small>against {e.vs}</small></li>)}</ul>
        </div>
      </div>

      <div className="g28-show-grid">
        <div>
          <h3>The electorate by vote history</h3>
          <div className="g28-scroll"><table className="g28-show-t">
            <thead><tr><th>Voters who</th><th>Eligible</th><th>Turnout</th><th>Share of voters</th><th>Democratic</th><th>Third party</th></tr></thead>
            <tbody>{why.segments.map((s) => <tr key={s.segment}><td>{SEG[s.segment] ?? s.segment}</td><td>{fmtN(s.eligible)}</td><td>{s.turnout.toFixed(1)}%</td><td>{s.share.toFixed(1)}%</td><td>{s.dem.toFixed(1)}%</td><td>{s.third.toFixed(1)}%</td></tr>)}</tbody>
          </table></div>
        </div>
        <div>
          <h3>Why the rest stay home</h3>
          <p className="s28-say">What low propensity voters rank in their top three, against reliable voters. They rank schools and housing, guns and crime higher, and cost of living and immigration lower.</p>
          <div className="g28-scroll"><table className="g28-show-t">
            <thead><tr><th>Issue</th><th>Low propensity</th><th>Reliable</th><th>Gap</th></tr></thead>
            <tbody>{issueRows.map((r) => <tr key={r.k}><td>{LBL[r.k]}</td><td>{r.lo.toFixed(0)}%</td><td>{r.hi.toFixed(0)}%</td><td className={r.lo - r.hi >= 0 ? "up" : "dn"}>{sign(r.lo - r.hi, 0)}</td></tr>)}</tbody>
          </table></div>
          <p className="s28-say">Low propensity voters: {low ? `${low.turnout.toFixed(0)}% expected turnout` : ""}; independents vote at {why.groups.party?.find((g) => g.group === "independents")?.turnout.toFixed(0)}% against {why.groups.party?.find((g) => g.group === "Republicans")?.turnout.toFixed(0)}% for Republicans and {why.groups.party?.find((g) => g.group === "Democrats")?.turnout.toFixed(0)}% for Democrats.</p>
        </div>
      </div>

      <div className="g28-show-grid">
        <div>
          <h3>Who is open to a third party</h3>
          <ul className="g28-chipsx">{open.map((n) => <li key={n.item}><b>{n.value.toFixed(1)}%</b> {n.item}</li>)}</ul>
          <p className="s28-say">2024 nonvoters: {why.flow.filter((x) => x.from === "Did not vote").map((x) => `${x.to} ${x.share.toFixed(0)}%`).join(", ")}. A third party ticket brings some of them out: each ticket&apos;s new voters come from its message, its media audience and how many low propensity voters it reaches, county by county.</p>
          {tks.length ? <ul className="g28-chipsx">{tks.map((t) => <li key={t.key} style={{ borderColor: t.color }}><b style={{ color: t.color }}>+{fmtN(t.newV ?? 0)}</b> new voters for {t.name} · {((100 * (t.newV ?? 0)) / Math.max(1, t.votes)).toFixed(0)}% of its vote</li>)}</ul> : null}
        </div>
        <div>
          <h3>What moved turnout in 2026</h3>
          <p className="s28-say">Turnout against the 2026 forecast, points per standard deviation of each county trait, carried into 2028.</p>
          <ul className="g28-chipsx">{drivers.map((n) => <li key={n.item} className={n.value >= 0 ? "up" : "dn"}><b>{sign(n.value, 2)}</b> {DRV[n.item] ?? n.item}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}
