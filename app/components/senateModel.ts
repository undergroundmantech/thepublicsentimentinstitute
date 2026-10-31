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
  { st: "AK", m: -4.9 }, { st: "AL", m: 12.8, open: true }, { st: "AR", m: 8.6 },
  { st: "CO", m: -20.0 }, { st: "DE", m: -26.6 }, { st: "FL", m: 5.1 },
  { st: "GA", m: -11.8 }, { st: "IA", m: -1.1, open: true }, { st: "ID", m: 19.4 },
  { st: "IL", m: -19.9, open: true }, { st: "KS", m: -4.0 }, { st: "KY", m: 10.8, open: true },
  { st: "LA", m: 6.4, open: true }, { st: "MA", m: -33.0 }, { st: "ME", m: -3.0 },
  { st: "MI", m: -7.5, open: true }, { st: "MN", m: -11.6, open: true }, { st: "MS", m: 1.8 },
  { st: "MT", m: 18.0, open: true }, { st: "NC", m: -9.5, open: true }, { st: "NE", m: -2.5 },
  { st: "NH", m: -10.6, open: true }, { st: "NJ", m: -25.8 }, { st: "NM", m: -21.4 },
  { st: "OH", m: -4.8 }, { st: "OK", m: 21.1, open: true }, { st: "OR", m: -27.9 },
  { st: "RI", m: -39.7 }, { st: "SC", m: -0.4 }, { st: "SD", m: 13.5 },
  { st: "TN", m: 19.8 }, { st: "TX", m: -1.9 }, { st: "VA", m: -20.4 },
  { st: "WV", m: 28.7 }, { st: "WY", m: 38.2, open: true },
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
