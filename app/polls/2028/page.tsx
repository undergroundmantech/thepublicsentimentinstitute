import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";
import PollIndex from "../PollIndex";

export const metadata: Metadata = seo({ title: "2028 presidential polls: primary and general election polling averages", description: "2028 presidential polling averages from On Point Politics: the Republican and Democratic primaries with every candidate, and every general election matchup, on one board.", path: "/polls/2028" });

export default function Page() {
  return <PollIndex initial="2028" title={<>The road to <em>2028</em></>} lede="Both 2028 primaries with every candidate the polls have named, and every general election matchup with at least two national polls, on the same weighted average as every other race. Tap a note to open its average." />;
}
