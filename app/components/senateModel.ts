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
  { st: "AK", m: -2.2 }, { st: "AL", m: 20.0, open: true }, { st: "AR", m: 13.9 },
  { st: "CO", m: -24.1 }, { st: "DE", m: -31.4 }, { st: "FL", m: 3.4 },
  { st: "GA", m: -11.0 }, { st: "IA", m: -2.8, open: true }, { st: "ID", m: 12.3 },
  { st: "IL", m: -26.9, open: true }, { st: "KS", m: -0.7 }, { st: "KY", m: 13.5, open: true },
  { st: "LA", m: 7.3, open: true }, { st: "MA", m: -32.6 }, { st: "ME", m: -3.6 },
  { st: "MI", m: -4.8, open: true }, { st: "MN", m: -8.6, open: true }, { st: "MS", m: 5.9 },
  { st: "MT", m: 19.0, open: true }, { st: "NC", m: -11.3, open: true }, { st: "NE", m: -1.2 },
  { st: "NH", m: -12.9, open: true }, { st: "NJ", m: -24.8 }, { st: "NM", m: -21.0 },
  { st: "OH", m: -3.5 }, { st: "OK", m: 23.8, open: true }, { st: "OR", m: -31.1 },
  { st: "RI", m: -29.3 }, { st: "SC", m: 0.2 }, { st: "SD", m: 12.4 },
  { st: "TN", m: 19.0 }, { st: "TX", m: -2.0 }, { st: "VA", m: -21.7 },
  { st: "WV", m: 29.2 }, { st: "WY", m: 38.1, open: true },
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
