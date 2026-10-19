// On Point Polling's 2026 general election state polls, for the map on /tpsi/polls.
// The main number is likely voters with undecideds leaned; "asked" is the result before leaners.
// Add a state here when a poll is released, and change its status as it moves from next to field to released.

export type PollCand = { n: string; p: "d" | "r" | "o"; leaned: number; asked?: number };
export type PollRace = { race: "Senate" | "Governor" | "Railroad Commissioner"; cands: PollCand[] };
export type StatePoll = {
  st: string; name: string; status: "released" | "field" | "next";
  dates?: string; sample?: string; moe?: string; href?: string; hrefLabel?: string; release?: string;
  races: PollRace[]; note?: string;
};

export const FUND_URL = "https://www.gofundme.com/f/fund-independent-polling-in-5-battleground-states";
export const FUND_LINE = "$643.50 funds a full state poll. Every result goes public, crosstabs included.";

export const STATE_POLLS: StatePoll[] = [
  {
    st: "MI", name: "Michigan", status: "released", dates: "Oct. 18, 2026", sample: "586 RV", moe: "±5.2 LV",
    href: "https://onpointpolitics.substack.com/p/michigan-poll-el-sayed-leads-rogers", hrefLabel: "Read the release",
    races: [
      { race: "Senate", cands: [{ n: "Abdul El-Sayed", p: "d", leaned: 51.7, asked: 48.7 }, { n: "Mike Rogers", p: "r", leaned: 45.4, asked: 42.8 }] },
      { race: "Governor", cands: [{ n: "Jocelyn Benson", p: "d", leaned: 54.1, asked: 50.8 }, { n: "John James", p: "r", leaned: 42.1, asked: 39.0 }] },
    ],
  },
  {
    st: "OH", name: "Ohio", status: "released", dates: "Oct. 16 to 17, 2026", sample: "635 RV", moe: "±4.9",
    href: "/tpsi/polls/ohio-2026", hrefLabel: "Full results and crosstabs", release: "https://onpointpolitics.substack.com/p/ohio-poll-democrats-lead-both-races",
    races: [
      { race: "Senate", cands: [{ n: "Sherrod Brown", p: "d", leaned: 48.4, asked: 46.6 }, { n: "Jon Husted", p: "r", leaned: 44.8, asked: 42.3 }] },
      { race: "Governor", cands: [{ n: "Amy Acton", p: "d", leaned: 49.2, asked: 47.9 }, { n: "Vivek Ramaswamy", p: "r", leaned: 45.7, asked: 43.1 }] },
    ],
  },
  {
    st: "TX", name: "Texas", status: "released", dates: "Oct. 17 to 18, 2026", sample: "661 RV", moe: "±5.5 LV",
    href: "/tpsi/polls/texas-2026", hrefLabel: "Full results and crosstabs", release: "https://onpointpolitics.substack.com/p/texas-poll-talarico-leads-paxton",
    races: [
      { race: "Senate", cands: [{ n: "James Talarico", p: "d", leaned: 50.4, asked: 48.8 }, { n: "Ken Paxton", p: "r", leaned: 45.9, asked: 43.0 }] },
      { race: "Governor", cands: [{ n: "Gina Hinojosa", p: "d", leaned: 47.0, asked: 45.2 }, { n: "Greg Abbott", p: "r", leaned: 49.0, asked: 47.7 }] },
      { race: "Railroad Commissioner", cands: [{ n: "Jon Rosenthal", p: "d", leaned: 44.8, asked: 39.8 }, { n: "Bo French", p: "r", leaned: 49.4, asked: 45.1 }] },
    ],
  },
  {
    st: "FL", name: "Florida", status: "released", dates: "Oct. 18, 2026", sample: "601 RV", moe: "±5.8 LV",
    href: "https://onpointpolitics.substack.com/p/florida-poll-moody-leads-nixon-donalds", hrefLabel: "Read the release",
    races: [
      { race: "Senate", cands: [{ n: "Angie Nixon", p: "d", leaned: 45.8, asked: 42.8 }, { n: "Ashley Moody", p: "r", leaned: 52.5, asked: 49.6 }] },
      { race: "Governor", cands: [{ n: "David Jolly", p: "d", leaned: 44.4, asked: 42.4 }, { n: "Byron Donalds", p: "r", leaned: 48.3, asked: 46.6 }] },
    ],
  },
  { st: "SC", name: "South Carolina", status: "field", races: [], note: "Senate and governor poll in the field now." },
  { st: "NE", name: "Nebraska", status: "next", races: [], note: "Considering next. Not yet funded." },
  { st: "WI", name: "Wisconsin", status: "next", races: [], note: "Considering next. Not yet funded." },
];
