// /results/civic/[id]: live results for a November 3 race that civicAPI reports and the forecast does not cover.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { seo } from "@/app/lib/seo";
import CivicRace from "./CivicRace";
import "./civic.css";

// the live numbers come from the client's own 30 second poll, so the page shell can stay cached for an hour
export const revalidate = 3600;

async function nameOf(id: string): Promise<{ name: string; type: string } | null> {
  try {
    const r = await fetch(`https://civicapi.org/api/v2/race/${id}`, { next: { revalidate: 3600 }, headers: { accept: "application/json" } });
    if (!r.ok) return null; const j = await r.json(); return { name: j.election_name, type: j.election_type };
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; if (!/^\d{1,9}$/.test(id)) return {};
  const n = await nameOf(id);
  const name = n?.name ?? "Race";
  return seo({ title: `${name} Results 2026: Live Count | On Point Politics`, absoluteTitle: true, path: `/results/civic/${id}`, type: "article",
    description: `Live results for the ${name} race on November 3, 2026: the count as it comes in, county by county, from civicAPI.` });
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!/^\d{1,9}$/.test(id)) notFound();
  return <div><CivicRace id={Number(id)} /></div>;
}
