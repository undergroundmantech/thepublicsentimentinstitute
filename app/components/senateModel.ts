// The 2026 Senate model, shared by the landing-page swarm and the coverage
// globe. Mirrors SENATE_RAW's modeledResult in /forecastratings — positive =
// R margin, negative = D margin; open = no incumbent running. Update both
// places together when the model moves.

export type SenateRace = { st: string; m: number; open?: boolean };

export const SENATE_MODEL: SenateRace[] = [
  { st: "AL", m: 16.1, open: true }, { st: "AK", m: -6.5 }, { st: "AR", m: 14.0 },
  { st: "CO", m: -17.5 }, { st: "DE", m: -23.8 }, { st: "FL", m: 5.6 },
  { st: "GA", m: -10.8 }, { st: "ID", m: 17.3 }, { st: "IL", m: -20.6, open: true },
  { st: "IA", m: 0.7, open: true }, { st: "KS", m: 4.8 }, { st: "KY", m: 8.1, open: true },
  { st: "LA", m: 10.7 }, { st: "ME", m: -13.0 }, { st: "MA", m: -27.0 },
  { st: "MI", m: -5.6, open: true }, { st: "MN", m: -10.1, open: true }, { st: "MS", m: 6.5 },
  { st: "MT", m: 12.1, open: true }, { st: "NE", m: -0.2 }, { st: "NH", m: -10.5, open: true },
  { st: "NJ", m: -20.0 }, { st: "NM", m: -62.2 }, { st: "NC", m: -8.1, open: true },
  { st: "OH", m: -0.9 }, { st: "OK", m: 20.1 }, { st: "OR", m: -23.2 },
  { st: "RI", m: -33.2 }, { st: "SC", m: 0.5 }, { st: "SD", m: 15.1 },
  { st: "TN", m: 21.1 }, { st: "TX", m: -1.7 }, { st: "VA", m: -18.5 },
  { st: "WV", m: 28.6 }, { st: "WY", m: 36.2, open: true },
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

// Same margin scale the rest of the site uses; lime = inside 1.5.
export function marginColor(m: number): string {
  const a = Math.abs(m);
  if (a < 1.5) return "#b7ff00";
  if (m < 0) return a >= 12 ? "#3568e6" : a >= 6 ? "#5b8cff" : "#84a8ff";
  return a >= 12 ? "#e84450" : a >= 6 ? "#ff5d6c" : "#ff8791";
}
