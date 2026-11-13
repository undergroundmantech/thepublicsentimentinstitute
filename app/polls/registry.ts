// Poll route registry. Every tracked average has one canonical URL, built from a pattern:
// national averages have a name, 2028 matchups live at /polls/2028/{rep}-vs-{dem}, the 2025 governor races at
// /polls/{state}/governor-2025 and 2024 at /polls/archive/2024/{state}. A new race never needs a new route name.
//
// Nov 13 2026: the 2026 Senate and governor averages closed with the election and left the desk. Their ids still
// resolve, to the forecast race page, which keeps the final average with the result.
import { AGGREGATES, DESK_AGGREGATES, RETIRED_CATEGORIES, type AggregateDef } from "@/app/_polling/lib/aggregates";
import { MATCHUPS_2028 } from "@/app/_polling/2028/matchups";

const NATIONAL: Record<string, string> = {
  "generic-ballot": "/polls/generic-ballot",
  "trump-approval": "/polls/approval",
  "vance-favorability": "/polls/approval/vance",
  "right-wrong-track": "/polls/right-track",
  "2024-national": "/polls/archive/2024",
};
for (const m of MATCHUPS_2028) NATIONAL[m.id] = `/polls/2028/${m.slug}`;

/** Race slug from the part of an aggregate id after the state. */
function raceSlug(rest: string) {
  if (rest === "sen-2026") return "senate";
  if (rest === "gov-2026") return "governor";
  return rest.replace(/^sen-/, "senate-").replace(/^gov-/, "governor-").replace(/-2026$/, "");
}

/** The forecast race page for a closed 2026 race. */
export function forecastHrefOf(d: AggregateDef): string {
  const st = (d.stateAbbr ?? d.id.slice(0, 2)).toLowerCase();
  return `/forecast/${st}/${d.category === "2026 Senate" ? "senate" : "governor"}`;
}

/** The old /polls/{state}/{race} path of a closed 2026 race, kept so the old links can be sent on. */
function oldPath(d: AggregateDef) {
  const m = d.id.match(/^([a-z]{2})-(.+)$/);
  return m ? `/polls/${m[1]}/${raceSlug(m[2])}` : null;
}

export function pollHref(id: string): string {
  if (NATIONAL[id]) return NATIONAL[id];
  let m = id.match(/^2024-([a-z]{2})$/);
  if (m) return `/polls/archive/2024/${m[1]}`;
  m = id.match(/^2025-([a-z]{2})-gov$/);
  if (m) return `/polls/${m[1]}/governor-2025`;
  const d = AGGREGATES.find((x) => x.id === id);
  if (d && RETIRED_CATEGORIES.has(d.category)) return forecastHrefOf(d);
  m = id.match(/^([a-z]{2})-(.+)$/);
  if (m) return `/polls/${m[1]}/${raceSlug(m[2])}`;
  return `/polls/generic-ballot?race=${encodeURIComponent(id)}`;
}

const BY_HREF: Record<string, AggregateDef> = {};
for (const d of DESK_AGGREGATES) if (!BY_HREF[pollHref(d.id)]) BY_HREF[pollHref(d.id)] = d;

export function aggByHref(href: string): AggregateDef | undefined { return BY_HREF[href]; }
export function aggById(id: string): AggregateDef | undefined { return DESK_AGGREGATES.find((d) => d.id === id); }

/** Every /polls/{state}/{race} route the averages page serves: the 2025 governor archive. */
export function stateRaceParams(): { state: string; race: string }[] {
  const out: { state: string; race: string }[] = [];
  for (const d of DESK_AGGREGATES) {
    const m = pollHref(d.id).match(/^\/polls\/([a-z]{2})\/([^/?]+)$/);
    if (m) out.push({ state: m[1], race: m[2] });
  }
  return out;
}

/** Old /polls/{state}/{race} routes of the closed 2026 races and primaries, each with where it now goes. */
export const RETIRED_ROUTES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const d of AGGREGATES) {
    if (!RETIRED_CATEGORIES.has(d.category)) continue;
    const p = oldPath(d);
    if (p && !out[p]) out[p] = forecastHrefOf(d);
  }
  for (const k of ["fl/governor-gop-primary", "tx/senate-gop-primary", "tx/senate-dem-primary", "me/senate-dem-primary"]) out[`/polls/${k}`] = "/polls";
  return out;
})();
export function retiredRaceParams(): { state: string; race: string }[] {
  return Object.keys(RETIRED_ROUTES).map((p) => { const [, , state, race] = p.split("/"); return { state, race }; });
}

/** Primary pages that predate the averages engine. The 2026 primaries are over; none are served. */
export const PRIMARIES: Record<string, { title: string }> = {};

export const AGG_GROUPS: { key: string; title: string; test: (d: AggregateDef) => boolean }[] = [
  { key: "2028", title: "2028 general election", test: (d) => d.category === "2028" },
  { key: "national", title: "National", test: (d) => ["Approval", "2026 House", "National mood"].includes(d.category) },
  { key: "2025", title: "2025 governor races", test: (d) => d.category === "2025 Governor" },
  { key: "2024", title: "2024 president", test: (d) => d.category === "2024 President" },
];
