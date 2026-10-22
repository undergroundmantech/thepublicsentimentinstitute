import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EarlyVoteConsole from "../EarlyVoteConsole";
import { buildEvConsole } from "../consoleData";
import JsonLd from "@/app/components/JsonLd";
import { seo, graph, pageLd, datasetLd, crumbsLd } from "@/app/lib/seo";
import { getModel } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import { STATE_NAME } from "../lib";
import { getEarlyVote, commas, longDate, pct, slugOf, type EarlyVote } from "../server";
import { stateFaq, faqLd } from "../Summary";

// The same hourly rebuild as the national tracker. Reporting states are built ahead; any other state is built
// the first time it is asked for, once it reports.
export const revalidate = 3600;
export const dynamicParams = true;

const BY_SLUG: Record<string, string> = Object.fromEntries(Object.keys(STATE_NAME).filter((s) => s !== "US").map((st) => [slugOf(st), st]));

export async function generateStaticParams() {
  const ev = await getEarlyVote().catch(() => null);
  return (ev?.states ?? []).map((s) => ({ state: s.slug }));
}

type Props = { params: Promise<{ state: string }> };

function lookup(ev: EarlyVote | null, slug: string) {
  const st = BY_SLUG[slug];
  if (!st) return null;
  return { st, name: STATE_NAME[st], s: ev?.states.find((x) => x.st === st) ?? null };
}

/** The state's marquee forecast page: the Senate race, else the governor, else the forecast hub. */
function forecastLink(st: string) {
  const ids = new Set(getModel().races.map((r) => r.id));
  if (ids.has(`sen-${st}`)) return { href: raceHref(`sen-${st}`), label: `${STATE_NAME[st]} Senate forecast` };
  if (ids.has(`gov-${st}`)) return { href: raceHref(`gov-${st}`), label: `${STATE_NAME[st]} governor forecast` };
  return { href: "/forecast", label: "On Point forecast" };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params;
  const ev: Awaited<ReturnType<typeof getEarlyVote>> | null = await getEarlyVote(); // a failed refresh keeps the last good page
  const f = lookup(ev, state);
  if (!f) return {};
  const path = `/maps/early-vote/${state}`;
  const s = f.s;
  const description = s && ev
    ? `${commas(s.total)} ballots cast in ${f.name} as of ${longDate(ev.snapshot)}: ${commas(s.mail)} by mail and ${commas(s.inperson)} in person${s.partyShare > 0.5 ? `, ${pct(s.dem, s.total)} Democrats and ${pct(s.rep, s.total)} Republicans` : ""}. Live ${f.name} early vote tracker by county and party, updated daily.`
    : `${f.name} early vote tracker for the 2026 midterms, by county and party, updated daily once ${f.name} reports ballots.`;
  return seo({ title: `${f.name} Early Vote Tracker 2026: Ballots Cast by County | On Point Politics`, absoluteTitle: true, description, path,
    type: "article", modified: ev?.snapshot, noindex: !s,
    keywords: [`${f.name} early vote`, `${f.name} early voting 2026`, `${f.name} early vote tracker`, `${f.name} mail ballots`, `${f.name} early vote by party`, `${f.name} early vote by county`] });
}

export default async function StateEarlyVotePage({ params }: Props) {
  const { state } = await params;
  const ev: Awaited<ReturnType<typeof getEarlyVote>> | null = await getEarlyVote(); // a failed refresh keeps the last good page
  const f = lookup(ev, state);
  if (!f) notFound();
  const s = f.s;
  const path = `/maps/early-vote/${state}`;
  const fc = forecastLink(f.st);
  const desc = `Daily count of ${f.name} ballots cast by mail and in person for November 3, 2026, by county, with party registration or an On Point Polling estimate.`;
  return (
    <>
      {s && ev ? (
        <JsonLd data={graph(
          pageLd({ name: `${f.name} Early Vote Tracker`, description: desc, path, modified: ev.snapshot, about: "dataset" }),
          { ...datasetLd({ name: `${f.name} 2026 early vote`, description: desc, path, modified: ev.snapshot, place: f.name,
              measured: ["Mail ballots requested", "Mail ballots returned", "In person early votes", "Early votes by party registration"] }),
            measurementTechnique: "Official state and county early vote counts, with party estimated by On Point Polling where the state reports none",
            temporalCoverage: `2026-09-01/${ev.snapshot}` },
          crumbsLd([["Home", "/"], ["Maps", "/maps"], ["Early vote tracker", "/maps/early-vote"], [f.name, path]]),
          faqLd(stateFaq(ev, s)),
        )} />
      ) : null}
      {ev ? (
        <div className="opp fc-page fc-xl fx-dark">
          <EarlyVoteConsole data={buildEvConsole(ev)} initial={s ? f.st : undefined} faq={s ? stateFaq(ev, s) : undefined}
            lede={s ? <p>As of {longDate(ev.snapshot)}, {commas(s.total)} ballots have been cast in {f.name}: {commas(s.mail)} by mail and {commas(s.inperson)} in person.
              {s.partyShare > 0.5 ? ` Registered Democrats cast ${pct(s.dem, s.total)} of them and registered Republicans ${pct(s.rep, s.total)}.` : ` ${f.name} does not publish the party of its early voters.`}{" "}
              See the <Link href={fc.href}>{fc.label}</Link>.</p> : <p>{f.name} has not reported any 2026 early ballots yet. The count appears here the day it does.</p>} />
        </div>
      ) : null}
    </>
  );
}
