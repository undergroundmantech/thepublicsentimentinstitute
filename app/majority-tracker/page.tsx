import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, isoDay, pageLd, seo } from "@/app/lib/seo";
import { CAND, NEWS, NEXT, SENATORS, SWING, TIER, UPDATED, VOTE_DATE, tally } from "./data";
import Roster from "./Roster";
import Chamber from "./Chamber";
import Toon from "./Toon";
import "./tracker.css";
import AdUnit from "@/app/components/AdUnit";
import StayConnected from "@/app/components/StayConnected";

// rebuilt every hour, so the countdown and the tally stay current between updates
export const revalidate = 3600;

const day = (d: string, y = true) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", ...(y ? { year: "numeric" } : {}) });
const T = tally();
const DESC = `Who has the votes to lead Senate Democrats? Live whip count of the ${day(VOTE_DATE)} Senate Democratic leader election, Chuck Schumer vs Chris Van Hollen: all ${T.caucus} members of the incoming caucus, their stated and reported positions and On Point Politics' estimate for everyone else.`;

export const metadata: Metadata = seo({
  title: "Schumer vs Van Hollen whip count: Senate Democratic leader race",
  description: DESC,
  path: "/majority-tracker",
  type: "article",
  modified: isoDay(UPDATED),
  keywords: ["Schumer Van Hollen", "Senate Democratic leader election", "Senate majority leader vote", "Schumer whip count", "Chris Van Hollen leader", "who supports Van Hollen", "Senate Democratic leadership vote December 1", "Chuck Schumer challenge", "Majority Tracker"],
});

const FAQ: [string, string][] = [
  ["When is the Senate Democratic leader election?", `Senate Democrats vote on ${day(VOTE_DATE)} in a secret ballot of the caucus.`],
  ["Who is running for Senate Democratic leader?", "Chuck Schumer of New York, the leader since 2017, and Chris Van Hollen of Maryland, who announced his challenge on November 12, 2026."],
  ["How many votes does it take to win?", `${T.need} of the ${T.caucus} members of the incoming caucus, a simple majority, now that the AP has called Alaska for Mary Peltola.`],
  ["Which senators back Chris Van Hollen?", `${SENATORS.filter((s) => s.pick === "V" && !TIER[s.tier].estimate && !/^Chris Van Hollen/.test(s.name)).map((s) => s.name).join(", ")} are on record against Schumer or for Van Hollen. Every other pick on this page is our estimate.`],
  ["Which senators back Chuck Schumer?", `${T.firmS} members are on record for Schumer, including ${SENATORS.filter((s) => s.pick === "S" && !TIER[s.tier].estimate && s.name !== "Chuck Schumer").slice(0, 8).map((s) => s.name).join(", ")}.`],
];

export default function MajorityTrackerPage() {
  const vhNeed = T.need - T.bestV;
  const days = Math.max(0, Math.ceil((new Date(VOTE_DATE + "T15:00:00Z").getTime() - Date.now()) / 864e5));
  const swing = SENATORS.filter((s) => SWING.includes(s.name));
  const next = SENATORS.filter((s) => NEXT.includes(s.name));
  const lead = T.S >= T.need ? "S" : T.V >= T.need ? "V" : null;
  return (
    <div className="opp mt">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["Polls", "/polls"], ["Majority Tracker", "/majority-tracker"]]),
        pageLd({ name: "Majority Tracker: Senate Democratic leader election", description: DESC, path: "/majority-tracker", modified: isoDay(UPDATED), about: "Senate Democratic leader election" }),
      )} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span><span aria-current="page">Majority Tracker</span></nav>

      {/* the face off: two candidates, one aisle, a countdown */}
      <header className="mt-show">
        <div className="mt-show-bg" aria-hidden="true" />
        <div className="mt-show-top">
          <span className="mt-live"><i />Live whip count</span>
          <span className="mt-when">{days > 0 ? <><b>{days}</b> {days === 1 ? "day" : "days"} to the vote · {day(VOTE_DATE, false)}</> : <>Vote day · {day(VOTE_DATE, false)}</>}</span>
        </div>
        <h1 className="mt-title">Majority <em>Tracker</em></h1>
        <p className="mt-sub">Who leads Senate Democrats? Every member of the incoming caucus, and where we project each one on {day(VOTE_DATE)}.</p>
        <div className="mt-ring">
          {(["S", "V"] as const).map((k) => (
            <div key={k} className={`mt-fighter p-${k}${lead === k ? " lead" : ""}`}>
              <div className="mt-bubble">{k === "S" ? "Says he has the votes" : "Challenging since Nov 12"}</div>
              <Toon name={CAND[k].full} side={k} size={190} className="mt-ffc" uid="h" />
              <div className="mt-fname"><b>{CAND[k].full}</b><span>{CAND[k].st} · {k === "S" ? "leader since 2017" : "the challenger"}</span></div>
              <div className="mt-fnum"><b>{k === "S" ? T.S : T.V}</b><span>projected · {k === "S" ? T.firmS : T.firmV} on record</span></div>
            </div>
          ))}
          <div className="mt-vs" aria-hidden="true"><span>VS</span><em>{T.need} to win</em></div>
        </div>
      </header>

      <aside className="mt-note" role="note">
        <b>These are our best estimates.</b>
        <p>The vote is a secret ballot. For senators who haven&apos;t announced a vote, every pick here is On Point Politics&apos; best estimate, not a reported position, and the count will move as senators take sides. Updated {day(UPDATED)}.</p>
      </aside>

      <Chamber rows={SENATORS} need={T.need} />

      <dl className="mt-strip">
        <div><dt>Needed to win</dt><dd>{T.need}</dd><span>a majority of the {T.caucus} member caucus</span></div>
        <div><dt>On record</dt><dd><b className="mt-c-S">{T.firmS}</b> · <b className="mt-c-V">{T.firmV}</b></dd><span>stated or reported, the rest are our estimates</span></div>
        <div><dt>Best cases</dt><dd><b className="mt-c-S">{T.bestS}</b> · <b className="mt-c-V">{T.bestV}</b></dd><span>if every low confidence call flips one way</span></div>
        <div><dt>Betting market</dt><dd><b className="mt-c-S">91%</b> · <b className="mt-c-V">8%</b></dd><span>Kalshi traders, Nov 18</span></div>
      </dl>

      <section className="mt-news" aria-labelledby="mt-news-h">
        <div className="mt-sec-h"><p className="eye">The latest</p><h2 id="mt-news-h">What changed in the race</h2></div>
        <ol>{NEWS.map(([d, what, src, href], i) => (
          <li key={i}><time dateTime={d}>{day(d, false)}</time><p>{what}</p><a href={href} target="_blank" rel="noopener noreferrer">{src}</a></li>
        ))}</ol>
      </section>

      <AdUnit />

      <section className="mt-fence" aria-labelledby="mt-fence-h">
        <div className="mt-sec-h"><p className="eye">On the fence</p><h2 id="mt-fence-h">The senators who can still move the count</h2></div>
        <ul>
          {[...swing, ...next].map((s, i) => (
            <li key={s.name} className={`p-${s.pick}${i >= swing.length ? " next" : ""}`}>
              <Toon name={s.name} side={s.pick} size={96} className="mt-fence-face" uid="f" />
              <div>
                <b>{s.name}</b><span>{s.st} · leaning {CAND[s.pick].name} · {TIER[s.tier].short.toLowerCase()} confidence</span>
                <p>{s.note}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-fence-n">Even if every low confidence Schumer pick flips, Van Hollen reaches {T.bestV}. He would also need {vhNeed > 0 ? `at least ${vhNeed}` : "none of the"} senators we rate medium for Schumer.</p>
      </section>

      <StayConnected from="majority-tracker" title="Know the moment the leader count moves" note="An email when a senator moves, a new On Point video breaks it down, or a new poll drops. Free, and you can leave any time." pick={["majority", "videos"]} />

      <Roster rows={SENATORS} />

      <AdUnit />
      <section className="mt-faq" aria-labelledby="mt-faq-h">
        <div className="mt-sec-h"><p className="eye">The race in brief</p><h2 id="mt-faq-h">Schumer vs Van Hollen, explained</h2></div>
        {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <p className="mt-foot">The leader election is a secret ballot, so individual votes may never be public. Stated and reported positions come from senators&apos; public statements and news reports. Every other pick is On Point Politics&apos; estimate from each senator&apos;s record, statements and ties to the candidates, and is labeled with our confidence. The portraits are cartoons drawn for this page. See also the <Link href="/polls/approval">Trump approval average</Link>, the <Link href="/polls/generic-ballot">generic ballot</Link> and the <Link href="/forecast/2028">2028 forecast</Link>.</p>
    </div>
  );
}
