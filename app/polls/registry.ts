// Poll route registry. Every tracked average has one canonical URL, built from a pattern:
// national averages have a name, 2026 races live at /polls/{state}/{race}, 2024 at
// /polls/archive/2024/{state}. A new race never needs a new route name.
import { AGGREGATES, type AggregateDef } from "@/app/_polling/lib/aggregates";

const NATIONAL: Record<string, string> = {
  "generic-ballot": "/polls/generic-ballot",
  "trump-approval": "/polls/approval",
  "vance-favorability": "/polls/approval/vance",
  "right-wrong-track": "/polls/right-track",
  "2028-vance-newsom": "/polls/2028",
  "2024-national": "/polls/archive/2024",
};

/** Race slug from the part of an aggregate id after the state. */
function raceSlug(rest: string) {
  if (rest === "sen-2026") return "senate";
  if (rest === "gov-2026") return "governor";
  return rest.replace(/^sen-/, "senate-").replace(/^gov-/, "governor-").replace(/-2026$/, "");
}

export function pollHref(id: string): string {
  if (NATIONAL[id]) return NATIONAL[id];
  let m = id.match(/^2024-([a-z]{2})$/);
  if (m) return `/polls/archive/2024/${m[1]}`;
  m = id.match(/^2025-([a-z]{2})-gov$/);
  if (m) return `/polls/${m[1]}/governor-2025`;
  m = id.match(/^([a-z]{2})-(.+)$/);
  if (m) return `/polls/${m[1]}/${raceSlug(m[2])}`;
  return `/polls/generic-ballot?race=${encodeURIComponent(id)}`;
}

const BY_HREF: Record<string, AggregateDef> = {};
for (const d of AGGREGATES) if (!BY_HREF[pollHref(d.id)]) BY_HREF[pollHref(d.id)] = d;

export function aggByHref(href: string): AggregateDef | undefined { return BY_HREF[href]; }
export function aggById(id: string): AggregateDef | undefined { return AGGREGATES.find((d) => d.id === id); }

/** Every /polls/{state}/{race} route the averages page can serve. */
export function stateRaceParams(): { state: string; race: string }[] {
  const out: { state: string; race: string }[] = [];
  for (const d of AGGREGATES) {
    const m = pollHref(d.id).match(/^\/polls\/([a-z]{2})\/([^/?]+)$/);
    if (m) out.push({ state: m[1], race: m[2] });
  }
  for (const k of Object.keys(PRIMARIES)) { const [state, race] = k.split("/"); out.push({ state, race }); }
  return out;
}

/** Primary pages that predate the averages engine, served at the same pattern. */
export const PRIMARIES: Record<string, { title: string }> = {
  "fl/governor-gop-primary": { title: "Florida governor Republican primary polls" },
  "tx/senate-gop-primary": { title: "Texas Senate Republican primary polls" },
  "tx/senate-dem-primary": { title: "Texas Senate Democratic primary polls" },
  "me/senate-dem-primary": { title: "Maine Senate Democratic primary polls" },
};

export const AGG_GROUPS: { key: string; title: string; test: (d: AggregateDef) => boolean }[] = [
  { key: "national", title: "National", test: (d) => ["Approval", "2026 House", "National mood", "2028"].includes(d.category) },
  { key: "senate", title: "2026 Senate", test: (d) => d.category === "2026 Senate" },
  { key: "governor", title: "2026 Governor", test: (d) => d.category === "2026 Governor" },
  { key: "2025", title: "2025 governor races", test: (d) => d.category === "2025 Governor" },
  { key: "2024", title: "2024 president", test: (d) => d.category === "2024 President" },
];
