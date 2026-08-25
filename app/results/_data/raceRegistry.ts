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
  // CO-04 §4d "About This Race" editorial copy (newsroom voice, tier 3+).
  // Only populated where we have real, verified facts about the race —
  // never fabricated. Absent entries simply don't render the section.
  about?: string;
};

export const RACE_REGISTRY: RaceRegistryEntry[] = [
  // ── May 26, 2026 (Texas Runoffs — ARCHIVED) ───────────────────────────────
  { id: 79766, date: "2026-05-26", slug: "texas-us-senate-republican-primary-runoff",            label: "Texas US Senate Republican Primary Runoff",            archived: true },
  { id: 79722, date: "2026-05-26", slug: "texas-attorney-general-republican-primary-runoff",     label: "Texas Attorney General Republican Primary Runoff",     archived: true },
  { id: 79736, date: "2026-05-26", slug: "texas-lieutenant-governor-democratic-primary-runoff",  label: "Texas Lieutenant Governor Democratic Primary Runoff",  archived: true },
  { id: 79739, date: "2026-05-26", slug: "texas-railroad-commissioner-republican-primary-runoff",label: "Texas Railroad Commissioner Republican Primary Runoff", archived: true },
  { id: 79755, date: "2026-05-26", slug: "texas-us-house-18-democratic-primary-runoff",          label: "Texas US House 18 Democratic Primary Runoff",          archived: true },

  // ── June 2, 2026 — CA active; IA/MT/NJ/NM/SD archived ────────────────────
  { id: 79777, date: "2026-06-02", slug: "california-governor-open-primary",                     label: "California Governor Open Primary",             archived: true },
  { id: 79938, date: "2026-06-02", slug: "los-angeles-mayor-open-primary",                       label: "Los Angeles Mayor Open Primary",               archived: true },
  { id: 79893, date: "2026-06-02", slug: "california-us-house-1-open-primary",                   label: "California US House 1 Open Primary",             archived: true },
  { id: 79932, date: "2026-06-02", slug: "california-us-house-7-open-primary",                   label: "California US House 7 Open Primary",             archived: true },
  { id: 79884, date: "2026-06-02", slug: "california-us-house-11-open-primary",                  label: "California US House 11 Open Primary",            archived: true },
  { id: 79916, date: "2026-06-02", slug: "california-us-house-40-open-primary",                  label: "California US House 40 Open Primary",            archived: true },
  { id: 79924, date: "2026-06-02", slug: "california-us-house-48-open-primary",                  label: "California US House 48 Open Primary",            archived: true },
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
  { id: 82664, date: "2026-06-09", slug: "south-carolina-us-senate-republican-primary",          label: "South Carolina US Senate Republican Primary",         archived: true },
  { id: 82596, date: "2026-06-09", slug: "south-carolina-governor-republican-primary",           label: "South Carolina Governor Republican Primary",          archived: true },
  { id: 82663, date: "2026-06-09", slug: "south-carolina-us-senate-democratic-primary",          label: "South Carolina US Senate Democratic Primary",         archived: true },
  { id: 82595, date: "2026-06-09", slug: "south-carolina-governor-democratic-primary",           label: "South Carolina Governor Democratic Primary",          archived: true },
  { id: 82594, date: "2026-06-09", slug: "south-carolina-comptroller-general-democratic-primary",label: "South Carolina Comptroller General Democratic Primary", archived: true },
  { id: 82597, date: "2026-06-09", slug: "south-carolina-secretary-of-state-democratic-primary", label: "South Carolina Secretary of State Democratic Primary",  archived: true },
  { id: 82592, date: "2026-06-09", slug: "south-carolina-attorney-general-republican-primary",   label: "South Carolina Attorney General Republican Primary",   archived: true },
  { id: 82654, date: "2026-06-09", slug: "south-carolina-us-house-1-democratic-primary",         label: "South Carolina US House 1 Democratic Primary",        archived: true },
  { id: 82655, date: "2026-06-09", slug: "south-carolina-us-house-1-republican-primary",         label: "South Carolina US House 1 Republican Primary",        archived: true },
  { id: 82657, date: "2026-06-09", slug: "south-carolina-us-house-2-republican-primary",         label: "South Carolina US House 2 Republican Primary",        archived: true },
  { id: 82662, date: "2026-06-09", slug: "south-carolina-us-house-6-republican-primary",         label: "South Carolina US House 6 Republican Primary",        archived: true },
  { id: 83063, date: "2026-06-09", slug: "maine-us-senate-democratic-primary",                   label: "Maine US Senate Democratic Primary",                  archived: true },
  { id: 82693, date: "2026-06-09", slug: "maine-governor-democratic-primary",                    label: "Maine Governor Democratic Primary",                   archived: true },
  { id: 82694, date: "2026-06-09", slug: "maine-governor-republican-primary",                    label: "Maine Governor Republican Primary",                   archived: true },
  { id: 83061, date: "2026-06-09", slug: "maine-us-house-2-democratic-primary",                  label: "Maine US House 2 Democratic Primary",                 archived: true },
  { id: 83111, date: "2026-06-09", slug: "nevada-governor-republican-primary",                   label: "Nevada Governor Republican Primary",                  archived: true },
  { id: 83110, date: "2026-06-09", slug: "nevada-governor-democratic-primary",                   label: "Nevada Governor Democratic Primary",                  archived: true },
  { id: 83081, date: "2026-06-09", slug: "nevada-attorney-general-republican-primary",           label: "Nevada Attorney General Republican Primary",          archived: true },
  { id: 83080, date: "2026-06-09", slug: "nevada-attorney-general-democratic-primary",           label: "Nevada Attorney General Democratic Primary",          archived: true },
  { id: 83112, date: "2026-06-09", slug: "nevada-lieutenant-governor-democratic-primary",        label: "Nevada Lieutenant Governor Democratic Primary",       archived: true },
  { id: 83113, date: "2026-06-09", slug: "nevada-secretary-of-state-republican-primary",         label: "Nevada Secretary of State Republican Primary",        archived: true },
  { id: 83150, date: "2026-06-09", slug: "nevada-us-house-1-republican-primary",                 label: "Nevada US House 1 Republican Primary",                archived: true },
  { id: 83149, date: "2026-06-09", slug: "nevada-us-house-1-democratic-primary",                 label: "Nevada US House 1 Democratic Primary",                archived: true },
  { id: 82403, date: "2026-06-09", slug: "north-dakota-us-house-at-large-republican-primary",    label: "North Dakota US House At-Large Republican Primary",   archived: true },
  { id: 82384, date: "2026-06-09", slug: "north-dakota-public-service-commissioner-republican-primary", label: "North Dakota Public Service Commissioner Republican Primary", archived: true },

  // ── June 16, 2026 — ARCHIVED ─────────────────────────────────────────────
  // Georgia
  { id: 83316, date: "2026-06-16", slug: "georgia-us-senate-republican-primary-runoff",          label: "Georgia US Senate Republican Primary Runoff",          archived: true },
  { id: 83266, date: "2026-06-16", slug: "georgia-governor-republican-primary-runoff",            label: "Georgia Governor Republican Primary Runoff",            archived: true },
  { id: 83277, date: "2026-06-16", slug: "georgia-lieutenant-governor-republican-primary-runoff", label: "Georgia Lieutenant Governor Republican Primary Runoff",  archived: true },
  { id: 83276, date: "2026-06-16", slug: "georgia-lieutenant-governor-democratic-primary-runoff", label: "Georgia Lieutenant Governor Democratic Primary Runoff",  archived: true },
  { id: 83289, date: "2026-06-16", slug: "georgia-secretary-of-state-republican-primary-runoff",  label: "Georgia Secretary of State Republican Primary Runoff",   archived: true },
  { id: 83288, date: "2026-06-16", slug: "georgia-secretary-of-state-democratic-primary-runoff",  label: "Georgia Secretary of State Democratic Primary Runoff",   archived: true },
  { id: 83312, date: "2026-06-16", slug: "georgia-us-house-11-republican-primary-runoff",         label: "Georgia US House 11 Republican Primary Runoff",          archived: true },
  { id: 83313, date: "2026-06-16", slug: "georgia-us-house-12-democratic-primary-runoff",         label: "Georgia US House 12 Democratic Primary Runoff",          archived: true },
  { id: 83314, date: "2026-06-16", slug: "georgia-us-house-1-democratic-primary-runoff",          label: "Georgia US House 1 Democratic Primary Runoff",           archived: true },
  { id: 83315, date: "2026-06-16", slug: "georgia-us-house-7-democratic-primary-runoff",          label: "Georgia US House 7 Democratic Primary Runoff",           archived: true },
  // Alabama
  { id: 83428, date: "2026-06-16", slug: "alabama-us-senate-republican-primary-runoff",           label: "Alabama US Senate Republican Primary Runoff",           archived: true },
  { id: 83427, date: "2026-06-16", slug: "alabama-us-senate-democratic-primary-runoff",           label: "Alabama US Senate Democratic Primary Runoff",           archived: true },
  { id: 83430, date: "2026-06-16", slug: "alabama-lieutenant-governor-republican-primary-runoff",  label: "Alabama Lieutenant Governor Republican Primary Runoff",  archived: true },
  { id: 83431, date: "2026-06-16", slug: "alabama-attorney-general-republican-primary-runoff",    label: "Alabama Attorney General Republican Primary Runoff",    archived: true },
  // Oklahoma
  { id: 83476, date: "2026-06-16", slug: "oklahoma-state-question-832",                           label: "Oklahoma State Question 832 — $15 Minimum Wage",        archived: true },
  { id: 83424, date: "2026-06-16", slug: "oklahoma-us-senate-republican-primary",                 label: "Oklahoma US Senate Republican Primary",                 archived: true },
  { id: 83423, date: "2026-06-16", slug: "oklahoma-us-senate-democratic-primary",                 label: "Oklahoma US Senate Democratic Primary",                 archived: true },
  { id: 83344, date: "2026-06-16", slug: "oklahoma-governor-republican-primary",                  label: "Oklahoma Governor Republican Primary",                  archived: true },
  { id: 83343, date: "2026-06-16", slug: "oklahoma-governor-democratic-primary",                  label: "Oklahoma Governor Democratic Primary",                  archived: true },
  { id: 83415, date: "2026-06-16", slug: "oklahoma-us-house-1-republican-primary",                label: "Oklahoma US House 1 Republican Primary",                archived: true },
  // Washington DC
  { id: 83478, date: "2026-06-16", slug: "dc-us-house-delegate-democratic-primary",               label: "DC US House Delegate Democratic Primary",               archived: true },
  { id: 83479, date: "2026-06-16", slug: "dc-mayor-democratic-primary",                           label: "DC Mayor Democratic Primary",                           archived: true },

  // ── June 23, 2026 — active ────────────────────────────────────────────────
  // South Carolina (runoffs from June 9 primary)
  { id: 84103, date: "2026-06-23", slug: "south-carolina-agriculture-commissioner-republican-runoff", label: "South Carolina Agriculture Commissioner Republican Runoff" },
  { id: 84104, date: "2026-06-23", slug: "south-carolina-attorney-general-republican-runoff",          label: "South Carolina Attorney General Republican Runoff" },
  { id: 84105, date: "2026-06-23", slug: "south-carolina-governor-republican-runoff",                  label: "South Carolina Governor Republican Runoff",
    about: "This runoff settles the Republican nomination after no candidate cleared the majority threshold in the June 9 primary. Upstate counties (Greenville, Spartanburg) carry the largest share of the runoff electorate and have historically reported fastest on runoff night." },
  { id: 84106, date: "2026-06-23", slug: "south-carolina-us-house-1-republican-runoff",                label: "South Carolina US House 1 Republican Runoff" },
  { id: 84110, date: "2026-06-23", slug: "south-carolina-us-house-1-democratic-runoff",                label: "South Carolina US House 1 Democratic Runoff" },
  { id: 84111, date: "2026-06-23", slug: "south-carolina-us-house-2-democratic-runoff",                label: "South Carolina US House 2 Democratic Runoff" },
  // Maryland
  { id: 83700, date: "2026-06-23", slug: "maryland-governor-republican-primary",                   label: "Maryland Governor Republican Primary" },
  { id: 83920, date: "2026-06-23", slug: "maryland-us-house-3-democratic-primary",                  label: "Maryland US House 3 Democratic Primary" },
  { id: 83925, date: "2026-06-23", slug: "maryland-us-house-6-democratic-primary",                  label: "Maryland US House 6 Democratic Primary" },
  { id: 83926, date: "2026-06-23", slug: "maryland-us-house-6-republican-primary",                  label: "Maryland US House 6 Republican Primary" },
  // New York
  { id: 84040, date: "2026-06-23", slug: "new-york-us-house-10-democratic-primary",                label: "New York US House 10 Democratic Primary" },
  { id: 84042, date: "2026-06-23", slug: "new-york-us-house-12-democratic-primary",                label: "New York US House 12 Democratic Primary" },
  { id: 84043, date: "2026-06-23", slug: "new-york-us-house-13-democratic-primary",                label: "New York US House 13 Democratic Primary" },
  { id: 84045, date: "2026-06-23", slug: "new-york-us-house-15-democratic-primary",                label: "New York US House 15 Democratic Primary" },
  { id: 84117, date: "2026-06-23", slug: "new-york-us-house-17-democratic-primary",                label: "New York US House 17 Democratic Primary" },
  // Utah
  { id: 84100, date: "2026-06-23", slug: "utah-us-house-1-democratic-primary",                    label: "Utah US House 1 Democratic Primary" },
  { id: 84101, date: "2026-06-23", slug: "utah-us-house-2-republican-primary",                    label: "Utah US House 2 Republican Primary" },
  { id: 84102, date: "2026-06-23", slug: "utah-us-house-3-republican-primary",                    label: "Utah US House 3 Republican Primary" },

  // June 30 2026 — Colorado (Command Deck test bed — see raceCapabilities.ts)
  { id: 84322, date: "2026-06-30", slug: "colorado-us-senate-democratic-primary",                 label: "Colorado US Senate Democratic Primary",
    about: "Colorado's open US Senate seat drew a crowded Democratic primary field after the incumbent's retirement. The Denver-Boulder corridor's turnout typically decides statewide primaries like this one, with rural Western Slope counties reporting slower and later in the night." },

  // ── August 18, 2026 — Florida, Wyoming, Alaska — active ──────────────────
  // Florida. The Governor Republican primary is the headline race and has its
  // own route at /results/2026-08-18/florida-governor-republican-primary.
  { id: 86349, date: "2026-08-18", slug: "florida-governor-republican-primary",                   label: "Florida Governor Republican Primary",
    about: "A four-way Republican field with no runoff: whoever finishes first takes the nomination, however narrow the margin. The TPSI model separates Byron Donalds and James Fishback by less than its own margin of error, with Jay Collins and Paul Renner holding enough of the vote to decide which of them leads. Florida's Panhandle votes on Central time, so the state does not finish closing until 8:00 PM ET, and the large bank of vote-by-mail ballots released first is not a random sample of the electorate." },
  { id: 86348, date: "2026-08-18", slug: "florida-governor-democratic-primary",                   label: "Florida Governor Democratic Primary" },
  { id: 86440, date: "2026-08-18", slug: "florida-us-senate-republican-primary",                  label: "Florida US Senate Republican Primary" },
  { id: 86439, date: "2026-08-18", slug: "florida-us-senate-democratic-primary",                  label: "Florida US Senate Democratic Primary" },
  { id: 86417, date: "2026-08-18", slug: "florida-us-house-2-republican-primary",                 label: "Florida US House 2 Republican Primary" },
  { id: 86437, date: "2026-08-18", slug: "florida-us-house-7-republican-primary",                 label: "Florida US House 7 Republican Primary" },
  { id: 86409, date: "2026-08-18", slug: "florida-us-house-14-republican-primary",                label: "Florida US House 14 Republican Primary" },
  { id: 86415, date: "2026-08-18", slug: "florida-us-house-19-republican-primary",                label: "Florida US House 19 Republican Primary" },
  { id: 86418, date: "2026-08-18", slug: "florida-us-house-20-democratic-primary",                label: "Florida US House 20 Democratic Primary" },
  { id: 86425, date: "2026-08-18", slug: "florida-us-house-24-democratic-primary",                label: "Florida US House 24 Democratic Primary" },
  { id: 86427, date: "2026-08-18", slug: "florida-us-house-25-republican-primary",                label: "Florida US House 25 Republican Primary" },
  // Wyoming
  { id: 86810, date: "2026-08-18", slug: "wyoming-us-senate-republican-primary",                  label: "Wyoming US Senate Republican Primary" },
  { id: 86809, date: "2026-08-18", slug: "wyoming-us-senate-democratic-primary",                  label: "Wyoming US Senate Democratic Primary" },
  { id: 86808, date: "2026-08-18", slug: "wyoming-us-house-at-large-republican-primary",          label: "Wyoming US House At-Large Republican Primary" },
  { id: 86807, date: "2026-08-18", slug: "wyoming-us-house-at-large-democratic-primary",          label: "Wyoming US House At-Large Democratic Primary" },
  // Alaska runs one nonpartisan ballot and advances four to the November RCV general.
  { id: 86863, date: "2026-08-18", slug: "alaska-us-senate-open-primary",                         label: "Alaska US Senate Open Primary",
    about: "Alaska's nonpartisan primary puts every candidate on one ballot and advances the top four to a ranked-choice general election in November. There is no party nomination decided here and no single winner on the night — the question is only which four names appear on the November ballot." },
  { id: 86862, date: "2026-08-18", slug: "alaska-us-house-at-large-open-primary",                 label: "Alaska US House At-Large Open Primary" },

  // ── August 25, 2026 — Oklahoma, South Carolina, Georgia runoffs — active ──
  // Oklahoma. The Governor Republican runoff is the headline race and has its
  // own route at /results/2026-08-25/oklahoma-governor-republican-runoff.
  { id: 87529, date: "2026-08-25", slug: "oklahoma-governor-republican-runoff",                    label: "Oklahoma Governor Republican Runoff",
    about: "Neither Gentner Drummond nor Mike Mazzei cleared 50% in June, so the nomination is settled here with no further round. The TPSI model separates them by less than a point and a half — inside its own margin of error — with Drummond ahead on rural and western Oklahoma and Mazzei narrowly carrying Oklahoma County and Tulsa County. Those two metros together cast under a third of the expected vote, so the race is decided in the seventy-five counties outside them. Oklahoma is entirely on Central time and closes statewide at 8:00 PM ET." },
  { id: 87530, date: "2026-08-25", slug: "oklahoma-insurance-commissioner-republican-runoff",      label: "Oklahoma Insurance Commissioner Republican Runoff" },
  { id: 87531, date: "2026-08-25", slug: "oklahoma-commissioner-of-labor-republican-runoff",       label: "Oklahoma Commissioner of Labor Republican Runoff" },
  { id: 87532, date: "2026-08-25", slug: "oklahoma-superintendent-of-public-instruction-republican-runoff", label: "Oklahoma Superintendent of Public Instruction Republican Runoff" },
  { id: 87533, date: "2026-08-25", slug: "oklahoma-us-senate-democratic-runoff",                   label: "Oklahoma US Senate Democratic Runoff" },
  // South Carolina. Forecast published, but no TPSI poll and therefore no county model.
  { id: 87534, date: "2026-08-25", slug: "south-carolina-us-senate-special-republican-runoff",     label: "South Carolina US Senate Special Republican Runoff",
    about: "A special-election runoff to fill the seat outright. TPSI publishes a win probability for this race but did not field a survey of it: the number is a desk judgement from the first round, the endorsements since, and how South Carolina runoff electorates have behaved before. Turnout is assumed at 60% of the 465,076 ballots cast in the first round. There is no county-level forecast, because there is no poll to decompose." },
  // Georgia
  { id: 87536, date: "2026-08-25", slug: "georgia-us-house-13-runoff",                             label: "Georgia US House 13 Runoff" },
];

// Lookup helpers
export const slugToId = Object.fromEntries(RACE_REGISTRY.map(r => [r.slug, r.id]));
export const idToSlug = Object.fromEntries(RACE_REGISTRY.map(r => [r.id, r.slug]));
export const idToDate = Object.fromEntries(RACE_REGISTRY.map(r => [r.id, r.date]));
export const idToLabel = Object.fromEntries(RACE_REGISTRY.map(r => [r.id, r.label]));
export const idToArchived = Object.fromEntries(RACE_REGISTRY.map(r => [r.id, !!r.archived]));
export const idToAbout = Object.fromEntries(RACE_REGISTRY.map(r => [r.id, r.about]));

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
