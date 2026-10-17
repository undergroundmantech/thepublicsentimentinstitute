import { getDownballot } from "../../data";
import { OG_SIZE, OG_TYPE, ogCard, pctOg, dayOg, C } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics statewide office forecast";

export function generateStaticParams() {
  return getDownballot().races.map((r) => ({ st: r.st.toLowerCase(), office: r.office }));
}

export default async function Image({ params }: { params: Promise<{ st: string; office: string }> }) {
  const { st, office } = await params;
  const db = getDownballot();
  const r = db.races.find((x) => x.st === st.toUpperCase() && x.office === office);
  if (!r) return ogCard({ eyebrow: "2026 forecast", title: "Statewide offices forecast" });
  const title = `${r.state} ${r.officeLabel}`;
  if (r.uncontested || !r.dem || !r.gop) return ogCard({ eyebrow: `2026 forecast · ${dayOg(db.meta.updated)}`, title, sub: "Uncontested in 2026" });
  const pR = r.est.prob;
  return ogCard({
    eyebrow: `2026 forecast · ${dayOg(db.meta.updated)}`,
    title,
    sub: `${r.dem} vs ${r.gop}`,
    left: { label: `${r.dem.split(" ").pop()} · Dem`, value: pctOg(1 - pR), color: C.dem },
    right: { label: `${r.gop.split(" ").pop()} · Rep`, value: pctOg(pR), color: C.gop },
    split: 1 - pR,
    foot: "Chance to win, county by county forecast",
  });
}
