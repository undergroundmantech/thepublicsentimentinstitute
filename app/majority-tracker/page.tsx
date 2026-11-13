import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, isoDay, pageLd, seo } from "@/app/lib/seo";
import { NEXT, SENATORS, SWING, UPDATED, VOTE_DATE, tally } from "./data";
import TrackerTable from "./TrackerTable";
import Chamber from "./Chamber";
import "./tracker.css";

const day = (d: string, y = true) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", ...(y ? { year: "numeric" } : {}) });
const T = tally();
const DESC = `Who has the votes to lead Senate Democrats? On Point Politics tracks all ${T.caucus} members of the incoming caucus in the ${day(VOTE_DATE)} leader election between Chuck Schumer and Chris Van Hollen: stated positions, reported positions and our best estimates for everyone else.`;

export const metadata: Metadata = seo({
  title: "Majority Tracker: Schumer vs Van Hollen for Senate Democratic leader",
  description: DESC,
  path: "/majority-tracker",
  type: "article",
  modified: isoDay(UPDATED),
  keywords: ["Senate Democratic leader", "Schumer Van Hollen", "Chuck Schumer", "Chris Van Hollen", "Senate Democratic leader election", "whip count", "Senate leadership vote", "Majority Tracker"],
});

export default function MajorityTrackerPage() {
  const vhNeed = T.need - T.bestV, vhNeedAll = T.needAll - T.bestV;
  return (
    <div className="opp mt">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["Polls", "/polls"], ["Majority Tracker", "/majority-tracker"]]),
        pageLd({ name: "Majority Tracker: Senate Democratic leader election", description: DESC, path: "/majority-tracker", modified: isoDay(UPDATED), about: "Senate Democratic leader election" }),
      )} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span><span aria-current="page">Majority Tracker</span></nav>

      <header className="ph mt-head">
        <div className="eye g">Senate Democratic leader election · {day(VOTE_DATE)}</div>
        <h1>Majority <em>Tracker</em></h1>
        <p className="lede">Chuck Schumer against Chris Van Hollen. One seat for each of the {T.caucus} members of the incoming Senate Democratic caucus, with where we project each of them to vote. {T.need} votes win the leadership with {T.caucusSeated} senators seated, {T.needAll} if Mary Peltola is seated after Alaska&apos;s count.</p>
      </header>

      <aside className="mt-note" role="note">
        <b>These are our best estimates.</b>
        <p>For senators who haven&apos;t announced a vote, every pick here is On Point Politics&apos; best estimate, not a reported position. The count will change over time, and we will update this page as senators take sides. Updated {day(UPDATED)}.</p>
      </aside>

      <Chamber rows={SENATORS} need={T.need} />

      <dl className="mt-strip">
        <div><dt>Needed to win</dt><dd>{T.need}</dd><span>of {T.caucusSeated} seated, {T.needAll} if Peltola wins Nov 18</span></div>
        <div><dt>On record</dt><dd><b className="mt-c-S">{T.firmS}</b> · <b className="mt-c-V">{T.firmV}</b></dd><span>stated or reported, the rest are our estimates</span></div>
        <div><dt>Best cases</dt><dd><b className="mt-c-S">{T.bestS}</b> · <b className="mt-c-V">{T.bestV}</b></dd><span>if every low confidence call flips one way</span></div>
        <div><dt>Without Peltola</dt><dd><b className="mt-c-S">{T.Sseated}</b> · <b className="mt-c-V">{T.Vseated}</b></dd><span>of {T.caucusSeated} senators seated today</span></div>
      </dl>

      <div className="grid3 mt-read">
        <div className="card card-b"><p className="eye">Read the chamber</p><p>Each candidate fills from his own wall, firmest votes first, so the seats beside the center aisle are the least certain. A side that reaches the aisle has {T.need}, enough to win with {T.caucusSeated} seated. With Peltola seated the bar is {T.needAll}, one seat past it.</p></div>
        <div className="card card-b"><p className="eye">Swing senators</p><p>{SWING.map((n) => n.split(" ").slice(1).join(" ")).join(", ").replace(/, ([^,]*)$/, " and $1")} are the likeliest to move the count. {NEXT.map((n) => n.split(" ").slice(1).join(" ")).join(" and ")} are next.</p></div>
        <div className="card card-b"><p className="eye">What Van Hollen needs</p><p>Even if every low confidence Schumer pick flips, he reaches {T.bestV}. He would also need at least {vhNeed} senators we rate medium for Schumer, {vhNeedAll} if Peltola is seated.</p></div>
      </div>

      <TrackerTable rows={SENATORS} />

      <p className="mt-foot">The leader election is a secret ballot, so individual votes may never be public. Stated and reported positions come from senators&apos; public statements and news reports. Every other pick is On Point Politics&apos; estimate from each senator&apos;s record, statements and ties to the candidates, and is labeled with our confidence. These are our best estimates for those who haven&apos;t announced a vote; they will change over time and this page will be updated.</p>
    </div>
  );
}
