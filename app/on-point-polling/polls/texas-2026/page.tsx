import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, ORG_ID, SITE, SITE_ID, abs, seo } from "@/app/lib/seo";

const PATH = "/on-point-polling/polls/texas-2026";
const SUBSTACK = "https://substack.com/home/post/p-220956146";
const TITLE = "Texas poll: Talarico leads Paxton as Abbott holds on";
const DEK = "Talarico leads Paxton by 5.8 for U.S. Senate while Abbott leads Hinojosa by 2.5 for governor among likely voters. Both races are inside the margin of error, and Texans are splitting their tickets.";

export const metadata: Metadata = seo({
  title: "Texas poll October 2026: Talarico vs Paxton, Abbott vs Hinojosa",
  description: "On Point Polling's Texas survey, October 17 to 18, 2026: James Talarico 48.8%, Ken Paxton 43.0% for Senate; Greg Abbott 47.7%, Gina Hinojosa 45.2% for governor; Bo French 45.1%, Jon Rosenthal 39.8% for Railroad Commissioner. Crossover, age, regions, vote method, Trump approval and data centers.",
  path: PATH,
  type: "article",
  published: "2026-10-18T12:00:00-05:00",
  modified: "2026-10-18",
  keywords: ["Texas poll", "Texas Senate poll 2026", "Texas governor poll 2026", "James Talarico", "Ken Paxton", "Greg Abbott", "Gina Hinojosa", "Texas Railroad Commissioner poll", "On Point Polling"],
  ownImage: true,
});

type P = "d" | "r" | "o";
type Cand = { n: string; v: number; p: P; tag: string };
const RACES: { key: string; h: string; lead: string; side: P; cands: Cand[]; leaned: string }[] = [
  {
    key: "sen", h: "U.S. Senate", lead: "Talarico +5.8", side: "d",
    cands: [
      { n: "James Talarico", v: 48.8, p: "d", tag: "Democrat" }, { n: "Ken Paxton", v: 43.0, p: "r", tag: "Republican" },
      { n: "Ted Brown", v: 2.8, p: "o", tag: "Libertarian" }, { n: "Undecided", v: 5.5, p: "o", tag: "" },
    ],
    leaned: "Talarico 50.4 to 45.9, +4.5",
  },
  {
    key: "gov", h: "Governor", lead: "Abbott +2.5", side: "r",
    cands: [
      { n: "Greg Abbott", v: 47.7, p: "r", tag: "Republican" }, { n: "Gina Hinojosa", v: 45.2, p: "d", tag: "Democrat" },
      { n: "Pat Dixon", v: 3.3, p: "o", tag: "Libertarian" }, { n: "Undecided", v: 3.8, p: "o", tag: "" },
    ],
    leaned: "Abbott 49.0 to 47.0, +2.0",
  },
  {
    key: "rrc", h: "Railroad Commissioner", lead: "French +5.3", side: "r",
    cands: [
      { n: "Bo French", v: 45.1, p: "r", tag: "Republican" }, { n: "Jon Rosenthal", v: 39.8, p: "d", tag: "Democrat" },
      { n: "Arthur DiBianca", v: 3.7, p: "o", tag: "Libertarian" }, { n: "Undecided", v: 11.3, p: "o", tag: "" },
    ],
    leaned: "French 49.4 to 44.8, +4.6",
  },
];

// [group, Talarico, Paxton, Hinojosa, Abbott], likely voters as asked
type Row = [string, number, number, number, number];
const AGE: Row[] = [["18 to 29", 74, 22, 64, 22], ["30 to 44", 61, 29, 56, 32], ["45 to 64", 41, 46, 39, 54], ["65 and older", 38, 58, 37, 62]];
const RACE: Row[] = [["Hispanic", 72, 19, 68, 21], ["Black", 75, 17, 69, 18], ["White, college degree", 40, 53, 37, 61], ["White, no college degree", 22, 69, 20, 75]];
const REGION: Row[] = [
  ["Harris County", 60, 38, 53, 37], ["Dallas and Tarrant", 54, 36, 52, 40], ["San Antonio and Hill Country", 64, 28, 62, 38],
  ["South Texas and the Border", 67, 25, 63, 29], ["Austin Metro", 45, 53, 42, 58], ["DFW Suburbs", 37, 44, 34, 51],
  ["Houston Suburbs and Southeast", 33, 58, 32, 67], ["Rural and Small Metro", 39, 56, 34, 60],
];
const METHOD: Row[] = [["Election Day, 52%", 49, 41, 45, 44], ["Early in person, 44%", 50, 45, 47, 51], ["By mail, 4%", 39, 52, 39, 60]];
const ISSUES: [string, number][] = [
  ["Guns and the Second Amendment", 11], ["Immigration and the border", 7], ["Crime and policing", 6], ["Healthcare and Social Security", -4],
  ["Corruption and lobbying", -6], ["Economy and cost of living", -11], ["Epstein files", -19],
];
const RATINGS: [string, number][] = [
  ["James Talarico", 13], ["Ted Cruz", 8], ["Gina Hinojosa", 7], ["Greg Abbott", 5], ["John Cornyn", 0], ["JD Vance", 0], ["Donald Trump", -4], ["Ken Paxton", -14],
];

const net = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "even");
const lead = (d: number, r: number) => (d === r ? "even" : d > r ? `D+${d - r}` : `R+${r - d}`);

function Bars({ cands }: { cands: Cand[] }) {
  return (
    <div className="txp-bars">
      {cands.map((c) => (
        <div key={c.n} className="txp-bar">
          <span className="nm">{c.n}{c.tag ? <small>{c.tag}</small> : null}</span>
          <span className="tr"><i className={c.p} style={{ width: `${(c.v / 60) * 100}%` }} /></span>
          <b className={`mono ${c.p}`}>{c.v.toFixed(1)}%</b>
        </div>
      ))}
    </div>
  );
}

/** two races side by side for each group: each pair is a split bar, Democrat from the left and Republican from the right */
function Pairs({ rows, caption }: { rows: Row[]; caption: string }) {
  const Split = ({ d, r }: { d: number; r: number }) => (
    <span className="sp" aria-hidden="true"><i className="d" style={{ width: `${d}%` }} /><i className="r" style={{ width: `${r}%` }} /></span>
  );
  return (
    <figure className="txp-pairs">
      <div className="txp-ph" aria-hidden="true"><span /><span>Senate, Talarico vs Paxton</span><span>Governor, Hinojosa vs Abbott</span></div>
      {rows.map(([g, td, tr, hd, ar]) => (
        <div key={g} className="txp-pr">
          <span className="g">{g}</span>
          <span className="c"><Split d={td} r={tr} /><b className={`mono ${td >= tr ? "d" : "r"}`}>{lead(td, tr)}</b><small className="mono">{td} to {tr}</small></span>
          <span className="c"><Split d={hd} r={ar} /><b className={`mono ${hd >= ar ? "d" : "r"}`}>{lead(hd, ar)}</b><small className="mono">{hd} to {ar}</small></span>
        </div>
      ))}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function NetBars({ rows, dom = 20, caption }: { rows: [string, number][]; dom?: number; caption: string }) {
  return (
    <figure className="txp-net">
      {rows.map(([n, v]) => (
        <div key={n} className="row">
          <span className="nm">{n}</span>
          <span className="ax"><span className="mid" />{v !== 0 ? <i className={v > 0 ? "pos" : "neg"} style={v > 0 ? { left: "50%", width: `${(v / dom) * 50}%` } : { right: "50%", width: `${(-v / dom) * 50}%` }} /> : null}</span>
          <b className={`mono ${v > 0 ? "pos" : v < 0 ? "neg" : ""}`}>{net(v)}</b>
        </div>
      ))}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function Stack({ parts, caption }: { parts: { l: string; v: number; c: string }[]; caption: string }) {
  return (
    <figure className="txp-stack">
      <span className="bar" aria-hidden="true">{parts.map((p) => <i key={p.l} className={p.c} style={{ width: `${p.v}%` }} />)}</span>
      <span className="leg">{parts.map((p) => <span key={p.l}><i className={p.c} />{p.l} <b className="mono">{p.v.toFixed(1)}%</b></span>)}</span>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export default function Page() {
  const ld = graph(
    crumbsLd([["Home", "/"], ["On Point Polling", "/on-point-polling"], ["Polls", "/on-point-polling/polls"], ["Texas 2026", PATH]]),
    {
      "@type": "NewsArticle",
      "@id": `${abs(PATH)}#article`,
      headline: TITLE,
      description: DEK,
      url: abs(PATH),
      datePublished: "2026-10-18T12:00:00-05:00",
      dateModified: "2026-10-18T12:00:00-05:00",
      author: { "@type": "Organization", name: SITE.publisher, url: abs("/on-point-polling") },
      publisher: { "@id": ORG_ID },
      isPartOf: { "@id": SITE_ID },
      image: [abs(`${PATH}/opengraph-image`)],
      about: ["2026 United States Senate election in Texas", "2026 Texas gubernatorial election", "2026 Texas Railroad Commissioner election", "Public opinion polling"],
      contentLocation: { "@type": "AdministrativeArea", name: "Texas" },
      sameAs: [SUBSTACK],
      inLanguage: "en-US",
    },
  );

  return (
    <div className="opp txp">
      <JsonLd data={ld} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span>
        <Link href="/on-point-polling/polls">Polls</Link><span className="sep">/</span><span>Texas 2026</span>
      </nav>
      <header className="ph">
        <div className="eye g">On Point Polling · Texas poll</div>
        <h1>Texas poll: Talarico leads Paxton as Abbott <em>holds on</em></h1>
        <p className="lede">{DEK}</p>
        <div className="pmeta">
          <span className="pill" style={{ background: "var(--glass2)", color: "var(--ink)" }}>Texas</span>
          <span>Registered voters <b className="mono">661</b></span>
          <span>Margin of error <b className="mono">±5.5 LV</b></span>
          <span>Field <b className="mono">Oct 17 to 18</b></span>
          <span>Released <b>October 18, 2026</b></span>
        </div>
      </header>

      <div className="layout">
        <div className="txp-main">
          <section className="txp-score" aria-label="Topline results">
            {RACES.map((r) => (
              <div key={r.key} className="card">
                <div className="card-h"><h3>{r.h}</h3><span className="eye" style={{ marginLeft: "auto" }}>Likely voters · as asked</span></div>
                <div className="card-b">
                  <div className={`txp-lead mono ${r.side}`}>{r.lead}</div>
                  <Bars cands={r.cands} />
                  <div className="kv" style={{ marginTop: 10 }}><span>With undecideds leaned</span><span>{r.leaned}</span></div>
                </div>
              </div>
            ))}
          </section>

          <article className="card txp-body">
            <div className="card-b">
              <h2>The topline</h2>
              <p>Texas voters are splitting their tickets in On Point Polling&apos;s October survey. James Talarico leads Ken Paxton by 5.8 points for U.S. Senate, while Greg Abbott leads Gina Hinojosa by 2.5 points for governor among likely voters. Down the ballot, Bo French leads Jon Rosenthal by 5.3 points for Railroad Commissioner. All three margins sit inside the margin of error.</p>
              <ul>
                <li><strong>Talarico +5.8</strong> over Paxton for U.S. Senate, +4.5 with undecideds leaned.</li>
                <li><strong>Abbott +2.5</strong> over Hinojosa for governor, +2.0 with undecideds leaned.</li>
                <li><strong>French +5.3</strong> over Rosenthal for Railroad Commissioner, +4.6 with undecideds leaned.</li>
                <li><strong>Crossover runs one way.</strong> 12% of 2024 Trump voters back Talarico, while only 2% of Harris voters back Paxton.</li>
                <li><strong>Paxton is the least popular name we tested,</strong> 41% approve to 55% disapprove.</li>
                <li><strong>Trump is 4 points underwater</strong> in a state he won by nearly 14.</li>
              </ul>
              <p>The same likely electorate that gives Abbott the edge for governor and French the lead for Railroad Commissioner puts Talarico ahead for Senate. The difference is Ken Paxton.</p>

              <h2>Senate: Paxton is the problem</h2>
              <p>Talarico leads Paxton 48.8% to 43.0% as asked. The 5.5% who are undecided lean 64 to 36 toward Paxton, which trims Talarico&apos;s lead to 4.5 points, 50.4% to 45.9%, but does not erase it.</p>
              <p>Talarico&apos;s lead rests on three things:</p>
              <ul>
                <li><strong>Crossover.</strong> 12% of 2024 Trump voters back Talarico and Paxton holds only 76% of them. Just 2% of Harris voters back Paxton.</li>
                <li><strong>Independents.</strong> Talarico leads independents 57% to 20%, a 37 point margin.</li>
                <li><strong>Younger voters.</strong> Talarico wins voters under 30 by 74% to 22% and voters 30 to 44 by 61% to 29%.</li>
              </ul>
              <p>Paxton&apos;s strength is where Republicans are always strong in Texas. He wins white voters without a college degree 69% to 22%, voters 65 and older 58% to 38%, and rural and small metro Texas by 17 points.</p>
              <p>The gender gap is modest. Talarico wins women 50% to 40% and edges men 48% to 46%. With undecideds leaned, men split evenly. Among all registered voters, Talarico&apos;s lead grows to 7.1 points.</p>

              <h2>Governor: Abbott holds on</h2>
              <p>Abbott leads Hinojosa 47.7% to 45.2% as asked. Here the undecided voters lean the other way, 58 to 42 toward Hinojosa, which trims Abbott&apos;s lead to 2.0 points, 49.0% to 47.0%.</p>
              <ul>
                <li><strong>Abbott holds his base.</strong> He wins 85% of Trump voters, 9 points more than Paxton, and loses only 8% of them to Hinojosa.</li>
                <li><strong>Hinojosa wins independents</strong> 52% to 31%, but that 21 point margin is 16 points smaller than Talarico&apos;s.</li>
                <li><strong>Abbott wins men</strong> 50% to 43%, while women split 47% Hinojosa to 46% Abbott.</li>
              </ul>
              <p>Both nominees are viewed favorably on balance. Hinojosa is at 50% approve to 43% disapprove, and Abbott is at 51% to 46%. The swing between the two statewide races is about 8 points on the margin, and much of it comes from Republicans and independents who will vote for Abbott but not for Paxton. Among all registered voters, Abbott leads by 2.4 points.</p>

              <h2>Railroad Commissioner: French leads a low information race</h2>
              <p>One in nine likely voters has not picked a candidate for Railroad Commissioner, the most of any race we tested. French leads Rosenthal 45.1% to 39.8% as asked. The undecided voters lean slightly toward Rosenthal, about 54 to 46, and with them allocated French leads 49.4% to 44.8%.</p>
              <p>This down ballot race tracks closer to party lines than the Senate race:</p>
              <ul>
                <li><strong>French holds 80% of Trump voters,</strong> and only 7% back Rosenthal.</li>
                <li><strong>Rosenthal wins 84% of Harris voters,</strong> 10 points fewer than Talarico, with more of them still undecided.</li>
                <li><strong>Rosenthal leads independents only 40% to 28%,</strong> and Hispanic voters 59% to 21%, well behind Talarico with both groups.</li>
              </ul>
              <p>French wins men 48% to 39% and voters 65 and older 58% to 31%. Rosenthal carries Harris County, Dallas and Tarrant, San Antonio and South Texas, while French runs up the margin in the Houston suburbs and rural Texas by about 30 points. Among all registered voters, French leads by 4.6 points.</p>

              <h2>Age, more than gender, splits Texas</h2>
              <p>The defining divide in this poll is age. Voters under 45 back both Democrats by wide margins, and voters 45 and older back both Republicans.</p>
              <Pairs rows={AGE} caption="Senate and governor by age, likely voters as asked. Blue from the left is the Democrat, red from the right the Republican." />
              <p>By race and education, Talarico runs ahead of Hinojosa in nearly every group. That is the Paxton effect at work.</p>
              <Pairs rows={RACE} caption="Senate and governor by race and education, likely voters as asked." />

              <h2>Where the race is being decided</h2>
              <p>The big urban counties, San Antonio and South Texas back the Democrats, while the suburban rings and rural Texas back the Republicans.</p>
              <Pairs rows={REGION} caption="Senate and governor by region, likely voters as asked. Regional samples are small, so read them as directional: Austin Metro rests on only 34 interviews and runs well to the right of its 2024 result, and South Texas runs to the left of its 2024 result." />

              <h2>Early voting opens Monday with the races close</h2>
              <p>Texas early in person voting opens October 19. Likely voters split almost evenly between voting early and voting on Election Day, and Talarico leads in both groups.</p>
              <Pairs rows={METHOD} caption="Senate and governor by how likely voters plan to vote, as asked. The mail group is only 24 interviews, mostly older voters, so read it with caution. About 3% of likely voters have already returned a mail ballot." />
              <p>Unlike Ohio, where Democrats have already banked a big early vote lead, almost no Texans have voted yet. Both races are wide open going into the first day of early voting.</p>

              <h2>Trump, the candidates and the issues</h2>
              <p>President Trump is 4 points underwater in a state he carried by nearly 14: 47% of likely voters approve, including 29% who strongly approve, and 51% disapprove, including 47% who strongly disapprove. He holds 87% of Republicans, but independents disapprove 69% to 26% and women disapprove 54% to 43%. Men approve 52% to 47%.</p>
              <p>Trump is above water on 6 of the 12 issues we tested, from guns and the Second Amendment at the top to the Epstein files at the bottom.</p>
              <NetBars rows={ISSUES} caption="Trump approval by issue, net approve minus disapprove, likely voters." />
              <p>That economy number matters most. The economy, jobs and the cost of living is the top issue for 40% of likely voters, more than twice the next issue, healthcare and Social Security at 16%. Immigration and the border is third at 15%.</p>
              <p><strong>How Texas rates the people on and around the ballot,</strong> by net approval among likely voters:</p>
              <NetBars rows={RATINGS} caption="Net approval of the candidates and leaders, likely voters." />
              <p>Talarico has the best image of anyone we tested and Paxton the worst, a 27 point gap between the two Senate nominees. Cornyn has the most voters with no opinion, 14%.</p>
              <p><strong>Data centers are a sleeper issue.</strong> 55% of likely voters disapprove of the large data centers being built across Texas, including 34% who strongly disapprove, and 37% approve. Opposition is broad: 69% of Democrats, 66% of independents and 59% of women disapprove, and men disapprove 50% to 46%. Republicans are the only group where approval leads, 52% to 41%.</p>

              <h2>This is not a Democratic sample</h2>
              <p>The likely electorate in this poll leans Republican by double digits.</p>
              <Stack parts={[{ l: "Republican", v: 48.0, c: "r" }, { l: "Democrat", v: 37.0, c: "d" }, { l: "Independent", v: 15.0, c: "o" }]} caption="Party identification of likely voters, R+11." />
              <Stack parts={[{ l: "Trump", v: 53.8, c: "r" }, { l: "Harris", v: 42.5, c: "d" }, { l: "Other or did not vote", v: 3.7, c: "o" }]} caption="2024 vote of likely voters, Trump +11, close to his actual 13.7 point win." />
              <p>So Talarico&apos;s lead is not a story about the sample. It is a story about Republicans crossing over against Paxton, independents breaking toward the Democrat, and younger Texans lining up behind Talarico.</p>
              <p>Our model projects turnout of about 9.2 million, roughly 48% of registered voters, and 91% of likely voters say they are certain to vote. Hispanic voters are 27% of the likely electorate, and a third of likely voters are 65 or older.</p>
              <p>With early voting starting Monday, all three statewide races are within the margin of error. Abbott and French are running like Republicans usually run in Texas. Paxton is not, and that is why the Senate race is the one to watch.</p>
            </div>
          </article>

          <section className="card" aria-labelledby="txp-method">
            <div className="card-h"><h3 id="txp-method">Methodology</h3><span className="eye" style={{ marginLeft: "auto" }}>On Point Polling</span></div>
            <div className="card-b txp-method">
              <p>On Point Polling surveyed 661 Texas registered voters online from October 17 to 18, 2026, with quotas on age, gender, Hispanic origin and where respondents live. Respondents who rushed through the survey, live outside Texas or took the survey twice were removed.</p>
              <p>Results are weighted to Texas voter file benchmarks by age by gender, race by education, race by gender, gender by education and 8 regions, with White, Hispanic, Black and Asian or other voters weighted separately. Among respondents who voted in 2024, results are also weighted to the certified 2024 result, Trump by 13.7 points. The share who did not vote in 2024 is left as reported, and the likely voter screen decides 2026 turnout.</p>
              <p>Likely voters are identified by their stated intention to vote, how they plan to vote, how many of their close contacts will vote and their past voting history. Undecided voters are allocated based on how decided voters with similar views and backgrounds plan to vote, and a small share is left undecided. Respondents who said they had already voted early in person before Texas early voting opened on October 19 were counted as planning to vote early.</p>
              <p>The margin of error is ±5.5 points for likely voters and ±4.2 points for registered voters, adjusted for weighting. Results for subgroups carry a larger margin of error.</p>
              <p>The full release, with every chart and the crosstabs for likely and registered voters, is on <a href={SUBSTACK} target="_blank" rel="noopener" style={{ textDecoration: "underline" }}>On Point Polling&apos;s Substack</a>.</p>
            </div>
          </section>
        </div>

        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>At a glance</h3></div>
            <div className="card-b" style={{ paddingBlock: 6 }}>
              <div className="kv"><span>Senate, as asked</span><span className="d">Talarico +5.8</span></div>
              <div className="kv"><span>Governor, as asked</span><span className="r">Abbott +2.5</span></div>
              <div className="kv"><span>Railroad Commissioner</span><span className="r">French +5.3</span></div>
              <div className="kv"><span>Trump approval</span><span>47 / 51</span></div>
              <div className="kv"><span>Sample</span><span>661 RV</span></div>
              <div className="kv"><span>Margin of error</span><span>±5.5 LV · ±4.2 RV</span></div>
              <div className="kv"><span>Field dates</span><span>Oct 17 to 18</span></div>
              <div className="kv"><span>Mode</span><span>Online</span></div>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Texas on On Point</h3></div>
            <div className="card-b txp-links">
              <Link href="/forecast/tx/senate">Texas Senate forecast</Link>
              <Link href="/forecast/tx/governor">Texas governor forecast</Link>
              <Link href="/forecast/statewide/tx/railroad-commissioner">Railroad Commissioner forecast</Link>
              <Link href="/polls/tx/senate">Texas Senate polling average</Link>
              <Link href="/polls/tx/governor">Texas governor polling average</Link>
              <Link href="/maps/early-vote">Early vote tracker</Link>
            </div>
          </div>
          <div className="card"><div className="card-b">
            <div className="eye">Commission a poll</div>
            <p style={{ fontSize: 14, margin: "8px 0 12px" }}>Statewide, district or national polling with full crosstabs, in days, not weeks.</p>
            <Link className="btn g" href="/on-point-polling/services">Partner with On Point Polling</Link>
          </div></div>
          <div className="callout"><div className="eye">All releases</div>Every On Point Polling survey is on the <Link href="/on-point-polling/polls" style={{ textDecoration: "underline" }}>poll releases page</Link>.</div>
        </aside>
      </div>

      <style>{`
        .opp .txp-main { display: grid; gap: 16px; min-width: 0; }
        .opp .txp-score { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        @media (max-width: 1100px) { .opp .txp-score { grid-template-columns: 1fr; } }
        .opp .txp-lead { font: 800 32px/1 var(--font-d); letter-spacing: -.03em; margin-bottom: 14px; }
        .opp.txp .d { color: var(--dem2); } .opp.txp .r { color: var(--gop2); } .opp.txp .o { color: var(--mute); }
        .opp .txp-bars { display: grid; gap: 8px; }
        .opp .txp-bar { display: grid; grid-template-columns: minmax(0, 128px) minmax(0, 1fr) 54px; gap: 10px; align-items: center; font-size: 13px; }
        .opp .txp-bar .nm { display: grid; color: var(--ink); font-weight: 600; line-height: 1.2; }
        .opp .txp-bar .nm small { font: 600 10px var(--font-m); letter-spacing: .08em; text-transform: uppercase; color: var(--mute); }
        .opp .txp-bar .tr { height: 10px; border-radius: 99px; background: rgba(var(--line-rgb), .07); overflow: hidden; }
        .opp .txp-bar .tr i { display: block; height: 100%; border-radius: 99px; }
        .opp.txp i.d { background: var(--dem); } .opp.txp i.r { background: var(--gop); } .opp.txp i.o { background: var(--mute2, #6f6884); }
        .opp .txp-bar b { text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; }
        .opp .txp-body .card-b { display: grid; gap: 16px; font-size: 15.5px; line-height: 1.7; color: var(--ink2); padding: 24px 26px 30px; }
        .opp .txp-body h2 { font: 800 clamp(20px, 2.2vw, 26px)/1.2 var(--font-d); letter-spacing: -.02em; color: var(--hi); margin: 14px 0 0; text-wrap: balance; }
        .opp .txp-body h2:first-child { margin-top: 0; }
        .opp .txp-body p { margin: 0; text-wrap: pretty; max-width: 74ch; }
        .opp .txp-body h2, .opp .txp-body ul { max-width: 74ch; }
        .opp .txp-body strong { color: var(--ink); }
        .opp .txp-body ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; list-style: disc; }
        .opp .txp-body figure { margin: 4px 0; display: grid; gap: 8px; min-width: 0; }
        .opp .txp-body figcaption { font-size: 13px; color: var(--mute); line-height: 1.5; max-width: 74ch; }
        .opp .txp-pairs { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; background: var(--glass); }
        .opp .txp-ph, .opp .txp-pr { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(0, 1.4fr) minmax(0, 1.4fr); gap: 14px; align-items: center; }
        .opp .txp-ph { font: 700 10px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--mute); padding-bottom: 6px; border-bottom: 1px solid var(--line); }
        .opp .txp-pr { padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; }
        .opp .txp-pr:last-of-type { border-bottom: 0; }
        .opp .txp-pr .g { color: var(--ink); font-weight: 600; line-height: 1.3; }
        .opp .txp-pr .c { display: grid; grid-template-columns: minmax(40px, 1fr) 48px 62px; gap: 8px; align-items: center; min-width: 0; }
        .opp .txp-pr .c b { font-size: 12.5px; text-align: right; }
        .opp .txp-pr .c small { font-size: 11px; color: var(--mute); text-align: right; white-space: nowrap; }
        .opp .txp-pr .sp { position: relative; height: 10px; border-radius: 99px; background: rgba(var(--line-rgb), .08); overflow: hidden; }
        .opp .txp-pr .sp i { position: absolute; top: 0; bottom: 0; }
        .opp .txp-pr .sp i.d { left: 0; } .opp .txp-pr .sp i.r { right: 0; }
        .opp .txp-net { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; background: var(--glass); }
        .opp .txp-net .row { display: grid; grid-template-columns: minmax(130px, 1.2fr) minmax(0, 1.4fr) 48px; gap: 12px; align-items: center; font-size: 13.5px; padding: 5px 0; }
        .opp .txp-net .nm { color: var(--ink); }
        .opp .txp-net .ax { position: relative; height: 10px; border-radius: 99px; background: rgba(var(--line-rgb), .07); }
        .opp .txp-net .ax .mid { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--line2); }
        .opp .txp-net .ax i { position: absolute; top: 0; bottom: 0; border-radius: 99px; }
        .opp .txp-net i.pos { background: #2fbf9b; } .opp .txp-net i.neg { background: #e8794a; }
        .opp .txp-net b { text-align: right; font-size: 13px; }
        .opp .txp-net b.pos { color: #2fbf9b; } .opp .txp-net b.neg { color: #e8794a; }
        .opp .txp-stack .bar { display: flex; height: 14px; border-radius: 99px; overflow: hidden; }
        .opp .txp-stack .bar i { display: block; height: 100%; }
        .opp .txp-stack .leg { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; color: var(--ink); }
        .opp .txp-stack .leg i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
        .opp .txp-method { display: grid; gap: 12px; font-size: 14px; line-height: 1.65; color: var(--ink2); }
        .opp .txp-method p { margin: 0; }
        .opp .txp-links { display: grid; gap: 2px; padding-block: 8px; }
        .opp .txp-links a { padding: 8px 0; border-top: 1px solid var(--line); font-size: 14px; color: var(--ink); text-decoration: none; }
        .opp .txp-links a:first-child { border-top: 0; }
        .opp .txp-links a:hover { color: var(--hi); text-decoration: underline; }
        @media (max-width: 700px) {
          .opp .txp-ph { display: none; }
          .opp .txp-pr { grid-template-columns: 1fr; gap: 4px; }
          .opp .txp-pr .c::before { font: 700 10px var(--font-m); letter-spacing: .08em; text-transform: uppercase; color: var(--mute); grid-column: 1 / -1; }
          .opp .txp-pr .c:nth-child(2)::before { content: "Senate"; } .opp .txp-pr .c:nth-child(3)::before { content: "Governor"; }
          .opp .txp-net .row { grid-template-columns: 1fr 48px; } .opp .txp-net .ax { grid-column: 1 / -1; grid-row: 2; }
        }
        @media (max-width: 600px) { .opp .txp-body .card-b { padding: 18px 16px 22px; font-size: 15px; } .opp .txp-bar { grid-template-columns: minmax(0, 110px) minmax(0, 1fr) 50px; } }
      `}</style>
    </div>
  );
}
