import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, ORG_ID, SITE, SITE_ID, abs, seo } from "@/app/lib/seo";

const PATH = "/on-point-polling/polls/ohio-2026";
const IMG = "/on-point-polling/polls/ohio-2026";
const TITLE = "Ohio poll: Democrats lead both races as early voters bank their edge";
const DEK = "Brown leads Husted by 4.3 and Acton leads Ramaswamy by 4.8 among likely voters. Both leads are inside the margin of error, and Election Day still leans Republican.";

export const metadata: Metadata = seo({
  title: "Ohio poll October 2026: Brown vs Husted, Acton vs Ramaswamy",
  description: `On Point Polling's Ohio survey of 635 likely voters, October 16 to 17, 2026: Sherrod Brown 46.6%, Jon Husted 42.3% for Senate; Amy Acton 47.9%, Vivek Ramaswamy 43.1% for governor. Early vote, regions, Trump approval and data centers.`,
  path: PATH,
  type: "article",
  published: "2026-10-17T12:00:00-04:00",
  modified: "2026-10-17",
  keywords: ["Ohio poll", "Ohio Senate poll 2026", "Ohio governor poll 2026", "Sherrod Brown", "Jon Husted", "Amy Acton", "Vivek Ramaswamy", "On Point Polling"],
  ownImage: true,
});

type Cand = { n: string; v: number; p: "d" | "r" | "o"; tag: string };
const RACES: { key: string; h: string; lead: string; cands: Cand[]; leaned: string; img: string }[] = [
  {
    key: "sen", h: "U.S. Senate", lead: "Brown +4.3",
    cands: [
      { n: "Sherrod Brown", v: 46.6, p: "d", tag: "Democrat" }, { n: "Jon Husted", v: 42.3, p: "r", tag: "Republican" },
      { n: "William Redpath", v: 3.4, p: "o", tag: "Libertarian" }, { n: "Greg Levy", v: 2.2, p: "o", tag: "Other party" },
      { n: "Undecided", v: 5.6, p: "o", tag: "" },
    ],
    leaned: "Brown 48.4 to 44.8, +3.6", img: "01_senate.jpg",
  },
  {
    key: "gov", h: "Governor", lead: "Acton +4.8",
    cands: [
      { n: "Amy Acton", v: 47.9, p: "d", tag: "Democrat" }, { n: "Vivek Ramaswamy", v: 43.1, p: "r", tag: "Republican" },
      { n: "Don Kissick", v: 4.2, p: "o", tag: "Third party" }, { n: "Undecided", v: 4.8, p: "o", tag: "" },
    ],
    leaned: "Acton 49.2 to 45.7, +3.5", img: "02_governor.jpg",
  },
];

const RATINGS: [string, number][] = [
  ["Mike DeWine, governor", 7], ["Amy Acton", 6], ["JD Vance", 1], ["Sherrod Brown", 0], ["Vivek Ramaswamy", -3], ["Jon Husted", -7], ["Donald Trump", -9],
];

function Fig({ src, alt, cap, h = 1350 }: { src: string; alt: string; cap: string; h?: number }) {
  return (
    <figure className="ohp-fig">
      <Image src={`${IMG}/${src}`} alt={alt} width={2400} height={h} sizes="(max-width: 960px) 100vw, 900px" />
      <figcaption>{cap}</figcaption>
    </figure>
  );
}

export default function Page() {
  const ld = graph(
    crumbsLd([["Home", "/"], ["On Point Polling", "/on-point-polling"], ["Polls", "/on-point-polling/polls"], ["Ohio 2026", PATH]]),
    {
      "@type": "NewsArticle",
      "@id": `${abs(PATH)}#article`,
      headline: TITLE,
      description: DEK,
      url: abs(PATH),
      datePublished: "2026-10-17T12:00:00-04:00",
      dateModified: "2026-10-17T12:00:00-04:00",
      author: { "@type": "Organization", name: SITE.publisher, url: abs("/on-point-polling") },
      publisher: { "@id": ORG_ID },
      isPartOf: { "@id": SITE_ID },
      image: [abs(`${IMG}/01_senate.jpg`), abs(`${IMG}/02_governor.jpg`), abs(`${IMG}/county_map.jpg`)],
      about: ["2026 Ohio United States Senate election", "2026 Ohio gubernatorial election", "Public opinion polling"],
      contentLocation: { "@type": "AdministrativeArea", name: "Ohio" },
      inLanguage: "en-US",
    },
  );

  return (
    <div className="opp ohp">
      <JsonLd data={ld} />
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/on-point-polling">On Point Polling</Link><span className="sep">/</span>
        <Link href="/on-point-polling/polls">Polls</Link><span className="sep">/</span><span>Ohio 2026</span>
      </nav>
      <header className="ph">
        <div className="eye g">On Point Polling · Ohio poll</div>
        <h1>Ohio poll: Democrats lead both races as early voters <em>bank their edge</em></h1>
        <p className="lede">{DEK}</p>
        <div className="pmeta">
          <span className="pill" style={{ background: "var(--glass2)", color: "var(--ink)" }}>Ohio</span>
          <span>Likely voters <b className="mono">635</b></span>
          <span>Margin of error <b className="mono">±4.9</b></span>
          <span>Field <b className="mono">Oct 16 to 17</b></span>
          <span>Released <b>October 17, 2026</b></span>
        </div>
      </header>

      <div className="layout">
        <div className="ohp-main">
          <section className="ohp-score" aria-label="Topline results">
            {RACES.map((r) => (
              <div key={r.key} className="card">
                <div className="card-h"><h3>{r.h}</h3><span className="eye" style={{ marginLeft: "auto" }}>Likely voters · as asked</span></div>
                <div className="card-b">
                  <div className="ohp-lead d mono">{r.lead}</div>
                  <div className="ohp-bars">
                    {r.cands.map((c) => (
                      <div key={c.n} className="ohp-bar">
                        <span className="nm">{c.n}{c.tag ? <small>{c.tag}</small> : null}</span>
                        <span className="tr"><i className={c.p} style={{ width: `${(c.v / 60) * 100}%` }} /></span>
                        <b className={`mono ${c.p}`}>{c.v.toFixed(1)}%</b>
                      </div>
                    ))}
                  </div>
                  <div className="kv" style={{ marginTop: 10 }}><span>With undecideds leaned</span><span>{r.leaned}</span></div>
                </div>
              </div>
            ))}
          </section>

          <article className="card ohp-body">
            <div className="card-b">
              <h2>The topline</h2>
              <p>Democrats lead both of Ohio&apos;s marquee races in On Point Polling&apos;s final October survey, but both leads sit inside the margin of error. Sherrod Brown leads Jon Husted by 4.3 points for U.S. Senate, and Amy Acton leads Vivek Ramaswamy by 4.8 points for governor among likely voters.</p>
              <p><strong>U.S. Senate, likely voters</strong></p>
              <ul>
                <li>As asked: Brown 46.6%, Husted 42.3%, Redpath 3.4%, Levy 2.2%, undecided 5.6%. <strong>Brown +4.3</strong></li>
                <li>Undecideds leaned: Brown 48.4%, Husted 44.8%, Redpath 3.5%, Levy 2.4%, undecided 0.9%. <strong>Brown +3.6</strong></li>
              </ul>
              <p><strong>Governor, likely voters</strong></p>
              <ul>
                <li>As asked: Acton 47.9%, Ramaswamy 43.1%, Kissick 4.2%, undecided 4.8%. <strong>Acton +4.8</strong></li>
                <li>Undecideds leaned: Acton 49.2%, Ramaswamy 45.7%, Kissick 4.3%, undecided 0.8%. <strong>Acton +3.5</strong></li>
              </ul>
              <p>We surveyed 635 Ohio likely voters online from October 16 to 17, 2026. The margin of error is ±4.9 points for likely voters.</p>
              <p>The short version: this is a close race in a state Donald Trump won by 11 points, and the Democrats are ahead because they are winning independents, drawing more crossover votes and banking a big lead among Ohioans who have already voted.</p>
              <Fig src="01_senate.jpg" alt="Ohio U.S. Senate ballot among likely voters as asked: Brown 46.6, Husted 42.3, Redpath 3.4, Levy 2.2, undecided 5.6" cap="U.S. Senate ballot, likely voters, as asked." />
              <Fig src="02_governor.jpg" alt="Ohio governor ballot among likely voters as asked: Acton 47.9, Ramaswamy 43.1, Kissick 4.2, undecided 4.8" cap="Governor ballot, likely voters, as asked." />

              <h2>Senate: Brown holds a narrow edge</h2>
              <p>Brown leads Husted 46.6% to 42.3% as asked. When we allocate the 5.6% who are undecided, they break 58 to 42 toward Husted, which trims Brown&apos;s lead to 3.6 points but does not erase it.</p>
              <p>Brown&apos;s coalition rests on three pillars:</p>
              <ul>
                <li><strong>Women.</strong> Brown wins women 50% to 38%, while Husted carries men 47% to 43%.</li>
                <li><strong>Independents.</strong> Brown leads independents 49% to 27%, a 22 point margin.</li>
                <li><strong>Crossover.</strong> 8% of 2024 Trump voters back Brown, while only 3% of Harris voters back Husted.</li>
              </ul>
              <p>Husted&apos;s strength is where Republicans are always strong: he leads white voters without a college degree 49% to 39% and wins rural Ohio by 14 points.</p>
              <p>The youngest voters are the least settled. Brown leads voters under 30 by 46% to 21%, but a quarter of them are still undecided.</p>
              <p>Among all registered voters, Brown&apos;s lead grows to 6.8 points. The likely voter screen narrows the race, as it usually does for Democrats in Ohio.</p>
              <Fig src="01b_senate_leaned.jpg" alt="Ohio U.S. Senate with undecideds leaned: Brown 48.4, Husted 44.8, Brown plus 3.6" cap="U.S. Senate with undecided voters allocated." />

              <h2>Governor: Acton leads, Ramaswamy has more room to grow</h2>
              <p>Acton leads Ramaswamy 47.9% to 43.1% as asked. The governor&apos;s race has the sharpest undecided break in the poll: undecided voters lean 67 to 33 toward Ramaswamy, mostly because of how they rate Acton, Ramaswamy and Trump. With them allocated, Acton still leads by 3.5 points.</p>
              <ul>
                <li><strong>The gender gap is wider here.</strong> Acton wins women 54% to 37%, while Ramaswamy wins men 49% to 42%.</li>
                <li><strong>Independents favor Acton</strong> 48% to 30%.</li>
                <li><strong>Crossover runs her way.</strong> 12% of Trump voters back Acton, more than back Brown, while 5% of Harris voters back Ramaswamy.</li>
              </ul>
              <p>Acton is also the better known and better liked of the two. She is the only one of the four nominees with a net positive rating, 50% approve to 44% disapprove. Ramaswamy is at 45% to 48%, and 8% of likely voters have no opinion of him, the most of anyone we tested.</p>
              <p>Among all registered voters, Acton leads by 4.9 points.</p>
              <Fig src="02b_governor_leaned.jpg" alt="Ohio governor with undecideds leaned: Acton 49.2, Ramaswamy 45.7, Acton plus 3.5" cap="Governor with undecided voters allocated." />

              <h2>The early vote: Democrats are banking a lead</h2>
              <p>One in five Ohio likely voters says they have already cast a ballot, and that group backs the Democrats by nearly 40 points. Brown leads 66% to 29% among those who have voted, and Acton leads 68% to 30%.</p>
              <p>Broken down by how Ohioans are voting, counting ballots already cast:</p>
              <ul>
                <li><strong>By mail, 15% of likely voters.</strong> Brown 61%, Husted 36%. Acton 60%, Ramaswamy 34%. Three in four of these voters have already returned their ballot.</li>
                <li><strong>Early in person, 16%.</strong> Brown 58%, Husted 35%. Acton 62%, Ramaswamy 35%. More than half have already voted.</li>
                <li><strong>Election Day, 69%.</strong> Husted 45%, Brown 41%. Ramaswamy 47%, Acton 43%.</li>
              </ul>
              <Fig src="06_vote_method.jpg" alt="Ballots by vote method: mail voters Brown 61 Husted 36 and Acton 60 Ramaswamy 34; early in person Brown 58 Husted 35 and Acton 62 Ramaswamy 35; Election Day Husted 45 Brown 41 and Ramaswamy 47 Acton 43" cap="Ballots by vote method, as asked. Ballots already cast count toward the method used." />
              <p>The Republicans win Election Day voters, but only by 4 points in both races. Among the 80% who have not voted yet, Husted leads 46% to 42% and Ramaswamy leads 46% to 43%.</p>
              <p>That is the math Republicans have to solve. To overcome the votes Democrats have already banked, Husted and Ramaswamy need Election Day turnout that is both bigger and more lopsided than what we measure now.</p>

              <h2>Where the race is being decided</h2>
              <p>The suburbs are a dead heat, and that is where Ohio will be won. Voters in suburban ZIP codes, more than half the electorate, split 45% Husted to 44% Brown and 46% to 46% for governor.</p>
              <p>The rest of the map looks like Ohio usually does:</p>
              <ul>
                <li><strong>Cleveland area:</strong> Brown 51% to 36%. Acton 61% to 34%.</li>
                <li><strong>North:</strong> Brown 55% to 35%. Acton 54% to 38%.</li>
                <li><strong>Cincinnati and Dayton:</strong> Brown 49% to 41%. Acton 51% to 40%.</li>
                <li><strong>Columbus area:</strong> Brown 44% to 41%. Acton and Ramaswamy tied at 42%.</li>
                <li><strong>Ohio Valley:</strong> Husted 55% to 37%. Ramaswamy 62% to 37%.</li>
                <li><strong>West:</strong> Husted 59% to 29%. Ramaswamy 59% to 29%.</li>
              </ul>
              <p>By type of place, Democrats win city ZIP codes by more than 45 points, while Republicans win rural Ohio by 14 points for Senate and 16 for governor.</p>
              <Fig src="county_map.jpg" h={1740} alt="Ohio county maps of the Senate and governor races with undecideds leaned, with results for six regions below each map" cap="Likely voters by county with undecideds leaned. Individual counties rest on only a few interviews each, so read the regions, not single counties." />

              <h2>Trump, the candidates and the issues</h2>
              <p>President Trump is 9 points underwater in a state he carried comfortably. 45% of Ohio likely voters approve of his job performance and 54% disapprove, including 47% who strongly disapprove. He holds 85% of Republicans, but independents disapprove 68% to 29%.</p>
              <Fig src="03_trump.jpg" alt="Trump job approval among Ohio likely voters: 45 approve, 54 disapprove" cap="Trump job approval, likely voters." />
              <p>On the issues, Trump is above water on only 2 of the 12 we tested:</p>
              <ul>
                <li><strong>Best:</strong> immigration and the border, +6, and guns and the Second Amendment, +5.</li>
                <li><strong>Worst:</strong> the Epstein files, −25, Iran and Operation Epic Fury, −21, and the economy and cost of living, −19.</li>
              </ul>
              <Fig src="07_trump_issues.jpg" alt="Trump approval on 12 issues among Ohio likely voters, net from plus 6 on immigration to minus 25 on the Epstein files" cap="Trump approval by issue, ranked by net approval." />
              <p>That last one matters most. The economy, jobs and cost of living is the top issue for 39% of likely voters, more than twice the next issue, healthcare and Social Security at 18%.</p>
              <p><strong>How Ohio rates the people on and around the ballot,</strong> by net approval:</p>
              <div className="ohp-rank">
                {RATINGS.map(([n, v]) => (
                  <div key={n} className="kv"><span>{n}</span><span className={v > 0 ? "pos" : v < 0 ? "neg" : ""}>{v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "even"}</span></div>
                ))}
              </div>
              <p>Husted carries the weakest image of the four nominees, which helps explain why Brown leads despite Ohio&apos;s Republican lean.</p>
              <Fig src="04_approval_people.jpg" alt="Approval of Ohio candidates and leaders among likely voters, ranked by net approval" cap="Approval of the candidates and leaders, likely voters." />
              <p><strong>Data centers are a sleeper issue.</strong> 58% of likely voters disapprove of the large data centers being built across Ohio, and only 33% approve. Opposition is broad: 73% of independents, 68% of women and 59% of rural voters disapprove. Republicans are the only group where approval leads, 50% to 37%.</p>
              <Fig src="05_data_centers.jpg" alt="Ohio likely voters on large data centers: 58 disapprove, 33 approve" cap="Views of large data centers being built in Ohio, likely voters." />

              <h2>This is not a Democratic sample</h2>
              <p>The likely electorate in this poll leans Republican. 43.6% identify as Republicans, 36.0% as Democrats and 20.4% as independents, an R+7.6 electorate. They recall voting for Trump over Harris 52.9% to 43.8% in 2024, close to his actual 11 point win, even though we did not weight by recall vote.</p>
              <p>So the Democratic leads are not a story about the sample. They are a story about independents breaking left, Republicans crossing over at higher rates than Democrats, and Democrats getting their voters to the polls early.</p>
              <p>Turnout looks strong. 89% of likely voters say they are certain to vote, and our model implies turnout of about 66% of registered voters.</p>
              <p>With 17 days to go, both races are within the margin of error. Ohio Republicans still have a path, but it runs through a big, lopsided Election Day, and right now Democrats are building a lead before that day arrives.</p>
            </div>
          </article>

          <section className="card" aria-labelledby="ohp-method">
            <div className="card-h"><h3 id="ohp-method">Methodology</h3><span className="eye" style={{ marginLeft: "auto" }}>On Point Polling</span></div>
            <div className="card-b ohp-method">
              <p>On Point Polling surveyed 635 Ohio registered voters online from October 16 to 17, 2026, with quotas on age, gender and where respondents live. Respondents who rushed through the survey or live outside Ohio were removed.</p>
              <p>Results are weighted to match Ohio registered voters by age, gender, race, education and region. We did not weight by 2024 recall vote, so how respondents say they voted between Trump and Harris is left as reported. Likely voters are identified by their stated intention to vote, how they plan to vote and their past voting history. Undecided voters are allocated based on how decided voters with similar views and backgrounds plan to vote, and a small share is left undecided.</p>
              <p>The margin of error is ±4.9 points for likely voters and ±4.2 points for registered voters, adjusted for weighting. Results for subgroups carry a larger margin of error.</p>
              <p>Full crosstabs for likely and registered voters are available on <Link href="/contact" style={{ textDecoration: "underline" }}>request</Link>.</p>
            </div>
          </section>
        </div>

        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>At a glance</h3></div>
            <div className="card-b" style={{ paddingBlock: 6 }}>
              <div className="kv"><span>Senate, as asked</span><span className="d">Brown +4.3</span></div>
              <div className="kv"><span>Governor, as asked</span><span className="d">Acton +4.8</span></div>
              <div className="kv"><span>Trump approval</span><span>45 / 54</span></div>
              <div className="kv"><span>Already voted</span><span>1 in 5</span></div>
              <div className="kv"><span>Sample</span><span>635 LV</span></div>
              <div className="kv"><span>Margin of error</span><span>±4.9 LV · ±4.2 RV</span></div>
              <div className="kv"><span>Field dates</span><span>Oct 16 to 17</span></div>
              <div className="kv"><span>Mode</span><span>Online</span></div>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Ohio on On Point</h3></div>
            <div className="card-b ohp-links">
              <Link href="/forecast/oh/senate">Ohio Senate forecast</Link>
              <Link href="/forecast/oh/governor">Ohio governor forecast</Link>
              <Link href="/polls/oh/senate">Ohio Senate polling average</Link>
              <Link href="/polls/oh/governor">Ohio governor polling average</Link>
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
        .opp .ohp-main { display: grid; gap: 16px; min-width: 0; }
        .opp .ohp-score { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        @media (max-width: 700px) { .opp .ohp-score { grid-template-columns: 1fr; } }
        .opp .ohp-lead { font: 800 34px/1 var(--font-d); letter-spacing: -.03em; margin-bottom: 14px; }
        .opp.ohp .d { color: var(--dem2); } .opp.ohp .r { color: var(--gop2); } .opp.ohp .o { color: var(--mute); }
        .opp .ohp-bars { display: grid; gap: 8px; }
        .opp .ohp-bar { display: grid; grid-template-columns: minmax(0, 132px) minmax(0, 1fr) 54px; gap: 10px; align-items: center; font-size: 13px; }
        .opp .ohp-bar .nm { display: grid; color: var(--ink); font-weight: 600; line-height: 1.2; }
        .opp .ohp-bar .nm small { font: 600 10px var(--font-m); letter-spacing: .08em; text-transform: uppercase; color: var(--mute); }
        .opp .ohp-bar .tr { height: 10px; border-radius: 99px; background: rgba(var(--line-rgb), .07); overflow: hidden; }
        .opp .ohp-bar .tr i { display: block; height: 100%; border-radius: 99px; }
        .opp .ohp-bar .tr i.d { background: var(--dem); } .opp .ohp-bar .tr i.r { background: var(--gop); } .opp .ohp-bar .tr i.o { background: var(--mute2, #6f6884); }
        .opp .ohp-bar b { text-align: right; font-size: 13px; font-variant-numeric: tabular-nums; }
        .opp .ohp-body .card-b { display: grid; gap: 16px; font-size: 15.5px; line-height: 1.7; color: var(--ink2); padding: 24px 26px 30px; }
        .opp .ohp-body h2 { font: 800 clamp(20px, 2.2vw, 26px)/1.2 var(--font-d); letter-spacing: -.02em; color: var(--hi); margin: 14px 0 0; text-wrap: balance; }
        .opp .ohp-body h2:first-child { margin-top: 0; }
        .opp .ohp-body p { margin: 0; text-wrap: pretty; max-width: 74ch; }
        .opp .ohp-body h2, .opp .ohp-body ul, .opp .ohp-rank { max-width: 74ch; }
        .opp .ohp-body strong { color: var(--ink); }
        .opp .ohp-body ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; list-style: disc; }
        .opp .ohp-body li { padding: 0; margin: 0; }
        .opp .ohp-fig { margin: 6px 0; display: grid; gap: 8px; }
        .opp .ohp-fig img { width: 100%; height: auto; display: block; border-radius: 12px; border: 1px solid var(--line); }
        .opp .ohp-fig figcaption { font-size: 13px; color: var(--mute); line-height: 1.5; }
        .opp .ohp-rank { border-top: 1px solid var(--line); }
        .opp .ohp-rank .kv { font-size: 14px; border-top: 0; border-bottom: 1px solid var(--line); }
        .opp .ohp-rank .pos { color: #2fbf9b; } .opp .ohp-rank .neg { color: #e8794a; }
        .opp .ohp-method { display: grid; gap: 12px; font-size: 14px; line-height: 1.65; color: var(--ink2); }
        .opp .ohp-method p { margin: 0; }
        .opp .ohp-links { display: grid; gap: 2px; padding-block: 8px; }
        .opp .ohp-links a { padding: 8px 0; border-top: 1px solid var(--line); font-size: 14px; color: var(--ink); text-decoration: none; }
        .opp .ohp-links a:first-child { border-top: 0; }
        .opp .ohp-links a:hover { color: var(--hi); text-decoration: underline; }
        @media (max-width: 600px) { .opp .ohp-body .card-b { padding: 18px 16px 22px; font-size: 15px; } .opp .ohp-bar { grid-template-columns: minmax(0, 110px) minmax(0, 1fr) 50px; } }
      `}</style>
    </div>
  );
}
