import fs from "node:fs";
import path from "node:path";
import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";
import Article, { Fig } from "../Article";
import { articleBySlug } from "../lib";

const a = articleBySlug("what-a-forecast-probability-means");
export const metadata = seo({ title: a.title, description: a.dek, path: `/analysis/${a.slug}`, type: "article", published: a.published, modified: a.modified });

type Cal = { lo: number; hi: number; n: number; expected: number; won: number; upsets: number };
type Acc = { calib: Cal[]; headline: { all: { scored: { n: number; right: number; in80: number; brier: number; mean_fav: number; fav_won: number } } } };

export default function Page() {
  const A = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/accuracy/2026.json"), "utf8")) as Acc;
  const cal = A.calib, S = A.headline.all.scored;
  const mid = cal.filter((c) => c.lo >= 60 && c.lo < 90);
  const midN = mid.reduce((x, c) => x + c.n, 0), midExp = mid.reduce((x, c) => x + c.expected * c.n, 0) / Math.max(1, midN), midWon = mid.reduce((x, c) => x + c.won * c.n, 0) / Math.max(1, midN);
  const flip = cal.find((c) => c.lo === 50), sure = cal.filter((c) => c.lo >= 95);
  const sureN = sure.reduce((x, c) => x + c.n, 0), sureUp = sure.reduce((x, c) => x + c.upsets, 0);
  const upsets = cal.reduce((x, c) => x + c.upsets, 0), expUp = cal.reduce((x, c) => x + c.n * (1 - c.expected / 100), 0);
  return (
    <Article a={a} sources={[{ label: "Calibration chart in the accuracy report", href: "/accuracy#calibration" }, { label: "Forecast methodology", href: "/forecast/methodology" }]}>
      <p>
        When a forecast gives a candidate a 70 percent chance, it is not saying the candidate will win. It is saying that if you took every race where we gave a favorite about
        70 percent, roughly seven in ten of those favorites should win and three in ten should lose. A forecast that never sees its 70 percent favorites lose is not brilliant.
        It is underconfident, and its numbers should have been higher. A forecast whose 70 percent favorites lose half the time is overconfident.
      </p>
      <p>
        That is a testable promise, and the 2026 midterms gave us {S.n} Senate, House and governor races to test it on. We sorted every race by the chance our final
        forecast gave the favorite and counted how often each group of favorites actually won.
      </p>
      <Fig title="2026 favorites, by the chance we gave them" head={["Chance given", "Races", "Should have won", "Actually won", "Upsets"]}
        rows={cal.map((c) => [`${c.lo} to ${c.hi} percent`, c.n, `${c.expected.toFixed(0)}%`, `${c.won.toFixed(0)}%`, c.upsets])}
        note="Races still being counted are scored on the current leader. Source: the On Point Politics 2026 accuracy report." />

      <h2>The coin flips behaved like coin flips</h2>
      {flip ? <p>
        The first row is the one people tend to misread. We had {flip.n} races where neither side was better than a 60 percent favorite. Those are close to coin flips, and
        the favorite won {flip.won.toFixed(0)} percent of them, almost exactly the {flip.expected.toFixed(0)} percent we expected. The {flip.upsets} upsets in that group are not
        forecast failures. A forecast that called every close race correctly would be lucky, not good.
      </p> : null}

      <h2>The middle was too cautious</h2>
      <p>
        The rows from 60 to 90 percent tell a more useful story. Across those {midN} races we expected favorites to win about {midExp.toFixed(0)} percent of the time, and they
        won {midWon.toFixed(0)} percent. That gap means our probabilities in the lean and likely range were too low: races we called leaning one way were more settled than we
        said. Part of that is the year. A national wave pushes most races in the same direction, so favorites on the winning side of a wave come through more often than an
        average year would suggest. Part of it is the model, and we take it as a sign that our uncertainty was set a little wide.
      </p>
      <p>
        The same lesson shows up in the ranges. Every race on the site carries an 80 percent range for the margin. In a well calibrated forecast about 80 percent of results
        land inside that range. In 2026, {S.in80.toFixed(0)} percent did.
      </p>

      <h2>The safe races were safe</h2>
      <p>
        At the top of the table are {sureN} races where we gave the favorite at least 95 percent. Those favorites lost {sureUp === 0 ? "none" : sureUp === 1 ? "once" : `${sureUp} times`}.
        This matters more than it sounds, because safe races are where a model with a hidden flaw tends to embarrass itself. A forecast that gets the close races right
        by luck but loses a safe seat has a structural problem.
      </p>

      <h2>One number to sum it up</h2>
      <p>
        Forecasters often report a Brier score, the average squared gap between the probability given and what happened, where zero is perfect and 0.25 is what you get
        by calling every race a coin flip. Our 2026 score across all {S.n} races was {S.brier.toFixed(3)}. Across the whole table there were {upsets} upsets. If our
        probabilities had been perfectly calibrated we would have expected about {Math.round(expUp)}. Fewer upsets than expected is the signature of the cautious middle
        described above.
      </p>

      <h2>How to read our numbers</h2>
      <ul>
        <li><b>Under 60 percent</b> is a toss up. Treat it as genuinely open, however the map is shaded.</li>
        <li><b>60 to 90 percent</b> is a real edge. In 2026 our edges held more often than the number said, but a single race is still a single draw.</li>
        <li><b>Above 95 percent</b> means it would take an error well beyond the typical misses we measured in the 2018, 2022 and 2026 races to flip it.</li>
      </ul>
      <p>
        The same reading applies to the <Link href="/forecast/2028">2028 forecast</Link>, and we will grade it the same way, in public, once the votes are counted.
      </p>
    </Article>
  );
}
