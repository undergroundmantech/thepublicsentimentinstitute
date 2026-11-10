import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";
import Article, { Fig } from "../Article";
import { articleBySlug } from "../lib";

const a = articleBySlug("who-votes-in-2028");
export const metadata = seo({ title: a.title, description: a.dek, path: `/analysis/${a.slug}`, type: "article", published: a.published, modified: a.modified });

// From the On Point 2028 electorate model, run November 9, 2026: 1,152 groups in every county, summed nationally.
// Share of 2028 voters, expected turnout among eligible members, and the Democratic share of the two party vote.
const SEG = [
  { k: "Vote in every election", share: 55.5, turn: 94.1, d2: 58.1, elig: 92.3, note: "Voted in 2020, 2022, 2024 and 2026" },
  { k: "Presidential years only", share: 18.4, turn: 85.4, d2: 42.7, elig: 33.7, note: "Voted in 2020 and 2024, skipped the midterms" },
  { k: "New in 2024", share: 9.8, turn: 69.8, d2: 50.9, elig: 21.9, note: "First vote in 2024" },
  { k: "Lapsed", share: 5.8, turn: 33.4, d2: 44.8, elig: 27.0, note: "Voted before, missed 2024 and 2026" },
  { k: "2026 surge", share: 5.0, turn: 43.3, d2: 56.9, elig: 18.1, note: "Voted in 2026 after skipping recent elections" },
  { k: "Not voting lately", share: 5.6, turn: 17.0, d2: 48.6, elig: 51.2, note: "No vote on record in recent cycles" },
];
const TOT = { voters: 156.4, eligible: 244.1, d2: 53.2, women: 52.4, wD: 57.9, mD: 48.0, young: 15.8, youngD: 58.8 };

export default function Page() {
  return (
    <Article a={a} sources={[{ label: "The 2028 forecast", href: "/forecast/2028" }, { label: "On Point Polling methodology", href: "/on-point-polling/methodology" }, { label: "What we got right and wrong in 2026", href: "/analysis/2026-forecast-review" }]}>
      <p>
        Most election models describe voters with a handful of categories: age, race, education, maybe party. Those categories explain a lot about how people vote. They explain
        much less about whether people vote, and in a close presidential race the turnout question is often the whole game. For 2028 we rebuilt our electorate model around
        the thing that best predicts turnout: a person&apos;s own vote history.
      </p>

      <h2>How the model is built</h2>
      <p>
        The model starts from the On Point Polling national respondent database, where each respondent reports their recent voting along with their demographics and politics.
        It splits the adult citizens of every county into <b>1,152 groups</b>: 32 combinations of age, race and education, by gender, by party identification, and by six vote
        history segments. Each group gets its own turnout rate, its own partisan lean, its own pull toward a third party and its own mix of early, mail and Election Day voting.
      </p>
      <p>
        Those groups are then checked against reality. For every state with reliable statewide totals, the model is calibrated so that its 2026 turnout matches the votes
        actually cast in 2026. That step matters, because it ties the 2028 projection to the most recent election rather than to an assumption about what a normal year looks like.
      </p>

      <h2>The six kinds of voter</h2>
      <Fig title="The 2028 electorate by vote history" head={["Segment", "Share of 2028 voters", "Expected turnout", "Democratic share, two party", "Eligible adults, millions"]}
        rows={SEG.map((s) => [s.k, `${s.share.toFixed(1)}%`, `${s.turn.toFixed(0)}%`, `${s.d2.toFixed(1)}%`, s.elig.toFixed(1)])}
        note={`Model estimates for a generic Democrat against a generic Republican. About ${TOT.voters} million votes from ${TOT.eligible} million eligible adults.`} />
      <p>
        A little over half of the 2028 electorate is people who vote in every election, midterms included. This group now leans Democratic, about {SEG[0].d2.toFixed(0)} percent
        of its two party vote. That is a real change from a decade ago, when the most reliable voters were older and leaned Republican. College educated voters, who vote at
        high rates, have moved toward Democrats, and that has tilted the habitual electorate with them.
      </p>
      <p>
        The second largest group is the opposite. Voters who show up for presidential races but skip midterms make up about {SEG[1].share.toFixed(0)} percent of the projected 2028
        vote, and they lean Republican, giving Democrats only about {SEG[1].d2.toFixed(0)} percent of their two party vote. These are the voters who were largely missing from the
        2026 midterm, and their absence is a big reason that midterm looked so different from 2024.
      </p>

      <h2>Why 2028 will not look like 2026</h2>
      <p>
        Put the first two rows side by side and the shape of the next election comes into focus. In a midterm, the electorate is mostly the every election group, which favors
        Democrats. In a presidential year the presidential only group comes back in force and pulls the electorate toward Republicans. The model expects that return to cost
        Democrats several points of margin compared with 2026, which is most of the reason a thirteen point midterm win becomes a forecast of roughly
        {" "}{(2 * TOT.d2 - 100).toFixed(0)} points nationally in 2028.
      </p>
      <p>
        The smaller groups are where campaigns can still move the number. Voters who first voted in 2024 split almost evenly. The 2026 surge group, people who turned out this
        November after skipping recent elections, leans Democratic, but fewer than half of them are expected to vote again. Lapsed voters lean Republican and turn out at about one in three.
        Each of these groups is small nationally and can be decisive in a state decided by a point.
      </p>

      <h2>The gender gap and the young vote</h2>
      <p>
        Women are projected to cast {TOT.women.toFixed(0)} percent of the 2028 vote and to give Democrats about {TOT.wD.toFixed(0)} percent of their two party vote, against
        about {TOT.mD.toFixed(0)} percent among men. Voters under 30 make up about {TOT.young.toFixed(0)} percent of the electorate and lean Democratic at about {TOT.youngD.toFixed(0)} percent,
        but they are also the least reliable voters in every segment, which is why youth turnout is one of the largest sources of uncertainty in the forecast.
      </p>

      <h2>How the vote is cast</h2>
      <p>
        The model also tracks how each group votes. Democratic identifiers lean much more heavily on mail ballots, and Republican identifiers cast a much larger
        share on Election Day. That matters on election night, when early counts and late counts can point in different directions, and it matters for campaigns, because a vote
        banked in October cannot be lost to a rainstorm in November.
      </p>

      <h2>What to watch</h2>
      <ul>
        <li><b>The presidential only voters.</b> If they return at their 2024 rate the race tightens. If enough of them stay home, as they did in 2026, Democrats keep most of their midterm edge.</li>
        <li><b>The 2026 surge.</b> Repeat voters from this group would add to the Democratic base in the states where it was largest.</li>
        <li><b>New 2024 voters.</b> They split evenly today. Whichever party wins their second vote gains a durable group.</li>
      </ul>
      <p>
        These estimates feed directly into the <Link href="/forecast/2028">2028 forecast</Link>, and we will revise them as new polling and voter file updates arrive.
        For how the 2026 forecast performed, read <Link href="/analysis/2026-forecast-review">what we got right and wrong in 2026</Link>.
      </p>
    </Article>
  );
}
