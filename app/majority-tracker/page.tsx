import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, isoDay, pageLd, seo } from "@/app/lib/seo";
import { CAND, NEXT, SENATORS, SWING, TIER, TIERS, UPDATED, VOTE_DATE, tally, type Pick, type Senator } from "./data";
import TrackerTable from "./TrackerTable";
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

function Dot({ x }: { x: Senator }) {
  return (
    <li className={`mt-dot p-${x.pick} t-${x.tier}${x.ifSeated ? " seat" : ""}`} title={`${x.name.replace(", if seated", "")}, ${x.st}. ${TIER[x.tier].label}. ${x.note}`}>
      <i aria-hidden="true" />
      <b>{x.last}</b>
      <span>{x.st}{x.ifSeated ? ", if seated" : ""}</span>
    </li>
  );
}

function Panel({ p }: { p: Pick }) {
  const list = SENATORS.filter((x) => x.pick === p).sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
  const firm = p === "S" ? T.firmS : T.firmV, est = p === "S" ? T.estS : T.estV, n = list.length;
  const gap = Math.max(0, T.need - n);
  const cells: React.ReactNode[] = [];
  list.forEach((x, i) => {
    cells.push(<Dot key={x.name} x={x} />);
    if (i === T.need - 1) cells.push(<li key="line" className="mt-line" aria-hidden="true"><span>{T.need} to win</span></li>);
  });
  for (let k = 0; k < gap; k++) cells.push(<li key={"g" + k} className="mt-dot empty" aria-hidden="true"><i /></li>);
  if (gap) cells.push(<li key="line" className="mt-line" aria-hidden="true"><span>{T.need} to win</span></li>);
  return (
    <section className={`card mt-panel p-${p}`} aria-labelledby={`mt-${p}`}>
      <div className="card-h">
        <h3 id={`mt-${p}`}><i className={`mt-sw p-${p}`} aria-hidden="true" />{CAND[p].full}, {n} projected</h3>
        <span className="mt-sub">{firm} stated or reported, {est} estimated</span>
        <span className="sp" />
        <span className={`pill mt-pill p-${p}`}>{n >= T.need ? `${n - T.need} to spare` : `${gap} short of ${T.need}`}</span>
      </div>
      <div className="card-b">
        <ol className="mt-dots" aria-label={`${CAND[p].full} supporters, projected`}>{cells}</ol>
      </div>
    </section>
  );
}

export default function MajorityTrackerPage() {
  const seg = (w: number) => `${(100 * w) / T.caucus}%`;
  const vhNeed = T.need - T.bestV, vhNeedAll = T.needAll - T.bestV;
  return (
    <div className="opp mt">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["Majority Tracker", "/majority-tracker"]]),
        pageLd({ name: "Majority Tracker: Senate Democratic leader election", description: DESC, path: "/majority-tracker", modified: isoDay(UPDATED), about: "Senate Democratic leader election" }),
      )} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Majority Tracker</span></nav>

      <header className="ph mt-head">
        <div className="eye g">Senate Democratic leader election · {day(VOTE_DATE)}</div>
        <h1>Majority <em>Tracker</em></h1>
        <p className="lede">Chuck Schumer against Chris Van Hollen. One dot for each of the {T.caucus} members of the incoming Senate Democratic caucus, with where we project each of them to vote. {T.need} votes win the leadership with {T.caucusSeated} senators seated, {T.needAll} if Mary Peltola is seated after Alaska&apos;s count.</p>
      </header>

      <aside className="mt-note" role="note">
        <b>These are our best estimates.</b>
        <p>For senators who haven&apos;t announced a vote, every pick here is On Point Politics&apos; best estimate, not a reported position. The count will change over time, and we will update this page as senators take sides. Updated {day(UPDATED)}.</p>
      </aside>

      <div className="grid4 mt-kpis">
        <div className="kpi"><div className="lab"><i className="mt-sw p-S" />Schumer, projected</div><div className="v mt-c-S">{T.S}</div><div className="sub">of {T.caucus}. {T.Sseated} of {T.caucusSeated} without Peltola.</div></div>
        <div className="kpi"><div className="lab"><i className="mt-sw p-V" />Van Hollen, projected</div><div className="v mt-c-V">{T.V}</div><div className="sub">of {T.caucus}. Peltola is projected for Schumer.</div></div>
        <div className="kpi"><div className="lab">Needed to win</div><div className="v">{T.need}</div><div className="sub">of {T.caucusSeated} seated. {T.needAll} of {T.caucus} if Peltola wins Nov 18.</div></div>
        <div className="kpi"><div className="lab">Range if low confidence calls flip</div><div className="v">{T.bestS} <small>·</small> {T.bestV}</div><div className="sub">Best case for Schumer, then for Van Hollen, of {T.caucus}.</div></div>
      </div>

      <div className="card mt-bar-card">
        <div className="mt-bar" role="img" aria-label={`${T.S} projected for Schumer and ${T.V} for Van Hollen, ${T.need} needed`}>
          <span className="b S firm" style={{ width: seg(T.firmS) }} />
          <span className="b S est" style={{ width: seg(T.estS) }} />
          <span className="b V est" style={{ width: seg(T.estV) }} />
          <span className="b V firm" style={{ width: seg(T.firmV) }} />
          <i className="mk" style={{ left: seg(T.need) }} />
          <i className="mk" style={{ left: seg(T.caucus - T.need) }} />
        </div>
        <div className="mt-bar-lab"><span><b className="mt-c-S">{T.S}</b> Schumer · {T.firmS} on record</span><span className="mid">Ticks mark {T.need} from each side</span><span><b className="mt-c-V">{T.V}</b> Van Hollen · {T.firmV} on record</span></div>
      </div>

      <div className="card mt-legend" aria-label="How to read the dots">
        <span className="h">Candidate</span><span><i className="mt-sw p-S" />Schumer</span><span><i className="mt-sw p-V" />Van Hollen</span>
        <span className="h">Position</span>
        {TIERS.map((t) => <span key={t}><i className={`mt-key t-${t}`} />{TIER[t].label}</span>)}
        <span><i className="mt-key seat" />Peltola, counts only if seated</span>
      </div>

      <div className="mt-panels"><Panel p="S" /><Panel p="V" /></div>

      <div className="grid3 mt-read">
        <div className="card card-b"><p className="eye">Read the line</p><p>The black line sits after the {T.need}th vote. A side that crosses it has enough to win with {T.caucusSeated} seated. With Peltola seated the bar is {T.needAll}, one dot past the line.</p></div>
        <div className="card card-b"><p className="eye">Swing senators</p><p>{SWING.map((n) => n.split(" ").slice(1).join(" ")).join(", ").replace(/, ([^,]*)$/, " and $1")} are the likeliest to move the count. {NEXT.map((n) => n.split(" ").slice(1).join(" ")).join(" and ")} are next.</p></div>
        <div className="card card-b"><p className="eye">What Van Hollen needs</p><p>Even if every low confidence Schumer pick flips, he reaches {T.bestV}. He would also need at least {vhNeed} senators we rate medium for Schumer, {vhNeedAll} if Peltola is seated.</p></div>
      </div>

      <TrackerTable rows={SENATORS} />

      <p className="mt-foot">The leader election is a secret ballot, so individual votes may never be public. Stated and reported positions come from senators&apos; public statements and news reports. Every other pick is On Point Politics&apos; estimate from each senator&apos;s record, statements and ties to the candidates, and is labeled with our confidence. These are our best estimates for those who haven&apos;t announced a vote; they will change over time and this page will be updated.</p>
    </div>
  );
}
