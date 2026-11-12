// The states On Point Polling fielded in the 2026 general election, drawn on the same state shapes as the 2028
// forecast. Server drawn so the map reads with scripts off; MapPanel adds hover, click and the side card.
import fs from "node:fs";
import path from "node:path";
import type { Bench, Polling } from "@/app/accuracy/bench";
import MapPanel, { type MapState, type MapNational } from "./MapPanel";

type StatesGeo = { frame: [number, number]; states: Record<string, string>; labels: Record<string, [number, number, number]> };
let geo: StatesGeo | null = null;
function getGeo(): StatesGeo {
  if (!geo) geo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/forecast/2028/x/states.json"), "utf8")) as StatesGeo;
  return geo;
}

const NAMES: Record<string, string> = { FL: "Florida", IA: "Iowa", KS: "Kansas", MI: "Michigan", NE: "Nebraska", OH: "Ohio", SC: "South Carolina", TX: "Texas" };

/** a muted party tint whose depth follows the size of our final margin, mixed against the page ground for both themes */
function tint(poll: number, ind: boolean) {
  const k = Math.round(38 + Math.min(Math.abs(poll), 10) * 4);
  const c = ind ? "var(--ind)" : poll < 0 ? "var(--dem)" : "var(--gop)";
  return `color-mix(in srgb, ${c} ${k}%, var(--mute2))`;
}

export function mapData(P: Polling, B: Bench): { states: MapState[]; national: MapNational } {
  const by = new Map<string, MapState>();
  for (const r of P.races) {
    const s = by.get(r.st) ?? { st: r.st, name: NAMES[r.st] ?? r.st, date: r.date, n: r.n, sponsor: r.sponsor, races: [] };
    s.races.push({ office: r.office === "House" ? `House district ${Number(r.id.split("-")[2])}` : r.office, d: r.d, r: r.r, ind: r.ind, dv: r.dv, rv: r.rv, poll: r.poll, result: r.result ?? null, miss: r.miss ?? null, right: !!r.right, winner: r.winner ?? null });
    if (r.date > s.date) s.date = r.date;
    by.set(r.st, s);
  }
  const states = [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
  const n = P.national, g = B.generic;
  return { states, national: { date: n.date, n: n.n, d: n.d, r: n.r, poll: -n.poll, result: -n.result, averages: g.averages.margin, polls: B.national.polls.length } };
}

export default function PolledMap({ P, B }: { P: Polling; B: Bench }) {
  const G = getGeo();
  const { states, national } = mapData(P, B);
  const order = new Map(states.map((s, i) => [s.st, i]));
  return (
    <div className="oph-map" data-fx>
      <div className="oph-map-art">
        <svg id="oph-us" viewBox={`-10 0 ${G.frame[0] + 20} ${G.frame[1]}`} role="img" aria-label={`Map of the ${states.length} states On Point Polling surveyed in the 2026 general election: ${states.map((s) => s.name).join(", ")}`}>
          <g className="oph-base">
            {Object.entries(G.states).map(([st, d]) => {
              const s = states.find((x) => x.st === st);
              if (!s) return <path key={st} d={d} />;
              const sen = s.races.find((r) => r.office === "Senate") ?? s.races[0];
              return <path key={st} d={d} data-st={st} className="on" tabIndex={-1} style={{ ["--c" as string]: tint(sen.poll, sen.ind), ["--i" as string]: order.get(st) }} />;
            })}
          </g>
          <g className="oph-labels" aria-hidden="true">
            {states.map((s, i) => {
              const L = G.labels[s.st]; if (!L) return null;
              const right = s.races.filter((r) => r.right).length;
              return (
                <g key={s.st} transform={`translate(${L[0]} ${L[1]})`} style={{ ["--i" as string]: i }}>
                  <circle className="ring" r="16" />
                  <text className="ab" y="-2">{s.st}</text>
                  <text className="ct" y="13">{right} of {s.races.length}</text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="oph-scan" aria-hidden="true" />
      </div>
      <MapPanel states={states} national={national} />
    </div>
  );
}
