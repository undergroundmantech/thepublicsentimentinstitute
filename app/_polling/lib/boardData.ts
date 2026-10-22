// What the polls whiteboard shows, built the same way on the index pages (at build time) and on a
// race page (in the browser, from the averages it has already built).
import type { AggregateDef, BuiltAggregate } from "./aggregates";
import { HOUSE_DISTRICT_POLLS } from "./houseDistrictPolls";
import type { MapRow } from "./StateRaceMap";
import type { RoomItem } from "./PollRoom";
import { pollHref, PRIMARIES } from "@/app/polls/registry";
import { STATE_NAME } from "@/app/lib/opp";

export type BoardGroup = "house" | "senate" | "governor" | "national" | "archive";
export const BOARD_GROUPS: { id: BoardGroup; label: string }[] = [
  { id: "senate", label: "Senate" }, { id: "governor", label: "Governor" }, { id: "house", label: "House" }, { id: "national", label: "National" }, { id: "archive", label: "Primaries and archive" },
];
export function boardGroupOf(d: AggregateDef): BoardGroup {
  if (d.category === "2026 Senate") return "senate";
  if (d.category === "2026 Governor") return "governor";
  if (["Approval", "2026 House", "National mood", "2028"].includes(d.category)) return "national";
  return "archive";
}
const NATIONAL_HEAD: Record<string, string> = { "generic-ballot": "Generic ballot", "trump-approval": "Trump approval", "vance-favorability": "JD Vance favorability", "right-wrong-track": "Right track, wrong track", "2028-vance-newsom": "2028: Vance vs. Newsom" };
function labelOf(d: AggregateDef) {
  if (d.stateAbbr) return STATE_NAME[d.stateAbbr] ?? d.stateAbbr;
  if (NATIONAL_HEAD[d.id]) return NATIONAL_HEAD[d.id];
  if (d.category === "2025 Governor") return d.label.replace(/ Governor$/, " governor, 2025");
  if (d.category === "2024 President") return d.id === "2024-national" ? "2024 president, national" : `2024 president, ${d.label}`;
  return d.label;
}
const sample = (a: number[], n: number) => (a.length <= n ? a : Array.from({ length: n }, (_, i) => a[Math.round((i * (a.length - 1)) / (n - 1))]));

export type Board = { items: Record<BoardGroup, RoomItem[]>; maps: Record<"senate" | "governor" | "house", MapRow[]>; all: { id: string; label: string; group: BoardGroup; href?: string }[] };

export function buildBoard(defs: AggregateDef[], built: Record<string, BuiltAggregate | undefined>, cut?: string): Board {
  const items: Record<BoardGroup, RoomItem[]> = { house: [], senate: [], governor: [], national: [], archive: [] };
  const maps: Board["maps"] = { senate: [], governor: [], house: [] };
  const bestMap: Record<string, Record<string, MapRow>> = { senate: {}, governor: {} };
  for (const d of defs) {
    const g = boardGroupOf(d);
    const b = built[d.id];
    const net = b?.latest?.net ?? null;
    const lead = net == null ? null : net >= 0 ? d.seriesA : d.seriesB;
    const it: RoomItem = {
      id: d.id, label: labelOf(d), sub: d.stateAbbr ? `${d.seriesA.label} vs. ${d.seriesB.label}` : undefined, st: d.stateAbbr,
      value: net == null ? "" : d.fmtMargin(net), color: lead?.color ?? "", spark: b ? sample(b.daily.slice(-90).map((x) => x.net), 36) : [],
      n: b?.polls.length ?? d.polls.length, margin: net == null ? null : Math.abs(net), href: pollHref(d.id),
      fresh: cut ? d.polls.filter((p) => p.endDate > cut).length : 0,
    };
    items[g].push(it);
    if ((g === "senate" || g === "governor") && d.stateAbbr && b?.latest && lead) {
      const row: MapRow = {
        abbr: d.stateAbbr, id: d.id, title: `${STATE_NAME[d.stateAbbr] ?? d.stateAbbr} ${g === "senate" ? "Senate" : "governor"}: ${d.seriesA.label} vs. ${d.seriesB.label}`,
        leader: lead.label, color: lead.color, margin: Math.abs(net!), marginText: d.fmtMargin(net!), polls: b.polls.length, party: lead.party ? lead.party[0] : undefined,
        trend: (() => { const sg = net! >= 0 ? 1 : -1; const tail = b.daily.slice(-43); return tail.filter((_, i) => (tail.length - 1 - i) % 3 === 0).map((x) => x.net * sg); })(),
      };
      const prev = bestMap[g][d.stateAbbr];
      if (!prev || row.polls > prev.polls) bestMap[g][d.stateAbbr] = row;
    }
  }
  maps.senate = Object.values(bestMap.senate); maps.governor = Object.values(bestMap.governor);
  for (const [k, v] of Object.entries(PRIMARIES)) items.archive.push({ id: `prim:${k}`, label: v.title.replace(/ polls$/, ""), value: "Primary", color: "", spark: [], n: 0, href: `/polls/${k}`, margin: null });

  // House: the district polling averages the House forecast uses, one row per district, and one map entry per state
  const byState: Record<string, typeof HOUSE_DISTRICT_POLLS> = {};
  for (const h of HOUSE_DISTRICT_POLLS) {
    (byState[h.st] ??= []).push(h);
    const name = `${h.st}-${String(h.d).padStart(2, "0")}`;
    items.house.push({
      id: h.id, label: name, sub: `${h.dem ?? "Democrat"} vs. ${h.gop ?? "Republican"} · forecast ${h.fm >= 0 ? "D" : "R"}+${Math.abs(h.fm).toFixed(1)}`, st: h.st,
      value: Math.abs(h.poll) < 0.05 ? "Even" : `${h.poll > 0 ? "D" : "R"}+${Math.abs(h.poll).toFixed(1)}`, color: h.poll >= 0 ? "var(--dem)" : "var(--gop)",
      spark: [], n: 0, margin: Math.abs(h.poll), href: h.href,
    });
  }
  for (const [st, list] of Object.entries(byState)) {
    const avg = list.reduce((a, x) => a + x.poll, 0) / list.length;
    const closest = [...list].sort((a, b) => Math.abs(a.poll) - Math.abs(b.poll))[0];
    maps.house.push({
      abbr: st, id: `house:${st}`, title: `${STATE_NAME[st] ?? st} House: ${list.length} polled ${list.length === 1 ? "district" : "districts"}, closest ${st}-${closest.d}`,
      leader: "", color: avg >= 0 ? "var(--dem)" : "var(--gop)", margin: Math.abs(avg), marginText: `${avg >= 0 ? "D" : "R"}+${Math.abs(avg).toFixed(1)}`,
      polls: list.length, party: avg >= 0 ? "D" : "R", label: `${list.length} polled`,
    });
  }
  const all = (Object.keys(items) as BoardGroup[]).flatMap((g) => items[g].map((x) => ({ id: x.id, label: g === "house" ? `${x.label} House` : x.sub ? `${x.label}: ${x.sub.split(" · ")[0]}` : x.label, group: g, href: x.href })));
  return { items, maps, all };
}
