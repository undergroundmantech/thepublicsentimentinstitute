// Who is running for president in 2028: every name in the conversation, by party and by how real the candidacy is.
// To update: edit a row and the UPDATED date. Statuses follow what each person has said in public, as reported.

export const UPDATED = "2026-11-18";
export const ELECTION = "2028-11-07";

export type Status = "declared" | "likely" | "possible" | "out";
export type Cand = { name: string; party: "D" | "R" | "I"; role: string; status: Status; note: string; q?: string };

export const STATUS: Record<Status, { label: string; blurb: string }> = {
  declared: { label: "Declared", blurb: "Announced a campaign or filed with the FEC" },
  likely: { label: "Likely", blurb: "Widely expected to run and taking steps" },
  possible: { label: "Possible", blurb: "Considering it, or talked about, with no commitment" },
  out: { label: "Not running", blurb: "Ruled it out, passed, or ineligible" },
};
export const ORDER: Status[] = ["declared", "likely", "possible", "out"];

const c = (party: Cand["party"], name: string, role: string, status: Status, note: string, q?: string): Cand => ({ party, name, role, status, note, ...(q ? { q } : {}) });

export const CANDS: Cand[] = [
  // ---------------- Democrats
  c("D", "Alexandria Ocasio-Cortez", "U.S. Representative, New York", "likely", "Reelected in November. Has said she has not ruled out a run, and advisers are reported to be planning a national tour.", "Is AOC running for president in 2028?"),
  c("D", "Gavin Newsom", "Governor of California", "likely", "Says he will decide in late January 2027, and said in September he would not run if Kamala Harris does.", "Is Gavin Newsom running for president in 2028?"),
  c("D", "Kamala Harris", "Former Vice President", "likely", "Passed on the 2026 California governor race and says she is thinking about 2028.", "Is Kamala Harris running in 2028?"),
  c("D", "Josh Shapiro", "Governor of Pennsylvania", "likely", "Reelected in November. Says the decision is one he will make with his family."),
  c("D", "Pete Buttigieg", "Former Transportation Secretary", "likely", "Said in Denver on Nov 14 he will have no news on 2028 any time soon, and has not ruled it out.", "Is Pete Buttigieg running in 2028?"),
  c("D", "JB Pritzker", "Governor of Illinois", "possible", "Reelected to a third term. Has traveled to early states and says he can't rule anything out."),
  c("D", "Andy Beshear", "Governor of Kentucky", "possible", "Openly weighing a run and says he will decide after his term as Democratic Governors Association chair."),
  c("D", "Ro Khanna", "U.S. Representative, California", "possible", "Says the midterms made a run more likely than not and that he will decide after the holidays. Allies launched a draft committee."),
  c("D", "Cory Booker", "U.S. Senator, New Jersey", "possible", "Reelected in November and says he is giving another run serious thought."),
  c("D", "Mark Kelly", "U.S. Senator, Arizona", "possible", "Has said a 2028 bid is under consideration."),
  c("D", "Elissa Slotkin", "U.S. Senator, Michigan", "possible", "Says she is seriously considering a run and has not decided."),
  c("D", "Ruben Gallego", "U.S. Senator, Arizona", "possible", "Says raising three young children is a big part of the decision."),
  c("D", "Rahm Emanuel", "Former Ambassador to Japan", "possible", "Says he is thinking about it and would decide after the midterms."),
  c("D", "Gretchen Whitmer", "Governor of Michigan", "possible", "Said in May she would not run, then softened it to never say never."),
  c("D", "Wes Moore", "Governor of Maryland", "possible", "Reelected in November and has not closed the door on a national run."),
  c("D", "Chris Murphy", "U.S. Senator, Connecticut", "possible", "Often named as a dark horse. No announcement."),
  c("D", "Raphael Warnock", "U.S. Senator, Georgia", "possible", "Has not said whether he will run."),
  c("D", "Jared Polis", "Governor of Colorado", "possible", "Term limited and leaving office in January, which frees him to consider a run."),
  c("D", "James Talarico", "U.S. Senator elect, Texas", "possible", "Won a Texas Senate seat in November and has dismissed talk of a White House bid."),
  c("D", "Bernie Sanders", "U.S. Senator, Vermont", "possible", "His age makes a third run unlikely."),
  c("D", "Jon Ossoff", "U.S. Senator, Georgia", "out", "Says he has zero interest in running in 2028."),
  c("D", "Tim Walz", "Governor of Minnesota", "out", "Ended his reelection bid in January 2026 and said he will not run for office again."),
  c("D", "Amy Klobuchar", "Governor elect of Minnesota", "out", "Won the Minnesota governor race in November."),
  c("D", "Chris Van Hollen", "U.S. Senator, Maryland", "out", "Said Nov 14 he is no longer pursuing a presidential bid and is running for Senate Democratic leader instead."),
  // ---------------- Republicans
  c("R", "JD Vance", "Vice President", "likely", "Said Nov 17 he will decide sometime next year. People around him expect him to run.", "Is JD Vance running for president in 2028?"),
  c("R", "Ron DeSantis", "Governor of Florida", "likely", "Keeping his options open, and reported to be weighing 2028 against waiting for 2032.", "Is Ron DeSantis running in 2028?"),
  c("R", "Ted Cruz", "U.S. Senator, Texas", "possible", "Reported Nov 16 to have told allies he plans another run and to have begun early preparations. No announcement.", "Is Ted Cruz running for president in 2028?"),
  c("R", "Glenn Youngkin", "Former Governor of Virginia", "possible", "Reported to be considering a run, and launched a national education group in August."),
  c("R", "Chris Christie", "Former Governor of New Jersey", "possible", "Said in September he is weighing a third bid."),
  c("R", "James Fishback", "Businessman", "declared", "Announced a presidential run on Oct 29 after taking 10.5% in Florida's governor primary."),
  c("R", "Royce White", "Former NBA player", "declared", "Announced a campaign the day after finishing third in Minnesota's August Senate primary."),
  c("R", "Dan Greaney", "Television writer", "declared", "Filed and running as a self described Lincoln and Roosevelt Republican."),
  c("R", "Brian Kemp", "Governor of Georgia", "possible", "Passed on a 2026 Senate race, which fueled talk of a run."),
  c("R", "Rand Paul", "U.S. Senator, Kentucky", "possible", "Has said another bid is under consideration."),
  c("R", "Tim Scott", "U.S. Senator, South Carolina", "possible", "A 2024 candidate who is often mentioned again."),
  c("R", "Sarah Huckabee Sanders", "Governor of Arkansas", "possible", "Reelected in November. No formal moves."),
  c("R", "Tom Cotton", "U.S. Senator, Arkansas", "possible", "Reelected in November and frequently listed as a contender."),
  c("R", "Tulsi Gabbard", "Former Director of National Intelligence", "possible", "Her 2026 departure from the administration fueled talk of a run."),
  c("R", "Vivek Ramaswamy", "Businessman", "possible", "Lost the Ohio governor race in November and remains a name in 2028 talk."),
  c("R", "Tucker Carlson", "Commentator", "possible", "Talked about as a candidate, especially if the party turns to Rubio. No sign of a campaign."),
  c("R", "Donald Trump Jr.", "Businessman", "possible", "His name surfaces in 2028 talk. No campaign."),
  c("R", "Gregory Bovino", "Former Border Patrol commander", "possible", "Has said a run is on the table. A supporter built exploratory committee drew headlines in June."),
  c("R", "John Kennedy", "U.S. Senator, Louisiana", "possible", "Says his plan is to run for reelection but that he would consider it."),
  c("R", "Kristi Noem", "Special envoy, former Homeland Security Secretary", "possible", "Keeps appearing on contender lists."),
  c("R", "Don Bacon", "Former U.S. Representative, Nebraska", "possible", "Has said he would love to run."),
  c("R", "Marco Rubio", "Secretary of State", "out", "Says he has no plans to run and would back Vance. Some donors still hope he gets in.", "Is Marco Rubio running in 2028?"),
  c("R", "Nikki Haley", "Former U.N. Ambassador", "out", "Said Nov 11 she will not run in 2028.", "Is Nikki Haley running in 2028?"),
  c("R", "Josh Hawley", "U.S. Senator, Missouri", "out", "Said in September he has no intention of seeking the nomination."),
  c("R", "Greg Abbott", "Governor of Texas", "out", "Ruled out a run and lost reelection in November."),
  c("R", "Donald Trump", "President", "out", "Barred from a third term by the 22nd Amendment."),
  // ---------------- outside the two parties
  c("I", "Thomas Massie", "U.S. Representative, Kentucky", "possible", "Reported Nov 8 to be weighing a third party bid after losing his House primary."),
];
