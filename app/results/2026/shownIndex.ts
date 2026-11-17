// Which races the results pages show (patch 5). Pure, unit-tested (tests/intelligence/shownIndex.test.ts).
//
// Only races with votes being counted are shown:
//  - in a replay, a race that never has a vote counted (or an On Point call) anywhere in the recording is left off for
//    the whole replay; every other race is shown throughout, "no votes yet" before its first votes, as on the night;
//  - live, a race civicAPI has no votes for (and On Point has not called: a race with one candidate is called at poll
//    close) is left off, and comes back by itself the moment civicAPI publishes votes for it.
// Every list, map, tally and count on the results pages reads the index through this, so they all agree.
import { TYPE_SETS, type CRace, type XIndex, type XRace } from "./live";
type LiveLike = { loading: boolean; byId: Record<string, CRace> };

const SET_OF = (k: XRace["k"]): keyof typeof TYPE_SETS => (k === "sen" || k === "house" || k === "gov" ? "fed" : k === "measure" ? "ballot" : k === "leg" ? "leg" : "state");
/** whether civicAPI has votes for a race, or On Point has called it */
export const hasReturnsOrCall = (c: CRace | undefined): boolean => !!c && c.c.some((x) => (x[2] || 0) > 0 || !!x[4]);

/**
 * The index as the pages show it, or null while it cannot be known yet (the page then shows its loading state, so it
 * never draws races that are about to go). `counted`: the races the recorded night ever counts, from the replay pack
 * (null until it has loaded). In a replay that list decides. Live, the first civicAPI read decides; until it is in,
 * the recorded list stands in for it, so the races known to have no votes never show even for a moment. Live, only
 * races in the type sets the page reads are judged. State legislature chambers are always shown.
 */
export function shownIndex(ix: XIndex | null, live: LiveLike, sets: (keyof typeof TYPE_SETS)[], replay = false, counted: ReadonlySet<string> | null = null): XIndex | null {
  if (!ix) return ix;
  let keep: (r: XRace) => boolean;
  if (replay || live.loading) {
    if (!counted) return null;
    // (a pack without the list: a replay shows every race, as before; live waits for its own read)
    if (!counted.size) return replay ? ix : null;
    keep = (r) => r.k === "leg" || counted.has(r.id);
  }
  else { const read = new Set(sets); keep = (r) => r.k === "leg" || !read.has(SET_OF(r.k)) || hasReturnsOrCall(live.byId[r.id]); }
  const races = ix.races.filter(keep);
  return races.length === ix.races.length ? ix : { ...ix, races };
}
