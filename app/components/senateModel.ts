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
  { st: "AK", m: -1.8 }, { st: "AL", m: 20.8, open: true }, { st: "AR", m: 14.5 },
  { st: "CO", m: -22.4 }, { st: "DE", m: -30.0 }, { st: "FL", m: 3.9 },
  { st: "GA", m: -9.9 }, { st: "IA", m: -2.6, open: true }, { st: "ID", m: 13.1 },
  { st: "IL", m: -25.6, open: true }, { st: "KS", m: -0.2 }, { st: "KY", m: 14.5, open: true },
  { st: "LA", m: 8.2, open: true }, { st: "MA", m: -32.3 }, { st: "ME", m: -3.7 },
  { st: "MI", m: -4.7, open: true }, { st: "MN", m: -8.3, open: true }, { st: "MS", m: 6.6 },
  { st: "MT", m: 19.5, open: true }, { st: "NC", m: -11.0, open: true }, { st: "NE", m: -0.7 },
  { st: "NH", m: -12.8, open: true }, { st: "NJ", m: -23.4 }, { st: "NM", m: -20.6 },
  { st: "OH", m: -3.5 }, { st: "OK", m: 24.6, open: true }, { st: "OR", m: -29.6 },
  { st: "RI", m: -28.6 }, { st: "SC", m: 0.5 }, { st: "SD", m: 11.6 },
  { st: "TN", m: 19.7 }, { st: "TX", m: -1.9 }, { st: "VA", m: -21.3 },
  { st: "WV", m: 31.3 }, { st: "WY", m: 39.9, open: true },
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
