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
  { st: "AK", m: -7.6 }, { st: "AL", m: 15.9, open: true }, { st: "AR", m: 7.4 },
  { st: "CO", m: -19.3 }, { st: "DE", m: -24.4 }, { st: "FL", m: 5.5 },
  { st: "GA", m: -12.8 }, { st: "IA", m: -2.4, open: true }, { st: "ID", m: 15.8 },
  { st: "IL", m: -22.0, open: true }, { st: "KS", m: -4.8 }, { st: "KY", m: 12.6, open: true },
  { st: "LA", m: 8.6, open: true }, { st: "MA", m: -33.3 }, { st: "ME", m: -4.3 },
  { st: "MI", m: -8.1, open: true }, { st: "MN", m: -12.8, open: true }, { st: "MS", m: 0.8 },
  { st: "MT", m: 16.8, open: true }, { st: "NC", m: -11.0, open: true }, { st: "NE", m: -5.0 },
  { st: "NH", m: -10.9, open: true }, { st: "NJ", m: -24.9 }, { st: "NM", m: -24.4 },
  { st: "OH", m: -5.7 }, { st: "OK", m: 17.8, open: true }, { st: "OR", m: -26.7 },
  { st: "RI", m: -38.6 }, { st: "SC", m: -1.8 }, { st: "SD", m: 11.3 },
  { st: "TN", m: 19.2 }, { st: "TX", m: -2.7 }, { st: "VA", m: -17.7 },
  { st: "WV", m: 27.5 }, { st: "WY", m: 33.1, open: true },
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
