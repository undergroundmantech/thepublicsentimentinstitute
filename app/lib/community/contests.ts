// The weekly reader poll and the predict the next poll contest. Add a new week at the top of POLLS and a new contest at
// the top of CONTESTS; the site always shows the newest one that has opened. Client safe: no server imports.
export interface ReaderPoll { week: string; opens: string; q: string; options: { k: string; label: string }[]; note?: string }
export const POLLS: ReaderPoll[] = [
  { week: "2026-11-23", opens: "2026-11-23", q: "Who will be the 2028 Democratic nominee?",
    options: [{ k: "harris", label: "Kamala Harris" }, { k: "newsom", label: "Gavin Newsom" }, { k: "aoc", label: "Alexandria Ocasio-Cortez" }, { k: "shapiro", label: "Josh Shapiro" }, { k: "buttigieg", label: "Pete Buttigieg" }, { k: "talarico", label: "James Talarico" }, { k: "other", label: "Someone else" }],
    note: "The On Point forecast has Harris at 74 percent. Do you agree?" },
];
export const currentPoll = (now = new Date()) => POLLS.find((p) => new Date(p.opens + "T00:00:00Z") <= now) ?? POLLS[POLLS.length - 1];
export const pollOf = (week: string) => POLLS.find((p) => p.week === week);

export interface Field { k: string; label: string; unit: string; min: number; max: number; step: number; hint: string }
export interface Contest { id: string; opens: string; closes: string; title: string; about: string; fields: Field[]; actual?: Record<string, number>; resultUrl?: string }
export const CONTESTS: Contest[] = [
  { id: "national-dec-2026", opens: "2026-11-23", closes: "2026-12-07T23:59:00-05:00", title: "Call our next national poll",
    about: "Guess the toplines of On Point Polling's next national survey, fielding in early December. Closest total miss wins the top of the board and a free seat in the next workshop.",
    fields: [
      { k: "approve", label: "Trump approval", unit: "%", min: 25, max: 60, step: 0.5, hint: "Share who approve, leaned" },
      { k: "disapprove", label: "Trump disapproval", unit: "%", min: 35, max: 70, step: 0.5, hint: "Share who disapprove, leaned" },
      { k: "generic", label: "Generic ballot, Democratic lead", unit: "pts", min: -10, max: 25, step: 0.5, hint: "Democrats minus Republicans; negative for a Republican lead" },
    ] },
];
export const currentContest = (now = new Date()) => CONTESTS.find((c) => new Date(c.opens + "T00:00:00Z") <= now) ?? CONTESTS[CONTESTS.length - 1];
export const contestOf = (id: string) => CONTESTS.find((c) => c.id === id);
export const isOpen = (c: Contest, now = new Date()) => !c.actual && now <= new Date(c.closes);
