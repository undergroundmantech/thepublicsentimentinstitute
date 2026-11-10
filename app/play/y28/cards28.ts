// The world of 2028: issue moments drawn from what is really driving the race in the On Point dataset and the 2026
// news, on the same minus 2 to plus 2 scale as every candidate's researched positions. Issue index k follows the
// dataset's order: cost of living, health care, corruption, Epstein files, immigration, civil rights, transgender
// policy, crime, energy and data centers, schools, guns, the Iran war, democratic socialism, tariffs.
import type { Card, Party } from "./engine28";

export const CARDS: Card[] = [
  { id: "iran", k: 11, when: "both", title: "Strikes resume in the Gulf", prompt: "The Iran ceasefire breaks down and American bases take fire. Gas jumps forty cents overnight. Cameras are waiting outside your hotel.",
    src: "https://www.aljazeera.com/news/2026/11/9/rubio-says-war-on-iran-unpopular-but-necessary-to-stop-nuclear-threat",
    opts: [{ label: "End this war", say: "No more forever wars. Bring them home and make Congress vote.", pos: -1.8 }, { label: "Ceasefire and talks", say: "Protect our troops, get back to the table, no wider war.", pos: -0.7 }, { label: "Finish the job", say: "Iran cannot get a bomb. We see this through.", pos: 1.6 }] },
  { id: "epstein", k: 3, when: "both", title: "A new Epstein tranche", prompt: "The Justice Department releases another heavily redacted batch of Epstein files. Survivors hold a press conference on the Capitol steps.",
    src: "https://www.al-monitor.com/originals/2026/07/vance-says-israeli-intelligence-had-ties-epstein-what-know",
    opts: [{ label: "Release every page", say: "Every name, every page. On day one.", pos: -2 }, { label: "Back the survivors", say: "The survivors deserve answers and the law should follow the evidence.", pos: -0.8 }, { label: "Change the subject", say: "Voters want to talk about prices, not old files.", pos: 0.8 }] },
  { id: "tariffs", k: 13, when: "both", title: "Prices at the register", prompt: "A new round of tariffs hits groceries and car parts. A Michigan supplier announces layoffs and blames the duties.",
    src: "https://www.michigan.gov/ag/news/press-releases/2026/08/03/ag-nessel-governor-whitmer-sue-trump-administration-again-to-stop-illegal-tariffs",
    opts: [{ label: "End the tariffs", say: "Tariffs are a tax on your family. Drop them.", pos: -1.6 }, { label: "Targeted only", say: "Hit the cheaters, not the grocery bill.", pos: 0.3 }, { label: "Stand by them", say: "Tariffs bring the factories home. Hold the line.", pos: 1.8 }] },
  { id: "datacenter", k: 8, when: "both", title: "The data center fight", prompt: "A county board approves a hyperscale AI data center over a packed, angry hearing. Power bills in the region are up eighteen percent.",
    src: "https://www.texasmonthly.com/news-politics/greg-abbott-gina-hinojosa-data-centers/",
    opts: [{ label: "Moratorium", say: "No new hyperscale permits until communities have a say.", pos: -1.5 }, { label: "Make them pay", say: "They bring their own power and pay for the grid, or they do not build.", pos: -0.5 }, { label: "Build it here", say: "Win the AI race in America. Build, and build fast.", pos: 1.6 }] },
  { id: "ice", k: 4, when: "both", title: "A raid at the plant", prompt: "Immigration agents raid a meatpacking plant. Video of children waiting outside the gates is everywhere.",
    src: "https://www.npr.org/2026/03/05/nx-s1-5667546/kristi-noem-homeland-security-fired",
    opts: [{ label: "Stop the raids", say: "This is not who we are. End the raids and fix the system.", pos: -1.7 }, { label: "Secure and humane", say: "Secure the border, go after criminals, leave working families alone.", pos: 0 }, { label: "Enforce the law", say: "If you came illegally, you go home. No exceptions.", pos: 1.9 }] },
  { id: "premiums", k: 1, when: "both", title: "Premiums double", prompt: "Insurers file rate increases after the health care subsidies lapse. A mother in a town hall line says her premium is now more than her rent.",
    opts: [{ label: "Medicare for All", say: "Health care is a right. Medicare for all of us.", pos: -2 }, { label: "Restore the subsidies", say: "Bring back the tax credits now and cap what families pay.", pos: -0.9 }, { label: "Market reforms", say: "Competition and price transparency, not more Washington.", pos: 1 }] },
  { id: "gas", k: 0, when: "both", title: "Gas at five dollars", prompt: "Gas tops five dollars in three swing states. Governors from both parties are suspending gas taxes.",
    src: "https://www.ajc.com/politics/2026/09/brian-kemp-suspends-georgias-gas-tax-as-iran-war-squeezes-drivers/",
    opts: [{ label: "Price gouging crackdown", say: "Go after the oil companies' record profits and send rebates.", pos: -1.5 }, { label: "Federal gas tax holiday", say: "Suspend the federal gas tax through the winter.", pos: -0.3 }, { label: "Drill and cut taxes", say: "Unleash American energy and cut taxes across the board.", pos: 1.5 }] },
  { id: "abortion", k: 5, when: "both", title: "A ballot measure in Florida", prompt: "A new abortion rights amendment qualifies for the 2028 ballot in two states. You are asked where you stand on a federal law.",
    opts: [{ label: "Codify Roe", say: "Restore the right nationwide. Full stop.", pos: -1.6 }, { label: "Leave it to the states", say: "Voters in each state should decide.", pos: 0.6 }, { label: "A national limit", say: "A national standard to protect life.", pos: 1.8 }] },
  { id: "guns", k: 10, when: "both", title: "Another school shooting", prompt: "A shooting at a high school leaves eleven dead. The vigil is tonight. Your debate prep team wants a line by noon.",
    opts: [{ label: "Ban assault weapons", say: "Ban weapons of war and pass universal background checks.", pos: -1.8 }, { label: "Background checks", say: "Universal background checks and red flag laws. Most gun owners agree.", pos: -0.6 }, { label: "Harden schools", say: "Armed officers in schools. Do not punish law abiding owners.", pos: 1.6 }] },
  { id: "trans", k: 6, when: "both", title: "The sports question", prompt: "A town hall questioner asks you directly whether trans girls should compete in girls' high school sports.",
    opts: [{ label: "Inclusion", say: "Every kid deserves to play.", pos: -1.8 }, { label: "Fairness, and dignity", say: "Sports should be fair, and no kid should be bullied.", pos: 0 }, { label: "Biology", say: "Boys should not play in girls' sports. Period.", pos: 1.9 }] },
  { id: "crime", k: 7, when: "both", title: "The Guard in the city", prompt: "The administration sends the National Guard into another city after a spike in carjackings. The mayor calls it an occupation.",
    opts: [{ label: "Pull them out", say: "Troops in our streets make no one safer. Fund community safety.", pos: -1.5 }, { label: "More cops, local control", say: "Hire more police, but the mayor runs the city.", pos: 0.2 }, { label: "Back the Guard", say: "Law and order first. Every city that needs it.", pos: 1.8 }] },
  { id: "stocks", k: 2, when: "both", title: "Trading on the war", prompt: "A report shows senators of both parties traded oil stocks hours before the Iran ceasefire was announced.",
    src: "https://www.murphy.senate.gov/newsroom/press-releases/murphy-details-unprecedented-corruption-of-trump-white-house-over-the-last-500-days",
    opts: [{ label: "Ban stock trading", say: "Members of Congress and the president: no individual stocks. Ever.", pos: -1.9 }, { label: "Stronger disclosure", say: "Faster disclosure and stiffer penalties.", pos: -0.4 }, { label: "Due process", say: "Let the ethics committees do their jobs.", pos: 1 }] },
  { id: "socialism", k: 12, when: "both", title: "The socialism ad", prompt: "A super PAC runs a million dollar ad calling your party's platform socialism. Your pollster says it is landing with older suburban voters.",
    opts: [{ label: "Own it", say: "If health care and fair wages are socialism, call me a socialist.", pos: -1.8 }, { label: "Democratic capitalism", say: "I believe in markets that work for working people.", pos: -0.2 }, { label: "Hit socialism", say: "Socialism has failed everywhere it has been tried.", pos: 1.8 }] },
  { id: "housing", k: 9, when: "both", title: "Rent strike", prompt: "Tenants in a swing state suburb go on a rent strike as rents rise for the fourth straight year.",
    opts: [{ label: "Build public housing", say: "Millions of homes, public and affordable, and a cap on rent hikes.", pos: -1.6 }, { label: "Build more, faster", say: "Cut red tape and build three million homes.", pos: 0 }, { label: "Cut regulations", say: "Get government out of the way and let builders build.", pos: 1.4 }] },
  { id: "ai_jobs", k: 0, when: "gen", title: "Robots on the line", prompt: "An automaker announces it will replace a third of a plant's workers with AI driven robots by 2030.",
    opts: [{ label: "Workers first", say: "A robot tax and a guarantee for every worker displaced.", pos: -1.6 }, { label: "Retrain and protect", say: "Training, wage insurance and a seat for workers at the table.", pos: -0.4 }, { label: "Let innovation run", say: "Lower taxes and let American companies compete.", pos: 1.3 }] },
];
/** A card for this turn that the player has not seen, dealt from the seed. */
export function dealCard(seen: string[], phase: "prim" | "gen", r: () => number): Card | null {
  const pool = CARDS.filter((c) => !seen.includes(c.id) && (c.when === "both" || c.when === phase));
  return pool.length ? pool[Math.floor(r() * pool.length)] : null;
}
export const DEBATE_Q: { k: number; q: string }[] = [
  { k: 0, q: "Families are paying more for everything. What will you do about the cost of living in your first hundred days?" },
  { k: 11, q: "Should American troops still be fighting Iran a year from now?" },
  { k: 4, q: "What should happen to the millions of people living here without legal status?" },
  { k: 1, q: "Premiums are rising. What is your health care plan?" },
  { k: 2, q: "Should members of Congress and the president be allowed to trade stocks?" },
  { k: 13, q: "Do tariffs help or hurt American workers?" },
  { k: 8, q: "Should communities be able to say no to AI data centers?" },
  { k: 3, q: "Would you release every remaining page of the Epstein files?" },
  { k: 5, q: "What is your position on a national abortion law?" },
  { k: 10, q: "What would you do about gun violence?" },
];
export const debateLines = (k: number): { label: string; pos: number }[] => {
  const c = CARDS.find((x) => x.k === k); if (!c) return [{ label: "Left", pos: -1.5 }, { label: "Center", pos: 0 }, { label: "Right", pos: 1.5 }];
  return c.opts.map((o) => ({ label: o.say, pos: o.pos }));
};
export const partyName = (p: Party) => (p === "D" ? "Democratic" : "Republican");

// ------------------------------------------------------------- scandals and attacks
// Each answer has a likely result (up) and a risky one (dn) that lands with probability risk, plus a base cost.
type CrisisDef = { id: string; title: string; prompt: string; genOnly?: boolean; vp?: boolean; big?: boolean;
  opts: { label: string; say: string; risk: number; base: number; up: number; dn: number }[] };
const STD = (deny: string, hit: string, sorry: string, ride = "Let the news cycle move on.") => [
  { label: "Own it", say: sorry, risk: 0.12, base: -0.2, up: 0.05, dn: -0.35 },
  { label: "Deny it", say: deny, risk: 0.42, base: 0, up: 0.08, dn: -0.85 },
  { label: "Hit back", say: hit, risk: 0.38, base: 0, up: 0.3, dn: -0.7 },
  { label: "Ride it out", say: ride, risk: 0.3, base: -0.25, up: 0, dn: -0.45 },
];
export const CRISES: CrisisDef[] = [
  { id: "hotmic", title: "A hot mic", big: true, prompt: "A microphone you thought was off caught {me} mocking voters in a swing county. It has eleven million views by lunch.",
    opts: STD("That clip is edited and everyone knows it.", "{op} has said worse on camera, on purpose.", "I said something dumb and I am sorry. Those voters deserve better.") },
  { id: "aide", title: "An aide's old posts", prompt: "Reporters dig up years of ugly posts from one of your senior advisers.",
    opts: [{ label: "Fire the aide", say: "They are gone as of this morning.", risk: 0.1, base: -0.1, up: 0.05, dn: -0.3 }, ...STD("Those posts are years old and taken out of context.", "{op}'s team has done worse and nobody asks them.", "Those posts are vile and I did not know.").slice(1)] },
  { id: "deepfake", title: "A deepfake goes viral", big: true, prompt: "A fake video of {me} saying things you never said is spreading faster than the fact checks. It looks real.",
    opts: [{ label: "Prove it is fake", say: "Here is the forensic report, frame by frame.", risk: 0.25, base: -0.1, up: 0.15, dn: -0.6 }, { label: "Blame {op}'s allies", say: "We know who benefits from this.", risk: 0.5, base: 0, up: 0.35, dn: -0.9 }, { label: "Ignore it", say: "Voters can tell what is real.", risk: 0.45, base: -0.15, up: 0, dn: -0.9 }] },
  { id: "memo", title: "A leaked strategy memo", prompt: "Your internal memo calling two swing states unwinnable leaks to the press. Volunteers there are furious.",
    opts: STD("That memo was a draft from a junior staffer.", "Their campaign is leaking our memos because they have no plan of their own.", "We are competing everywhere, and I will be there this week to prove it.") },
  { id: "attack", title: "{op} hits you on {issue}", prompt: "{op} launches a blistering attack on your record on {issue}, and it is landing with independents.",
    opts: [{ label: "Pivot to the center", say: "I have heard people, and here is where I stand now.", risk: 0.3, base: 0, up: 0.2, dn: -0.6 }, { label: "Double down", say: "I have not changed and I will not.", risk: 0.35, base: 0, up: 0.15, dn: -0.7 }, { label: "Counterattack", say: "{op} wants to talk about records? Let us talk about theirs.", risk: 0.4, base: 0, up: 0.35, dn: -0.8 }] },
  { id: "book", title: "A former aide's tell all", big: true, prompt: "A former chief of staff publishes a book calling {me} cruel to staff and unprepared for the job.",
    opts: STD("A bitter former employee selling books.", "{op}'s campaign helped promote it, and we can prove it.", "I have not always been easy to work for, and I have learned from it.") },
  { id: "interview", title: "A disastrous interview", prompt: "A long sit down interview goes badly: {me} could not answer a simple follow up on {issue}.",
    opts: STD("The interview was a hit job.", "{op} will not even sit for interviews.", "I fumbled it. Here is my answer, plainly.", "Do three more interviews this week and bury it.") },
  { id: "rm", title: "Your running mate's old comments", genOnly: true, vp: true, prompt: "Video surfaces of {vp} saying something years ago that the other side is putting in ads in every swing state.",
    opts: [{ label: "Stand by them", say: "{vp} has grown, and so has the country.", risk: 0.35, base: -0.1, up: 0.1, dn: -0.7 }, { label: "Have them apologize", say: "{vp} will address it today, in their own words.", risk: 0.15, base: -0.2, up: 0.05, dn: -0.4 }, { label: "Hit back", say: "{op}'s running mate has said worse this year.", risk: 0.4, base: 0, up: 0.25, dn: -0.8 }] },
  { id: "donor", title: "A donor problem", prompt: "One of your biggest donors is caught on tape bragging about what their money will buy in your administration.",
    opts: [{ label: "Return the money", say: "Every dollar goes back today.", risk: 0.1, base: -0.15, up: 0.1, dn: -0.3 }, ...STD("Donors do not set my agenda and never will.", "{op} takes far more from people like that.", "That is not how I govern.").slice(1, 3)] },
  { id: "stock", title: "Your family's stock trades", big: true, prompt: "A report shows trades in your household's account right before government announcements. You did nothing illegal. It looks terrible.",
    opts: STD("Every trade was handled by an outside adviser.", "Members of {op}'s party trade far more and nobody asks.", "We are putting everything in a blind trust today.") },
];
