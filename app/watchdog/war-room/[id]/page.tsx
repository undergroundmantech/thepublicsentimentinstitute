import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { notFound } from "next/navigation";
import { raceHref } from "@/app/lib/opp";
import { getWarIndex, getWarRace } from "../data";
import { OFFICE_NAME, lead, pct, rating, raceLabel } from "../fmt";
import RaceRoom from "../RaceRoom";
import "../../people/people.css";
import "../warroom.css";

export const dynamicParams = false;
export function generateStaticParams() { return getWarIndex().races.map((r) => ({ id: r.id })); }

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const r = getWarRace((await params).id); if (!r) return {};
  const nm = r.office === "house" ? `${r.state} ${raceLabel(r)}` : r.name;
  return {
    title: `${nm} War Room: ${r.dem} vs ${r.gop}`,
    description: `Campaign health for ${r.dem} and ${r.gop} in the ${nm} race, and how each side can win: the forecast, polls, money, air war, early vote and scouting reports, briefed for a Democratic or Republican operative.`,
    alternates: { canonical: `/watchdog/war-room/${r.id}` },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const r = getWarRace((await params).id); if (!r) notFound();
  const all = getWarIndex().races;
  const sim = r.similar.map((s) => all.find((x) => x.id === s.id)).filter(Boolean).map((x) => ({ id: x!.id, label: x!.office === "house" ? `House · ${raceLabel(x!)}` : x!.name, office: x!.office, st: x!.st }));
  const rate = rating(r.est.prob, r.dP);
  return (
    <>
      <nav className="pf-crumbs wr-crumbs" aria-label="Breadcrumb"><Link href="/watchdog/war-room">War Room</Link><span>/</span><span>{r.office === "house" ? `${r.state} ${raceLabel(r)}` : r.name}</span></nav>
      <header className="wr-head">
        <div>
          <div className="eye gold">{OFFICE_NAME[r.office]} · {r.state}{r.open ? " · open seat" : ""}</div>
          <h1>{r.office === "house" ? `${r.state} ${raceLabel(r)}` : r.name}</h1>
          <p className="wr-vs"><span className="d">{r.dem}{r.dP !== "D" ? `, ${r.dP === "I" ? "independent" : r.dP}` : ""}</span> <i>vs</i> <span className="r">{r.gop}</span></p>
        </div>
        <div className="wr-fc">
          <div><span>Forecast</span><b>{lead(r.est.margin, r.dP)}</b></div>
          <div><span>{r.dP === "D" ? "Democrat" : "Independent"}</span><b className="d">{pct(1 - r.est.prob)}</b></div>
          <div><span>Republican</span><b className="r">{pct(r.est.prob)}</b></div>
          <div><span>Rating</span><b className={`wr-rate ${rate.split(" ").pop()!.toLowerCase()}`}>{rate}</b></div>
          <Link className="wd-btn" href={raceHref(r.id)}>Full forecast</Link>
        </div>
      </header>
      <RaceRoom r={r} similar={sim} />
    </>
  );
}
