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
  { st: "AK", m: -2.5 }, { st: "AL", m: 23.5, open: true }, { st: "AR", m: 14.0 },
  { st: "CO", m: -18.3 }, { st: "DE", m: -29.7 }, { st: "FL", m: 5.1 },
  { st: "GA", m: -10.4 }, { st: "IA", m: -1.8, open: true }, { st: "ID", m: 19.0 },
  { st: "IL", m: -24.2, open: true }, { st: "KS", m: 0.9 }, { st: "KY", m: 20.7, open: true },
  { st: "LA", m: 12.1, open: true }, { st: "MA", m: -33.7 }, { st: "ME", m: -0.9 },
  { st: "MI", m: -5.5, open: true }, { st: "MN", m: -9.5, open: true }, { st: "MS", m: 7.0 },
  { st: "MT", m: 20.8, open: true }, { st: "NC", m: -10.8, open: true }, { st: "NE", m: -0.1 },
  { st: "NH", m: -9.9, open: true }, { st: "NJ", m: -25.0 }, { st: "NM", m: -22.9 },
  { st: "OH", m: -3.6 }, { st: "OK", m: 28.2, open: true }, { st: "OR", m: -28.9 },
  { st: "RI", m: -38.9 }, { st: "SC", m: 1.7 }, { st: "SD", m: 10.9 },
  { st: "TN", m: 29.6 }, { st: "TX", m: -2.0 }, { st: "VA", m: -20.6 },
  { st: "WV", m: 34.2 }, { st: "WY", m: 42.0, open: true },
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
