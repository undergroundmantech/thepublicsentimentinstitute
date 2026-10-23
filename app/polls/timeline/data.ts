// Server side: one polling average shaped for the timeline, built at deploy so the browser only draws it.
import { AGGREGATES, buildAggregate } from "@/app/_polling/lib/aggregates";
import { EVENTS } from "./events";
import type { TLData } from "./Timeline";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function timelineData(id: string, o: { title: string; kicker: string; lede: string; kind: TLData["kind"]; avgHref: string }): TLData | null {
  const def = AGGREGATES.find((d) => d.id === id); if (!def) return null;
  const b = buildAggregate(def);
  const daily = b.daily.map((d) => [d.t, r2(d.a), r2(d.b)] as [number, number, number]);
  const polls = b.polls.filter((p) => Number.isFinite(p.adjA) && Number.isFinite(p.adjB)).map((p) => [p.t, r2(p.adjA as number), r2(p.adjB as number)] as [number, number, number]);
  const last = b.daily[b.daily.length - 1];
  const updated = last ? new Date(last.t).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
  return { id, ...o, updated, a: { label: def.seriesA.label, color: def.seriesA.color }, b: { label: def.seriesB.label, color: def.seriesB.color }, daily, polls, events: EVENTS };
}
