// The share card for an "Is X running" page: the answer, and the candidate's nomination odds when the model has them.
import { OG_SIZE, OG_TYPE, ogCard, pctOg, C } from "@/app/lib/og";
import { modelName, nomination } from "@/app/2028/data28";
import { CANDS, STATUS } from "../data";
import { slugOf } from "../slug";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Is this candidate running for president in 2028";
export function generateStaticParams() { return CANDS.map((c) => ({ slug: slugOf(c.name) })); }

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const c = CANDS.find((x) => slugOf(x.name) === slug);
  if (!c) return ogCard({ eyebrow: "2028 candidates", title: "Who is running in 2028" });
  const ans = c.status === "declared" ? "Yes, running" : c.status === "out" ? "Not running" : c.status === "likely" ? "Likely to run" : "Considering a run";
  const party = c.party === "I" ? null : c.party; const mn = party ? modelName(c.name, party) : null;
  const odds = party && mn ? nomination()[party].find((x) => x.name === mn)?.p ?? null : null;
  const col = c.party === "D" ? C.dem : c.party === "R" ? C.gop : C.ind;
  return ogCard({
    eyebrow: `2028 · ${STATUS[c.status].label}`,
    title: `Is ${c.name} running in 2028?`,
    sub: ans,
    ...(odds != null ? { left: { label: `${c.name.split(" ").pop()} · nomination`, value: pctOg(odds), color: col }, right: { label: "Rest of the field", value: pctOg(1 - odds), color: C.mute }, split: odds } : {}),
    foot: "On Point Politics 2028 forecast",
  });
}
