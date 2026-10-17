// Tile map of every state legislature: each state is one square split in two, the senate on the left and
// the house on the right, filled by the chance Democrats control that chamber after 2026.
import { RATE } from "@/app/lib/opp";

export type TileChamber = { st: string; chamber: "house" | "senate"; demControl: number; name: string; href?: string; current?: "D" | "R" | null };

export const TILE: Record<string, [number, number]> = {
  AK: [0, 0], ME: [11, 0], VT: [10, 1], NH: [11, 1],
  WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], WI: [7, 2], MI: [8, 2], NY: [9, 2], RI: [10, 2], MA: [11, 2],
  OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3],
  CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
  AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5],
  OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6],
  HI: [0, 7], TX: [4, 7], FL: [9, 7],
};

export function controlFill(p: number) {
  if (p >= 0.95) return RATE.safeD;
  if (p >= 0.8) return RATE.likelyD;
  if (p >= 0.6) return RATE.leanD;
  if (p > 0.4) return RATE.toss;
  if (p > 0.2) return RATE.leanR;
  if (p > 0.05) return RATE.likelyR;
  return RATE.safeR;
}
const darkText = (p: number) => p > 0.2 && p < 0.8;

export default function LegisTiles({ chambers, cell = 58, onPick }: { chambers: TileChamber[]; cell?: number; onPick?: (c: TileChamber) => void }) {
  const by = new Map(chambers.map((c) => [`${c.st}-${c.chamber}`, c]));
  const g = 5, W = 12 * cell, H = 8 * cell;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="legis-tiles" role="img" aria-label="State legislative control odds by state" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <pattern id="lt-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="rgba(var(--line-rgb),.04)" /><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(var(--line-rgb),.14)" strokeWidth="2" />
        </pattern>
      </defs>
      {Object.entries(TILE).map(([st, [cx, cy]]) => {
        const x = cx * cell + g / 2, y = cy * cell + g / 2, s = cell - g, half = s / 2;
        const sen = by.get(`${st}-senate`), hou = by.get(`${st}-house`);
        const any = sen ?? hou;
        const both = [sen, hou].filter(Boolean) as TileChamber[];
        const txtP = both.length ? both.reduce((a, c) => a + c.demControl, 0) / both.length : 0.5;
        const part = (c: TileChamber | undefined, left: boolean) => {
          const fill = c ? controlFill(c.demControl) : "url(#lt-hatch)";
          const el = (
            <rect x={left ? x : x + half} y={y} width={half} height={s} fill={fill} className={c ? "lt-half" : undefined}
              onClick={c && onPick ? () => onPick(c) : undefined} style={c ? { cursor: "pointer" } : undefined}>
              <title>{c ? `${c.name}: Democrats ${Math.round(c.demControl * 100)}% to control` : `${st} ${left ? "Senate" : "House"}: no partisan election in 2026`}</title>
            </rect>
          );
          return c?.href && !onPick ? <a href={c.href}>{el}</a> : el;
        };
        return (
          <g key={st}>
            <clipPath id={`lt-${st}`}><rect x={x} y={y} width={s} height={s} rx={7} /></clipPath>
            <g clipPath={`url(#lt-${st})`}>
              {part(sen, true)}{part(hou, false)}
              <line x1={x + half} x2={x + half} y1={y} y2={y + s} stroke="var(--bg)" strokeWidth={1.5} />
            </g>
            <text x={x + s / 2} y={y + s / 2 + 4} textAnchor="middle" fontSize={cell * 0.22} fontWeight={800}
              fill={any ? (darkText(txtP) ? "#1a1020" : "#fff") : "var(--mute)"} style={{ fontFamily: "var(--font-d)", pointerEvents: "none" }}>{st}</text>
          </g>
        );
      })}
    </svg>
  );
}
