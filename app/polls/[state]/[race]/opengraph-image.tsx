import { STATE_NAME } from "@/app/lib/opp";
import { aggByHref, stateRaceParams, PRIMARIES } from "../../registry";
import { avgSummary } from "../../seo";
import { OG_SIZE, OG_TYPE, ogCard, pctOg, dayOg, C } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics polling average";

export function generateStaticParams() { return stateRaceParams(); }

export default async function Image({ params }: { params: Promise<{ state: string; race: string }> }) {
  const { state, race } = await params;
  const prim = PRIMARIES[`${state}/${race}`];
  const def = aggByHref(`/polls/${state}/${race}`);
  if (prim || !def) return ogCard({ eyebrow: "Polling average", title: prim?.title ?? `${STATE_NAME[state.toUpperCase()] ?? state} polls` });
  return avgCard(avgSummary(def));
}

export function avgCard(s: ReturnType<typeof avgSummary>) {
  const A = s.def.seriesA.label, B = s.def.seriesB.label;
  const a = s.a ?? 0, b = s.b ?? 0;
  const col = (p: string | undefined, label: string, first: boolean) =>
    p === "Republican" || /^Republicans?$|Trump|Vance/.test(label) ? C.gop
    : p === "Democrat" || /^Democrats?$|Harris|Newsom/.test(label) ? C.dem
    : p === "Independent" ? C.ind
    : /^(approve|favorable|right track)$/i.test(label) ? C.yes
    : /^(disapprove|unfavorable|wrong track)$/i.test(label) ? C.no
    : first ? C.dem : C.gop;
  const colA = col(s.def.seriesA.party, A, true);
  const colB = col(s.def.seriesB.party, B, false);
  return ogCard({
    eyebrow: `Polling average${s.updated ? ` · ${dayOg(s.updated)}` : ""}`,
    title: s.place && s.office ? `${s.place} ${s.office}` : s.headline,
    sub: s.lead ? `${s.lead === "Even" ? "An even race" : `${s.lead} points`} across ${s.polls} polls` : undefined,
    left: { label: A, value: `${a.toFixed(1)}%`, color: colA },
    right: { label: B, value: `${b.toFixed(1)}%`, color: colB },
    split: a / Math.max(0.1, a + b),
    foot: "Weighted by recency, sample size and pollster grade",
  });
}
