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
  { st: "AK", m: -1.8 }, { st: "AL", m: 25.5, open: true }, { st: "AR", m: 13.2 },
  { st: "CO", m: -20.8 }, { st: "DE", m: -28.3 }, { st: "FL", m: 6.8 },
  { st: "GA", m: -10.0 }, { st: "IA", m: -1.3, open: true }, { st: "ID", m: 21.0 },
  { st: "IL", m: -26.1, open: true }, { st: "KS", m: 1.6 }, { st: "KY", m: 21.4, open: true },
  { st: "LA", m: 11.0, open: true }, { st: "MA", m: -34.4 }, { st: "ME", m: -4.0 },
  { st: "MI", m: -5.2, open: true }, { st: "MN", m: -8.7, open: true }, { st: "MS", m: 7.2 },
  { st: "MT", m: 15.2, open: true }, { st: "NC", m: -11.7, open: true }, { st: "NE", m: -3.5 },
  { st: "NH", m: -10.4, open: true }, { st: "NJ", m: -24.2 }, { st: "NM", m: -26.7 },
  { st: "OH", m: -3.8 }, { st: "OK", m: 27.1, open: true }, { st: "OR", m: -28.3 },
  { st: "RI", m: -35.9 }, { st: "SC", m: -1.4 }, { st: "SD", m: 9.3 },
  { st: "TN", m: 26.7 }, { st: "TX", m: -2.1 }, { st: "VA", m: -20.3 },
  { st: "WV", m: 31.4 }, { st: "WY", m: 38.5, open: true },
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
