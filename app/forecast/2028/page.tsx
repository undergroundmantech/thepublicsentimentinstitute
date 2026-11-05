import type { Metadata } from "next";
import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import Atlas28 from "./Atlas28";
import { getHub, href28, fmtMg, fmtN, fmtPct, type Hub } from "./lib28";
import { STATE_NAME } from "@/app/lib/opp";
import "./p28.css";

export const metadata: Metadata = {
  title: "2028 Presidential Forecast | On Point Politics",
  description: "County by county 2028 forecast: the Electoral College, both primaries, projected votes in every state and county, and the generational shift from our national polling.",
  alternates: { canonical: "/forecast/2028" },
};

const SEG_D: [string, string][] = [["prog", "Progressive"], ["inst", "Institutional"], ["union", "Working class and union"], ["civil", "Civil rights coalition"], ["leanD", "Democratic leaning independents"]];
const SEG_R: [string, string][] = [["af", "America First"], ["sub", "Suburban professional"], ["pop", "Populist working class"], ["lib", "Libertarian"], ["leanR", "Republican leaning independents"]];

function AgeCurve({ age }: { age: Hub["gen"]["age"] }) {
  // logit, positive is more Democratic, net of race, gender and education; drawn as the two party margin against the average voter
  const W = 640, H = 220, x = (a: number) => 40 + ((a - 18) / (100 - 18)) * (W - 60), y = (m: number) => H / 2 - m * 3.2;
  const pts = age.map(([a, l]) => [a, (1 / (1 + Math.exp(-l)) - 0.5) * 200] as [number, number]);
  const tv = age.map(([a, , t]) => [a, t] as [number, number]);
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="p28-curve" role="img" aria-label="Two party lean by age, from the On Point national dataset">
      {[-20, -10, 0, 10, 20].map((m) => <g key={m}><line x1={40} x2={W - 20} y1={y(m)} y2={y(m)} className={m === 0 ? "zero" : "grid"} /><text x={34} y={y(m) + 4} textAnchor="end">{m === 0 ? "Avg" : `${m < 0 ? "R" : "D"} ${Math.abs(m)}`}</text></g>)}
      {[18, 30, 45, 65, 80, 95].map((a) => <text key={a} x={x(a)} y={H + 18} textAnchor="middle">{a}</text>)}
      <polyline points={tv.map(([a, t]) => `${x(a)},${H - 10 - t * 120}`).join(" ")} className="turn" />
      <polyline points={pts.map(([a, m]) => `${x(a)},${y(m)}`).join(" ")} className="lean" />
      <rect x={x(18)} y={10} width={x(22) - x(18)} height={H - 20} className="newband" />
      <text x={x(22) + 6} y={22} className="lab">New 18 to 21 voters</text>
    </svg>
  );
}

export default function Page() {
  const h = getHub();
  const g = h.general;
  const dFav = Object.entries(h.prim.dem.nomination).sort((a, b) => b[1] - a[1]);
  const rFav = Object.entries(h.prim.gop.nomination).sort((a, b) => b[1] - a[1]);
  const sts = Object.keys(h.states).filter((s) => !s.includes("-")).sort((a, b) => (STATE_NAME[a] ?? a).localeCompare(STATE_NAME[b] ?? b));
  const gn = h.gen.national;
  return (
    <div className="opp fc-xl fx-dark p28">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>2028</span></nav>
      <ForecastNav />
      <header className="p28-hero">
        <p className="eye g">2028 forecast · built {new Date(h.built + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
        <h1>The Democrat wins <em>{fmtPct(g.p_D_win)}</em> of {fmtN(g.N)} simulated 2028 elections.</h1>
        <p className="lede">A generic Democrat against JD Vance, county by county: {Math.round(g.mean_D_EV)} electoral votes on average and a national margin of {fmtMg(g.nat_margin)}, about {fmtN(g.votes.D)} votes to {fmtN(g.votes.R)}. Every county carries the generational change from our national polling: who dies, who ages, who turns 18 and who moves.</p>
        <div className="p28-pills">
          <span className="pill d">Democratic nominee: {dFav[0][0]} {fmtPct(dFav[0][1])}</span>
          <span className="pill r">Republican nominee: {rFav[0][0]} {fmtPct(rFav[0][1])}</span>
          <span className="pill t">Popular and electoral vote split: {fmtPct(g.p_split_D_pop_R_ec + g.p_split_R_pop_D_ec)}</span>
        </div>
      </header>

      <Atlas28 states={h.states as never} dcand={h.dcand} rcand={h.rcand} coal={h.coal} pal={h.pal} hypo={h.hypo} general={g} prim={h.prim} />

      <section className="p28-sec">
        <div className="sec-h"><h2>Generations: who leaves, who arrives</h2><p>From the On Point national dataset, {fmtN(h.gen.n.v28)} respondents with an exact age, fitted for 2024 recall and 2028 intention with race, gender and education held fixed.</p></div>
        <div className="p28-two">
          <div className="card"><div className="card-h"><h3>Lean and turnout by age</h3><span className="eye">our dataset</span></div><div className="card-b"><AgeCurve age={h.gen.age} />
            <p className="note">The pink line is two party lean against the average voter. The gray line is turnout by age. Voters in their forties and fifties lean most Republican; the youngest and the oldest lean Democratic. Each cohort keeps its 2024 lean as it ages four years.</p></div></div>
          <div className="card"><div className="card-h"><h3>What four years of change does nationally</h3><span className="eye">margin points</span></div><div className="card-b">
            <table className="p28-steps"><tbody>
              <tr><td>Deaths and aging</td><td className={gn.gen_deaths_aging < 0 ? "d" : "r"}>{fmtMg(gn.gen_deaths_aging, 2)}</td><td>{h.gen.deathShare.toFixed(1)}% of 2024 voters, about {(h.gen.deathShare * 1.563).toFixed(1)} million, die by 2028. In our data the oldest voters lean Democratic and voters in their fifties lean Republican, and cohorts age into higher turnout.</td></tr>
              <tr><td>New 18 to 21 voters</td><td className={gn.gen_new_voters < 0 ? "d" : "r"}>{fmtMg(gn.gen_new_voters, 2)}</td><td>{h.gen.newShare.toFixed(1)}% of the 2028 electorate. Young women and men in our data lean Democratic about equally: {h.gen.genz.Female}% and {h.gen.genz.Male}% of the two party vote.</td></tr>
              <tr><td>Life cycle drift</td><td className={gn.gen_drift < 0 ? "d" : "r"}>{fmtMg(gn.gen_drift, 2)}</td><td>Voters under 44 drift a quarter point a year toward Republicans as they age, a stated assumption the simulation varies from zero to double.</td></tr>
              <tr><td>Migration</td><td className={gn.mig_shift < 0 ? "d" : "r"}>{fmtMg(gn.mig_shift, 2)}</td><td>Domestic movers from county growth since 2020, carried forward at 80% of the pace, leaning mostly like the places they choose; newly naturalized voters lean Democratic.</td></tr>
              <tr className="tot"><td>Total</td><td className={gn.gen_shift + gn.mig_shift < 0 ? "d" : "r"}>{fmtMg(gn.gen_shift + gn.mig_shift, 2)}</td><td>Half of the national part is applied, since 2026 polling already reflects half of the four years. The rest moves votes between places.</td></tr>
            </tbody></table>
          </div></div>
        </div>
      </section>

      <section className="p28-sec">
        <div className="sec-h"><h2>The primary electorates</h2><p>Who votes in each primary, modeled from the political types in our national dataset, then placed in every county by race, age, education, region and partisanship.</p></div>
        <div className="p28-two">
          {([["D", SEG_D, "Democratic primary", "var(--dem2)"], ["R", SEG_R, "Republican primary", "var(--gop2)"]] as const).map(([pk, segs, title, c]) => (
            <div className="card" key={pk}><div className="card-h"><h3>{title}</h3><span className="eye">{fmtN(h.elect.totals[pk])} projected votes</span></div><div className="card-b">
              <div className="p28-bars">{segs.map(([k, l]) => { const v = h.elect[pk][`seg_${k}`] ?? 0; return <div className="bar" key={k}><span className="nm">{l}</span><span className="tr"><span className="fl" style={{ width: `${v * 2}%`, background: c }} /></span><span className="n">{v.toFixed(0)}%</span></div>; })}</div>
              <p className="note">Black {h.elect[pk].black.toFixed(0)}%, Hispanic {h.elect[pk].hisp.toFixed(0)}%, under 30 {h.elect[pk].young.toFixed(0)}%, 65 and up {h.elect[pk].old.toFixed(0)}%, college graduates {h.elect[pk].college.toFixed(0)}%.</p>
            </div></div>
          ))}
        </div>
      </section>

      <section className="p28-sec">
        <div className="sec-h"><h2>Every state, every race</h2><p>Each state has three pages: the general election with every county&apos;s projected vote, and both primaries.</p></div>
        <div className="p28-index">
          {sts.map((s) => { const r = h.states[s]; const d = h.prim.dem.states[s], rp = h.prim.gop.states[s]; return (
            <div key={s} className="p28-st card">
              <Link href={href28(s)} className="hd"><b>{STATE_NAME[s] ?? s}</b><span className={r.m < 0 ? "d" : "r"}>{fmtMg(r.m)}</span></Link>
              <div className="ln"><Link href={href28(s, "democratic-primary")}>D primary <span style={{ color: h.pal[d?.w] }}>{d?.w}</span></Link><Link href={href28(s, "republican-primary")}>R primary <span style={{ color: h.pal[rp?.w] }}>{rp?.w}</span></Link></div>
            </div>); })}
        </div>
      </section>

      <section className="p28-sec card p28-methods">
        <h2>How the 2028 model works</h2>
        <h3>General election</h3>
        <ul>
          <li><b>National environment:</b> a generic Democrat leads Vance by {Math.abs(h.env.nat28).toFixed(1)} points, blending Gallup party ID with leaners at 40%, the 2028 head to head averages at 35% and half of the 2026 House margin at 25%.</li>
          <li><b>Counties:</b> each starts from its certified 2024 result, takes the national swing scaled by its elasticity, and carries part of its 2020 to 2024 trend and its 2026 shift.</li>
          <li><b>Generations:</b> each county&apos;s adults are spread by single year of age. Four years pass: deaths follow a life table, everyone ages, four new cohorts turn 18 to 21, and turnout follows age. Lean by age comes from our national dataset, net of race, with the race part added back in proportion to how diverse the county is.</li>
          <li><b>Migration:</b> domestic movers from Census growth since 2020, net of international arrivals and natural change.</li>
          <li><b>Votes:</b> 2028 turnout is set near 158.5 million, about 1.4% above 2024; age and migration decide where those votes are cast.</li>
          <li><b>Simulation:</b> {fmtN(g.N)} runs with a fat tailed national error, regional, state and county errors, shared swings among college, Hispanic and Black voters, and uncertain strength for the generational and migration terms.</li>
        </ul>
        <h3>Primaries</h3>
        <ul>
          <li><b>Electorates:</b> a model of the 13 political types in our dataset, by race, age, education, gender, region and county lean, places each type in every county. Each type votes in a primary at its own rate, scaled by open, semi open or closed rules, with caucuses cut sharply. The national race and age mix is anchored to past primary exit polls.</li>
          <li><b>Turnout:</b> each state&apos;s projected primary vote comes from its last open contest, Democrats in 2020 and Republicans in 2016, grown for 2028, unless the state has since switched between caucus and primary.</li>
          <li><b>Candidates:</b> support follows each county&apos;s primary electorate, past primary lanes from 2016 to 2024, home states, donor footprints, 2026 midterm results and political type affinities, calibrated to the national polling averages. Against state polls, the Democratic model misses each share by {h.primMae.D.toFixed(1)} points on average and the Republican model by {h.primMae.R.toFixed(1)}.</li>
          <li><b>Calendar:</b> {fmtN(h.sims.primary)} runs vote in four windows on a calendar assumed from 2024, since neither party has set 2028. Momentum moves candidates after each window, trailing candidates drop out, and their voters move to the most similar remaining candidates.</li>
        </ul>
      </section>
    </div>
  );
}
