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
  { st: "AK", m: -1.9 }, { st: "AL", m: 25.3, open: true }, { st: "AR", m: 13.4 },
  { st: "CO", m: -20.8 }, { st: "DE", m: -28.9 }, { st: "FL", m: 6.5 },
  { st: "GA", m: -10.5 }, { st: "IA", m: -1.4, open: true }, { st: "ID", m: 20.9 },
  { st: "IL", m: -25.9, open: true }, { st: "KS", m: 1.3 }, { st: "KY", m: 21.7, open: true },
  { st: "LA", m: 11.0, open: true }, { st: "MA", m: -34.0 }, { st: "ME", m: -2.5 },
  { st: "MI", m: -3.8, open: true }, { st: "MN", m: -7.4, open: true }, { st: "MS", m: 5.6 },
  { st: "MT", m: 14.4, open: true }, { st: "NC", m: -11.5, open: true }, { st: "NE", m: -3.2 },
  { st: "NH", m: -10.3, open: true }, { st: "NJ", m: -24.2 }, { st: "NM", m: -25.3 },
  { st: "OH", m: -4.3 }, { st: "OK", m: 27.0, open: true }, { st: "OR", m: -28.3 },
  { st: "RI", m: -38.2 }, { st: "SC", m: 1.0 }, { st: "SD", m: 11.5 },
  { st: "TN", m: 28.0 }, { st: "TX", m: -1.8 }, { st: "VA", m: -20.3 },
  { st: "WV", m: 32.9 }, { st: "WY", m: 39.0, open: true },
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
