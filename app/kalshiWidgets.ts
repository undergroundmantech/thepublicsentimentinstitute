// Kalshi's embeddable widgets, all in one place. Nothing is hard coded per race: race charts are built from the event
// ticker in app/kalshi.ts. Every URL carries the same tracking string, the one Kalshi reads for the usage report; change
// KALSHI_TRACK here if Kalshi issues a different string or a promo code parameter.
export const KALSHI_TRACK = "utm_medium=widget&utm_source=pbdmidterms&utm_campaign=midterms-live";
const W = "https://widgets.kalshi.com";
const tag = (u: string) => `${u}${u.includes("?") ? "&" : "?"}${KALSHI_TRACK}`;

export type Period = "1d" | "1w" | "1m" | "all";
/** A race or control market chart, for race rails and market boards. */
export const eventChart = (event: string, period: Period = "1d", size: "small" | "medium" | "large" = "large") =>
  tag(`${W}/external-widgets/events/${encodeURIComponent(event)}?widget_size=${size}&period=${period}&theme=dark`);
/** The forecast map for a chamber. */
export const forecastMap = (chamber: "senate" | "house" | "governor") =>
  tag(`${W}/external-widgets/midterms/${chamber}?links=new-tab&forecast=true&timeline=false&theme=dark`);
/** The American Power Index, broadcast version. */
export const powerIndex = () => tag(`${W}/external-widgets/indices/kpow-broadcast`);
/** The politics ticker tape. */
export const politicsTicker = () => tag(`${W}/banner?category=Politics&colorTheme=dark&logocolor=%2309bc7f`);
