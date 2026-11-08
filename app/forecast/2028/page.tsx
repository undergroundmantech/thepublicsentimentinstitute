import type { Metadata } from "next";
import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import Atlas28 from "./Atlas28";
import District28 from "./District28";
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
      <header className="p28-hero split">
        <div className="p28-hero-t">
          <p className="eye g">2028 forecast · built {new Date(h.built + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          <h1>The Democrat wins <em>{fmtPct(g.p_D_win)}</em> of {fmtN(g.N)} simulated 2028 elections.</h1>
          <p className="lede">A generic Democrat against JD Vance, county by county: {Math.round(g.mean_D_EV)} electoral votes on average and a national margin of {fmtMg(g.nat_margin)}. Every county carries the generational change from our national polling: who dies, who ages, who turns 18 and who moves.</p>
        </div>
        <aside className="p28-score card" aria-label="The forecast at a glance">
          <div className="sc-ev">
            <div className="sc-top"><span className="d"><b>{Math.round(g.mean_D_EV)}</b> Democrat</span><span className="r">Vance <b>{538 - Math.round(g.mean_D_EV)}</b></span></div>
            <div className="sc-bar" role="img" aria-label={`Average electoral votes: Democrat ${Math.round(g.mean_D_EV)}, Vance ${538 - Math.round(g.mean_D_EV)}`}>
              <i className="d" style={{ width: `${(g.mean_D_EV / 538) * 100}%` }} /><i className="r" style={{ width: `${100 - (g.mean_D_EV / 538) * 100}%` }} /><span className="k270" />
            </div>
            <p className="sc-note">Average electoral votes · 270 to win · 80% range {g.p10_EV} to {g.p90_EV} · popular and electoral vote split in {fmtPct(g.p_split_D_pop_R_ec + g.p_split_R_pop_D_ec)} of runs</p>
          </div>
          <div className="sc-kpis">
            <div><span className="v d">{fmtPct(g.p_D_win)}</span><span className="l">Democrat wins</span></div>
            <div><span className="v r">{fmtPct(1 - g.p_D_win - (g.p_tie ?? 0))}</span><span className="l">Vance wins</span></div>
            <div><span className="v">{fmtMg(g.nat_margin)}</span><span className="l">Popular vote</span></div>
          </div>
          <div className="sc-noms">
            {([["Democratic nomination", dFav], ["Republican nomination", rFav]] as const).map(([t, list]) => (
              <div key={t}><p className="eye">{t}</p>
                {list.slice(0, 3).map(([n, v]) => (
                  <div key={n} className="nm"><span className="who"><i style={{ background: h.pal[n] }} />{n}</span><span className="tr"><span style={{ width: `${v * 100}%`, background: h.pal[n] }} /></span><b>{fmtPct(v)}</b></div>
                ))}
              </div>
            ))}
          </div>
        </aside>
      </header>

      <nav className="p28-jump" aria-label="On this page">
        <a href="#map">The map</a><a href="#districts">Districts</a><a href="#states">Every state</a><a href="#generations">Generations</a><a href="#electorates">Primary voters</a><a href="#method">Method</a>
      </nav>

      <section id="map" className="p28-sec p28-anchor first">
        <div className="sec-h"><p className="eye">Interactive</p><h2>The 2028 map</h2><p>The general election and both primaries, by state or by county. Pick the candidates, hover any place, and open a state for its own page.</p></div>
        <Atlas28 states={h.states as never} dcand={h.dcand} rcand={h.rcand} coal={h.coal} pal={h.pal} hypo={h.hypo} general={g} prim={h.prim} />
      </section>

      <div id="districts" className="p28-anchor"><District28 dcand={h.dcand} rcand={h.rcand} coal={h.coal} /></div>

      <section className="p28-sec p28-anchor" id="states">
        <div className="sec-h"><p className="eye">Three pages per state</p><h2>Every state, every race</h2><p>The general election with every county&apos;s projected vote, and both primaries. Names are each primary&apos;s favorite.</p></div>
        <div className="p28-index">
          {sts.map((s) => { const r = h.states[s]; const d = h.prim.dem.states[s], rp = h.prim.gop.states[s]; const lean = Math.max(-40, Math.min(40, r.m)); return (
            <div key={s} className="p28-st">
              <Link href={href28(s)} className="hd"><b>{STATE_NAME[s] ?? s}</b><span className={`mg ${r.m < 0 ? "d" : "r"}`}>{fmtMg(r.m)}</span></Link>
              <span className="lean" aria-hidden="true"><i className={r.m < 0 ? "d" : "r"} style={{ [r.m < 0 ? "right" : "left"]: "50%", width: `${(Math.abs(lean) / 40) * 50}%` }} /></span>
              <div className="ln">
                {d ? <Link href={href28(s, "democratic-primary")}><span className="pk d">D</span><i style={{ background: h.pal[d.w] }} />{d.w}{d.tu ? <em>toss up</em> : null}</Link> : null}
                {rp ? <Link href={href28(s, "republican-primary")}><span className="pk r">R</span><i style={{ background: h.pal[rp.w] }} />{rp.w}{rp.tu ? <em>toss up</em> : null}</Link> : null}
              </div>
            </div>); })}
        </div>
      </section>

      <section className="p28-sec p28-anchor" id="generations">
        <div className="sec-h"><p className="eye">From our national dataset</p><h2>Generations: who leaves, who arrives</h2><p>From the On Point national dataset, {fmtN(h.gen.n.v28)} respondents with an exact age, fitted for 2024 recall and 2028 intention with race, gender and education held fixed.</p></div>
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

      <section className="p28-sec p28-anchor" id="electorates">
        <div className="sec-h"><p className="eye">Who votes in the primaries</p><h2>The primary electorates</h2><p>Who votes in each primary, modeled from the political types in our national dataset, then placed in every county by race, age, education, region and partisanship.</p></div>
        <div className="p28-two">
          {([["D", SEG_D, "Democratic primary", "var(--dem2)"], ["R", SEG_R, "Republican primary", "var(--gop2)"]] as const).map(([pk, segs, title, c]) => (
            <div className="card" key={pk}><div className="card-h"><h3>{title}</h3><span className="eye">{fmtN(h.elect.totals[pk])} projected votes</span></div><div className="card-b">
              <div className="p28-bars">{segs.map(([k, l]) => { const v = h.elect[pk][`seg_${k}`] ?? 0; return <div className="bar" key={k}><span className="nm">{l}</span><span className="tr"><span className="fl" style={{ width: `${v * 2}%`, background: c }} /></span><span className="n">{v.toFixed(0)}%</span></div>; })}</div>
              <p className="note">Black {h.elect[pk].black.toFixed(0)}%, Hispanic {h.elect[pk].hisp.toFixed(0)}%, under 30 {h.elect[pk].young.toFixed(0)}%, 65 and up {h.elect[pk].old.toFixed(0)}%, college graduates {h.elect[pk].college.toFixed(0)}%.</p>
            </div></div>
          ))}
        </div>
      </section>

      <section className="p28-sec p28-anchor" id="method">
        <div className="sec-h"><p className="eye">Method</p><h2>How the 2028 model works</h2></div>
        <div className="p28-methods">
        <div className="card"><h3>General election</h3>
        <ul>
          <li><b>National environment:</b> a generic Democrat leads Vance by {Math.abs(h.env.nat28).toFixed(1)} points, combining Gallup party ID with leaners and the national 2028 head to head polling average, weighted by how many recent polls there are. Each candidate's effect blends their own polls with their record, quality and issue positions.</li>
          <li><b>Congressional districts:</b> every district on the 2026 lines starts from its own 2024 presidential result and moves with the vote weighted swing of the counties it covers, half in margin points and half in log odds, with its own error in each simulation. Districts that share a county share its swing. Alaska is the state; Connecticut&apos;s districts take the state&apos;s swing.</li>
          <li><b>Counties:</b> built the way our 2026 model builds them. Each starts from its certified 2024 result. The national swing reaches each state half by its elasticity and half uniformly, and each county takes three quarters of its state&apos;s swing by its own elasticity. It carries part of its own 2020 to 2024 anomaly and its state&apos;s presidential trend, and keeps 0.98 of its lean against its state. Forecasting 2024 from 2020 this way calls every state right.</li>
          <li><b>Generations:</b> each county&apos;s adults are spread by single year of age. Four years pass: deaths follow a life table, everyone ages, four new cohorts turn 18 to 21, and turnout follows age. Lean by age comes from our national dataset, net of race, with the race part added back in proportion to how diverse the county is.</li>
          <li><b>Migration:</b> domestic movers from Census growth since 2020, net of international arrivals and natural change.</li>
          <li><b>Votes:</b> 2028 turnout is set near 158.5 million, about 1.4% above 2024; age and migration decide where those votes are cast.</li>
          <li><b>Simulation:</b> {fmtN(g.N)} runs with a fat tailed national error, regional errors with the South as its own block, state and county errors, shared swings among college, Hispanic and Black voters, and uncertain strength for the generational and migration terms.</li>
        </ul></div>
        <div className="card"><h3>Primaries</h3>
        <ul>
          <li><b>Electorates:</b> a model of the 13 political types in our dataset, by race, age, education, gender, region and county lean, places each type in every county. Each type votes in a primary at its own rate, scaled by open, semi open or closed rules, with caucuses cut sharply. The national race and age mix is anchored to past primary exit polls.</li>
          <li><b>Turnout:</b> each state&apos;s projected primary vote comes from its last open contest, Democrats in 2020 and Republicans in 2016, grown for 2028, unless the state has since switched between caucus and primary.</li>
          <li><b>Candidates:</b> support follows each county&apos;s primary electorate, past primary lanes from 2016 to 2024, home states, donor footprints, 2026 midterm results and political type affinities, calibrated to the national polling averages. Against state polls, the Democratic model misses each share by {h.primMae.D.toFixed(1)} points on average and the Republican model by {h.primMae.R.toFixed(1)}.</li>
          <li><b>Calendar:</b> {fmtN(h.sims.primary)} runs vote in four windows on a calendar assumed from 2024, since neither party has set 2028. Momentum moves candidates after each window, trailing candidates drop out, and their voters move to the most similar remaining candidates.</li>
        </ul></div>
        </div>
      </section>
    </div>
  );
}
