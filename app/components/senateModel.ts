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
  { st: "AK", m: -4.6 }, { st: "AL", m: 17.2, open: true }, { st: "AR", m: 11.0 },
  { st: "CO", m: -18.1 }, { st: "DE", m: -31.3 }, { st: "FL", m: 2.9 },
  { st: "GA", m: -10.2 }, { st: "IA", m: -2.2, open: true }, { st: "ID", m: 20.9 },
  { st: "IL", m: -20.4, open: true }, { st: "KS", m: -0.3 }, { st: "KY", m: 14.1, open: true },
  { st: "LA", m: 8.7, open: true }, { st: "MA", m: -33.7 }, { st: "ME", m: -2.7 },
  { st: "MI", m: -7.2, open: true }, { st: "MN", m: -12.4, open: true }, { st: "MS", m: 3.3 },
  { st: "MT", m: 19.8, open: true }, { st: "NC", m: -13.4, open: true }, { st: "NE", m: -0.8 },
  { st: "NH", m: -10.8, open: true }, { st: "NJ", m: -20.7 }, { st: "NM", m: -21.7 },
  { st: "OH", m: -4.9 }, { st: "OK", m: 22.7, open: true }, { st: "OR", m: -24.4 },
  { st: "RI", m: -40.7 }, { st: "SC", m: -1.1 }, { st: "SD", m: 14.7 },
  { st: "TN", m: 21.8 }, { st: "TX", m: -1.0 }, { st: "VA", m: -16.2 },
  { st: "WV", m: 32.1 }, { st: "WY", m: 41.9, open: true },
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
