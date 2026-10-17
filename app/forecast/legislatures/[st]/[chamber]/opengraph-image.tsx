import { getStatehouse } from "../../data";
import { OG_SIZE, OG_TYPE, ogCard, pctOg, dayOg, C } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics state legislative chamber forecast";

export function generateStaticParams() {
  return getStatehouse().chambers.map((c) => ({ st: c.st.toLowerCase(), chamber: c.chamber }));
}

export default async function Image({ params }: { params: Promise<{ st: string; chamber: string }> }) {
  const { st, chamber } = await params;
  const sl = getStatehouse();
  const c = sl.chambers.find((x) => x.st === st.toUpperCase() && x.chamber === chamber);
  if (!c) return ogCard({ eyebrow: "2026 forecast", title: "State legislative forecast" });
  return ogCard({
    eyebrow: `2026 forecast · ${dayOg(sl.meta.updated)}`,
    title: c.name,
    sub: `${c.up} of ${c.seats} seats on the ballot · ${c.majority} for a majority`,
    left: { label: "Democrats", value: pctOg(c.demControl), color: C.dem },
    right: { label: "Republicans", value: pctOg(c.gopControl), color: C.gop },
    split: c.demControl / Math.max(0.0001, c.demControl + c.gopControl),
    foot: "Chance to control the chamber",
  });
}
