// Search metadata for polling averages: the latest numbers go straight into the title, the
// description and the Dataset record, so a search result or an AI answer can quote them.
import type { Metadata } from "next";
import { AGGREGATES, buildAggregate, type AggregateDef, type BuiltAggregate } from "@/app/_polling/lib/aggregates";
import { STATE_NAME } from "@/app/lib/opp";
import { crumbsLd, datasetLd, graph, pageLd, seo } from "@/app/lib/seo";
import { pollHref } from "./registry";

const cache = new Map<string, BuiltAggregate>();
const built = (d: AggregateDef) => {
  let b = cache.get(d.id);
  if (!b) { b = buildAggregate(d); cache.set(d.id, b); }
  return b;
};

const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const n1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export type AvgSummary = {
  def: AggregateDef; path: string; place?: string; office?: string;
  a: number | null; b: number | null; updated: string | null; polls: number; lead: string; headline: string;
};

/** The race or question an average tracks, in plain words. */
function subject(d: AggregateDef): { place?: string; office?: string; name: string } {
  const st = d.stateAbbr ? STATE_NAME[d.stateAbbr] : undefined;
  if (d.id === "generic-ballot") return { name: "2026 generic congressional ballot" };
  if (d.id === "trump-approval") return { name: "Donald Trump approval rating" };
  if (d.id === "vance-favorability") return { name: "JD Vance favorability" };
  if (d.id === "right-wrong-track") return { name: "Right track or wrong track" };
  if (d.id === "2028-vance-newsom") return { name: "2028 presidential election: Vance vs Newsom" };
  let m = d.id.match(/^2024-([a-z]{2})$/);
  if (m) return { place: STATE_NAME[m[1].toUpperCase()], office: "president", name: `${STATE_NAME[m[1].toUpperCase()]} 2024 presidential election` };
  if (d.id === "2024-national") return { name: "2024 presidential election, national" };
  m = d.id.match(/^2025-([a-z]{2})-gov$/);
  if (m) return { place: STATE_NAME[m[1].toUpperCase()], office: "governor", name: `${STATE_NAME[m[1].toUpperCase()]} 2025 governor race` };
  m = d.id.match(/^([a-z]{2})-(sen|gov)/);
  const place = st ?? (m ? STATE_NAME[m[1].toUpperCase()] : undefined);
  const office = m?.[2] === "gov" ? "governor" : m?.[2] === "sen" ? "Senate" : undefined;
  return { place, office, name: place && office ? `${place} ${office} race 2026` : d.label.replace(/\s*·\s*/g, " ").replace(/\s*—\s*/g, ": ") };
}

export function avgSummary(def: AggregateDef): AvgSummary {
  const b = built(def);
  const s = subject(def);
  const last = b.daily[b.daily.length - 1];
  const A = def.seriesA.label, B = def.seriesB.label;
  let lead = "";
  if (b.latest) {
    const net = b.latest.a - b.latest.b;
    lead = Math.abs(net) < 0.05 ? "Even" : `${net > 0 ? A : B} +${n1(Math.abs(net))}`;
  }
  return {
    def, path: pollHref(def.id), place: s.place, office: s.office,
    a: b.latest?.a ?? null, b: b.latest?.b ?? null, updated: last?.date ?? null, polls: b.polls.length, lead, headline: s.name,
  };
}

export const avgById = (id: string) => { const d = AGGREGATES.find((x) => x.id === id); return d ? avgSummary(d) : null; };

function words(s: AvgSummary) {
  const A = s.def.seriesA.label, B = s.def.seriesB.label;
  const nums = s.a != null && s.b != null ? `${A} ${n1(s.a)}%, ${B} ${n1(s.b)}%` : "";
  const asOf = s.updated ? ` as of ${day(s.updated)}` : "";
  return { A, B, nums, asOf };
}

/** Title and description with the current average in them. */
export function avgMeta(s: AvgSummary, title?: string): Metadata {
  const { A, B, nums, asOf } = words(s);
  const isRace = !!s.office && s.def.seriesA.label !== "Approve";
  const t = title ?? (isRace ? `${s.place} ${s.office} polls ${s.updated?.slice(0, 4) ?? ""}: ${A} vs ${B} polling average`.replace(/\s+:/, ":") : `${s.headline} polling average`);
  const description = nums
    ? `${s.headline} polling average${asOf}: ${nums}, ${s.lead === "Even" ? "an even race" : `${s.lead}`}. Averaged daily from ${s.polls.toLocaleString()} public polls, weighted by recency, sample size and pollster grade, with trend lines and every poll listed.`
    : `${s.headline} polling average from On Point Politics, with trend lines and every public poll listed.`;
  const ownImage = /^\/polls\/[a-z]{2}\/[^/]+$/.test(s.path) || s.path === "/polls/approval" || s.path === "/polls/generic-ballot";
  return seo({ title: t, description, path: s.path, modified: s.updated ?? undefined, ownImage });
}

/** Breadcrumbs, the page and the average as a Dataset with its citable JSON. */
export function avgLd(s: AvgSummary, crumbs: [string, string][]) {
  const { A, B, nums, asOf } = words(s);
  const desc = `${s.headline} polling average from On Point Politics${asOf}${nums ? `: ${nums}` : ""}. Built from ${s.polls} public polls, weighted by recency, sample size, voter screen and pollster grade.`;
  return graph(
    crumbsLd(crumbs),
    pageLd({ name: `${s.headline} polling average`, description: desc, path: s.path, modified: s.updated ?? undefined, about: "dataset" }),
    datasetLd({
      name: `${s.headline} polling average`, description: desc, path: s.path, modified: s.updated ?? new Date().toISOString().slice(0, 10),
      place: s.place, keywords: [s.headline, "polling average", "polls", A, B].filter(Boolean),
      measured: [`${A} share`, `${B} share`, "Margin"], file: `/api/polls/${s.def.id}`,
    }),
  );
}
