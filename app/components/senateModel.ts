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
  { st: "AK", m: -0.2 }, { st: "AL", m: 25.4, open: true }, { st: "AR", m: 10.4 },
  { st: "CO", m: -20.8 }, { st: "DE", m: -26.8 }, { st: "FL", m: 6.8 },
  { st: "GA", m: -9.8 }, { st: "IA", m: -0.0, open: true }, { st: "ID", m: 23.0 },
  { st: "IL", m: -26.0, open: true }, { st: "KS", m: -2.5 }, { st: "KY", m: 23.4, open: true },
  { st: "LA", m: 12.3, open: true }, { st: "MA", m: -33.3 }, { st: "ME", m: -1.8 },
  { st: "MI", m: -4.8, open: true }, { st: "MN", m: -9.2, open: true }, { st: "MS", m: 5.8 },
  { st: "MT", m: 19.6, open: true }, { st: "NC", m: -10.5, open: true }, { st: "NE", m: -1.3 },
  { st: "NH", m: -7.6, open: true }, { st: "NJ", m: -26.2 }, { st: "NM", m: -24.7 },
  { st: "OH", m: -3.6 }, { st: "OK", m: 26.9, open: true }, { st: "OR", m: -30.1 },
  { st: "RI", m: -36.3 }, { st: "SC", m: -1.2 }, { st: "SD", m: 16.2 },
  { st: "TN", m: 27.5 }, { st: "TX", m: -1.8 }, { st: "VA", m: -20.1 },
  { st: "WV", m: 30.7 }, { st: "WY", m: 41.7, open: true },
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
