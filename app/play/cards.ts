// Extra cards for a louder campaign: crises that blow up out of nowhere, and the chaos wheel, which a live stream's chat
// can spin. Every card is an ordinary scenario card, so it resolves through the same outcomes as the rest of the game:
// points through the voter groups, money, volunteers, buzz, enthusiasm and a risk that can backfire.
import type { Ctx, Ev, State } from "./engine";
import { rand, cal } from "./engine";

const sur = (n: string) => n.replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ").slice(-1)[0];

/** A crisis: something about you blows up. Four ways out, none of them free. */
export function crises(c: Ctx): Ev[] {
  const me = sur(c.me.name), them = sur(c.op.name), st = c.r.state;
  const opts = (deny: string, sorry: string) => [
    { label: "Deny everything", say: deny, out: { fx: -0.04, buzz: 4, risk: 0.42, riskT: "Then a second source confirmed it, and the denial became the story.", riskFx: -0.38, t: "The denial held, for now." } },
    { label: "Own it and apologize", say: sorry, out: { fx: -0.14, enth: -2, buzz: -3, t: "A rough news cycle, but it was over in two days." } },
    { label: "Hit back at them", say: `Turn it around on ${them} and their allies.`, need: "oppo" as const, out: { fx: -0.06, buzz: 8, oppEnth: -2, risk: 0.3, riskT: "Voters saw two campaigns in the mud and tuned out.", riskFx: -0.12, t: "You made it a fight about them." } },
    { label: "Change the subject", say: "Announce a big new plan the same morning and flood the zone.", cash: 150000, out: { fx: -0.08, buzz: 5, risk: 0.25, riskT: "Reporters asked about the scandal at the plan rollout, every question.", riskFx: -0.14, t: "The new plan led half the newscasts." } },
  ];
  return [
    { id: "cr:posts", kind: "crisis", title: "Old posts resurface", prompt: `A political account dug up a decade of ${me}'s old social media posts. A few are bad, and they are trending in ${st}.`, opts: opts("Say the account doctored them.", "Apologize on camera for the worst of them.") },
    { id: "cr:staffer", kind: "crisis", title: "A staffer quits loudly", prompt: `Your deputy communications director quit this morning and posted a long thread about the campaign's culture. Reporters are calling every staffer.`, opts: opts("Call it a disgruntled former employee.", "Announce an outside review of the campaign's workplace.") },
    { id: "cr:fec", kind: "crisis", title: "A campaign finance complaint", prompt: `A watchdog group filed an FEC complaint saying a vendor payment was really a disguised contribution. It is dry stuff, but ${them}'s campaign is calling it corruption.`, opts: opts("Call the complaint frivolous and partisan.", "Refund the money and release every invoice.") },
    { id: "cr:hotmic", kind: "crisis", title: "Caught on a hot mic", prompt: `A local TV crew left a microphone on after an interview, and ${me} said something about voters in a rival county that is now on every station.`, opts: opts("Say the clip was cut out of context.", "Drive to that county and apologize in person.") },
    { id: "cr:photo", kind: "crisis", title: "A photo with the wrong donor", prompt: `A photo surfaced of ${me} smiling with a donor who was just indicted. The fundraiser was last spring; the indictment was yesterday.`, opts: opts("Say you meet thousands of people.", "Donate the money to charity and condemn him.") },
    { id: "cr:leak", kind: "crisis", title: "Your debate book leaked", prompt: `Somebody leaked your internal debate prep memo to a reporter, including your team's blunt notes on ${me}'s weak spots.`, opts: opts("Say it is a fake.", "Joke about it and release the whole thing.") },
  ];
}

/** The chaos wheel: something loud and strange happens. Good or bad depends on the card and what you pick. */
export function chaos(c: Ctx, s: State): Ev[] {
  const me = sur(c.me.name), them = sur(c.op.name), st = c.r.state;
  const L: Ev[] = [
    { id: "ch:meme", kind: "chaos", title: "You became a meme", prompt: `A clip of ${me} tripping over a hay bale at a county fair has ten million views. The internet loves it. Your staff is split.`, opts: [
      { label: "Lean all the way in", say: "Post it yourself, sell hay bale shirts.", out: { buzz: 18, cash: 120000, fx: 0.08, t: "The shirts sold out in an hour." } },
      { label: "Laugh it off once", say: "One joke on a late night show, then back to work.", out: { buzz: 8, fx: 0.04, t: "A good sport moment." } },
      { label: "Pretend it never happened", say: "No comment.", out: { buzz: -4, fx: -0.03, t: "The meme moved on without you." } }] },
    { id: "ch:celebrity", kind: "chaos", title: "A celebrity wants in", prompt: `A huge musician from ${st} just posted that they want to headline a rally for whoever answers first. ${them}'s team is already calling.`, opts: [
      { label: "Book them tonight", say: "Rally this weekend, whatever it costs.", out: { cash: -250000, days: 1, buzz: 15, enth: 5, vol: 400, fx: 0.12, risk: 0.2, riskT: "The musician went off script about politics, and it got awkward.", riskFx: -0.15, t: "Forty thousand people and a stage dive." } },
      { label: "A quiet video endorsement", say: "Ask for a short video instead.", out: { buzz: 6, fx: 0.05, t: "A nice clip for your feeds." } },
      { label: "Pass", say: "Keep the focus on the issues.", out: { fx: 0, t: `${them} got the musician instead.`, oppEnth: 4 } }] },
    { id: "ch:debate-dare", kind: "chaos", title: "A dare on live radio", prompt: `On a morning show, ${them} dared ${me} to a one on one debate at a diner, no moderators, this Saturday.`, opts: [
      { label: "Accept the dare", say: "Show up at the diner.", out: { days: 1, buzz: 12, fx: 0.06, risk: 0.45, riskT: `${them} came prepared and owned the diner.`, riskFx: -0.2, t: "You won the diner." } },
      { label: "Counter with a real debate", say: "Challenge them to three televised debates instead.", out: { buzz: 4, fx: 0.03, t: "It looked presidential, if a little stiff." } },
      { label: "Ignore it", say: "No time for stunts.", out: { buzz: -5, fx: -0.04, t: "The empty chair at the diner went viral." } }] },
    { id: "ch:weather", kind: "chaos", title: "Freak storm on your rally day", prompt: `A surprise storm is rolling toward your biggest outdoor rally of the month. Five thousand people are already in line.`, opts: [
      { label: "Rally in the rain", say: "Grab an umbrella and go long.", out: { buzz: 14, enth: 4, fx: 0.07, risk: 0.25, riskT: "Lightning closed the venue and three people were treated for the cold.", riskFx: -0.12, t: "The soaked candidate photo ran everywhere." } },
      { label: "Move indoors", say: "Pack the high school gym.", out: { cash: -40000, buzz: 4, enth: 2, fx: 0.02, t: "Hot, loud and safe." } },
      { label: "Cancel", say: "Safety first.", out: { buzz: -6, enth: -2, fx: -0.02, t: "Disappointed fans posted about it." } }] },
    { id: "ch:mascot", kind: "chaos", title: "Someone in a costume follows you", prompt: `A guy in a giant chicken suit, paid by ${them}'s allies, is following ${me} to every stop and shouting that you are scared to debate.`, opts: [
      { label: "Get your own costume", say: "A staffer in a bigger chicken suit.", out: { buzz: 10, fx: 0.04, risk: 0.3, riskT: "The chicken fight made the national blooper reel.", riskFx: -0.08, t: "The dueling chickens were the best TV of the week." } },
      { label: "Invite the chicken onstage", say: "Hand him the mic and win the crowd.", out: { buzz: 8, fx: 0.06, t: "The chicken said he would vote for you." } },
      { label: "Have security move him", say: "Keep it boring.", out: { buzz: -3, fx: -0.02, t: "Footage of the chicken being escorted out did not help." } }] },
    { id: "ch:hack", kind: "chaos", title: "Your email list got hacked", prompt: `Somebody broke into your email tool and sent 400,000 supporters a message saying the campaign is shutting down.`, opts: [
      { label: "Turn it into a fundraiser", say: "Tell supporters what happened and ask them to prove it wrong.", out: { cash: 300000, buzz: 6, fx: 0.02, t: "Outrage is a great fundraising email." } },
      { label: "Call the FBI, say nothing", say: "Let investigators handle it.", out: { cash: -60000, fx: -0.03, t: "Some volunteers stayed home for a week." , vol: -200 } },
      { label: "Blame the other side", say: `Say ${them}'s allies were behind it.`, out: { buzz: 8, fx: 0.03, risk: 0.5, riskT: "It was a teenager in another state. You had to walk it back.", riskFx: -0.14, t: "Your base was furious on your behalf." } }] },
    { id: "ch:sports", kind: "chaos", title: "The big game", prompt: `${st}'s biggest team is in a rivalry game this weekend, and both campaigns want to be seen at it.`, opts: [
      { label: "Tailgate all day", say: "Grill, toss a ball, take a thousand selfies.", out: { days: 1, buzz: 9, enth: 3, fx: 0.05, risk: 0.2, riskT: "You wore the rival team's color by mistake.", riskFx: -0.1, t: "Great pictures, great crowd." } },
      { label: "Run an ad during the game", say: "Thirty seconds in the fourth quarter.", out: { cash: -220000, fx: 0.07, t: "Half the state saw it." } },
      { label: "Skip it", say: "Work the phones instead.", out: { cash: 90000, fx: -0.01, t: "You raised some money while everyone watched football." } }] },
    { id: "ch:dog", kind: "chaos", title: "Your dog has more followers than you", prompt: `The campaign dog's account just passed ${me}'s in followers. A reporter wants to profile the dog.`, opts: [
      { label: "Give the dog a show", say: "Weekly dog videos with a voting message.", out: { buzz: 12, vol: 250, fx: 0.04, t: "Young voters signed up to volunteer. For the dog." } },
      { label: "One cute interview", say: "Let the reporter meet the dog.", out: { buzz: 5, fx: 0.02, t: "A heartwarming Sunday feature." } },
      { label: "Keep the dog out of politics", say: "The dog is a private citizen.", out: { fx: 0, t: "The dog's fans were disappointed." } }] },
    { id: "ch:poll", kind: "chaos", title: "A wild outlier poll", prompt: `A brand new pollster nobody has heard of shows the race swinging twelve points. The cable networks are running it anyway.`, opts: [
      { label: "Fundraise off it", say: "Email it to the list, good or bad.", out: { cash: 200000, buzz: 6, t: "Every outlier is a fundraising email." } },
      { label: "Call it junk", say: "Tell reporters to wait for real polls.", out: { fx: 0.02, t: "You looked steady." } },
      { label: "Panic publicly", say: "Shake up the staff on live TV.", out: { buzz: 10, fx: -0.08, vol: -150, t: "Nobody likes watching a campaign panic." } }] },
    { id: "ch:food", kind: "chaos", title: "The food fight", prompt: `${me} was asked on camera how to eat a famous ${st} dish, and the answer has the whole state arguing.`, opts: [
      { label: "Double down", say: "Eat it your way at every stop for a week.", out: { buzz: 12, enth: 2, fx: 0.03, risk: 0.35, riskT: "A local chef called it an insult to the state.", riskFx: -0.08, t: "Your way is now a movement." } },
      { label: "Admit you were wrong", say: "Let a local diner teach you on camera.", out: { buzz: 6, fx: 0.05, t: "Humble and hungry. Voters liked it." } },
      { label: "Say no comment", say: "Some things are private.", out: { buzz: -2, fx: -0.01, t: "Pundits called it the most evasive answer of the cycle." } }] },
    { id: "ch:airport", kind: "chaos", title: "Stuck at the same airport", prompt: `A storm grounded every flight, and ${me} and ${them} are stuck at the same gate for six hours with a pack of reporters.`, opts: [
      { label: "Buy everyone pizza", say: `Including ${them}.`, out: { cash: -2000, buzz: 10, fx: 0.06, t: "The pizza photo was the warmest moment of the race." } },
      { label: "Debate them at the gate", say: "Make it a town hall by the vending machines.", out: { buzz: 12, fx: 0.04, risk: 0.35, riskT: `${them} got the better of you in front of a hundred travelers.`, riskFx: -0.12, t: "Gate C14 will never be the same." } },
      { label: "Hide in the lounge", say: "Catch up on call time.", out: { cash: 70000, fx: -0.02, t: "Reporters wrote about the closed door." } }] },
    { id: "ch:typo", kind: "chaos", title: "A typo on 2 million mailers", prompt: `Your biggest mail piece of the race went out with the election date wrong by a day. It is already in mailboxes.`, opts: [
      { label: "Send a correction blitz", say: "Texts, calls and a second mailer.", out: { cash: -180000, fx: 0, t: "Fixed, at a price." } },
      { label: "Make it a joke ad", say: "\"Even our printer is excited for Election Day.\"", out: { buzz: 9, fx: 0.03, risk: 0.3, riskT: "Election officials were not amused, and said so on TV.", riskFx: -0.1, t: "People loved the self roast." } },
      { label: "Hope nobody notices", say: "Keep quiet.", out: { fx: -0.08, enth: -3, t: "Some of your voters showed up a day late." } }] },
  ];
  return L.filter((e) => !s.used.includes(e.id) && (cal(s) > 0 || e.id !== "ch:sports"));
}

/** A crisis roughly one week in seven from week two, more when the candidate is exhausted. */
export function crisisFor(c: Ctx, s: State): Ev | null {
  if (s.week < 2 || s.done) return null;
  const p = 0.13 + (s.stamina < 35 ? 0.1 : 0) + ((s.buzz ?? 0) > 70 ? 0.05 : 0);
  if (rand(s) >= p) return null;
  const pool = crises(c).filter((e) => !s.used.includes(e.id) && !(s.queue ?? []).some((q) => q.id === e.id));
  return pool.length ? pool[Math.floor(rand(s) * pool.length)] : null;
}

/** Spin the chaos wheel: one wild card, put at the top of the stack. */
export function spinChaos(c: Ctx, s: State): Ev | null {
  const pool = chaos(c, s).filter((e) => !s.cur.some((x) => x.id === e.id));
  if (!pool.length) return null;
  const e = pool[Math.floor(rand(s) * pool.length)];
  s.cur.unshift(e); s.chaosN = (s.chaosN ?? 0) + 1;
  return e;
}
