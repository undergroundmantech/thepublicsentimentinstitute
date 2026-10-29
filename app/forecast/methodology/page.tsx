import type { Metadata } from "next";
import Link from "next/link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import type { ReactNode } from "react";
import { getModel } from "@/app/lib/forecastData";
import { RATE, RATING_LABEL } from "@/app/lib/opp";
import { seo } from "@/app/lib/seo";
import JsonLd from "@/app/components/JsonLd";
import { methodologyLd } from "../seo";

export const metadata: Metadata = seo({"title": "How the 2026 election forecast works", "description": "How the On Point Politics 2026 forecast works: fundamentals, the polling average, candidate effects, 2,000 correlated simulations, county and district models, and how chamber odds and ratings are set.", "path": "/forecast/methodology", "type": "article"});

// Every figure below is read off the model code in scripts/forecast/model (senate_mode.py,
// poll_daily.py, lowess_trend.py, dynamic_mode.py, house_dyn.py) and the build script
// scripts/forecast/build_app_forecast.py. Change them there first, then here.
const SECTIONS: { id: string; eye: string; title: string; body: ReactNode }[] = [
  {
    id: "overview", eye: "Overview", title: "What the model does",
    body: (
      <>
        <p>The forecast rebuilds every 2026 Senate, governor and House race county by county. It starts from what the fundamentals say a race should look like, moves that toward the polling average as the polling gets deeper and the election gets closer, adjusts for the candidates, and then runs the whole election 2,000 times with shared errors so that races move together the way they do on a real election night.</p>
        <p>Each race carries three legs. The first is a fundamentals leg built from On Point Polling county by county presidential approval. The second takes each county&rsquo;s certified 2024 result and moves it by the demographic swing to the 2026 national environment. The third carries each county&rsquo;s own voting history, and its statewide level is the polling average. The three are blended into one county forecast, which is then simulated.</p>
      </>
    ),
  },
  {
    id: "fundamentals", eye: "Step 1", title: "Fundamentals",
    body: (
      <>
        <p><b>Partisan lean.</b> Every state, county and district starts from its presidential lean on the lines in force for 2026, taken from the certified results. On the race pages this is the anchor, the first stage in the breakdown of how the number gets made.</p>
        <p><b>National environment.</b> Every leg is lined up on one national anchor, Democrats ahead by 13 points in the two party vote, set from the On Point Polling national poll of Oct 28 at D+13.0 alongside Gallup&rsquo;s D+11 party identification. Each state responds to that environment at its own measured rate: its presidential swings from 2016 to 2020 and 2020 to 2024 against the nation&rsquo;s, and its shift from 2024 in the On Point Polling state MRP of Oct 28, each weighted by how well it is measured and pulled toward the national rate. Texas, for one, moves about 1.15 times the national swing, and Wisconsin, North Carolina and Ohio about 0.6 to 0.7 times. The 2026 environment also draws on the generic congressional ballot and presidential approval. The generic ballot sets the national vote, and the On Point Polling respondent database supplies approval county by county, calibrated and converted into vote with the On Point Polling respondent crosstabs. Each county responds to the environment through its own elasticity, estimated from a national demographic fit and its own recent presidential swings, so a swing county moves more than a county that votes the same way every cycle.</p>
        <p><b>Incumbency.</b> An incumbent carries a measured personal vote: the county by county gap between that person&rsquo;s own past races and the nearest presidential race on the same ground. It applies to every sitting governor on the ballot and to none of the open seats. An incumbent who never won the office has no personal vote to carry.</p>
      </>
    ),
  },
  {
    id: "polls", eye: "Step 2", title: "The polling average",
    body: (
      <>
        <p>Every poll of a race enters the average once. A poll&rsquo;s weight is the product of its sample size, its age, its voter screen, its pollster grade and a penalty for a large undecided share. Recency decays over about three weeks, so a poll fielded a month ago counts for a fraction of one fielded this week. Likely voter samples count three times as much as registered voter samples, and adult samples count very little. Repeated releases from the same pollster inside three weeks are discounted, so one house cannot swamp the average, and any poll more than two standard deviations from the rest is pulled back to that line.</p>
        <p>Where a race has 8 or more polls, the level comes from a LOWESS trend instead. Every poll is placed at the midpoint of its field dates, published averages are left out, and a robust LOWESS line is fit at three spans. The Election Day level is 40 percent of the recent trend plus 60 percent of the long term trend, carried flat from the newest poll. That blend missed later polling the least in a backtest of the site&rsquo;s own polls. The weighted average still supplies the decided share and the third party share, so only the split of the decided vote moves. Races with fewer than 8 polls keep the weighted average.</p>
        <p>Pollster grades come from the <Link href="/on-point-polling/methodology">On Point Polling pollster ratings</Link>, and polls sponsored by a campaign or a party are flagged on every race page.</p>
      </>
    ),
  },
  {
    id: "blend", eye: "Step 3", title: "How polls and fundamentals blend",
    body: (
      <>
        <p>Each race&rsquo;s weight on its polls is measured, not fixed. The race&rsquo;s weighted polling average has an error of its own: a floor of 3.5 points of margin that every poll shares, plus 6 points for each poll&rsquo;s own error, divided by the effective number of polls. That effective count is the Kish count of the average&rsquo;s own weights, so a few large high quality polls count for more than many small ones, times how fresh the polls are, with a poll keeping half its information four weeks after it closes. The fundamentals carry an error of 7.5 points. The two are combined by precision: the poll weight is 7.5 squared over 7.5 squared plus the poll error squared, held at most at 85 percent.</p>
        <p>In practice a race with one fresh poll gives its polls a little over half the weight, a race with four or five effective polls about 70 percent, and the most heavily polled races about 75 percent; a race whose only polls are months old leans almost entirely on its fundamentals. The Gallup leg and the electorate leg split the rest 35 to 20. The early vote no longer moves weight between the legs: it reaches each race through the measured early vote correction after the run.</p>
      </>
    ),
  },
  {
    id: "candidates", eye: "Step 4", title: "Candidate effects",
    body: (
      <>
        <p>Beyond incumbency, the model prices the candidates themselves. Party unity comes from each nominee&rsquo;s share of their own party&rsquo;s 2026 primary vote, so a nominee who limped out of a divided primary carries less of their party. Each state&rsquo;s 2026 electorate also reads the parties&rsquo; 2026 primary turnout against their 2024 vote, and only real 2026 primary ballots count: a side whose primary was uncontested or has no county results is not stood in for by an older general election, so that state&rsquo;s electorate comes from its early vote instead. Where a race&rsquo;s own polling sits away from the model&rsquo;s fundamentals, that gap is read as candidate strength. In governor races with little or no polling, a small campaign finance term uses verified individual contributions, net of self funding, and it stands down wherever real polling exists.</p>
        <p>Third party and independent candidates are modeled explicitly rather than folded into the major parties. Where an independent is the main challenger, as in Nebraska, that candidate takes the non Republican side of the race and is shown in lavender.</p>
      </>
    ),
  },
  {
    id: "local", eye: "Step 4b", title: "Local conditions, gas, data centers and coalitions",
    body: (
      <>
        <p>Gallup party identification runs at full strength as its own leg of every Senate and governor forecast, at least 40 percent of the blend and 60 percent of each state&rsquo;s House fundamentals level: each county&rsquo;s certified 2024 vote is moved by the On Point Polling demographic swing and by its own elasticity to Gallup&rsquo;s 50 Democratic to 39 Republican. Applied the same way, Gallup&rsquo;s third quarter 2025 reading called Virginia&rsquo;s and New Jersey&rsquo;s 2025 governor races within about a point, where the final polling averages were 5 to 10 points short. Those were open seats, so where an incumbent governor is running the Gallup leg follows the national environment at 0.6 like the other legs, and in a governor race with 10 or more polls its floor is 30 percent.</p>
        <p>Gas counts by how much prices have risen since October 2025, not by how high they are. Each county&rsquo;s rise is its AAA price today against a year earlier, through the nearest metro&rsquo;s change within 50 kilometers or its state&rsquo;s: about $1.27 a gallon nationally, from about 91 to 93 cents in Oregon, North Carolina and Georgia to $1.71 in Michigan. Everyone is paying more, and that national rise is already in the polls; the term says where the squeeze is worst. In counties with the steepest rise, Trump 2024 voters who call their finances difficult move toward Democrats and strained Harris voters hold, at 0.6 of the size fitted on the On Point Polling data.</p>
        <p>Data centers have their own term. The Economist and YouGov track the generic ballot by distance to the nearest data center, and people within 2 kilometers now vote 6.3 points more Democratic than people farther away, up from almost no gap in January 2025. The model moves the voters of each ZIP code near an operating or planned site by three quarters of that measured gap, carried to counties and districts, with governors at 1.15 times since siting and power rates are state decisions. In governor races the statewide data center and gas pushes together are held within 2 points.</p>
        <p>Local conditions compound. A county&rsquo;s terms, jobs, wages, tariff exposure, population growth, migration, faith, rurality, news deserts, data centers and the gas rise through financial strain, each keep the direction their fit gave them. A term counts as active when it sits at least half a standard deviation of its national spread from zero, and when the active terms line up the county&rsquo;s whole local term is multiplied by e to the 0.15 k, where k is the active terms pushing the county&rsquo;s way less those pushing the other way, less one, held at six times. Counties with more local news feel their conditions more, by e to the 0.25 z on their log local news outlets per 100,000 residents against the nation, about 0.6 times in a news desert and about 1.65 times in the best covered places. A county&rsquo;s combined term is held only within about 46 points of margin, a safety limit, and a county may run 0.15 in log odds past the edge of its own historical lean; the county term counts 2.0 times and the statewide part 1.25 times. Gas is fair and adds no tilt: every county is read against the national price rise since October 2025 both ways, a county whose rise ran above the nation&rsquo;s moving toward Democrats through voters who call their finances difficult and one whose rise ran below it moving the same distance the other way, so the national total is zero; an extra dollar of rise counts what an extra dollar of price does in the On Point Polling fit. These terms are built into the legs rather than laid over the finished forecast: their county pattern is part of every leg&rsquo;s county shape, the poll leg included and then set back to the polling average, and their statewide part enters only the approval, Gallup and seat history legs, since the polls already carry each state&rsquo;s conditions. The polls weigh more as they pile up: the Gallup floor is 40 percent with four or fewer polls in the last 60 days and falls in a straight line to 15 percent at 24, the poll weight can reach 90 percent, and House district polls count at 0.80 of the blend with an incumbent running and 0.88 in an open district.</p>
        <p>Where no incumbent is running, the race leans on its polls and on President Trump&rsquo;s approval rather than its history: the seat history share falls to 0.03 and the approval leg rises to 0.16 before the Gallup floor, and the statewide history pull runs at 0.15 of its usual size. Open House districts move 0.15 of the way from the history leg to the approval leg and count their district polls at 0.82 of the blend.</p>
        <p>Each nominee&rsquo;s coalition is read from the 2026 county primary results with the census. Where the top challenger beat the nominee among a group of voters, the nominee&rsquo;s own party voters in that group defect and stay home more in November, and an incumbent&rsquo;s personal vote is placed by the groups that carried them before. A runoff winner is read on the average of the first round and the runoff.</p>
      </>
    ),
  },
  {
    id: "donors", eye: "Step 4c", title: "Donor coalitions",
    body: (
      <>
        <p>Since October 25 the model reads the 2026 donor map: every itemized individual gift to a House or Senate campaign and every ActBlue and WinRed line through September 30, about two billion dollars placed in the counties where the donors live. For each race with both nominees on file it measures four things: the Democrat&rsquo;s share of the two nominees&rsquo; in state dollars, the share of donations, a count of people giving rather than dollars, how much more of one side&rsquo;s money comes in gifts under $200, and how far each side&rsquo;s donors reach into the other side&rsquo;s counties.</p>
        <p>Each is set against what a race with the same partisan lean and the same incumbency normally shows, from a fit across more than 400 races, so ActBlue&rsquo;s national size and a state&rsquo;s lean never count as an edge. The parts are averaged into one score in units of the normal spread. Inside one spread of normal the term is zero; past it the shift is 0.02 logit per unit, capped at 0.05, and it enters the fundamentals and census legs the way the money term does, so a race with deep polling barely moves. Governors file with the states, not the FEC, so they carry no donor term. <Link href="/forecast/donors">See every race&rsquo;s donor coalition.</Link></p>
      </>
    ),
  },
  {
    id: "sims", eye: "Step 5", title: "2,000 correlated simulations",
    body: (
      <>
        <p>Each county&rsquo;s electorate is rebuilt from census cells by age, race and college education, split further by party and 2022 vote history, with every group given its own chance of turning out and its own vote. Constants are solved so the groups reproduce each county&rsquo;s projected turnout and two party share exactly. Then the election is run 2,000 times. In every run:</p>
        <ul>
          <li>a <b>national shock</b>, shared by every race in that run, moves the whole country together, scaled in each county by its elasticity;</li>
          <li><b>demographic shocks</b>, also shared nationally, move each group&rsquo;s vote and turnout together everywhere that group lives, and voters who skipped 2022 surge or stay home together;</li>
          <li>a <b>state shock</b> moves each state on its own, sized by the polling on file: widest with no polls and narrowest with four or more;</li>
          <li>a <b>county shock</b> that shrinks with county size, plus turnout, enthusiasm and third party shocks;</li>
          <li>then every group&rsquo;s voters are drawn: how many turn out, how many vote third party, and how the rest split.</li>
        </ul>
        <p>Because the national and demographic shocks are shared, a bad night for one party in Michigan is also a bad night for that party in Wisconsin and Pennsylvania. Win probabilities, the 80 percent range of each margin and the chamber odds all come from the same 2,000 runs.</p>
      </>
    ),
  },
  {
    id: "early-vote", eye: "Step 6", title: "The early vote, as a turnout correction",
    body: (
      <>
        <p>Once ballots start coming in, the forecast reads them as a check on turnout. In every state that reports early ballots, the party mix of the mail and in person ballots cast so far, as reported or, where a state reports no party, as estimated on the <Link href="/maps/early-vote" style={{ textDecoration: "underline" }}>early vote tracker</Link>, is set against the party mix the forecast&apos;s own 2026 electorate expected of those ballots.</p>
        <p>The gap is not taken at face value. Ballots cast early in the window run more Democratic than the early vote as a whole, so the reading is moved toward Republicans by how much of the early vote is still to come. Where a state published the party split of its early vote on the same day and at the close in 2022 or 2024, the like for like comparison, today against that day, less the forecast&apos;s expected early vote against that year&apos;s final, carries most of the weight. Only part of the electorate has voted: the ballots in carry the whole gap, and the ballots still to come carry half of it. The reading counts more with more ballots and more of the early vote in, and less where party is estimated rather than reported. Turnout volume against the early vote the forecast expects by this day, timed by each state&apos;s own 2022 and 2024 counts, reads whether the electorate is running larger or smaller. Primary turnout, the Democratic share of 2026 primary ballots against the 2018 and 2022 midterm primaries, is a weak prior on which party is more engaged.</p>
        <p>Every state then also reads the states most like it, by the model&apos;s own correlation between races and by 2024 vote, race and education, so a state with no early vote yet takes its correction from similar states and its primary. The forecast is the prior throughout: a thin early vote barely moves a race.</p>
        <p>The correction is not a flat shift. It becomes a change in each party&apos;s turnout among the forecast&apos;s simulated voters, the 1,152 kinds of voter in every county, and each race is recounted. Turnout is a logistic curve, so the same change moves low propensity voters far more than habitual ones: a race whose margin rests on one party&apos;s low propensity voters moves more, and every county moves by its own voters. House districts take their state&apos;s correction in proportion to how close their own vote is, so a safe seat moves less than a competitive one, and the statewide offices and legislatures are rebuilt on the adjusted forecast. Each race page shows the correction as its own step.</p>
      </>
    ),
  },
  {
    id: "governors", eye: "Governors", title: "Governor depolarization",
    body: (
      <>
        <p>Governor races are more local than Senate races. On the certified results of 108 governor races in 2014, 2018 and 2022, the governor vote followed the state&rsquo;s presidential lean and the national House environment at only about half strength, while Senate races followed the presidential lean almost one for one.</p>
        <p>So governor races respond to about 60 percent of the national swing and 60 percent of the state&rsquo;s partisan lean against the nation, a beta of 0.6 and a lambda of 0.6. The fundamentals keep their county pattern, but their statewide level moves by that much less. In the simulations, governor races take 60 percent of the shared national and demographic vote shocks, and the rest becomes their own state level uncertainty. Turnout shocks stay national, since governors share the ballot and the electorate with the Senate.</p>
        <p>Leaving one cycle out at a time, the fully partisan baseline missed by 19.5 points of margin on average and called 82.1 percent of winners. At 0.6 the miss fell to 15.0 points and 84.9 percent of winners were called. 0.6 is the conservative end of the range that helps, because the model already measures each incumbent&rsquo;s personal vote and reads the polls. Senate races are untouched.</p>
      </>
    ),
  },
  {
    id: "counties", eye: "Maps", title: "County simulations",
    body: (
      <>
        <p>County results on the maps are the average of the simulated votes in that county across all 2,000 runs, and statewide results are the sum of the counties. Hover any county on a race page for its simulated margin and simulated vote. The estimated exit poll on each statewide page is read the same way, off the simulated voters grouped by age, race, education, party and vote history, not asked of anyone.</p>
      </>
    ),
  },
  {
    id: "house", eye: "House", title: "The House district model",
    body: (
      <>
        <p>The House runs the same machinery, district by district. Each district starts from its 2024 presidential result on the lines in force for 2026, then adds its incumbent and any redrawing, measured ticket splitting, turnout in its own primary, district polls where they exist, FEC money, top two and one party generals, and unopposed seats. Each district&rsquo;s electorate is rebuilt from the voter groups of the counties that look like it, and the election is run 2,000 times with the same national, demographic and irregular voter shocks as the Senate and governor runs, so the House, the Senate and the governors move together in every run.</p>
      </>
    ),
  },
  {
    id: "chambers", eye: "Control", title: "How chamber odds are counted",
    body: (
      <>
        <p>In every simulation the model counts the seats each party wins, adds the seats not on the 2026 ballot, and checks who controls the chamber. The odds are the share of the 2,000 runs each party ends up in control.</p>
        <ul>
          <li><b>Senate:</b> Democrats need 51 of 100 seats, because a 50 to 50 chamber stays Republican on the Vice President&rsquo;s tiebreak. The 34 Democratic and 31 Republican seats not up this year are counted in. Dan Osborn in Nebraska is counted in the Democratic column.</li>
          <li><b>House:</b> 218 of 435 seats.</li>
          <li><b>Governors:</b> a majority of all 50 governorships, 26, counting the 14 not on this year&rsquo;s ballot.</li>
        </ul>
        <p>The seat bar on the forecast page calls every race for its projected winner. That is a different number from the average seat count across the simulations, which leans toward whichever side holds more of the close seats. Both are shown.</p>
      </>
    ),
  },
  {
    id: "ratings", eye: "Ratings", title: "Rating bands",
    body: (
      <>
        <p>Every race gets a rating from its model margin. A race inside 2 points is a toss up. From 2 to 6 points it leans to the leader, from 6 to 12 it is likely, and at 12 points or more it is safe. Where the leading non Republican candidate is an independent, the race is shown in the independent lavender. The same bands color the maps, pale for close races and deep for safe ones.</p>
      </>
    ),
  },
];

const BANDS: { k: keyof typeof RATE; range: string }[] = [
  { k: "safeD", range: "D 12+" }, { k: "likelyD", range: "D 6 to 12" }, { k: "leanD", range: "D 2 to 6" },
  { k: "toss", range: "Under 2" },
  { k: "leanR", range: "R 2 to 6" }, { k: "likelyR", range: "R 6 to 12" }, { k: "safeR", range: "R 12+" },
];

export default function Page() {
  const model = getModel();
  const updated = new Date(model.meta.updated + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="opp">
      <style>{CSS}</style>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>Methodology</span>
      </nav>
      <ForecastNav />
      <JsonLd data={methodologyLd()} />
      <header className="ph">
        <div className="eye g">Forecast methodology</div>
        <h1>How the forecast <em>works</em></h1>
        <p className="lede">From partisan lean and the national environment to the polling average, candidate effects and 2,000 correlated simulations of the election, county by county.</p>
        <div className="pmeta">
          <span><b className="mono">{model.meta.sims.toLocaleString()}</b> simulations</span>
          <span>Updated <b>{updated}</b></span>
          <Link className="btn sm" href="/forecast">The forecast</Link>
          <Link className="btn sm" href="/forecast/changelog">Changelog</Link>
        </div>
      </header>

      <div className="layout">
        <div className="fm-stack">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="card fm-sec">
              <div className="card-h"><h3>{s.title}</h3><span className="eye" style={{ marginLeft: "auto" }}>{s.eye}</span></div>
              <div className="card-b fm-prose">{s.body}</div>
            </section>
          ))}
        </div>

        <aside className="side fm-side">
          <div className="card">
            <div className="card-h"><h3>On this page</h3></div>
            <nav className="card-b fm-toc" aria-label="Sections">
              {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
            </nav>
          </div>
          <div className="card">
            <div className="card-h"><h3>Rating bands</h3><span className="eye" style={{ marginLeft: "auto" }}>Model margin</span></div>
            <div className="card-b">
              {BANDS.map((b) => (
                <div className="kv" key={b.k}><span><i className="fm-sw" style={{ background: RATE[b.k] }} />{RATING_LABEL[b.k]}</span><span>{b.range}</span></div>
              ))}
              <div className="kv"><span><i className="fm-sw" style={{ background: RATE.ind }} />Independent</span><span>Any lead</span></div>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Key settings</h3></div>
            <div className="card-b">
              <div className="kv"><span>Simulations</span><span>{model.meta.sims.toLocaleString()}</span></div>
              <div className="kv"><span>LOWESS polling level</span><span>8+ polls</span></div>
              <div className="kv"><span>Likely voter weight</span><span>3x RV</span></div>
              <div className="kv"><span>Governor beta</span><span>0.6</span></div>
              <div className="kv"><span>Governor lambda</span><span>0.6</span></div>
              <div className="kv"><span>Senate control</span><span>51 seats</span></div>
              <div className="kv"><span>House control</span><span>218 seats</span></div>
              <div className="kv"><span>Governor majority</span><span>26 of 50</span></div>
            </div>
          </div>
          <div className="callout">
            <div className="eye">Fieldwork</div>
            On Point Polling fields its own polls in the model. The polling side of the method, including pollster grades, is on the <Link href="/on-point-polling/methodology" style={{ textDecoration: "underline" }}>On Point Polling methodology page</Link>.
          </div>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.opp .fm-stack { display: grid; gap: 16px; min-width: 0; }
.opp .fm-sec { scroll-margin-top: 90px; }
.opp .fm-prose { color: var(--ink2); font-size: 15px; line-height: 1.7; }
.opp .fm-prose p { margin: 0 0 12px; max-width: 72ch; }
.opp .fm-prose p:last-child { margin-bottom: 0; }
.opp .fm-prose b { color: var(--ink); font-weight: 700; }
.opp .fm-prose a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.opp .fm-prose ul { margin: 0 0 12px; padding-left: 20px; max-width: 70ch; }
.opp .fm-prose li { margin: 6px 0; }
.opp .fm-toc { display: grid; gap: 2px; padding-top: 10px; padding-bottom: 10px; }
.opp .fm-toc a { padding: 6px 0; font-size: 13.5px; color: var(--ink2); border-bottom: 1px solid var(--line); }
.opp .fm-toc a:last-child { border-bottom: 0; }
.opp .fm-toc a:hover { color: var(--hi); }
.opp .fm-sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 8px; vertical-align: -1px; }
`;
