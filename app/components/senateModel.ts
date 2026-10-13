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
  { st: "AK", m: -1.5 }, { st: "AL", m: 19.3, open: true }, { st: "AR", m: 13.7 },
  { st: "CO", m: -23.2 }, { st: "DE", m: -31.2 }, { st: "FL", m: 4.1 },
  { st: "GA", m: -10.7 }, { st: "IA", m: -1.2, open: true }, { st: "ID", m: 18.5 },
  { st: "IL", m: -21.3, open: true }, { st: "KS", m: 0.2 }, { st: "KY", m: 12.9, open: true },
  { st: "LA", m: 7.2, open: true }, { st: "MA", m: -32.5 }, { st: "ME", m: -3.1 },
  { st: "MI", m: -5.3, open: true }, { st: "MN", m: -8.7, open: true }, { st: "MS", m: 5.8 },
  { st: "MT", m: 19.5, open: true }, { st: "NC", m: -11.3, open: true }, { st: "NE", m: -1.9 },
  { st: "NH", m: -11.9, open: true }, { st: "NJ", m: -25.0 }, { st: "NM", m: -20.8 },
  { st: "OH", m: -4.4 }, { st: "OK", m: 24.2, open: true }, { st: "OR", m: -32.4 },
  { st: "RI", m: -30.9 }, { st: "SC", m: 2.5 }, { st: "SD", m: 12.8 },
  { st: "TN", m: 19.2 }, { st: "TX", m: -3.2 }, { st: "VA", m: -21.5 },
  { st: "WV", m: 29.4 }, { st: "WY", m: 36.5, open: true },
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
