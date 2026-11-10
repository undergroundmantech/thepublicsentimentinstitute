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
          <li><b>National environment:</b> a generic Democrat leads Vance by {Math.abs(h.env.nat28).toFixed(1)} points, combining Gallup party ID with leaners and the national 2028 head to head polling average, weighted by how many recent polls there are. The Gallup reading is built the way the 2026 forecast builds it, half from Gallup&apos;s history of how party ID moves the vote and half from every county&apos;s own electorate rebuilt at the new party ID. Each candidate's effect blends their own polls with their record, quality and issue positions.</li>
          <li><b>Congressional districts:</b> every district on the 2026 lines starts from its own 2024 presidential result and moves with the vote weighted swing of the counties it covers, half in margin points and half in log odds, with its own error in each simulation. Districts that share a county share its swing. Alaska is the state; Connecticut&apos;s districts take the state&apos;s swing.</li>
          <li><b>County Gallup party ID:</b> every county&apos;s adults are split into 96 groups, age, race and college cells from the Census, each divided into Democrats, Republicans and independents by our national dataset. Each county&apos;s party mix is solved so its 2024 electorate reproduces its certified 2024 result, then the nation is brought to Gallup&apos;s 2024 reading, D 45 and R 48: that is the county&apos;s 2024 baseline. One national move takes the country to D 50 and R 39, and each county&apos;s electorate is rebuilt from its own mix, with every group voting the way our dataset says Democrats, Republicans and independents in that cell vote.</li>
          <li><b>Counties:</b> each starts from its certified 2024 result. The Gallup party ID move reaches every county by its own elasticity, half how much it has swung in past presidential races and half its own Gallup move from the county party ID model. Recent trends lead: the county carries its trend against its state from 2020 to 2024 most, then 2016 to 2024, its state carries the same against the nation, and it keeps 0.98 of its lean against its state. A backtest on 2016, 2020 and 2024 favored the recent ladder over the long run blend.</li>
          <li><b>Data centers and local conditions:</b> the 2026 terms carried forward. Data center exposure follows the Economist and YouGov distance curve among Trump 2024 voters at half strength, recalculated for the sites standing by 2028, with contested proposals counted by their status and local coverage. Jobs, wages, tariffs, growth, migration, religion, rurality and news deserts come from the 2026 county terms, scaled back to 0.35 of their 2026 size for 2028, and gas strain at half. Together these local terms are held to a soft cap, so no county moves more than about 11 points on local conditions.</li>
          <li><b>Gallup analog years:</b> the further leaned party ID moves from 2024, the more each county moves toward its own map in the years whose Gallup reading was closest. For now only 2016 and onward is used, so the pull runs toward each county&apos;s 2016 and 2020 maps, the closest readings since 2016 to the 2028 one; it runs light, about 12%, because a backtest found no gain from it. The recent trends use 2016 to 2024 and 2020 to 2024 only. Big third party years do not force a trend: each year&apos;s third party vote above the national rate goes back to the two parties by how those voters leaned, McMullin&apos;s mostly Republican, Johnson&apos;s about even, Nader&apos;s mostly Democratic, and that year counts for less in the trend, so Utah&apos;s 2016 counts about half.</li>
          <li><b>Vote behavior from our dataset:</b> each respondent&apos;s 2028 lean comes from their whole pattern of answers, not only the head to head: the 2026 generic ballot and House vote, Trump approval overall and on twelve issues, party ID, ideology, political type, what pushes them toward either party and what moved their 2026 vote, anchored on how they voted in 2024. A model learned from the respondents who answered the 2028 question sets everyone else&apos;s, and the swing from 2024 by race, age, education, gender and county lean carries it to every county, with no region terms.</li>
          <li><b>Candidate behavior from our dataset:</b> every respondent&apos;s 2028 primary choice decides what happens to them under each nominee. Voters whose candidate lost defect or stay home by how unlike the nominee their candidate is, weighted by their chance of voting in the primary. Each nominee&apos;s message fits voters differently too: economic populism and war skepticism are measured in the dataset, Rubio&apos;s establishment and foreign policy message loads against them and Vance&apos;s populist economic message with them, and Rubio carries an added drag with white working class voters. All of it runs through the voter groups of every county. A generic Republican, the average polled Republican with no personal terms, is in every matchup.</li>
          <li><b>Candidate coalitions by voter group:</b> every candidate has a coefficient for each of the 192 voter groups, age, race and college cells by party and by whether they voted in 2024, against a generic nominee of the same party. The groups come from the 2028 polls that report candidates by group, set larger than their researched size, plus our dataset: each candidate&apos;s 2028 primary support among independents and the other party&apos;s voters, group by group. Candidates with a pull on new voters raise turnout among their own side&apos;s 2024 nonvoters. A county&apos;s coalition effect is what its own groups do, so places full of persuadable voters move the most; rural and evangelical stay county terms, and the polls set each candidate&apos;s national level.</li>
          <li><b>Issue positions:</b> every candidate is scored on the dataset&apos;s 14 top issues, cost of living, health care, corruption, the Epstein files, immigration, civil rights, transgender policy, crime, energy, education, guns, the Iran operation, democratic socialism and tariffs, from minus 2 furthest left to plus 2 hardline right with how central each issue is to their message, from Wikipedia, its political positions pages and OnTheIssues, then a second pass on each candidate&apos;s specific 2026 record in the news: their votes and statements on the Iran war, the Epstein files, tariffs, data centers and ICE, and their fights with other 2028 contenders. Our dataset places each of the 192 voter groups on the same issues and says how much each cares, and a candidate gains in a group by sitting closer to it than a generic nominee of their party on what it cares about. The issue gain joins each group&apos;s coalition coefficient, sized so the spread among the polled Democrats with independents matches the polls, and replaces the earlier six issue county term. Third party options, Carlson, a Carlson and Greene ticket, Joe Kent, Candace Owens, Kennedy Jr., the Libertarian and Green nominees, a centrist and a populist independent, are scored on the same issues, and the 13 political types in our dataset lean toward one by how much closer it sits to them than the nearer major party nominee; that sets whose voters a third party share draws from.</li>
          <li><b>Dynamic movement:</b> every county&apos;s swing against the nation in each election since 2000, on margins that take back big third party years, was set against its census make up: Black, Hispanic, Asian, college, age, white without a degree and rural. About 0.56 of a cycle&apos;s census pattern has tended to carry into the next. Each group&apos;s 2028 move blends that momentum with the Fox News Voter Analysis shift from 2024 to the 2026 House vote, at half strength since a midterm draws a different electorate, and our dataset&apos;s shift from 2024, and reaches each county by its make up.</li>
          <li><b>Spending by media market:</b> each state&apos;s projected presidential dollars go to the media markets that reach its voters, weighted by how hard the closing weeks of 2024 worked each market. A market&apos;s ads reach every county in it, across state lines, so south Jersey and Delaware sit inside the Philadelphia ad war and upstate South Carolina inside Charlotte&apos;s. The money cutoff is measured per market: the more dollars per voter, the less the market answers the national swing.</li>
          <li><b>Primaries into November:</b> doubled for 2028 against the 2026 setting. The 2026 rules. Each state&apos;s simulated primary turnout, the Democratic share against its 2024 result and centered on the median state, moves the two parties&apos; turnout apart. Each nominee carries party unity, their primary share in the runs they win against the typical nominee&apos;s; demographic strength, where their primary vote says they run strong or weak among the 32 cells; and home ground, the county residual beyond that.</li>
          <li><b>Generations:</b> each county&apos;s adults are spread by single year of age. Four years pass: deaths follow a life table, everyone ages, four new cohorts turn 18 to 21, and turnout follows age. Lean by age comes from our national dataset, net of race, with the race part added back in proportion to how diverse the county is.</li>
          <li><b>Migration:</b> domestic movers from Census growth since 2020, net of international arrivals and natural change.</li>
          <li><b>Votes:</b> 2028 turnout is set near 158.5 million, about 64% of the nation&apos;s 247 million eligible citizens, the same rate as 2024; age and migration decide where those votes are cast. Every county stays inside its eligible population, the 2026 ceiling rule: no county passes 90% of its eligible citizens or rises more than 6% above its own 2024 rate, and no county&apos;s two primaries together pass 60% of its eligible citizens or 80% of its November vote.</li>
          <li><b>Electorate:</b> every county&apos;s eligible citizens, from the Census citizen voting age population moved to 2028 by county growth and the nation&apos;s aging, in 1,152 voter groups: age, race and college cells, women and men, Democrats, Republicans and independents, and six vote history segments from our national dataset&apos;s 2018 to 2026 vote history: every election, presidential only, new in 2024, the 2026 surge, lapsed and not voting. Each group&apos;s 2028 turnout comes from a vote history model fit on how 2020, 2022 and 2018 voting predicted 2024 turnout, carried forward on 2024, 2026 and 2022, and averaged with the dataset&apos;s turnout propensity; its vote, third party pull and volatility come from the dataset too. The 2024 electorate is calibrated to the Catalist voter file measure, and each state&apos;s segments are moved so the people who voted in 2026 match its certified 2026 statewide turnout.</li>
          <li><b>Simulation:</b> {fmtN(g.N)} elections, every voter drawn, the way the 2026 forecast runs: a fat tailed national error by each county&apos;s elasticity, regional errors with the South as its own block, state and county errors, national and state turnout and enthusiasm shocks, shared swings in each demographic group&apos;s vote and turnout, national swings in each vote history segment and each gender, with the most volatile segments moving most, a surge or stay home weighted toward the lowest propensity voters, third party shocks, and uncertain strength for the generational and migration terms.</li>
        </ul></div>
        <div className="card"><h3>Primaries</h3>
        <ul>
          <li><b>Electorates:</b> the 2026 rule, a cell&apos;s primary voters are its general election voters times its turnout again, since primaries draw the regular voters; a model of the 13 political types in our dataset, by race, age, education, gender, region and county lean, places each type in every county. Each type votes in a primary at its own rate, scaled by open, semi open or closed rules, with caucuses cut sharply. The national race and age mix is anchored to past primary exit polls.</li>
          <li><b>Party ID:</b> each county&apos;s Democratic side types, Republican side types and independents grow or shrink with its own 2028 Gallup party ID against its 2024 baseline, so primary electorates swell where a party gains.</li>
          <li><b>Turnout, county by county:</b> each county&apos;s projected primary vote starts from its own 2026 Senate or governor primary vote, where that primary was contested and reported by county, times the measured step from a midterm primary to an open presidential one and its own party ID change. A state&apos;s level meets its last open presidential primary halfway, caucus states keep their caucus level, and states without a usable 2026 count use their last open contest.</li>
          <li><b>Candidate strengths:</b> every candidate has their own profile. Where our dataset&apos;s 2028 primary question lists them, it sets half of their pull with each political type and part of their demographic pull; everyone else carries a researched profile, and no two profiles are the same.</li>
          <li><b>Candidates:</b> support follows each county&apos;s primary electorate, past primary lanes from 2016 to 2024, home states, donor footprints, 2026 midterm results and political type affinities, calibrated to the national polling averages. Against state polls, the Democratic model misses each share by {h.primMae.D.toFixed(1)} points on average and the Republican model by {h.primMae.R.toFixed(1)}.</li>
          <li><b>Calendar:</b> {fmtN(h.sims.primary)} runs vote in four windows on a calendar assumed from 2024, since neither party has set 2028. Momentum moves candidates after each window, trailing candidates drop out, and their voters move to the most similar remaining candidates.</li>
        </ul></div>
        </div>
      </section>
    </div>
  );
}
