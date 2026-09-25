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
  { st: "AK", m: -3.5 }, { st: "AL", m: 21.4, open: true }, { st: "AR", m: 14.1 },
  { st: "CO", m: -21.7 }, { st: "DE", m: -27.4 }, { st: "FL", m: 6.1 },
  { st: "GA", m: -9.1 }, { st: "IA", m: -0.6, open: true }, { st: "ID", m: 13.0 },
  { st: "IL", m: -24.5, open: true }, { st: "KS", m: 2.4 }, { st: "KY", m: 16.0, open: true },
  { st: "LA", m: 8.6, open: true }, { st: "MA", m: -28.4 }, { st: "ME", m: -4.5 },
  { st: "MI", m: -4.1, open: true }, { st: "MN", m: -10.1, open: true }, { st: "MS", m: 8.3 },
  { st: "MT", m: 18.5, open: true }, { st: "NC", m: -8.4, open: true }, { st: "NE", m: 1.1 },
  { st: "NH", m: -10.4, open: true }, { st: "NJ", m: -21.3 }, { st: "NM", m: -19.9 },
  { st: "OH", m: -4.9 }, { st: "OK", m: 25.8, open: true }, { st: "OR", m: -26.6 },
  { st: "RI", m: -24.2 }, { st: "SC", m: 2.2 }, { st: "SD", m: 7.3 },
  { st: "TN", m: 21.2 }, { st: "TX", m: -2.9 }, { st: "VA", m: -20.3 },
  { st: "WV", m: 33.0 }, { st: "WY", m: 41.6, open: true },
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
