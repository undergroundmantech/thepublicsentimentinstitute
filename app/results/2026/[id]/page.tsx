import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import NightDesk from "../NightDesk";
import "../results2026.css";

type R = { id: string; nm: string; k: string; st: string };
let IX: R[] | null = null;
const races = () => (IX ??= (JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/results/2026/index.json"), "utf8")).races as R[]));

export function generateStaticParams() { return races().map((r) => ({ id: r.id })); }
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = races().find((x) => x.id === decodeURIComponent(id));
  const t = r ? `${r.nm} results, November 3, 2026` : "November 3, 2026 results";
  return { title: t, description: r ? `Live returns for the ${r.nm} race against the On Point Politics forecast, county by county, with an estimate of the final count.` : undefined,
    alternates: { canonical: `https://onpointpolitics.com/results/2026/${id}` } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NightDesk id={decodeURIComponent(id)} />;
}
