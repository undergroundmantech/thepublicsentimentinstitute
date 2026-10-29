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
  { st: "AK", m: -4.7 }, { st: "AL", m: 17.2, open: true }, { st: "AR", m: 11.6 },
  { st: "CO", m: -18.6 }, { st: "DE", m: -28.2 }, { st: "FL", m: 4.8 },
  { st: "GA", m: -11.4 }, { st: "IA", m: -0.3, open: true }, { st: "ID", m: 22.0 },
  { st: "IL", m: -18.1, open: true }, { st: "KS", m: -1.0 }, { st: "KY", m: 13.8, open: true },
  { st: "LA", m: 7.7, open: true }, { st: "MA", m: -31.9 }, { st: "ME", m: -2.8 },
  { st: "MI", m: -7.0, open: true }, { st: "MN", m: -12.4, open: true }, { st: "MS", m: 3.9 },
  { st: "MT", m: 18.2, open: true }, { st: "NC", m: -10.6, open: true }, { st: "NE", m: -0.6 },
  { st: "NH", m: -9.6, open: true }, { st: "NJ", m: -20.6 }, { st: "NM", m: -20.2 },
  { st: "OH", m: -4.9 }, { st: "OK", m: 23.4, open: true }, { st: "OR", m: -24.2 },
  { st: "RI", m: -38.9 }, { st: "SC", m: -0.7 }, { st: "SD", m: 15.6 },
  { st: "TN", m: 22.7 }, { st: "TX", m: -1.3 }, { st: "VA", m: -15.7 },
  { st: "WV", m: 32.5 }, { st: "WY", m: 43.1, open: true },
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
