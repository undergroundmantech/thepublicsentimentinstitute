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
  { st: "AK", m: -1.4 }, { st: "AL", m: 21.8, open: true }, { st: "AR", m: 14.0 },
  { st: "CO", m: -22.8 }, { st: "DE", m: -29.7 }, { st: "FL", m: 4.9 },
  { st: "GA", m: -10.4 }, { st: "IA", m: -1.1, open: true }, { st: "ID", m: 12.1 },
  { st: "IL", m: -25.3, open: true }, { st: "KS", m: 1.2 }, { st: "KY", m: 13.8, open: true },
  { st: "LA", m: 7.5, open: true }, { st: "MA", m: -29.8 }, { st: "ME", m: -3.3 },
  { st: "MI", m: -4.8, open: true }, { st: "MN", m: -8.3, open: true }, { st: "MS", m: 6.8 },
  { st: "MT", m: 17.8, open: true }, { st: "NC", m: -12.8, open: true }, { st: "NE", m: -0.9 },
  { st: "NH", m: -12.4, open: true }, { st: "NJ", m: -23.6 }, { st: "NM", m: -20.5 },
  { st: "OH", m: -5.0 }, { st: "OK", m: 24.7, open: true }, { st: "OR", m: -29.7 },
  { st: "RI", m: -28.7 }, { st: "SC", m: 1.9 }, { st: "SD", m: 10.9 },
  { st: "TN", m: 20.0 }, { st: "TX", m: -2.2 }, { st: "VA", m: -21.1 },
  { st: "WV", m: 30.6 }, { st: "WY", m: 40.0, open: true },
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
