// Editorial coverage watchlist — races we intend to cover as they come onto
// CivicAPI's calendar, keyed by date/state/office (NOT CivicAPI race id).
//
// Per the note in raceCapabilities.ts: CivicAPI's race-search endpoint only
// publishes races ~2-3 weeks out, so most of these (Aug-Sept 2026) have no
// real id yet. Do NOT fabricate ids for them. Once a listed race appears in
// raceRegistry.ts with a real id, cross-reference it here (see
// `findWatchlistEntry`) to pull the editorial rating/notes without having to
// re-key them, and retire the watchlist entry.
//
// This list does not drive rendering by itself — it's an editorial/ops
// reference for coverage planning and a source for `rating`/`notes` copy
// once a race is registered.

export type CoverageCategory = "Governor" | "Senate" | "House";

export interface CoverageWatchlistEntry {
  date: string; // YYYY-MM-DD
  state: string;
  office: string; // e.g. "Governor", "AZ-01", "Senate"
  category: CoverageCategory;
  rating: string; // e.g. "Lean D", "Toss Up", "Safe R"
  notes: string;
}

export const COVERAGE_WATCHLIST: CoverageWatchlistEntry[] = [
  { date: "2026-07-21", state: "Arizona", office: "Governor", category: "Governor", rating: "Lean D", notes: "Incumbent Katie Hobbs defending. High modeling value for cross-tabs." },
  { date: "2026-07-21", state: "Arizona", office: "AZ-01", category: "House", rating: "Toss Up", notes: "Open seat (David Schweikert retiring). Prime flip target." },
  { date: "2026-07-21", state: "Arizona", office: "AZ-06", category: "House", rating: "Toss Up", notes: "Incumbent Juan Ciscomani defending." },

  { date: "2026-08-04", state: "Michigan", office: "Governor", category: "Governor", rating: "Toss Up", notes: "Open seat (Whitmer term-limited). Marquee tracking target." },
  { date: "2026-08-04", state: "Michigan", office: "Senate", category: "Senate", rating: "Toss Up", notes: "Open seat (Peters retiring). Marquee tracking target." },
  { date: "2026-08-04", state: "Michigan", office: "MI-07", category: "House", rating: "Toss Up", notes: "Tom Barrett (R) running." },
  { date: "2026-08-04", state: "Michigan", office: "MI-08", category: "House", rating: "Lean D", notes: "Incumbent Kristen McDonald Rivet defending." },
  { date: "2026-08-04", state: "Michigan", office: "MI-04", category: "House", rating: "Lean R", notes: "Incumbent Bill Huizenga defending." },
  { date: "2026-08-04", state: "Michigan", office: "MI-10", category: "House", rating: "Lean R", notes: "Open seat (John James departing)." },
  { date: "2026-08-04", state: "Kansas", office: "Governor", category: "Governor", rating: "Lean R", notes: "Open seat (Kelly term-limited). High-value flip tracking." },
  { date: "2026-08-04", state: "Virginia", office: "Senate", category: "Senate", rating: "Likely D", notes: "Incumbent Mark Warner defending." },
  { date: "2026-08-04", state: "Washington", office: "WA-03", category: "House", rating: "Toss Up", notes: "Incumbent Marie Gluesenkamp Perez defending. High modeling interest." },

  { date: "2026-08-06", state: "Tennessee", office: "Governor", category: "Governor", rating: "Safe R", notes: "Open seat (Lee term-limited)." },
  { date: "2026-08-06", state: "Tennessee", office: "Senate", category: "Senate", rating: "Safe R", notes: "Incumbent defending." },

  { date: "2026-08-08", state: "Hawaii", office: "Governor", category: "Governor", rating: "Safe D", notes: "Standard tracking." },

  { date: "2026-08-11", state: "Wisconsin", office: "Governor", category: "Governor", rating: "Toss Up", notes: "Open seat (Evers retiring). Massive polling volume expected." },
  { date: "2026-08-11", state: "Wisconsin", office: "WI-03", category: "House", rating: "Toss Up", notes: "Incumbent Derrick Van Orden defending." },
  { date: "2026-08-11", state: "Minnesota", office: "Governor", category: "Governor", rating: "Likely D", notes: "Open seat (Walz retiring)." },
  { date: "2026-08-11", state: "Minnesota", office: "Senate", category: "Senate", rating: "Likely D", notes: "Open seat (Smith retiring)." },
  { date: "2026-08-11", state: "Connecticut", office: "Governor", category: "Governor", rating: "Safe D", notes: "Standard tracking." },
  { date: "2026-08-11", state: "Vermont", office: "Governor", category: "Governor", rating: "Safe R", notes: "Standard tracking." },

  { date: "2026-08-18", state: "Florida", office: "Governor", category: "Governor", rating: "Lean R", notes: "Open seat (DeSantis term-limited). Byron Donalds leads early aggregates." },
  { date: "2026-08-18", state: "Florida", office: "Senate", category: "Senate", rating: "Lean R", notes: "Special election (Ashley Moody vs. Alex Vindman)." },
  { date: "2026-08-18", state: "Florida", office: "FL-25", category: "House", rating: "Toss Up", notes: "Incumbent Jared Moskowitz defending." },
  { date: "2026-08-18", state: "Florida", office: "FL-14", category: "House", rating: "Lean R", notes: "Incumbent Kathy Castor defending." },
  { date: "2026-08-18", state: "Florida", office: "FL-22", category: "House", rating: "Lean R", notes: "Open seat (Lois Frankel retiring)." },
  { date: "2026-08-18", state: "Alaska", office: "Governor", category: "Governor", rating: "Solid R", notes: "Open seat (Dunleavy term-limited). Ranked-choice modeling required." },
  { date: "2026-08-18", state: "Alaska", office: "Senate", category: "Senate", rating: "Solid R", notes: "Ranked-choice modeling required." },
  { date: "2026-08-18", state: "Wyoming", office: "Governor", category: "Governor", rating: "Safe R", notes: "Standard tracking." },
  { date: "2026-08-18", state: "Wyoming", office: "Senate", category: "Senate", rating: "Safe R", notes: "Standard tracking." },

  { date: "2026-09-01", state: "Massachusetts", office: "Governor", category: "Governor", rating: "Safe D", notes: "Standard tracking." },
  { date: "2026-09-01", state: "Massachusetts", office: "Senate", category: "Senate", rating: "Safe D", notes: "Standard tracking." },

  { date: "2026-09-08", state: "New Hampshire", office: "Senate", category: "Senate", rating: "Toss Up", notes: "Open seat (Shaheen retiring). Prime polling target." },
  { date: "2026-09-08", state: "New Hampshire", office: "Governor", category: "Governor", rating: "Lean R", notes: "Incumbent Kelly Ayotte defending." },

  { date: "2026-09-09", state: "Rhode Island", office: "Governor", category: "Governor", rating: "Safe D", notes: "Standard tracking." },
  { date: "2026-09-09", state: "Rhode Island", office: "Senate", category: "Senate", rating: "Safe D", notes: "Standard tracking." },

  { date: "2026-09-15", state: "Delaware", office: "Senate", category: "Senate", rating: "Safe D", notes: "Final primary before general stretch." },
];

/** Finds a watchlist entry matching a CivicAPI race's date/state/office, so a
 *  newly-registered race can inherit its editorial rating/notes without
 *  re-keying them by hand. Loose match: state + office text containment. */
export function findWatchlistEntry(date: string, state: string, office: string): CoverageWatchlistEntry | undefined {
  return COVERAGE_WATCHLIST.find(
    (w) => w.date === date && w.state.toLowerCase() === state.toLowerCase() && w.office.toLowerCase() === office.toLowerCase(),
  );
}
