import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ELECTION_DATES, formatElectionDate, getRacesByDate } from "../../_data/raceRegistry";
import { DEDICATED_BOARDS } from "../nightBoards";
import NightBoard from "./NightBoard";

/** The three hand-built boards own their own routes and must not be prerendered here. */
export function generateStaticParams() {
  return ELECTION_DATES.filter((date) => !DEDICATED_BOARDS[date]).map((date) => ({ date }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!ELECTION_DATES.includes(date)) return { title: "Election Results Archive · TPSI" };
  const heading = formatElectionDate(date);
  const title = `${heading} Election Results · TPSI`;
  const description = `Reported results for all ${getRacesByDate(date).length} races TPSI tracked on ${heading}.`;
  const url = `https://thepublicsentimentinstitute.com/results/archive/${date}`;
  return {
    title,
    description,
    openGraph: { title, description, url, siteName: "The Public Sentiment Institute", type: "website" },
    alternates: { canonical: url },
  };
}

export default async function ArchiveNight({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!ELECTION_DATES.includes(date)) notFound();
  return <NightBoard date={date} />;
}
