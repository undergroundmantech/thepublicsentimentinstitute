import fs from "node:fs";
import path from "node:path";
import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";
import Article, { Fig } from "../Article";
import { articleBySlug } from "../lib";

const a = articleBySlug("2026-forecast-review");
export const metadata = seo({ title: a.title, description: a.dek, path: `/analysis/${a.slug}`, type: "article", published: a.published, modified: a.modified });

type Blk = { n: number; right: number; share: number; bias: number; mae: number; median_miss: number; in80: number };
type Head = { races: number; called_right: number; counting: number; scored: Blk; scored_final: Blk };
type Ch = { median: number; p10: number; p90: number; actualD: number; actualR: number; demControl: number; right: boolean; counting: number };
type Race = { id: string; ind?: boolean; o: string; name: string; dem: string; gop: string; fm: number; p: number; act: number; pct: number; fin: boolean; right: boolean; excl: string | null };
type Reg = { k: string; counties: number; bias: number; mae: number };
type Acc = { headline: Record<"all" | "senate" | "governor" | "house", Head>; chambers: Record<"senate" | "governor" | "house", Ch>; races: Race[];
  counties: { all: { counties: number; mae: number; wmae: number; bias: number }; area: Reg[]; region: Reg[] };
  legislatures: { called_right: number; called: number; chambers: { settled: number; right: number } } };
type Bench = { generic: { us: { margin: number; n: number }; result: { margin: number }; averages: { margin: number } }; national: { polls: unknown[] } };
type Pol = { summary: Record<"senate" | "governor", { n: number; right: number; mae: number; bias: number }> };
const read = <T,>(p: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", p), "utf8")) as T;

const pct = (x: number) => `${Math.round(x * 100)} percent`;
const lean = (m: number) => (Math.abs(m) < 0.05 ? "even" : m > 0 ? `R +${m.toFixed(1)}` : `D +${Math.abs(m).toFixed(1)}`);
/** A bias in R minus D terms, as a sentence fragment: negative means the result was bluer than the forecast. */
const tilt = (b: number) => (Math.abs(b) < 0.3 ? "about even" : `${Math.abs(b).toFixed(1)} points ${b < 0 ? "more Democratic" : "more Republican"} than forecast`);

export default function Page() {
  const A = read<Acc>("accuracy/2026.json"), B = read<Bench>("accuracy/benchmarks-2026.json"), P = read<Pol>("accuracy/polling-2026.json");
  const H = A.headline, C = A.chambers, CO = A.counties, LG = A.legislatures;
  const misses = A.races.filter((r) => !r.right && r.o !== "house");
  const sw = CO.region.find((r) => r.k === "Southwest"), plains = CO.region.find((r) => r.k === "Lower Midwest / Plains"), sub = CO.area.find((r) => r.k === "Suburban"), rural = CO.area.find((r) => r.k === "Rural");
  const favOf = (r: Race) => (r.p >= 0.5 ? r.gop : r.dem), favP = (r: Race) => Math.max(r.p, 1 - r.p);
  const winner = (r: Race) => (r.act > 0 ? r.gop : r.dem);
  // an independent such as Dan Osborn runs in the Democratic column, so his margin is written with his name
  const lm = (r: Race, m: number) => (r.ind && m < 0 ? `${r.dem.split(" ").slice(-1)[0]} +${Math.abs(m).toFixed(1)}` : lean(m));
  return (
    <Article a={a} sources={[{ label: "The 2026 accuracy report, every race scored", href: "/accuracy" }, { label: "The forecast as published on November 3", href: "/forecast/2026" }, { label: "Download the scores", href: "/accuracy/2026.json" }, { label: "Forecast methodology", href: "/forecast/methodology" }]}>
      <p>
        A forecast is only worth reading if its makers are willing to grade it in public. Ours was frozen on the morning of November 3, before any polls closed, and every
        file was fingerprinted so it cannot be quietly edited afterward. This piece goes through how that forecast held up against the count, using the same scores as
        the <Link href="/accuracy">accuracy report</Link>. Some races are still being counted, so a few numbers below will move as the final certified results come in.
      </p>

      <h2>The headline: three chambers, and the national vote to a tenth</h2>
      <p>
        The forecast picked the winner in <b>{H.all.called_right} of {H.all.races}</b> Senate, House and governor races, counting leaders in races that were not finished.
        Among races that were fully counted when we scored them, it was right in <b>{H.all.scored_final.right} of {H.all.scored_final.n}</b>, or {H.all.scored_final.share.toFixed(1)} percent.
        It favored Democrats to win the Senate at {pct(C.senate.demControl)}, the House at {pct(C.house.demControl)} and a majority of governorships at {pct(C.governor.demControl)}, and all three came true.
      </p>
      <p>
        The part we are proudest of is the national vote. Our final national survey of {B.generic.us.n.toLocaleString("en-US")} registered voters, fielded October 28, had Democrats ahead
        by {B.generic.us.margin.toFixed(1)} points on the generic congressional ballot. The projected final national House vote is D +{B.generic.result.margin.toFixed(1)}. The major polling
        averages closed near D +{B.generic.averages.margin.toFixed(1)}, which means the industry as a whole underestimated the Democratic wave by about {(B.generic.result.margin - B.generic.averages.margin).toFixed(1)} points.
        Of the {B.national.polls.length} final national polls we tracked, ours finished closest.
      </p>
      <Fig title="Seats, forecast against result" head={["Chamber", "Forecast median", "80 percent range", "Result, D", "Chance we gave Democrats"]}
        rows={(["senate", "house", "governor"] as const).map((k) => [k === "senate" ? "Senate" : k === "house" ? "House" : "Governors", `${C[k].median} D`, `${C[k].p10} to ${C[k].p90}`, `${C[k].actualD}${C[k].counting ? " so far" : ""}`, pct(C[k].demControl)])}
        note="Results count seats won plus seats where a candidate leads with ballots still being counted." />
      <p>
        The Senate median landed almost exactly on the result. The House is where we were too cautious: the wave carried Democrats past our median of {C.house.median} seats to
        about {C.house.actualD}, still inside the range we published but toward its top end. The reason shows up in the race by race errors below.
      </p>

      <h2>The races we got wrong</h2>
      <p>Statewide, the forecast missed {misses.length} races. Each one is worth a look, because they failed in different ways.</p>
      <ul>
        {misses.map((r) => (
          <li key={r.id}>
            <b>{r.name}.</b> We made {favOf(r)} the favorite at {pct(favP(r))} with a projected margin of {lm(r, r.fm)}. {r.excl ? <>The first round count, with {r.pct} percent of the vote in, has {winner(r)} ahead at {lm(r, r.act)}, and the ranked choice tabulation is still to run, so this one is not settled.</>
              : Math.abs(r.act) < 0.1 ? <>With {r.pct} percent counted the race is essentially tied, so this miss may yet reverse.</>
              : <>{winner(r)} won at {lm(r, r.act)}{r.fin ? "" : `, with ${r.pct} percent counted`}.</>}
          </li>
        ))}
      </ul>
      <p>
        Mississippi and Texas went in as near coin flips, and a well calibrated forecast should expect a few of those to break the other way each cycle. What matters in Texas
        is the size of the miss, not the call: Gina Hinojosa outran even a forecast that already treated Texas as unusually sensitive to the national environment, and that
        error is part of a pattern described below. Nebraska was a clearer miss in the opposite direction. We leaned on Dan Osborn&apos;s strong 2024 showing as an independent,
        and the state returned to its partisan baseline more than the model expected. Alaska&apos;s count is not final until the ranked choice rounds are run.
      </p>

      <h2>Where the errors clustered</h2>
      <p>
        Across every race we scored, the typical miss on the margin was {H.all.scored.median_miss.toFixed(1)} points and the results came in {tilt(H.all.scored.bias)} on average.
        {" "}{H.all.scored.in80.toFixed(0)} percent of results landed inside our 80 percent ranges, a little more than they should, which tells us the ranges were slightly too wide this year.
      </p>
      <p>
        The county results are more revealing. We forecast all {CO.all.counties.toLocaleString("en-US")} counties in the statewide races, and the vote weighted miss
        was {CO.all.wmae.toFixed(1)} points. {sub ? <>Suburban counties, which cast the most votes, came in {tilt(sub.bias)}. </> : null}
        {rural ? <>Rural counties were {tilt(rural.bias)}. </> : null}
        {sw ? <>The biggest regional miss was the Southwest, {tilt(sw.bias)}, </> : null}
        {plains ? <>while the Lower Midwest and Plains went the other way, {tilt(plains.bias)}.</> : null}
      </p>
      <p>
        Put together, the story is consistent: Democrats gained most in the suburbs and in heavily Hispanic counties of the Southwest, more than our demographic swing
        estimated, while the Plains held closer to their usual lean. That is how the House median came in low, how Texas was missed, and how Nebraska was missed in the other direction.
      </p>

      <h2>Our own polls</h2>
      <p>
        On Point Polling also fielded state polls during the cycle, and they are scored separately so they cannot hide behind the forecast. In the {P.summary.senate.n} Senate races we
        polled, our final poll had the right leader in {P.summary.senate.right} and missed the margin by {P.summary.senate.mae.toFixed(1)} points on average.
        The {P.summary.governor.n} governor races were harder: {P.summary.governor.right} right, an average miss of {P.summary.governor.mae.toFixed(1)} points, with results {tilt(P.summary.governor.bias)}.
        We publish every one of these, misses included, on the <Link href="/accuracy#our-polls">accuracy report</Link>.
      </p>

      <h2>State legislatures</h2>
      <p>
        Below the statewide races, the forecast called {LG.chambers.right} of the {LG.chambers.settled} legislative chambers that are settled and the winner
        in {LG.called_right.toLocaleString("en-US")} of {LG.called.toLocaleString("en-US")} individual districts. Legislative districts are rarely polled, so those calls rest almost entirely on fundamentals and the national environment,
        which makes them a useful test of the model&apos;s foundation.
      </p>

      <h2>What we take into 2028</h2>
      <p>
        The lesson is not that the polls were wrong. Our own national poll was nearly exact. The lesson is about translation: how a national wave spreads across suburbs,
        Hispanic communities and the rural Plains. For the <Link href="/forecast/2028">2028 forecast</Link> we have rebuilt the electorate model on vote history, splitting every
        county into groups by how often they vote and calibrating each state to its 2026 turnout, so that the next forecast starts from who actually showed up rather than from
        who usually does. We explain that model in <Link href="/analysis/who-votes-in-2028">who votes in 2028</Link>.
      </p>
    </Article>
  );
}
