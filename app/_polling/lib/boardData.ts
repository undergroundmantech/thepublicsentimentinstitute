// What the polls whiteboard shows, built the same way on the index pages (at build time) and on a
// race page (in the browser, from the averages it has already built).
import { builtN, type AggregateDef, type BuiltAggregate } from "./aggregates";
import type { MapRow } from "./StateRaceMap";
import type { RoomItem } from "./PollRoom";
import { pollHref } from "@/app/polls/registry";
import { PRIMARIES_2028, SINGLES_2028, hrefOf2028 } from "@/app/_polling/2028/matchups";
import { STATE_NAME } from "@/app/lib/opp";

// Nov 13 2026: the 2026 Senate, governor and House boards closed with the election. Their averages live on in the
// forecast's race pages; the desk now opens on 2028. The old group names stay in the type so nothing that still
// names them breaks, but no board is built for them.
export type BoardGroup = "2028" | "house" | "senate" | "governor" | "national" | "archive";
export const BOARD_GROUPS: { id: BoardGroup; label: string }[] = [
  { id: "2028", label: "2028" }, { id: "national", label: "National" }, { id: "archive", label: "Archive" },
];
export function boardGroupOf(d: AggregateDef): BoardGroup {
  if (d.category === "2028") return "2028";
  if (d.category === "2026 Senate") return "senate";
  if (d.category === "2026 Governor") return "governor";
  if (["Approval", "2026 House", "National mood"].includes(d.category)) return "national";
  return "archive";
}
const NATIONAL_HEAD: Record<string, string> = { "generic-ballot": "Generic ballot", "trump-approval": "Trump approval", "vance-favorability": "JD Vance favorability", "right-wrong-track": "Right track, wrong track" };
function labelOf(d: AggregateDef) {
  if (d.stateAbbr) return STATE_NAME[d.stateAbbr] ?? d.stateAbbr;
  if (NATIONAL_HEAD[d.id]) return NATIONAL_HEAD[d.id];
  if (d.category === "2028") return d.label;
  if (d.category === "2025 Governor") return d.label.replace(/ Governor$/, " governor, 2025");
  if (d.category === "2024 President") return d.id === "2024-national" ? "2024 president, national" : `2024 president, ${d.label}`;
  return d.label;
}
const sample = (a: number[], n: number) => (a.length <= n ? a : Array.from({ length: n }, (_, i) => a[Math.round((i * (a.length - 1)) / (n - 1))]));

export type Board = { items: Record<BoardGroup, RoomItem[]>; maps: Record<"senate" | "governor" | "house", MapRow[]>; all: { id: string; label: string; group: BoardGroup; href?: string }[] };

export function buildBoard(defs: AggregateDef[], built: Record<string, BuiltAggregate | undefined>, cut?: string): Board {
  const items: Record<BoardGroup, RoomItem[]> = { "2028": [], house: [], senate: [], governor: [], national: [], archive: [] };
  const maps: Board["maps"] = { senate: [], governor: [], house: [] };
  const bestMap: Record<string, Record<string, MapRow>> = { senate: {}, governor: {} };
  for (const d of defs) {
    const g = boardGroupOf(d);
    if (g === "senate" || g === "governor" || g === "house") continue;
    const b = built[d.id];
    const net = b?.latest?.net ?? null;
    const lead = net == null ? null : net >= 0 ? d.seriesA : d.seriesB;
    const it: RoomItem = {
      id: d.id, label: labelOf(d), sub: d.stateAbbr ? `${d.seriesA.label} vs. ${d.seriesB.label}` : undefined, st: d.stateAbbr,
      value: net == null ? "" : d.fmtMargin(net), color: lead?.color ?? "", spark: b ? b.spark90 ?? sample(b.daily.slice(-90).map((x) => x.net), 36) : [],
      n: b ? builtN(b) : d.polls.length, margin: net == null ? null : Math.abs(net), href: pollHref(d.id),
      fresh: cut ? d.polls.filter((p) => p.endDate > cut).length : 0,
    };
    items[g].push(it);
    const g0 = g as BoardGroup;
    if ((g0 === "senate" || g0 === "governor") && d.stateAbbr && b?.latest && lead) {
      const row: MapRow = {
        abbr: d.stateAbbr, id: d.id, title: `${STATE_NAME[d.stateAbbr] ?? d.stateAbbr} ${g0 === "senate" ? "Senate" : "governor"}: ${d.seriesA.label} vs. ${d.seriesB.label}`,
        leader: lead.label, color: lead.color, margin: Math.abs(net!), marginText: d.fmtMargin(net!), polls: builtN(b), party: lead.party ? lead.party[0] : undefined,
        trend: (() => { const sg = net! >= 0 ? 1 : -1; const tail = b.daily.slice(-43); return tail.filter((_, i) => (tail.length - 1 - i) % 3 === 0).map((x) => x.net * sg); })(),
      };
      const prev = bestMap[g0][d.stateAbbr];
      if (!prev || row.polls > prev.polls) bestMap[g0][d.stateAbbr] = row;
    }
  }
  maps.senate = Object.values(bestMap.senate); maps.governor = Object.values(bestMap.governor);
  // 2028: both primaries first, then every matchup, then the matchups with a single poll so far
  items["2028"].unshift(...PRIMARIES_2028.map((p) => ({ id: `prim:${p.id}`, label: p.short, sub: "Every candidate", value: `${p.polls.length} polls`, color: p.party === "R" ? "var(--gop)" : "var(--dem)", spark: [], n: p.polls.length, margin: null, href: hrefOf2028(p.id) })));
  for (const m of SINGLES_2028) items["2028"].push({ id: `one:${m.id}`, label: `${m.rep} vs. ${m.dem}`, sub: "One poll so far", value: "", color: "", spark: [], n: 1, margin: null, href: "/polls/2028#one-poll" });

  const all = (Object.keys(items) as BoardGroup[]).flatMap((g) => items[g].map((x) => ({ id: x.id, label: g === "house" ? `${x.label} House` : x.sub ? `${x.label}: ${x.sub.split(" · ")[0]}` : x.label, group: g, href: x.href })));
  return { items, maps, all };
}
