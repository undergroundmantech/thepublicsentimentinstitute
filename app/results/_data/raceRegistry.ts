// Race slug registry — maps race ID ↔ slug ↔ election date
// Used for SEO-friendly URLs:
//   Active:   /results/2026-06-09/south-carolina-us-senate-republican-primary
//   Archived: /results/archive/2026-06-02/new-jersey-us-senate-democratic-primary
// Add new races here when a new election date is added.

export type RaceRegistryEntry = {
  id: number;
  slug: string;
  date: string; // YYYY-MM-DD
  label: string;
  archived?: boolean;
};

export const RACE_REGISTRY: RaceRegistryEntry[] = [
  // ── May 26, 2026 (Texas Runoffs — ARCHIVED) ───────────────────────────────
  { id: 79766, date: "2026-05-26", slug: "texas-us-senate-republican-primary-runoff",            label: "Texas US Senate Republican Primary Runoff",            archived: true },
  { id: 79722, date: "2026-05-26", slug: "texas-attorney-general-republican-primary-runoff",     label: "Texas Attorney General Republican Primary Runoff",     archived: true },
  { id: 79736, date: "2026-05-26", slug: "texas-lieutenant-governor-democratic-primary-runoff",  label: "Texas Lieutenant Governor Democratic Primary Runoff",  archived: true },
  { id: 79739, date: "2026-05-26", slug: "texas-railroad-commissioner-republican-primary-runoff",label: "Texas Railroad Commissioner Republican Primary Runoff", archived: true },
  { id: 79755, date: "2026-05-26", slug: "texas-us-house-18-democratic-primary-runoff",          label: "Texas US House 18 Democratic Primary Runoff",          archived: true },

  // ── June 2, 2026 — CA active; IA/MT/NJ/NM/SD archived ────────────────────
  { id: 79777, date: "2026-06-02", slug: "california-governor-open-primary",                     label: "California Governor Open Primary" },
  { id: 79938, date: "2026-06-02", slug: "los-angeles-mayor-open-primary",                       label: "Los Angeles Mayor Open Primary" },
  { id: 79893, date: "2026-06-02", slug: "california-us-house-1-open-primary",                   label: "California US House 1 Open Primary" },
  { id: 79932, date: "2026-06-02", slug: "california-us-house-7-open-primary",                   label: "California US House 7 Open Primary" },
  { id: 79884, date: "2026-06-02", slug: "california-us-house-11-open-primary",                  label: "California US House 11 Open Primary" },
  { id: 79916, date: "2026-06-02", slug: "california-us-house-40-open-primary",                  label: "California US House 40 Open Primary" },
  { id: 79924, date: "2026-06-02", slug: "california-us-house-48-open-primary",                  label: "California US House 48 Open Primary" },
  { id: 79945, date: "2026-06-02", slug: "iowa-governor-republican-primary",                     label: "Iowa Governor Republican Primary",                    archived: true },
  { id: 80210, date: "2026-06-02", slug: "iowa-us-senate-democratic-primary",                    label: "Iowa US Senate Democratic Primary",                   archived: true },
  { id: 80211, date: "2026-06-02", slug: "iowa-us-senate-republican-primary",                    label: "Iowa US Senate Republican Primary",                   archived: true },
  { id: 80204, date: "2026-06-02", slug: "iowa-us-house-2-democratic-primary",                   label: "Iowa US House 2 Democratic Primary",                  archived: true },
  { id: 80205, date: "2026-06-02", slug: "iowa-us-house-2-republican-primary",                   label: "Iowa US House 2 Republican Primary",                  archived: true },
  { id: 80458, date: "2026-06-02", slug: "montana-us-senate-democratic-primary",                 label: "Montana US Senate Democratic Primary",                archived: true },
  { id: 80460, date: "2026-06-02", slug: "montana-us-senate-republican-primary",                 label: "Montana US Senate Republican Primary",                archived: true },
  { id: 80452, date: "2026-06-02", slug: "montana-us-house-1-democratic-primary",                label: "Montana US House 1 Democratic Primary",               archived: true },
  { id: 80454, date: "2026-06-02", slug: "montana-us-house-1-republican-primary",                label: "Montana US House 1 Republican Primary",               archived: true },
  { id: 80455, date: "2026-06-02", slug: "montana-us-house-2-democratic-primary",                label: "Montana US House 2 Democratic Primary",               archived: true },
  { id: 80457, date: "2026-06-02", slug: "montana-us-house-2-republican-primary",                label: "Montana US House 2 Republican Primary",               archived: true },
  { id: 81057, date: "2026-06-02", slug: "new-jersey-us-senate-democratic-primary",              label: "New Jersey US Senate Democratic Primary",             archived: true },
  { id: 81058, date: "2026-06-02", slug: "new-jersey-us-senate-republican-primary",              label: "New Jersey US Senate Republican Primary",             archived: true },
  { id: 81046, date: "2026-06-02", slug: "new-jersey-us-house-7-democratic-primary",             label: "New Jersey US House 7 Democratic Primary",            archived: true },
  { id: 81047, date: "2026-06-02", slug: "new-jersey-us-house-7-republican-primary",             label: "New Jersey US House 7 Republican Primary",            archived: true },
  { id: 81048, date: "2026-06-02", slug: "new-jersey-us-house-8-democratic-primary",             label: "New Jersey US House 8 Democratic Primary",            archived: true },
  { id: 81055, date: "2026-06-02", slug: "new-jersey-us-house-12-democratic-primary",            label: "New Jersey US House 12 Democratic Primary",           archived: true },
  { id: 81056, date: "2026-06-02", slug: "new-jersey-us-house-12-republican-primary",            label: "New Jersey US House 12 Republican Primary",           archived: true },
  { id: 81014, date: "2026-06-02", slug: "new-mexico-us-senate-democratic-primary",              label: "New Mexico US Senate Democratic Primary",             archived: true },
  { id: 81015, date: "2026-06-02", slug: "new-mexico-us-senate-republican-primary",              label: "New Mexico US Senate Republican Primary",             archived: true },
  { id: 80461, date: "2026-06-02", slug: "south-dakota-governor-republican-primary",             label: "South Dakota Governor Republican Primary",            archived: true },
  { id: 80511, date: "2026-06-02", slug: "south-dakota-us-house-at-large-republican-primary",    label: "South Dakota US House At-Large Republican Primary",   archived: true },
  { id: 80512, date: "2026-06-02", slug: "south-dakota-us-senate-republican-primary",            label: "South Dakota US Senate Republican Primary",           archived: true },

  // ── June 9, 2026 — active ─────────────────────────────────────────────────
  { id: 82664, date: "2026-06-09", slug: "south-carolina-us-senate-republican-primary",          label: "South Carolina US Senate Republican Primary" },
  { id: 82596, date: "2026-06-09", slug: "south-carolina-governor-republican-primary",           label: "South Carolina Governor Republican Primary" },
  { id: 82663, date: "2026-06-09", slug: "south-carolina-us-senate-democratic-primary",          label: "South Carolina US Senate Democratic Primary" },
  { id: 82595, date: "2026-06-09", slug: "south-carolina-governor-democratic-primary",           label: "South Carolina Governor Democratic Primary" },
  { id: 82594, date: "2026-06-09", slug: "south-carolina-comptroller-general-democratic-primary",label: "South Carolina Comptroller General Democratic Primary" },
  { id: 82597, date: "2026-06-09", slug: "south-carolina-secretary-of-state-democratic-primary", label: "South Carolina Secretary of State Democratic Primary" },
  { id: 82592, date: "2026-06-09", slug: "south-carolina-attorney-general-republican-primary",   label: "South Carolina Attorney General Republican Primary" },
  { id: 82654, date: "2026-06-09", slug: "south-carolina-us-house-1-democratic-primary",         label: "South Carolina US House 1 Democratic Primary" },
  { id: 82655, date: "2026-06-09", slug: "south-carolina-us-house-1-republican-primary",         label: "South Carolina US House 1 Republican Primary" },
  { id: 82657, date: "2026-06-09", slug: "south-carolina-us-house-2-republican-primary",         label: "South Carolina US House 2 Republican Primary" },
  { id: 82662, date: "2026-06-09", slug: "south-carolina-us-house-6-republican-primary",         label: "South Carolina US House 6 Republican Primary" },
  { id: 83063, date: "2026-06-09", slug: "maine-us-senate-democratic-primary",                   label: "Maine US Senate Democratic Primary" },
  { id: 82693, date: "2026-06-09", slug: "maine-governor-democratic-primary",                    label: "Maine Governor Democratic Primary" },
  { id: 82694, date: "2026-06-09", slug: "maine-governor-republican-primary",                    label: "Maine Governor Republican Primary" },
  { id: 83061, date: "2026-06-09", slug: "maine-us-house-2-democratic-primary",                  label: "Maine US House 2 Democratic Primary" },
  { id: 83111, date: "2026-06-09", slug: "nevada-governor-republican-primary",                   label: "Nevada Governor Republican Primary" },
  { id: 83110, date: "2026-06-09", slug: "nevada-governor-democratic-primary",                   label: "Nevada Governor Democratic Primary" },
  { id: 83081, date: "2026-06-09", slug: "nevada-attorney-general-republican-primary",           label: "Nevada Attorney General Republican Primary" },
  { id: 83080, date: "2026-06-09", slug: "nevada-attorney-general-democratic-primary",           label: "Nevada Attorney General Democratic Primary" },
  { id: 83112, date: "2026-06-09", slug: "nevada-lieutenant-governor-democratic-primary",        label: "Nevada Lieutenant Governor Democratic Primary" },
  { id: 83113, date: "2026-06-09", slug: "nevada-secretary-of-state-republican-primary",         label: "Nevada Secretary of State Republican Primary" },
  { id: 83150, date: "2026-06-09", slug: "nevada-us-house-1-republican-primary",                 label: "Nevada US House 1 Republican Primary" },
  { id: 83149, date: "2026-06-09", slug: "nevada-us-house-1-democratic-primary",                 label: "Nevada US House 1 Democratic Primary" },
  { id: 82403, date: "2026-06-09", slug: "north-dakota-us-house-at-large-republican-primary",    label: "North Dakota US House At-Large Republican Primary" },
  { id: 82384, date: "2026-06-09", slug: "north-dakota-public-service-commissioner-republican-primary", label: "North Dakota Public Service Commissioner Republican Primary" },
];

// Lookup helpers
export const slugToId = Object.fromEntries(RACE_REGISTRY.map(r => [r.slug, r.id]));
export const idToSlug = Object.fromEntries(RACE_REGISTRY.map(r => [r.id, r.slug]));
export const idToDate = Object.fromEntries(RACE_REGISTRY.map(r => [r.id, r.date]));
export const idToLabel = Object.fromEntries(RACE_REGISTRY.map(r => [r.id, r.label]));
export const idToArchived = Object.fromEntries(RACE_REGISTRY.map(r => [r.id, !!r.archived]));

/** Returns the canonical URL for a race — archived races go under /results/archive/ */
export function getRaceUrl(id: number): string | null {
  const slug = idToSlug[id];
  const date = idToDate[id];
  if (!slug || !date) return null;
  return idToArchived[id]
    ? `/results/archive/${date}/${slug}`
    : `/results/${date}/${slug}`;
}

// Get all unique election dates, sorted newest first
export const ELECTION_DATES = [...new Set(RACE_REGISTRY.map(r => r.date))].sort((a, b) => b.localeCompare(a));

// Get all races for a given date
export function getRacesByDate(date: string): RaceRegistryEntry[] {
  return RACE_REGISTRY.filter(r => r.date === date);
}

// Format date for display: "2026-06-09" → "June 9, 2026"
export function formatElectionDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
