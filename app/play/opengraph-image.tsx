import { SIZE, playCard } from "./r/og";
import { TILES } from "./share28";

export const size = SIZE;
export const contentType = "image/png";
export const alt = "Campaign 2028, a presidential campaign game built on the On Point 2028 forecast";

// a close map for the game's own card: the 2024 pattern with the swing states split
const BLUE = ["WA", "OR", "CA", "NV", "CO", "NM", "MN", "IL", "MI", "WI", "PA", "VA", "MD", "DE", "NJ", "NY", "CT", "RI", "MA", "VT", "NH", "ME", "HI", "DC", "AZ", "GA"];
export default function Image() {
  return playCard({ eyebrow: "Free browser game · no download", title: "Run for president in 2028", sub: "Primaries, debates, running mates and a county by county fight to 270, on real forecast data.",
    dWon: Object.fromEntries(Object.keys(TILES).map((k) => [k, BLUE.includes(k)])) });
}
