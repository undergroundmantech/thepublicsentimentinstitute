import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getModel } from "@/app/lib/forecastData";
import { RATE, RATING_LABEL } from "@/app/lib/opp";

export const metadata: Metadata = {
  title: "Forecast methodology",
  description:
    "How the OnPoint Politics 2026 forecast works: fundamentals, the polling average, candidate effects, 2,000 correlated simulations, county and district models, and how chamber odds and ratings are set.",
  alternates: { canonical: "/forecast/methodology" },
};

// Every figure below is read off the model code in scripts/forecast/model (senate_mode.py,
// poll_daily.py, lowess_trend.py, dynamic_mode.py, house_dyn.py) and the build script
// scripts/forecast/build_app_forecast.py. Change them there first, then here.
const SECTIONS: { id: string; eye: string; title: string; body: ReactNode }[] = [
  {
    id: "overview", eye: "Overview", title: "What the model does",
    body: (
      <>
        <p>The forecast rebuilds every 2026 Senate, governor and House race county by county. It starts from what the fundamentals say a race should look like, moves that toward the polling average as the polling gets deeper and the election gets closer, adjusts for the candidates, and then runs the whole election 2,000 times with shared errors so that races move together the way they do on a real election night.</p>
        <p>Each race carries three legs. The first is a fundamentals leg built from TPSI county by county presidential approval. The second takes each county&rsquo;s certified 2024 result and moves it by the demographic swing to the 2026 national environment. The third carries each county&rsquo;s own voting history, and its statewide level is the polling average. The three are blended into one county forecast, which is then simulated.</p>
      </>
    ),
  },
  {
    id: "fundamentals", eye: "Step 1", title: "Fundamentals",
    body: (
      <>
        <p><b>Partisan lean.</b> Every state, county and district starts from its presidential lean on the lines in force for 2026, taken from the certified results. On the race pages this is the anchor, the first stage in the breakdown of how the number gets made.</p>
        <p><b>National environment.</b> The 2026 environment comes from the generic congressional ballot and presidential approval. The generic ballot sets the national vote, and the TPSI respondent database supplies approval county by county, calibrated and converted into vote with the TPSI respondent crosstabs. Each county responds to the environment through its own elasticity, estimated from a national demographic fit and its own recent presidential swings, so a swing county moves more than a county that votes the same way every cycle.</p>
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
        <p>Pollster grades come from the <Link href="/tpsi/methodology">TPSI pollster ratings</Link>, and polls sponsored by a campaign or a party are flagged on every race page.</p>
      </>
    ),
  },
  {
    id: "blend", eye: "Step 3", title: "How polls and fundamentals blend",
    body: (
      <>
        <p>The weight on the polling leg grows with how much independent polling a race has, counted in distinct nonpartisan polling houses rather than in polls, so three surveys from one pollster do not read as three reads of the race. Houses that polled inside 45 days count in full and houses that polled 45 to 60 days out count half. The weight rises in a straight line from one house to eight.</p>
        <p>The ceiling on that weight also rises as Election Day approaches, because a poll&rsquo;s information about the final margin climbs over the last six weeks while the fundamentals stop learning. At five weeks out the polling leg carries a little over 40 percent of the blend with one polling house and a little under 80 percent with eight or more. A race with no polls gives the three legs equal weight, and the blend then collapses to half fundamentals and half 2024 baseline.</p>
      </>
    ),
  },
  {
    id: "candidates", eye: "Step 4", title: "Candidate effects",
    body: (
      <>
        <p>Beyond incumbency, the model prices the candidates themselves. Party unity comes from each nominee&rsquo;s share of their own party&rsquo;s 2026 primary vote, so a nominee who limped out of a divided primary carries less of their party. Where a race&rsquo;s own polling sits away from the model&rsquo;s fundamentals, that gap is read as candidate strength. In governor races with little or no polling, a small campaign finance term uses verified individual contributions, net of self funding, and it stands down wherever real polling exists.</p>
        <p>Third party and independent candidates are modeled explicitly rather than folded into the major parties. Where an independent is the main challenger, as in Nebraska, that candidate takes the non Republican side of the race and is shown in lavender.</p>
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
            TPSI polls in the model are fielded by The Public Sentiment Institute. The polling side of the method, including pollster grades, is on the <Link href="/tpsi/methodology" style={{ textDecoration: "underline" }}>TPSI methodology page</Link>.
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
