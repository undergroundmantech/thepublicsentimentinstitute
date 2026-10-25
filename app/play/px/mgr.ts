// Your campaign manager: a name, a face and a voice. The field general is careful, the digital native talks in clips
// and lists, the brawler wants to hit first. Advice reads the state of your campaign, never the true county numbers.
import * as E from "../engine";

const FIRST = ["Dana", "Marcus", "Linda", "Ray", "Teresa", "Priya", "Luis", "Carol", "Mei", "Rosa", "Janelle", "Omar", "Gloria", "Darnell", "Becky", "Walt"];
const LAST = ["Hollister", "Ortega", "Banks", "Kowalski", "Nguyen", "Whitfield", "Reyes", "Okafor", "McAllister", "Brandt", "Castillo", "Delgado", "Albright", "Soto", "Mahoney", "Pruitt"];
const hash = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const mgrSeed = (r: { id: string }, m: E.Mgr) => hash(`${r.id}:${m}:mgr`);
export function mgrName(r: { id: string }, m: E.Mgr) { const h = mgrSeed(r, m); return `${FIRST[h % FIRST.length]} ${LAST[(h >>> 8) % LAST.length]}`; }

const say = (m: E.Mgr, vet: string, dig: string, bra: string) => (m === "digital" ? dig : m === "brawler" ? bra : vet);

/** The tip for right now, in the manager's voice. */
export function adviceFor(r: E.RaceFile, s: E.State, c: E.Ctx): string {
  const m = s.mgr ?? "vet", k = E.cal(s), len = E.lenOf(s);
  const stale = r.counties.reduce((a, co) => { const rd = E.readOf(s, co[0]); return a + (!rd || rd.sd >= 7 ? co[5] : 0); }, 0) / Math.max(1, c.total);
  if (s.week === s.dweek && s.debated == null) return `Debate night is this week. Every prep day widens your delivery zone, and you have had ${s.prep}. ${say(m, "Stay calm and stay on message.", "Give me one clip we can cut tonight.", "Go in swinging. Make them defend their record.")}`;
  if (s.stamina < 35) return say(m, "You are running on fumes. Below 30 energy the candidate starts making mistakes on camera. Take an afternoon off.", "You look exhausted on camera and the comments noticed. Half a day off, please.", "Even I say rest. A tired candidate throws bad punches.");
  if (s.week === len && !s.final) return "Last week. Bank every ballot you can, then the final 72 hours: put your volunteers where you have the most voters to turn out.";
  if (k <= 0) {
    if (!(s.programs ?? []).length && s.week >= 2) return say(m, "Summer is for building. Start a persuasion program in the region that decides this state: conversations now are worth more than ads nobody is watching.", "Nobody watches TV in July. Build the list: video fundraisers, the merch store, and a door program to feed the data.", "Raise money now so we can bury them in October. And start a door program so we know where to hit.");
    if (!s.jfc && s.week >= 2) return "The Network tab has the party committee. A joint fundraising committee now pays every week for the rest of the race.";
    if (k <= -1 && s.regs < 2000) return "Registration is wide open all summer. A drive in a county that leans your way adds voters nobody is polling yet.";
    return say(m, "Summer TV is cheap because nobody is watching. Save the money; spend the days on field, fundraising and the counties you need to visit.", "Summer is list building season. Every email address now is money in October.", "Use the summer to dig. Hire opposition research early and we will have the ads ready by Labor Day.");
  }
  if (k <= E.REG_DEADLINE && s.regs < 3000) return `Registration closes in early October. A drive in a county that leans your way adds voters who are not in anyone's polls yet.`;
  if (!s.offices.length) return "You have no field offices. Volunteers need somewhere to pick up walk lists, and offices give you a steady read on their counties.";
  if (!s.staff.pollster && stale > 0.5) return `About ${Math.round(stale * 100)}% of the vote is in counties you are guessing about. A pollster sharpens your whole map every week; a regional poll fixes one region now.`;
  if (k >= E.EARLY_FROM && !(s.programs ?? []).some((p) => p.kind === "gotv")) return say(m, "Early voting is open and we have no turnout program. Every ballot we chase now is one the weather cannot take.", "Ballots are going out. Start a turnout program and point the paid crews at it.", "Early vote is open. Turn out our people before they find a reason to stay home.");
  if (s.invites.length && s.days >= 2) return `${s.invites.length} people want your time this week. Some come with volunteers, money or an endorsement. Some leak.`;
  if (k >= 3 && s.cash > s.weekCash * 0.9 && s.tvWeek === 0 && s.cash > 500000) return "You are sitting on cash. Voters cannot see money in the bank: reserve TV for the last weeks before stations raise their rates.";
  if (stale > 0.4) return "Your read is going stale in a lot of counties. Visit them, run a door program there or poll the region before you spend there.";
  return say(m, "Swing counties move the most per visit. Your base counties turn out more when you show up.", "Buzz is money. A podcast or a viral moment this week pays for itself.", "Look at their network on the Network tab. Every billionaire behind them is an ad waiting to be cut.");
}

/** The Monday memo in the week report. */
export function memoFor(s: E.State, before: { avg: number | null; cash: number; buzz: number; vol: number }, avg: number | null): string {
  const m = s.mgr ?? "vet";
  const moved = avg != null && before.avg != null ? avg - before.avg : null;
  const head = moved == null ? "No new numbers we trust this week." : moved > 0.4 ? "Good week. The numbers moved our way." : moved < -0.4 ? "Bad week. We lost ground and I want it back." : "A holding week. Nothing broke.";
  const cash = s.cash < 0 ? " We are in the red; vendors want to be paid before they book more." : s.cash < before.cash * 0.6 ? " We burned a lot of cash." : "";
  const field = (s.doorsWk ?? 0) > 0 ? ` The doors team hit ${Math.round(s.doorsWk ?? 0).toLocaleString()} doors.` : "";
  const tail = say(m, " Keep building.", " Keep the content coming.", " Now let us hit them.");
  return head + cash + field + tail;
}

export function debateTip(s: E.State): string {
  return say(s.mgr ?? "vet", "Answer the question, then pivot to cost of living. Do not take the bait on zingers unless you have prepped.", "One great line beats four good answers. Find the clip.", "They have a record. Make them answer for it every round.");
}
