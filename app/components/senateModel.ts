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
  { st: "AK", m: -5.1 }, { st: "AL", m: 12.6, open: true }, { st: "AR", m: 9.2 },
  { st: "CO", m: -22.3 }, { st: "DE", m: -28.3 }, { st: "FL", m: 3.7 },
  { st: "GA", m: -12.8 }, { st: "IA", m: -3.7, open: true }, { st: "ID", m: 18.7 },
  { st: "IL", m: -17.8, open: true }, { st: "KS", m: -5.0 }, { st: "KY", m: 10.6, open: true },
  { st: "LA", m: 5.8, open: true }, { st: "MA", m: -33.5 }, { st: "ME", m: -5.7 },
  { st: "MI", m: -8.8, open: true }, { st: "MN", m: -10.9, open: true }, { st: "MS", m: 0.5 },
  { st: "MT", m: 17.6, open: true }, { st: "NC", m: -11.1, open: true }, { st: "NE", m: -2.0 },
  { st: "NH", m: -12.6, open: true }, { st: "NJ", m: -26.2 }, { st: "NM", m: -21.5 },
  { st: "OH", m: -6.7 }, { st: "OK", m: 18.4, open: true }, { st: "OR", m: -29.3 },
  { st: "RI", m: -40.2 }, { st: "SC", m: -1.1 }, { st: "SD", m: 12.8 },
  { st: "TN", m: 18.9 }, { st: "TX", m: -3.7 }, { st: "VA", m: -20.8 },
  { st: "WV", m: 27.7 }, { st: "WY", m: 38.4, open: true },
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
