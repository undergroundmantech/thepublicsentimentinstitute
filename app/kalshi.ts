// Kalshi event tickers for On Point races, built from the race id, never hard coded per race.
// Senate races are SENATE{ST}-26, governor races GOVPARTY{ST}-26 and House districts HOUSE{ST}{N}-26, the patterns
// Kalshi's public election markets use. A few older series use another spelling, so each race lists the spellings to
// try in order; the first one Kalshi answers wins.
export const KALSHI_YEAR = "26";
export const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

/** Event tickers to try for a race id such as sen-GA, gov-AZ or house-NE-01, in order. */
export function eventTickers(raceId: string): string[] {
  const [kind, st, d] = raceId.split("-");
  if (!st || !/^[A-Z]{2}$/.test(st)) return [];
  const y = KALSHI_YEAR;
  if (kind === "sen") return [`SENATE${st}-${y}`, `SENATEPARTY${st}-${y}`];
  if (kind === "gov") return [`GOVPARTY${st}-${y}`, `GOV${st}-${y}`];
  if (kind === "house" && d) { const n = Number(d); return n ? [`HOUSE${st}${n}-${y}`, `KXHOUSE${st}${n}-${y}`] : [`HOUSE${st}AL-${y}`, `HOUSE${st}1-${y}`]; }
  return [];
}

/** One side of a Kalshi race market, priced in dollars: 0.62 is 62 cents, a 62 percent chance. */
export type KalshiSide = { ticker: string; party: "D" | "R" | "I" | "?"; name: string; price: number; prev: number | null; bid: number | null; ask: number | null; volume: number | null };
export type KalshiRace = { id: string; event: string; title: string; sides: KalshiSide[]; asOf: string };

const num = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN; return isFinite(n) ? n : null; };
/** Kalshi has reported prices in cents and, more recently, in dollar strings; read either. */
const dollars = (m: Record<string, unknown>, k: string) => { const d = num(m[`${k}_dollars`]); if (d != null) return d; const c = num(m[k]); return c == null ? null : c / 100; };

/** Turn a Kalshi event response with nested markets into the sides of the race. */
export function readEvent(id: string, j: { event?: Record<string, unknown>; markets?: Record<string, unknown>[] }, asOf = new Date().toISOString()): KalshiRace | null {
  const ev = j.event ?? {}; const ms = j.markets ?? (ev.markets as Record<string, unknown>[] | undefined) ?? [];
  const sides: KalshiSide[] = [];
  for (const m of ms) {
    if (m.status && !["active", "open", "initialized"].includes(String(m.status))) continue;
    const ticker = String(m.ticker ?? ""); const suf = ticker.split("-").pop() ?? "";
    const party = (suf === "D" || suf === "R" || suf === "I" ? suf : "?") as KalshiSide["party"];
    const last = dollars(m, "last_price"), bid = dollars(m, "yes_bid"), ask = dollars(m, "yes_ask");
    const price = last ?? (bid != null && ask != null ? (bid + ask) / 2 : bid ?? ask);
    if (price == null) continue;
    sides.push({ ticker, party, name: String(m.yes_sub_title ?? m.subtitle ?? ""), price, prev: dollars(m, "previous_price"), bid, ask, volume: num(m.volume_fp ?? m.volume) });
  }
  if (!sides.length) return null;
  return { id, event: String(ev.event_ticker ?? sides[0].ticker.split("-").slice(0, -1).join("-")), title: String(ev.title ?? ""), sides, asOf };
}

const sur = (n: string) => n.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
/** The market price for one candidate: by surname first, since an independent such as Dan Osborn can trade under any
 * suffix, then by party, then the other side's complement. */
export function priceFor(k: KalshiRace | null | undefined, name: string, party: string): number | null {
  if (!k) return null;
  const byName = k.sides.find((x) => x.name && sur(x.name) === sur(name));
  if (byName) return byName.price;
  const p = party === "D" || party === "R" || party === "I" ? party : "?";
  const byParty = k.sides.find((x) => x.party === p) ?? (p === "I" ? k.sides.find((x) => x.party === "D") : undefined);
  if (byParty) return byParty.price;
  if (k.sides.length === 2) { const other = k.sides.find((x) => x.party === (p === "R" ? "D" : "R")); if (other) return Math.max(0, 1 - other.price); }
  return null;
}
