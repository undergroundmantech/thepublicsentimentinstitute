// Majority Tracker: the Senate Democratic leader election, Chuck Schumer against Chris Van Hollen.
// One row per member of the incoming Senate Democratic caucus. Stated and reported positions come
// from public statements; every other pick is an On Point estimate and moves as senators speak.
// To update: edit the rows below and the UPDATED date. Totals, the range and the gap all recompute.

export type Pick = "S" | "V";
export type Tier = "stated" | "reported" | "high" | "med" | "low";
export type Senator = { name: string; last: string; st: string; pick: Pick; tier: Tier; note: string; ifSeated?: boolean };

export const UPDATED = "2026-11-19";
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
  s("John Fetterman", "PA", "S", "stated", "Said he will vote for Schumer, Nov 11, and warned Van Hollen's bid could push him out of the party, Nov 14."),
  s("Ruben Gallego", "AZ", "S", "stated", "Backed Schumer with a World Series manager line, NBC Nov 10."),
  s("Mark Kelly", "AZ", "S", "stated", "Said yes on support, Roll Call Nov 10."),
  s("Richard Blumenthal", "CT", "S", "stated", "Backed Schumer again despite calls for him to step aside, CT Post Nov 17."),
  s("Sherrod Brown", "OH", "S", "stated", "Said yes, NBC Nov 10. A Schumer recruit."),
  s("Angus King", "ME", "S", "stated", "Restated support after the challenge, Roll Call Nov 12."),
  s("Sheldon Whitehouse", "RI", "S", "stated", "Said the win justifies another term, Washington Post Nov 6."),
  s("Tammy Baldwin", "WI", "S", "stated", "You win the World Series, you don't fire Pat Murphy, MS NOW Nov 17. Will once again support him, FOX11 Nov 9."),
  s("Angela Alsobrooks", "MD", "S", "reported", "Backed Schumer on Nov 2, before her home state colleague entered."),
  s("Brian Schatz", "HI", "S", "reported", "Backed Schumer per The Well News Nov 10. Expected whip."),
  s("Catherine Cortez Masto", "NV", "S", "reported", "Backed Schumer per The Well News Nov 10. Former DSCC chair."),
  s("Josh Turek", "IA", "S", "reported", "Expected to back Schumer per The Hill Nov 11. Declined to affirm per PolitiFact."),
  s("Roy Cooper", "NC", "S", "reported", "Expected to back Schumer per The Hill Nov 11. A Schumer recruit."),
  s("Ben Ray Luján", "NM", "S", "reported", "Asked who was running against Schumer, Nov 2."),
  s("Tim Kaine", "VA", "S", "med", "Not publicly backing a candidate, MS NOW Nov 17. Gave Schumer an A in January."),
  s("Adam Schiff", "CA", "S", "high", "Seeking a leadership role, not challenging the team, Semafor Nov 10."),
  s("Amy Klobuchar", "MN", "S", "high", "On the leadership team and leaving Jan 4. Her Dec 1 vote is unconfirmed."),
  s("Jacky Rosen", "NV", "S", "reported", "Listed among Schumer's backers, The New Republic Nov 13."),
  s("Jack Reed", "RI", "S", "reported", "Listed among Schumer's backers, The New Republic Nov 13."),
  s("Chris Coons", "DE", "S", "high", "Called Van Hollen's chances remote and credited Schumer for the midterm wins, Washington Sun Nov 16."),
  s("Patty Murray", "WA", "S", "med", "The caucus will decide, KUOW Nov 10. Former leadership."),
  s("Maria Cantwell", "WA", "S", "med", "No comment for now, MS NOW Nov 16. Gave him points for the victory, Spokesman Review Nov 4."),
  s("Mark Warner", "VA", "S", "med", "Let's see how it plays out, Virginia Scope Nov 10. Centrist."),
  s("Jon Ossoff", "GA", "S", "med", "No pick yet. Opposes moving the vote up, MS NOW Nov 17."),
  s("Lisa Blunt Rochester", "DE", "S", "med", "Praised his recruiting, Nov 2."),
  s("Mary Peltola", "AK", "S", "med", "Declared the winner Nov 17 per AP, so she votes Dec 1. No public pick yet. A Schumer recruit per US News."),
  s("Alex Padilla", "CA", "S", "med", "No public statement. Generally votes with leadership."),
  s("John Hickenlooper", "CO", "S", "med", "I haven't picked a position, Washington Times Nov 17, after praising Schumer's role in the nine flips."),
  s("Mazie Hirono", "HI", "S", "reported", "A Schumer backer per MS NOW Nov 17. Wants time for a robust discussion before the vote."),
  s("Tammy Duckworth", "IL", "S", "med", "No public statement. No history of breaking with leadership."),
  s("Maggie Hassan", "NH", "S", "med", "No public statement. Moderate."),
  s("Raphael Warnock", "GA", "S", "low", "Wants to hear the case, 41NBC Nov 10. Won't commit."),
  s("Scott Colom", "MS", "S", "low", "Won't commit and disputed that Schumer recruited him, The New Republic Nov 13."),
  s("Ron Wyden", "OR", "S", "low", "Focused on policy, per KGW Nov 10."),
  s("Andy Kim", "NJ", "S", "low", "Supportive of leadership as of March. Reform brand."),
  s("Cory Booker", "NJ", "S", "low", "Wants a family conversation, Oct 8."),
  s("Michael Bennet", "CO", "S", "low", "Only an old remark on leaders knowing when to go."),
  s("Chris Van Hollen", "MD", "V", "stated", "The candidate. Announced Nov 12."),
  s("Bernie Sanders", "VT", "V", "stated", "Will not support Schumer and will support Van Hollen, Nov 10 and 11."),
  s("Abdul El-Sayed", "MI", "V", "stated", "Proud to stand with him, Roll Call Nov 12."),
  s("Peggy Flanagan", "MN", "V", "reported", "Time for new leadership, Newsweek Nov 6. Impressed by Van Hollen."),
  s("Juliana Stratton", "IL", "V", "reported", "Listed as not backing Schumer, The New Republic Nov 13. Van Hollen is the only declared alternative."),
  s("Troy Jackson", "ME", "V", "reported", "Said he won't support Schumer, The New Republic Nov 13."),
  s("Adam Hamilton", "KS", "V", "reported", "Listed as not backing Schumer, The New Republic Nov 13. A progressive is not an obvious fit."),
  s("Annie Andrews", "SC", "V", "reported", "Listed as wanting new leadership, The New Republic Nov 13."),
  s("Elissa Slotkin", "MI", "V", "reported", "Endorsed Van Hollen for leader over Schumer, per Politics & Poll Tracker on X, Nov 19. Had called for a challenger, USA Today Nov 16."),
  s("Peter Welch", "VT", "V", "low", "Committed to change, WPTZ Nov 11. Sanders's state partner."),
  s("Chris Pappas", "NH", "V", "reported", "Listed as wanting new leadership, The New Republic Nov 13."),
  s("James Talarico", "TX", "V", "reported", "Listed as wanting new leadership, The New Republic Nov 13."),
  s("Elizabeth Warren", "MA", "V", "low", "Not today, Nov 10. Backed primary challengers per Zeteo."),
  s("Chris Murphy", "CT", "V", "low", "Has not commented on the race, CT Post Nov 17. Backed primary challengers per Zeteo."),
  s("Ed Markey", "MA", "V", "low", "Noncommittal, Boston Globe Nov 6. Backed challengers per Zeteo."),
  s("Jeff Merkley", "OR", "V", "stated", "Backs Van Hollen, The New Republic Nov 13."),
  s("Martin Heinrich", "NM", "V", "low", "Won't commit, Punchbowl News Nov 11. The least certain Van Hollen estimate."),
];

/** The latest in the race, newest first: date, what happened, the source and its link. */
export const NEWS: [string, string, string, string][] = [
  ["2026-11-19", "Elissa Slotkin endorses Chris Van Hollen for majority leader over Schumer, the first moderate to back the challenge publicly.", "Politics & Poll Tracker on X", "https://x.com/PollTracker2024"],
  ["2026-11-18", "Prediction market traders put Schumer at 91 percent to be the next majority leader and Van Hollen at 8.", "Kalshi News", "https://news.kalshi.com/p/senate-majority-leader-odds-schumer-91-van-hollen"],
  ["2026-11-17", "The AP calls Alaska for Mary Peltola, 50.1 to 45.8, without a ranked choice count. Democrats hold 56 seats, so the winner needs 29 votes on Dec 1.", "ICT, citing the AP", "https://ictnews.org/politics/election-2026/peltola-declared-winner-in-alaska-becomes-second-native-woman-elected-to-senate/"],
  ["2026-11-17", "Fourteen senators publicly back Schumer and four back Van Hollen: Sanders, Merkley and senators elect El-Sayed and Flanagan. Van Hollen says at least 15 have committed privately.", "Washington Times", "https://www.washingtontimes.com/news/2026/nov/17/senate-democrats-listening-mode-majority-leader-race/"],
  ["2026-11-17", "At the first caucus lunch since the challenge, the race did not come up. Senators of both camps pushed back on moving the vote earlier than Dec 1.", "MS NOW", "https://www.ms.now/news/race-for-senate-majority-leader-is-only-getting-messier"],
  ["2026-11-16", "Indivisible and National Nurses United endorse Van Hollen, and 75 percent of MoveOn members who voted back him.", "NationofChange", "https://www.nationofchange.org/2026/11/18/schumer-faces-a-contested-leadership-race-as-progressive-groups-back-van-hollen/"],
  ["2026-11-16", "Van Hollen says senators are not backing him publicly because they fear retaliation from Schumer. Coons calls his chances remote.", "Washington Sun", "https://www.washingtonsun.com/congress/van-hollen-schumer-leadership-race"],
  ["2026-11-12", "Van Hollen announces his run for Democratic leader. Schumer answers that he has the votes.", "NationofChange, citing the AP", "https://www.nationofchange.org/2026/11/18/schumer-faces-a-contested-leadership-race-as-progressive-groups-back-van-hollen/"],
];

/** Senators most likely to move the count, in order. */
export const SWING = ["Elizabeth Warren", "Chris Murphy", "Scott Colom", "Raphael Warnock", "Martin Heinrich", "Cory Booker"];
export const NEXT = ["Ed Markey"];

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
