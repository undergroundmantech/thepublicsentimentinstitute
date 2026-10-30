// Trophies: badges a campaign earns as it plays, checked after every move. A campaign keeps its own list, and the trophy
// case on the title screen keeps every badge a player has ever earned in this browser.
import type { RaceFile, State } from "./engine";

export type Trophy = { id: string; name: string; desc: string; tier: 1 | 2 | 3; test: (s: State, r: RaceFile) => boolean };
const visitsTotal = (s: State) => s.log.filter((l) => l.kind === "you" && /^(Rally|Town hall)/.test(l.t)).length;

export const TROPHIES: Trophy[] = [
  { id: "bus", name: "Bus Driver", desc: "Hold 10 rallies or town halls.", tier: 1, test: (s) => visitsTotal(s) >= 10 },
  { id: "road", name: "Road Warrior", desc: "Hold 30 rallies or town halls.", tier: 2, test: (s) => visitsTotal(s) >= 30 },
  { id: "everywhere", name: "Every County Counts", desc: "Campaign in 25 different counties.", tier: 2, test: (s) => Object.keys(s.visits).length >= 25 },
  { id: "money", name: "Money Machine", desc: "Raise $10 million.", tier: 2, test: (s) => s.raised >= 1e7 },
  { id: "warchest", name: "War Chest", desc: "Have more cash than your rival in the final week.", tier: 1, test: (s) => s.week >= (s.len ?? 8) && s.cash > s.oppCash },
  { id: "doors", name: "Shoe Leather", desc: "Talk to 100,000 voters at their doors.", tier: 2, test: (s) => (s.contacts ?? 0) >= 100000 },
  { id: "offices", name: "Office Space", desc: "Open five field offices.", tier: 1, test: (s) => s.offices.length >= 5 },
  { id: "staff", name: "Dream Team", desc: "An A rated pollster, media, field, digital and opposition research all on staff.", tier: 2, test: (s) => s.staff.pollster === 3 && s.staff.media && s.staff.field && s.staff.digital && s.staff.oppo },
  { id: "vols", name: "Grassroots Army", desc: "Reach 5,000 volunteers.", tier: 2, test: (s) => s.volunteers >= 5000 },
  { id: "buzz", name: "Main Character", desc: "Push buzz to 90.", tier: 2, test: (s) => s.buzz >= 90 },
  { id: "zing", name: "Zinger Machine", desc: "Land three zingers on the debate stage.", tier: 2, test: (s) => s.zingers >= 3 },
  { id: "debate", name: "Debate Champ", desc: "Win the debate.", tier: 2, test: (s) => (s.debated ?? 0) > 0 },
  { id: "streak", name: "On Fire", desc: "Gain in the polls four weeks in a row.", tier: 2, test: (s) => (s.streak ?? 0) >= 4 },
  { id: "rival", name: "Rival Breaker", desc: "Counter four of your rival's moves.", tier: 2, test: (s) => (s.rival?.countered ?? 0) >= 4 },
  { id: "surprise", name: "Survived October", desc: "Answer an October surprise and still lead the next poll average.", tier: 3, test: (s) => s.used.includes("osurprise") && s.polls.slice(-2).every((p) => p.m > 0) },
  { id: "crisis", name: "Crisis Manager", desc: "Get through three crises.", tier: 2, test: (s) => s.resolved.filter((x) => x.id.startsWith("cr:")).length >= 3 },
  { id: "chaos", name: "Agent of Chaos", desc: "Spin the chaos wheel three times.", tier: 1, test: (s) => (s.chaosN ?? 0) >= 3 },
  { id: "viral", name: "Gone Viral", desc: "Have a rally clip go viral.", tier: 1, test: (s) => s.log.some((l) => l.t.startsWith("Viral moment")) },
  { id: "iron", name: "Iron Candidate", desc: "Reach the final week without a single rest day.", tier: 2, test: (s) => s.week >= (s.len ?? 8) && s.rested === 0 },
  { id: "dirty", name: "Opposition File", desc: "Drop your opposition research file.", tier: 1, test: (s) => !!s.dumped },
  { id: "win", name: "Elected", desc: "Win your race.", tier: 1, test: (s) => !!s.result?.win },
  { id: "upset", name: "The Upset", desc: "Win a race you started at least three points behind.", tier: 3, test: (s) => !!s.result?.win && (s.result?.start ?? 0) <= -3 },
  { id: "comeback", name: "Comeback Kid", desc: "Win after trailing by four or more in the late polls.", tier: 3, test: (s) => !!s.result?.win && s.low <= -4 },
  { id: "landslide", name: "Landslide", desc: "Win by ten points or more.", tier: 3, test: (s) => !!s.result?.win && (s.result?.m ?? 0) >= 10 },
  { id: "photo", name: "Photo Finish", desc: "Win by less than a point.", tier: 3, test: (s) => !!s.result?.win && (s.result?.m ?? 9) < 1 },
  { id: "giant", name: "Giant Killer", desc: "Beat an incumbent.", tier: 3, test: (s, r) => !!s.result?.win && !!r.cands[s.side === "D" ? 1 : 0].inc },
  { id: "hard", name: "Against the Wave", desc: "Win on Wave Against You.", tier: 3, test: (s) => !!s.result?.win && s.diff === "wave" },
  { id: "machine", name: "Beat the Machine", desc: "Win against a five star rival.", tier: 3, test: (s) => !!s.result?.win && (s.rival?.stars ?? 0) >= 5 },
  { id: "spent", name: "Left It All Out There", desc: "Finish with less than $100,000 in the bank.", tier: 1, test: (s) => !!s.done && s.cash < 1e5 && s.cash >= 0 },
  { id: "nap", name: "Power Nap", desc: "Rest three times.", tier: 1, test: (s) => s.rested >= 3 },
  { id: "crowd", name: "Crowd Pleaser", desc: "Land three perfect applause lines in one rally.", tier: 2, test: (s) => (s.crowdBest ?? 0) >= 6 },
  { id: "showman", name: "Showman", desc: "Work the crowd at ten rallies.", tier: 1, test: (s) => (s.crowds ?? 0) >= 10 },
  { id: "adman", name: "Mad Man", desc: "Cut three ads the focus group loved.", tier: 2, test: (s) => (s.adHits ?? 0) >= 3 },
  { id: "whale", name: "Whale Watching", desc: "See two whale trades move your Kalshi line.", tier: 1, test: (s) => (s.whales ?? 0) >= 2 },
  { id: "market", name: "Beat the Market", desc: "Win a race Kalshi opened you at 35 cents or less.", tier: 3, test: (s) => !!s.result?.win && !!s.mkt && s.mkt.open <= 0.35 },
  { id: "bull", name: "Bull Run", desc: "Push your Kalshi line 15 cents above where it opened.", tier: 2, test: (s) => !!s.mkt && s.mkt.p - s.mkt.open >= 0.15 },
  { id: "chalk", name: "Chalk", desc: "Win as the Kalshi favorite, priced at 75 cents or more on election eve.", tier: 1, test: (s) => !!s.result?.win && !!s.mkt && s.mkt.p >= 0.75 },
  { id: "everyone", name: "Shook Every Hand", desc: "Make 50 campaign stops.", tier: 3, test: (s) => visitsTotal(s) >= 50 },
];

/** Check the campaign for new trophies; returns the ones it just earned and records them. */
export function checkTrophies(s: State, r: RaceFile): Trophy[] {
  const have = new Set(s.ach ?? []); const out: Trophy[] = [];
  for (const t of TROPHIES) { if (have.has(t.id)) continue; try { if (t.test(s, r)) { out.push(t); have.add(t.id); } } catch { /* a trophy never breaks the game */ } }
  if (out.length) s.ach = [...have];
  return out;
}

const CASE = "opp_play_trophies";
export function trophyCase(): string[] { try { return JSON.parse(localStorage.getItem(CASE) || "[]"); } catch { return []; } }
export function saveTrophies(ids: string[]) { try { const all = new Set([...trophyCase(), ...ids]); localStorage.setItem(CASE, JSON.stringify([...all])); } catch { /* storage blocked */ } }
