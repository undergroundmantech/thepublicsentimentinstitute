// Majority Tracker: the Senate Democratic leader election, Chuck Schumer against Chris Van Hollen.
// One row per member of the incoming Senate Democratic caucus. Stated and reported positions come
// from public statements; every other pick is an On Point estimate and moves as senators speak.
// To update: edit the rows below and the UPDATED date. Totals, the range and the gap all recompute.

export type Pick = "S" | "V";
export type Tier = "stated" | "reported" | "high" | "med" | "low";
export type Senator = { name: string; last: string; st: string; pick: Pick; tier: Tier; note: string; ifSeated?: boolean };

export const UPDATED = "2026-11-12";
export const VOTE_DATE = "2026-12-01";
export const CAND: Record<Pick, { name: string; full: string; st: string }> = {
  S: { name: "Schumer", full: "Chuck Schumer", st: "NY" },
  V: { name: "Van Hollen", full: "Chris Van Hollen", st: "MD" },
};
export const TIER: Record<Tier, { label: string; short: string; estimate: boolean }> = {
  stated: { label: "Stated", short: "Stated", estimate: false },
  reported: { label: "Reported", short: "Reported", estimate: false },
  high: { label: "Estimate, high confidence", short: "High", estimate: true },
  med: { label: "Estimate, medium confidence", short: "Medium", estimate: true },
  low: { label: "Estimate, low confidence", short: "Low", estimate: true },
};
export const TIERS: Tier[] = ["stated", "reported", "high", "med", "low"];

const s = (name: string, st: string, pick: Pick, tier: Tier, note: string, ifSeated?: boolean): Senator => ({
  name, last: name.replace(/, if seated$/, "").split(" ").slice(1).join(" "), st, pick, tier, note, ...(ifSeated ? { ifSeated } : {}),
});

export const SENATORS: Senator[] = [
  s("Chuck Schumer", "NY", "S", "stated", "The candidate. Says he has the votes, Nov 12."),
  s("Kirsten Gillibrand", "NY", "S", "stated", "Said he will win any leader race, WCAX Nov 10."),
  s("John Fetterman", "PA", "S", "stated", "Said he will vote for Schumer, Nov 11."),
  s("Ruben Gallego", "AZ", "S", "stated", "Backed Schumer with a World Series manager line, NBC Nov 10."),
  s("Mark Kelly", "AZ", "S", "stated", "Said yes on support, Roll Call Nov 10."),
  s("Richard Blumenthal", "CT", "S", "stated", "Plans to support Schumer, CT Public Nov 9. One later list says uncommitted."),
  s("Sherrod Brown", "OH", "S", "stated", "Said yes, NBC Nov 10. A Schumer recruit."),
  s("Angus King", "ME", "S", "stated", "Restated support after the challenge, Roll Call Nov 12."),
  s("Sheldon Whitehouse", "RI", "S", "stated", "Said the win justifies another term, Washington Post Nov 6."),
  s("Tammy Baldwin", "WI", "S", "reported", "Will once again support him, per FOX11 Nov 9."),
  s("Angela Alsobrooks", "MD", "S", "reported", "Backed Schumer on Nov 2, before her home state colleague entered."),
  s("Brian Schatz", "HI", "S", "reported", "Backed Schumer per The Well News Nov 10. Expected whip."),
  s("Catherine Cortez Masto", "NV", "S", "reported", "Backed Schumer per The Well News Nov 10. Former DSCC chair."),
  s("Josh Turek", "IA", "S", "reported", "Expected to back Schumer per The Hill Nov 11. Declined to affirm per PolitiFact."),
  s("Roy Cooper", "NC", "S", "reported", "Expected to back Schumer per The Hill Nov 11. A Schumer recruit."),
  s("Ben Ray Luján", "NM", "S", "reported", "Asked who was running against Schumer, Nov 2."),
  s("Tim Kaine", "VA", "S", "reported", "Gave Schumer an A, Punchbowl News Jan 15."),
  s("Adam Schiff", "CA", "S", "high", "Seeking a leadership role, not challenging the team, Semafor Nov 10."),
  s("Amy Klobuchar", "MN", "S", "high", "On the leadership team and leaving Jan 4. Her Dec 1 vote is unconfirmed."),
  s("Jacky Rosen", "NV", "S", "high", "No public statement. A moderate who has not broken with leadership."),
  s("Jack Reed", "RI", "S", "high", "No public statement. Senior member, and his state partner Whitehouse backs Schumer."),
  s("Chris Coons", "DE", "S", "med", "Open to hearing others, PBS Nov 11. Institutionalist."),
  s("Patty Murray", "WA", "S", "med", "The caucus will decide, KUOW Nov 10. Former leadership."),
  s("Maria Cantwell", "WA", "S", "med", "Gave him points for the victory, Spokesman Review Nov 4."),
  s("Mark Warner", "VA", "S", "med", "Let's see how it plays out, Virginia Scope Nov 10. Centrist."),
  s("Jon Ossoff", "GA", "S", "med", "No answer, Al Jazeera Nov 5. Just reelected."),
  s("Lisa Blunt Rochester", "DE", "S", "med", "Praised his recruiting, Nov 2."),
  s("Mary Peltola, if seated", "AK", "S", "med", "Votes only if she wins on Nov 18. A Schumer recruit per US News.", true),
  s("Alex Padilla", "CA", "S", "med", "No public statement. Generally votes with leadership."),
  s("John Hickenlooper", "CO", "S", "med", "No public statement. Business minded moderate."),
  s("Mazie Hirono", "HI", "S", "med", "No public statement. Progressive, but her state partner Schatz is the expected whip."),
  s("Tammy Duckworth", "IL", "S", "med", "No public statement. No history of breaking with leadership."),
  s("Maggie Hassan", "NH", "S", "med", "No public statement. Moderate."),
  s("Raphael Warnock", "GA", "S", "low", "Wants to hear the case, 41NBC Nov 10. Won't commit."),
  s("Scott Colom", "MS", "S", "low", "A Schumer recruit who won't commit. Reports conflict."),
  s("Ron Wyden", "OR", "S", "low", "Focused on policy, per KGW Nov 10."),
  s("Andy Kim", "NJ", "S", "low", "Supportive of leadership as of March. Reform brand."),
  s("Cory Booker", "NJ", "S", "low", "Wants a family conversation, Oct 8."),
  s("Michael Bennet", "CO", "S", "low", "Only an old remark on leaders knowing when to go."),
  s("Chris Van Hollen", "MD", "V", "stated", "The candidate. Announced Nov 12."),
  s("Bernie Sanders", "VT", "V", "stated", "Will not support Schumer and will support Van Hollen, Nov 10 and 11."),
  s("Abdul El-Sayed", "MI", "V", "stated", "Proud to stand with him, Roll Call Nov 12."),
  s("Peggy Flanagan", "MN", "V", "reported", "Time for new leadership, Newsweek Nov 6. Impressed by Van Hollen."),
  s("Juliana Stratton", "IL", "V", "high", "Will not support Schumer, per Newsweek. Van Hollen is the only declared alternative."),
  s("Troy Jackson", "ME", "V", "high", "Told Schumer he will support somebody else, The Blaze Nov 11."),
  s("Adam Hamilton", "KS", "V", "med", "Not supporting Schumer. A progressive is not an obvious fit."),
  s("Annie Andrews", "SC", "V", "med", "Wants generational change, Nov 5. Van Hollen is 67."),
  s("Elissa Slotkin", "MI", "V", "low", "A no without a concrete plan. Moderate, could be won back."),
  s("Peter Welch", "VT", "V", "low", "Committed to change, WPTZ Nov 11. Sanders's state partner."),
  s("Chris Pappas", "NH", "V", "low", "Wants a new generation, Roll Call Nov 4. Uncommitted."),
  s("James Talarico", "TX", "V", "low", "Withheld support, The Hill Nov 12."),
  s("Elizabeth Warren", "MA", "V", "low", "Not today, Nov 10. Backed primary challengers per Zeteo."),
  s("Chris Murphy", "CT", "V", "low", "No commitment found. Backed primary challengers per Zeteo."),
  s("Ed Markey", "MA", "V", "low", "Noncommittal, Boston Globe Nov 6. Backed challengers per Zeteo."),
  s("Jeff Merkley", "OR", "V", "low", "West Bank trip with Van Hollen per Zeteo. KGW says open to Schumer."),
  s("Martin Heinrich", "NM", "V", "low", "Won't commit, Punchbowl News Nov 11. The least certain Van Hollen estimate."),
];

/** Senators most likely to move the count, in order. */
export const SWING = ["Elizabeth Warren", "Chris Murphy", "Elissa Slotkin", "Chris Pappas", "James Talarico", "Scott Colom"];
export const NEXT = ["Raphael Warnock", "Cory Booker"];

export function tally(list: Senator[] = SENATORS) {
  const seated = list.filter((x) => !x.ifSeated);
  const n = (p: Pick, f: (x: Senator) => boolean = () => true) => list.filter((x) => x.pick === p && f(x)).length;
  const caucus = list.length, caucusSeated = seated.length;
  const need = Math.floor(caucusSeated / 2) + 1, needAll = Math.floor(caucus / 2) + 1;
  const S = n("S"), V = n("V"), Sseated = seated.filter((x) => x.pick === "S").length, Vseated = seated.filter((x) => x.pick === "V").length;
  const lowS = n("S", (x) => x.tier === "low"), lowV = n("V", (x) => x.tier === "low");
  const firm = (p: Pick) => n(p, (x) => !TIER[x.tier].estimate);
  return { caucus, caucusSeated, need, needAll, S, V, Sseated, Vseated, lowS, lowV, bestS: S + lowV, bestV: V + lowS, firmS: firm("S"), firmV: firm("V"), estS: S - firm("S"), estV: V - firm("V") };
}
