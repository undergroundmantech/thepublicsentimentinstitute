import type { Metadata } from "next";
import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { STATE_NAME } from "@/app/lib/opp";
import { GROUP_LABEL, bmHref, getMeasures } from "./data";
import MeasuresBoard, { type BoardMeasure } from "./MeasuresBoard";
import "./measures.css";
import JsonLd from "@/app/components/JsonLd";
import { measuresLd, measuresMeta } from "../seo";

export function generateMetadata(): Metadata { return measuresMeta(); }

export default function MeasuresPage() {
  const data = getMeasures();
  const ms = data.measures;
  const updated = new Date(data.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const pass = ms.filter((m) => m.est.prob > 0.5).length;
  const toss = ms.filter((m) => m.est.prob > 0.35 && m.est.prob < 0.65).length;
  const polled = ms.filter((m) => m.polls.length).length;
  const counts = new Map<string, number>();
  for (const m of ms) counts.set(m.group, (counts.get(m.group) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, GROUP_LABEL[k] ?? k, n] as [string, string, number]);
  const board: BoardMeasure[] = ms.map((m) => ({
    id: m.id, st: m.st, state: STATE_NAME[m.st] ?? m.st, href: bmHref(m), label: m.label, title: m.title, group: m.group, groupLabel: GROUP_LABEL[m.group] ?? m.group,
    yes: m.est.yes, p10: m.est.p10, p90: m.est.p90, prob: m.est.prob, threshold: m.threshold, polled: m.polls.length > 0,
  }));
  return (
    <div className="opp bm fc-wide">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>Ballot measures</span>
      </nav>
      <ForecastNav />
      <JsonLd data={measuresLd()} />
      <header className="bm-head">
        <div>
          <div className="eye g">2026 forecast</div>
          <h1>Ballot measures <em>forecast</em></h1>
          <p className="lede">
            Every statewide question on the Nov. 3 ballot, {ms.length} measures in {data.meta.states} states and the District of Columbia, forecast county by county with the chance each one clears
            its state&apos;s bar to pass. {pass} are favored to pass and {toss} are close to a coin flip.
          </p>
          <div className="pmeta"><span>Updated <b>{updated}</b></span><span>Simulations <b className="mono">2,000</b></span><Link className="btn sm" href="/forecast">All forecasts</Link></div>
        </div>
        <div className="bm-strip">
          <div className="card bm-s"><div className="lab">Measures</div><b className="mono">{ms.length}</b><div className="sub">{data.meta.states} states and D.C.</div></div>
          <div className="card bm-s"><div className="lab">Favored to pass</div><b className="mono cy">{pass}</b><div className="sub">{ms.length - pass} favored to fail</div></div>
          <div className="card bm-s"><div className="lab">Close calls</div><b className="mono ct">{toss}</b><div className="sub">Between 35% and 65% to pass</div></div>
          <div className="card bm-s"><div className="lab">Polled</div><b className="mono">{polled}</b><div className="sub">The others run on history alone</div></div>
        </div>
      </header>
      <div className="bm-legend" style={{ justifyContent: "flex-start", marginBottom: 4 }}>
        <span>Bars show the forecast Yes share from 20 to 80 percent, the shaded band is the 80 percent range, and the white line is the share needed to pass.</span>
      </div>
      <MeasuresBoard measures={board} groups={groups} />
      <div className="callout" style={{ marginTop: 16 }}>
        <div className="eye">How these are built</div>
        Each measure is put in a policy group and given the side its Yes vote leans to. The group sets how the Yes share moves with a state&apos;s partisanship and
        with each county&apos;s 2024 presidential vote, measured on the statewide measures of 2018, 2022 and 2024 in the MIT Election Lab precinct returns, and how the
        measure reached the ballot moves it further: legislative referrals and bonds run ahead, citizen initiatives behind. Polls then pull each forecast toward
        them by their recency and size, with undecided voters breaking two to one for No, the usual late slide on ballot questions, and polls paid for by one side
        moved four points toward the other. The odds are the chance of clearing each state&apos;s own bar, from 60 percent in Florida to two thirds in New Hampshire
        and a majority of all ballots cast in Hawaii, Minnesota, Tennessee and Wyoming.
      </div>
    </div>
  );
}
