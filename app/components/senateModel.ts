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
  { st: "AK", m: -1.8 }, { st: "AL", m: 20.4, open: true }, { st: "AR", m: 14.3 },
  { st: "CO", m: -22.8 }, { st: "DE", m: -30.1 }, { st: "FL", m: 4.0 },
  { st: "GA", m: -10.8 }, { st: "IA", m: -2.6, open: true }, { st: "ID", m: 13.0 },
  { st: "IL", m: -25.6, open: true }, { st: "KS", m: -0.3 }, { st: "KY", m: 14.3, open: true },
  { st: "LA", m: 7.8, open: true }, { st: "MA", m: -32.3 }, { st: "ME", m: -3.8 },
  { st: "MI", m: -4.6, open: true }, { st: "MN", m: -8.3, open: true }, { st: "MS", m: 6.3 },
  { st: "MT", m: 19.4, open: true }, { st: "NC", m: -11.0, open: true }, { st: "NE", m: -0.8 },
  { st: "NH", m: -13.1, open: true }, { st: "NJ", m: -23.3 }, { st: "NM", m: -20.6 },
  { st: "OH", m: -3.4 }, { st: "OK", m: 24.6, open: true }, { st: "OR", m: -30.0 },
  { st: "RI", m: -28.8 }, { st: "SC", m: 0.6 }, { st: "SD", m: 13.0 },
  { st: "TN", m: 19.4 }, { st: "TX", m: -1.9 }, { st: "VA", m: -21.2 },
  { st: "WV", m: 30.6 }, { st: "WY", m: 39.3, open: true },
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
