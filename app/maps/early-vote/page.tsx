import type { Metadata } from "next";
import EarlyVoteDesk from "./EarlyVoteDesk";
import JsonLd from "@/app/components/JsonLd";
import { seo, graph, pageLd, datasetLd, crumbsLd, abs } from "@/app/lib/seo";
import { getEarlyVote, commas, longDate, EV_KEYWORDS } from "./server";
import { NationalLede, NationalIndex, nationalFaq, faqLd } from "./Summary";

// Rebuilt at most once an hour, so the count in search results and share cards stays current without a deploy.
export const revalidate = 3600;

const PATH = "/maps/early-vote";

export async function generateMetadata(): Promise<Metadata> {
  const ev: Awaited<ReturnType<typeof getEarlyVote>> | null = await getEarlyVote(); // a failed refresh keeps the last good page
  const description = ev
    ? `${commas(ev.total)} ballots cast so far in the 2026 midterms as of ${longDate(ev.snapshot)}. Live early vote tracker for every reporting state: mail and in person ballots, party breakdown, county maps and turnout against 2022 and 2024.`
    : "Live 2026 early vote tracker for every reporting state: mail and in person ballots, party breakdown, county maps and turnout against 2022 and 2024.";
  return seo({ title: "2026 Early Vote Tracker: Ballots Cast by State | On Point Politics", absoluteTitle: true, description, path: PATH, keywords: EV_KEYWORDS,
    type: "article", modified: ev?.snapshot });
}

export default async function EarlyVotePage() {
  const ev: Awaited<ReturnType<typeof getEarlyVote>> | null = await getEarlyVote(); // a failed refresh keeps the last good page
  const desc = "Daily count of 2026 midterm ballots cast by mail and in person in every reporting state, with party registration, county detail and pace against 2022 and 2024.";
  return (
    <>
      {ev ? (
        <JsonLd data={graph(
          pageLd({ name: "2026 Early Vote Tracker", description: desc, path: PATH, modified: ev.snapshot, about: "dataset" }),
          { ...datasetLd({ name: "2026 early vote by state", description: desc, path: PATH, modified: ev.snapshot, keywords: EV_KEYWORDS,
              measured: ["Mail ballots requested", "Mail ballots returned", "In person early votes", "Early votes by party registration"] }),
            measurementTechnique: "Official state and county early vote counts, with party estimated by On Point Polling where a state reports none",
            temporalCoverage: `2026-09-01/${ev.snapshot}` },
          crumbsLd([["Home", "/"], ["Maps", "/maps"], ["Early vote tracker", PATH]]),
          faqLd(nationalFaq(ev)),
          { "@type": "ItemList", name: "Early vote by state", numberOfItems: ev.states.length,
            itemListElement: ev.states.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: `${s.name} early vote tracker`, url: abs(`${PATH}/${s.slug}`) })) },
        )} />
      ) : null}
      <EarlyVoteDesk lede={ev ? <NationalLede ev={ev} /> : undefined} after={ev ? <NationalIndex ev={ev} /> : undefined} />
    </>
  );
}
