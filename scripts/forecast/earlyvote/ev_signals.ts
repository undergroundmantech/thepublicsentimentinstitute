// The early vote page's own read of every reporting state, run outside the browser so the forecast can use it.
//
// It builds exactly what /maps/early-vote builds on its national view: each state's mail returns and early in person
// ballots, party as reported where the state publishes it and the On Point Polling party estimate where it reports ballots as
// Unspecified, then the electorate comparison (computeElectorate) against the 2026 electorate the forecast expects.
// The one difference: it reads the national feed only, so an Unspecified state is estimated from its counties weighted
// by adults rather than from county by county counts.
//
//   npx tsx scripts/forecast/earlyvote/ev_signals.ts SNAPSHOT_DIR OUT.json
//
// SNAPSHOT_DIR holds US_returned.json, US_inperson.json and US_requested.json in the civicAPI shape.
import fs from "node:fs";
import path from "node:path";
import {
  stateView, returnTilt, stateOfFips, sumRow, STATE_NAME,
  type CategoryPayload, type PartyModel, type StateView, type Mode,
} from "../../../app/maps/early-vote/lib";
import { computeElectorate, dShare, type ActualUnit, type ElectModel, type P3 } from "../../../app/maps/early-vote/Electorate";

const [snapDir, outPath] = process.argv.slice(2);
const ROOT = path.resolve(__dirname, "../../..");
const rd = <T,>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;
const model = rd<PartyModel>(path.join(ROOT, "public/earlyvote-party-model.json"));
const E = rd<ElectModel>(path.join(ROOT, "public/earlyvote-electorate.json"));
const countyNames = rd<Record<string, string>>(path.join(ROOT, "public/earlyvote-county-names.json"));
const load = (c: string) => { const p = path.join(snapDir, `US_${c}.json`); return fs.existsSync(p) ? rd<CategoryPayload>(p) : null; };
const natl = { requested: load("requested"), returned: load("returned"), inperson: load("inperson") };

// the page's expected party mix of a county's mail (0) or early in person (1) voters, at the state's mean offset
const meanOff: Record<string, number[][]> = {};
for (const [st, draws] of Object.entries(model.offsets)) {
  const acc = [[0, 0], [0, 0], [0, 0]];
  for (const dr of draws) for (let m = 0; m < 3; m++) { acc[m][0] += dr[m]?.[0] ?? 0; acc[m][1] += dr[m]?.[1] ?? 0; }
  meanOff[st] = acc.map((x) => [x[0] / Math.max(1, draws.length), x[1] / Math.max(1, draws.length)]);
}
const shift = (m: number[], o: number[]) => {
  const d0 = Math.max(m[0], 1e-3);
  const a = (Math.max(m[1], 1e-3) / d0) * Math.exp(o[0]), b = (Math.max(m[2], 1e-3) / d0) * Math.exp(o[1]); const z = 1 + a + b;
  return [1 / z, a / z, b / z];
};
const expMix = (f: string, mi: 0 | 1): number[] | null => {
  const m = model.mix[f]; if (!m) return null;
  return shift(m[mi], meanOff[stateOfFips(f)]?.[mi] ?? [0, 0]);
};

const tilt = returnTilt(natl.requested, natl.returned, model);
const split = (row: Record<string, { votes: number }> | undefined) => {
  let d = 0, r = 0, o = 0, u = 0;
  for (const [g, b] of Object.entries(row ?? {})) { const v = b?.votes ?? 0; if (g === "Democratic") d += v; else if (g === "Republican") r += v; else if (g === "Unspecified") u += v; else o += v; }
  return { d, r, o, u };
};
const fromView = (v: StateView | null, row?: Record<string, { votes: number }>): P3 & { u: number } => {
  if (v) { const n = v.d + v.r + v.o + v.u; const left = Math.max(0, v.u - v.ed - v.er - v.ei); return { d: v.d + v.ed, r: v.r + v.er, o: v.o + v.ei + left, n, u: v.u }; }
  const x = split(row); return { d: x.d, r: x.r, o: x.o + x.u, n: x.d + x.r + x.o + x.u, u: x.u };
};
const view = (st: string, c: "returned" | "inperson"): StateView | null => {
  const mode: Mode = c === "inperson" ? "early" : "returned";
  return stateView(st, natl[c]?.regions[st], undefined, countyNames, model, mode, tilt, null,
    c === "returned" ? { row: natl.requested?.regions[st], counties: undefined } : undefined);
};

const sts = new Set([...Object.keys(natl.returned?.regions ?? {}), ...Object.keys(natl.inperson?.regions ?? {})]);
const out: Record<string, unknown> = {};
for (const st of [...sts].sort()) {
  if (!STATE_NAME[st]) continue;
  const mail = fromView(view(st, "returned"), natl.returned?.regions[st]);
  const early = fromView(view(st, "inperson"), natl.inperson?.regions[st]);
  const n = mail.n + early.n;
  if (n <= 0) continue;
  const u: ActualUnit = { key: st, label: STATE_NAME[st], st, fips: null, mail, early, estShare: n > 0 ? (mail.u + early.u) / n : 0 };
  const c = computeElectorate(E, expMix, st, [u]);
  if (c.none) continue;
  const x = E.meta.crossover;
  out[st] = {
    ballots: n, mail: mail.n, inperson: early.n, requested: sumRow(natl.requested?.regions[st]),
    estimatedShare: u.estShare,
    party: { d: c.A.d / c.A.n, r: c.A.r / c.A.n, o: c.A.o / c.A.n },
    actualMargin: c.actualM, expectedMargin: c.expM, delta: c.delta,
    expectedEarly: c.expEarly, expectedTotal: c.scopeExp.mail + c.scopeExp.early + c.scopeExp.eday,
    pace: c.A.n / Math.max(1, c.expEarly),
    expectedParty: (() => { const pm = c.scopeExp.partyMail, pe = c.scopeExp.partyEarly; const w = [0, 1, 2].map((i) => pm[i] * c.A.mail + pe[i] * c.A.early); const s = w.reduce((a, b) => a + b, 0); return { d: w[0] / s, r: w[1] / s, o: w[2] / s }; })(),
    // the party mix the forecast expects of the whole early vote, mail and in person at their expected volumes
    expectedPartyFull: { d: c.scopeExp.party[0], r: c.scopeExp.party[1], o: c.scopeExp.party[2] },
    regime: model.regime[st] ?? "request",
    expGroups: c.expG, actGroups: c.actG, projected: c.proj, forecastElectorate: c.fcElect,
    dProjected: dShare(c.proj, x), dForecast: dShare(c.fcElect, x),
    impliedShift: c.impliedShift,
  };
}
fs.writeFileSync(outPath, JSON.stringify({
  snapshot: natl.returned?.snapshot_date ?? natl.inperson?.snapshot_date, tilt: { source: tilt.source, bR: tilt.bR, bO: tilt.bO },
  states: out,
}, null, 1));
console.log(`wrote ${Object.keys(out).length} states to ${outPath}`);
