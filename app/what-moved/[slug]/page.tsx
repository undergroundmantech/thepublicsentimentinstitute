import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/Link";
import StayConnected from "@/app/components/StayConnected";
import { seo } from "@/app/lib/seo";
import { day, entries, entry } from "../data";
import Entry from "../Entry";

export const dynamicParams = false;
export function generateStaticParams() { return entries().map((e) => ({ slug: e.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = entry((await params).slug); if (!e) return {};
  return seo({ title: `What moved in the 2028 forecast, ${day(e.date)}`, description: e.summary, path: `/what-moved/${e.slug}`, type: "article" });
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const e = entry((await params).slug); if (!e) notFound();
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/what-moved">What moved</Link><span className="sep">/</span><span>{day(e.date)}</span></nav>
      <div style={{ maxWidth: 1000, margin: "16px auto 0" }}><Entry e={e} /></div>
      <StayConnected from="what-moved" title="Get what moved in your inbox every week" pick={["forecast", "videos"]} />
    </div>
  );
}
