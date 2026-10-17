import { getModel, isInd } from "@/app/lib/forecastData";
import { raceHref, raceIdFromRoute } from "@/app/lib/opp";
import { OG_SIZE, OG_TYPE, ogCard, pctOg, dayOg, C } from "@/app/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "On Point Politics race forecast";

export function generateStaticParams() {
  return getModel().races.map((r) => { const [, state, race] = raceHref(r.id).split("/").slice(1); return { state, race }; });
}

export default async function Image({ params }: { params: Promise<{ state: string; race: string }> }) {
  const { state, race } = await params;
  const id = raceIdFromRoute(state, race);
  const model = getModel();
  const r = model.races.find((x) => x.id === id);
  if (!r) return ogCard({ eyebrow: "2026 forecast", title: "2026 election forecast" });
  const ind = isInd(r);
  const pR = r.est?.prob ?? 0;
  const where = r.office === "house" ? `${r.name} District` : r.office === "senate" ? r.name : `${r.state} Governor`;
  const unc = Math.abs(r.stages.rate) >= 99;
  return ogCard({
    eyebrow: `2026 forecast · ${dayOg(model.meta.updated)}`,
    title: where,
    sub: unc ? `${r.stages.rate < 0 ? r.dem : r.gop} faces no major party opponent` : `${r.dem} vs ${r.gop}${r.open ? " · open seat" : ""}`,
    left: { label: `${r.dem.split(" ").pop()} · ${ind ? "Ind" : "Dem"}`, value: pctOg(1 - pR), color: ind ? C.ind : C.dem },
    right: { label: `${r.gop.split(" ").pop()} · Rep`, value: pctOg(pR), color: C.gop },
    split: 1 - pR,
    foot: "Chance to win, from 2,000 simulated elections",
  });
}
