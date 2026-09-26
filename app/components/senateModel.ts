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
  { st: "AK", m: -4.1 }, { st: "AL", m: 20.3, open: true }, { st: "AR", m: 13.7 },
  { st: "CO", m: -23.8 }, { st: "DE", m: -29.2 }, { st: "FL", m: 5.2 },
  { st: "GA", m: -9.7 }, { st: "IA", m: -0.9, open: true }, { st: "ID", m: 12.3 },
  { st: "IL", m: -25.7, open: true }, { st: "KS", m: 1.7 }, { st: "KY", m: 15.3, open: true },
  { st: "LA", m: 8.0, open: true }, { st: "MA", m: -28.8 }, { st: "ME", m: -5.0 },
  { st: "MI", m: -4.3, open: true }, { st: "MN", m: -10.6, open: true }, { st: "MS", m: 7.7 },
  { st: "MT", m: 17.7, open: true }, { st: "NC", m: -8.8, open: true }, { st: "NE", m: 0.5 },
  { st: "NH", m: -10.7, open: true }, { st: "NJ", m: -22.9 }, { st: "NM", m: -20.8 },
  { st: "OH", m: -5.5 }, { st: "OK", m: 24.9, open: true }, { st: "OR", m: -28.0 },
  { st: "RI", m: -24.8 }, { st: "SC", m: 1.7 }, { st: "SD", m: 6.7 },
  { st: "TN", m: 20.4 }, { st: "TX", m: -2.9 }, { st: "VA", m: -20.8 },
  { st: "WV", m: 31.2 }, { st: "WY", m: 40.2, open: true },
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
