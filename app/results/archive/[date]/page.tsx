import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ELECTION_DATES } from "../../_data/raceRegistry";
import { DEDICATED_BOARDS } from "../nightBoards";
import NightBoard from "./NightBoard";
import { nightMeta } from "../meta";

/** The three hand-built boards own their own routes and must not be prerendered here. */
export function generateStaticParams() {
  return ELECTION_DATES.filter((date) => !DEDICATED_BOARDS[date]).map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  if (!ELECTION_DATES.includes(date)) return { title: "Election results archive" };
  return nightMeta(date);
}

export default async function ArchiveNight({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!ELECTION_DATES.includes(date)) notFound();
  return <NightBoard date={date} />;
}
