import { STATE_NAME } from "@/app/lib/opp";
import { getMeasures } from "../../data";
import { OG_SIZE, OG_TYPE, ogCard, pctOg, dayOg, C } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics ballot measure forecast";

export function generateStaticParams() {
  return getMeasures().measures.map((m) => ({ st: m.st.toLowerCase(), slug: m.slug }));
}

export default async function Image({ params }: { params: Promise<{ st: string; slug: string }> }) {
  const { st, slug } = await params;
  const ms = getMeasures();
  const m = ms.measures.find((x) => x.st === st.toUpperCase() && x.slug === slug);
  if (!m) return ogCard({ eyebrow: "2026 forecast", title: "Ballot measure forecast" });
  const sub = m.title.length > 70 ? m.title.slice(0, 68).replace(/\s+\S*$/, "") + "..." : m.title;
  return ogCard({
    eyebrow: `Ballot measure · ${dayOg(ms.meta.updated)}`,
    title: `${STATE_NAME[m.st] ?? m.st} ${m.label}`,
    sub,
    left: { label: "Passes", value: pctOg(m.est.prob), color: C.yes },
    right: { label: "Fails", value: pctOg(1 - m.est.prob), color: C.no },
    split: m.est.prob,
    foot: `Yes projected at ${m.est.yes.toFixed(1)}% · needs ${Math.round(m.threshold * 1000) / 10}%`,
  });
}
