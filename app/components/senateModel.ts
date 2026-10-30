// The 2026 Senate model, shared by the landing-page swarm, the coverage globes,
// the electoral map and the situation room. Positive = R margin, negative = D
// margin; open = no incumbent running.
//
// GENERATED — do not hand edit. scripts/forecast/sync_site_numbers.py rewrites
// this array, and the ratings tables in /forecastratings, from
// public/forecast/model.json. Run it after every forecast build, or these pages
// fall behind /forecast, which is what happened between Sept 23 and 25.

export type SenateRace = { st: string; m: number; open?: boolean };

export const SENATE_MODEL: SenateRace[] = [
  { st: "AK", m: -5.5 }, { st: "AL", m: 16.4, open: true }, { st: "AR", m: 9.9 },
  { st: "CO", m: -18.2 }, { st: "DE", m: -25.1 }, { st: "FL", m: 4.5 },
  { st: "GA", m: -11.5 }, { st: "IA", m: -0.4, open: true }, { st: "ID", m: 20.3 },
  { st: "IL", m: -18.9, open: true }, { st: "KS", m: -2.9 }, { st: "KY", m: 14.8, open: true },
  { st: "LA", m: 11.1, open: true }, { st: "MA", m: -32.8 }, { st: "ME", m: -2.8 },
  { st: "MI", m: -6.8, open: true }, { st: "MN", m: -11.8, open: true }, { st: "MS", m: 3.3 },
  { st: "MT", m: 18.7, open: true }, { st: "NC", m: -9.6, open: true }, { st: "NE", m: -1.7 },
  { st: "NH", m: -9.7, open: true }, { st: "NJ", m: -20.6 }, { st: "NM", m: -21.1 },
  { st: "OH", m: -4.5 }, { st: "OK", m: 20.3, open: true }, { st: "OR", m: -24.2 },
  { st: "RI", m: -39.3 }, { st: "SC", m: -0.3 }, { st: "SD", m: 15.8 },
  { st: "TN", m: 21.2 }, { st: "TX", m: -1.5 }, { st: "VA", m: -15.7 },
  { st: "WV", m: 30.4 }, { st: "WY", m: 37.5, open: true },
];

// Seats decided by the model's margins, plus holdovers not on the ballot:
// 13 D seats and 22 R seats are up; holdovers are 34 D / 31 R. The model's
// margins currently rate 19 D / 16 R of the contested seats.
export function senateBalance() {
  let d = 34, r = 31;
  for (const race of SENATE_MODEL) {
    if (race.m < 0) d++;
    else if (race.m > 0) r++;
  }
  return { d, r };
}

// Same margin scale the rest of the site uses; brand purple = inside 1.5.
export function marginColor(m: number): string {
  const a = Math.abs(m);
  if (a < 1.5) return "#6d3ee9";
  if (m < 0) return a >= 12 ? "#3568e6" : a >= 6 ? "#5b8cff" : "#84a8ff";
  return a >= 12 ? "#e84450" : a >= 6 ? "#ff5d6c" : "#ff8791";
}
