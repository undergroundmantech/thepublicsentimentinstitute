import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, pageLd, seo } from "@/app/lib/seo";
import { ACCURACY_2026 as A, LEAN_CAL_2026, RATED_2026 } from "@/app/_polling/lib/ratings2026";
import "../2028/p2028.css";

const DESC = "On Point Politics pollster ratings after the 2026 midterms: the new Gold Standard, a grade for every firm scored against the results, and the partisan corrections the averages now use.";
export const metadata: Metadata = seo({ title: "Pollster ratings 2026: the most accurate pollsters and the new Gold Standard", description: DESC, path: "/polls/ratings", type: "article", modified: "2026-11-13" });

const GOLD = RATED_2026.filter((r) => r.grade === "Gold");
const ORDER = ["Gold", "A++", "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "D-", "F", "NR"];
const rank = (g: string) => { const i = ORDER.indexOf(g === "D+" ? "D" : g === "F-" || g === "Super F" ? "F" : g); return i < 0 ? 14 : i; };
const sgn = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;
const side = (n: number) => (Math.abs(n) < 0.05 ? "even" : `${Math.abs(n).toFixed(1)} too ${n > 0 ? "Republican" : "Democratic"}`);
const SHIFT_LABEL: Record<string, string> = { rinternal: "Republican campaign and party polls", dinternal: "Democratic campaign and party polls", trafalgar: "Trafalgar", insideradvantage: "InsiderAdvantage", quantus: "Quantus Insights", gbao: "GBAO", dataforprogress: "Data for Progress" };
const SHIFT_DIR: Record<string, "R" | "D"> = { rinternal: "R", trafalgar: "R", insideradvantage: "R", quantus: "R", dinternal: "D", gbao: "D", dataforprogress: "D" };

export default function Page() {
  const rated = RATED_2026.filter((r) => r.units >= 2 || r.old !== "NR");
  return (
    <div className="opp rt">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["Polls", "/polls"], ["Pollster ratings", "/polls/ratings"]]),
        pageLd({ name: "Pollster ratings 2026", description: DESC, path: "/polls/ratings", modified: "2026-11-13", about: "Pollster ratings" }),
      )} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span><span aria-current="page">Pollster ratings</span></nav>
      <header className="ph">
        <div className="eye g">Pollster ratings · after the 2026 midterms</div>
        <h1>Who got 2026 <em>right</em></h1>
        <p className="lede">We scored {A.polls} Senate and governor polls from the final month of the campaign, {A.window}, against the certified results in {A.races} races, plus every firm&apos;s final national generic ballot against the D +{A.generic.result.toFixed(1)} result. The grades below now set how much each poll counts in every On Point average.</p>
      </header>

      <section className="card">
        <div className="card-h"><h3>The 2026 Gold Standard</h3><span className="eye" style={{ marginLeft: "auto" }}>Weighted six times a baseline poll</span></div>
        <div className="rt-gold">
          {GOLD.map((g) => (
            <div key={g.firm}>
              <b>{g.firm}</b>
              <span>{g.polls ? `${g.polls} race polls, average miss ${g.mae?.toFixed(1)}` : "National final only"}</span>
              <span>{g.nat != null ? `Generic ballot final D +${g.nat.toFixed(1)}` : "No national final"}</span>
            </div>
          ))}
        </div>
        <p className="pf-note">Quinnipiac and AtlasIntel join. Cygnal moves to A minus and Quantus Insights to B minus after running well to the right of the results. The Wall Street Journal, with no scored 2026 polls, moves to A++ until it has a record to grade.</p>
      </section>

      <section className="card">
        <div className="card-h"><h3>How the polls missed</h3><span className="eye" style={{ marginLeft: "auto" }}>Final 30 days</span></div>
        <div className="rt-kpi">
          <div><span>Average miss</span><b>{A.mae.toFixed(1)}</b><small>points on the margin</small></div>
          <div><span>Direction</span><b>R {sgn(A.bias)}</b><small>polls ran too Republican</small></div>
          <div><span>Generic ballot</span><b>D +{A.generic.averages.toFixed(1)}</b><small>averages, against D +{A.generic.result.toFixed(1)}</small></div>
          <div><span>Senate · governor</span><b>{A.senate.mae.toFixed(1)} · {A.governor.mae.toFixed(1)}</b><small>average miss by office</small></div>
        </div>
        <div className="rt-prose">
          <p>The 2026 polls understated Democrats almost everywhere. Across the final month the typical poll had the margin {side(A.bias)}, and nonpartisan polls alone were {side(A.nonpartisan.bias)}. Republican campaign and party polls were {side(A.rInternal.bias)}; Democratic ones landed close to the result, {side(A.dInternal.bias)}, though with as wide a spread.</p>
          <p>Outside reviews found the same pattern. Pew Research counted polls understating the Democratic margin by at least two points in 21 of 27 Senate and governor races, by about four points on average. G. Elliott Morris put the average miss at 3.5 points and traced most of it to turnout: likely voter screens built on past vote history were more Republican than the registered voter numbers in 25 of 32 cases and missed by more, 4.4 points against 2.6. A review of 412 final two week polls found 334 of them understated Democrats.</p>
          <p>The firms that held up shared that lesson. NYT/Siena had the smallest typical miss of any firm with a full slate, AtlasIntel and CNN/SSRS beat the field race for race, and On Point, The Honest Poll, AtlasIntel and Big Data Poll were the four national finals closest to the D +13 result.</p>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h3>Partisan corrections for 2028</h3><span className="eye" style={{ marginLeft: "auto" }}>Points moved back before averaging</span></div>
        <div className="tblwrap">
          <table className="tbl rt-tbl">
            <thead><tr><th>Who</th><th className="n">Polls scored</th><th className="n">Moved toward</th><th className="n">Points</th></tr></thead>
            <tbody>
              {Object.entries(LEAN_CAL_2026).map(([k, v]) => (
                <tr key={k}><td className="who">{SHIFT_LABEL[k] ?? k}</td><td className="n">{v.n}</td><td className="n">{SHIFT_DIR[k] === "R" ? "Democrats" : "Republicans"}</td><td className="n mono">{v.lean.toFixed(1)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pf-note">Each figure is how far that side&apos;s polls ran from the nonpartisan polls of the same races in the final month of 2026, trimmed of the most extreme tenth and shrunk toward zero when there are few polls. Measuring against the nonpartisan polls rather than the results keeps the correction about the sponsor: every kind of poll missed toward Republicans in 2026, and that shared miss is not something a single firm&apos;s correction should carry into 2028. Tables keep each poll as published.</p>
      </section>

      <section className="card">
        <div className="card-h"><h3>Every firm scored on 2026</h3><span className="eye" style={{ marginLeft: "auto" }}>{rated.length} firms</span></div>
        <div className="tblwrap">
          <table className="tbl rt-tbl">
            <thead><tr><th>Pollster</th><th>Grade</th><th>Was</th><th className="n">Score</th><th className="n">Race polls</th><th className="n">Average miss</th><th className="n">Lean</th><th className="n">Generic final</th></tr></thead>
            <tbody>
              {rated.map((r) => (
                <tr key={r.firm}>
                  <td className="who">{r.firm}{r.tag ? <span className="ty"> {r.tag === "R" ? "R sponsor" : r.tag === "D" ? "D sponsor" : ""}</span> : null}</td>
                  <td><span className={`rt-g k-${r.grade}`}>{r.grade}</span></td>
                  <td className={rank(r.grade) < rank(r.old) ? "rt-up" : "rt-dn"}>{r.old}</td>
                  <td className="n mono">{sgn(r.score)}</td>
                  <td className="n">{r.polls || ""}</td>
                  <td className="n">{r.mae != null ? r.mae.toFixed(1) : ""}</td>
                  <td className="n">{r.bias != null ? `${r.bias > 0 ? "R" : "D"} ${Math.abs(r.bias).toFixed(1)}` : ""}</td>
                  <td className="n">{r.nat != null ? `D +${r.nat.toFixed(1)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pf-note">Score is a firm&apos;s miss against the other polls of the same races, in points; below zero beat the field. A national generic ballot final counts as three race polls. The old grade counts as four more polls, so a short 2026 record leans on the track record and a long one is graded on 2026. Firms with fewer than five scored polls can grade no higher than A and no lower than D, unless a Gold firm&apos;s national final landed within a point. Firms with no scored 2026 polls keep their grade.</p>
      </section>

      <section className="card">
        <div className="card-h"><h3>Sources</h3></div>
        <ul className="rt-src">
          <li>Certified results and On Point&apos;s poll database, final 30 days of the 2026 campaign.</li>
          <li><a href="https://www.pewresearch.org/short-reads/2026/11/06/a-first-look-at-polling-performance-in-2026/" rel="noopener" target="_blank">Pew Research Center, a first look at polling performance in 2026</a></li>
          <li><a href="https://www.gelliottmorris.com/p/2026-11-13-polls-missed-turnout" rel="noopener" target="_blank">Strength In Numbers, the polls missed turnout</a></li>
          <li><a href="https://plusminus4.substack.com/p/a-detailed-first-look-at-polling" rel="noopener" target="_blank">PlusMinus4, a detailed first look at polling error in 2026</a></li>
          <li><a href="https://realclearpolitics.com/articles/2026/11/12/national_polls_missed_a_massive_blue_wave_all_cycle_why_154678.html" rel="noopener" target="_blank">RealClearPolitics, national polls missed a blue wave</a></li>
        </ul>
      </section>
    </div>
  );
}
