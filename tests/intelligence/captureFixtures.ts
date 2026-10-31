// Test doubles for the recorder: a fake civicAPI, a fake clock and a store that can be made to fail.
// Everything here is SYNTHETIC. Names, ids and votes are invented.

import type { XRace } from "@/app/results/2026/live";
import type { FetchText, RunnerDeps } from "@/app/lib/intelligence/captureRunner";
import { DEFAULT_FEED_TYPES, runTick, type RunnerConfig } from "@/app/lib/intelligence/captureRunner";
import { computeHealth, readHealthInputs, type ExpectedRace } from "@/app/lib/intelligence/captureHealth";
import { defaultWindows } from "@/app/lib/intelligence/captureSchedule";
import { MemoryStore, StoreError, type ObjectStore } from "@/app/lib/intelligence/captureStore";

export const RACES: XRace[] = [
  { id: "sen-GA", k: "sen", st: "GA", nm: "SYNTHETIC Georgia Senate", off: "US Senate", c: [["Alpha", "D", 0], ["Bravo", "R", 0]], civ: { t: ["US Senate"] }, cty: 3 },
  { id: "gov-AZ", k: "gov", st: "AZ", nm: "SYNTHETIC Arizona Governor", off: "Governor", c: [["Charlie", "D", 0], ["Delta", "R", 0]], civ: { t: ["Governor"] }, cty: 2 },
  { id: "house-PA-07", k: "house", st: "PA", nm: "SYNTHETIC Pennsylvania 7", off: "House", c: [["Echo", "D", 0], ["Foxtrot", "R", 0]], civ: { t: ["House of Representatives"], d: "PA-07" }, cty: 2 },
];

export interface FakeRace {
  id: number;
  type: string;
  province: string;
  district: string | null;
  votes: { d: number; r: number; o: number };
  pr: number;
  updated: string | null;
  test: boolean;
  counties: Record<string, { name: string; d: number; r: number }>;
  names: [string, string];
}

export const FAKE_IDS: Record<string, number> = { "sen-GA": 101, "gov-AZ": 102, "house-PA-07": 103 };

export function fakeRaces(test = false): Record<number, FakeRace> {
  const mk = (id: number, type: string, province: string, district: string | null, names: [string, string]): FakeRace => ({
    id, type, province, district, votes: { d: 0, r: 0, o: 0 }, pr: 0, updated: null, test, names,
    counties: province === "GA" ? { "13001": { name: "One", d: 0, r: 0 }, "13003": { name: "Two", d: 0, r: 0 }, "13005": { name: "Three", d: 0, r: 0 } } : { [province === "AZ" ? "04001" : "42001"]: { name: "One", d: 0, r: 0 } },
  });
  return { 101: mk(101, "US Senate", "GA", null, ["Alpha", "Bravo"]), 102: mk(102, "Governor", "AZ", null, ["Charlie", "Delta"]), 103: mk(103, "House of Representatives", "PA", "PA-07", ["Echo", "Foxtrot"]) };
}

export type Mode = "ok" | "down" | "http500" | "malformed" | "notjson" | "huge";

/** A civicAPI stand-in. Counts requests, can fail on demand, and advances the clock by `latencyMs` per request. */
export class FakeProvider {
  races: Record<number, FakeRace>;
  mode: Mode = "ok";
  /** Per-URL override: a substring of the URL mapped to a mode. */
  failing = new Map<string, Mode>();
  requests: string[] = [];
  latencyMs = 0;
  clock: Clock;
  constructor(clock: Clock, test = false) { this.clock = clock; this.races = fakeRaces(test); }

  set(id: number, patch: Partial<Omit<FakeRace, "id">>) { Object.assign(this.races[id], patch); }
  count(substr: string) { return this.requests.filter((u) => u.includes(substr)).length; }

  private cands(r: FakeRace) {
    return [{ name: r.names[0], party: "Democratic", votes: r.votes.d, percent: 0 }, { name: r.names[1], party: "Republican", votes: r.votes.r, percent: 0 }, ...(r.votes.o ? [{ name: "Other", party: "Independent", votes: r.votes.o, percent: 0 }] : [])];
  }

  fetchText: FetchText = async (url) => {
    this.requests.push(url);
    this.clock.advance(this.latencyMs);
    const forced = [...this.failing].find(([k]) => url.includes(k))?.[1];
    const mode = forced ?? this.mode;
    if (mode === "down") throw Object.assign(new Error(`connect ECONNREFUSED civicapi.org secret-host`), { code: "ECONNREFUSED" });
    if (mode === "http500") return { status: 500, text: "upstream exploded", ms: 1, age: null };
    if (mode === "notjson") return { status: 200, text: "<html>maintenance</html>", ms: 1, age: null };
    if (mode === "malformed") return { status: 200, text: url.includes("/search") ? JSON.stringify({ rows: [] }) : JSON.stringify([1, 2, 3]), ms: 1, age: null };
    const search = /\/race\/search\?.*type=([^&]+)/.exec(url);
    if (search) {
      const type = decodeURIComponent(search[1]);
      const rows = Object.values(this.races).filter((r) => r.type === type).map((r) => ({ id: r.id, type: r.type, province: r.province, district: r.district, election_name: `${r.province} ${r.type}`, percent_reporting: r.pr, candidates: this.cands(r) }));
      return { status: 200, text: JSON.stringify({ races: rows }), ms: 5, age: 3 };
    }
    const detail = /\/race\/(\d+)$/.exec(url);
    if (detail) {
      const r = this.races[Number(detail[1])];
      if (!r) return { status: 404, text: "{}", ms: 1, age: null };
      const half = (n: number) => Math.floor(n / Object.keys(r.counties).length);
      const region_results = Object.fromEntries(Object.entries(r.counties).map(([fips, c]) => [fips, { name: c.name, type: "county", fips, percent_reporting: r.pr, candidates: [{ name: r.names[0], party: "Democratic", votes: c.d || half(r.votes.d), percent: 0 }, { name: r.names[1], party: "Republican", votes: c.r || half(r.votes.r), percent: 0 }] }]));
      return { status: 200, text: JSON.stringify({ election_name: `${r.province} ${r.type}`, election_type: r.type, province: r.province, district: r.district, percent_reporting: r.pr, polls_close: null, last_updated: r.updated, test_data: r.test, candidates: this.cands(r), region_results }), ms: 5, age: 2 };
    }
    return { status: 404, text: "{}", ms: 1, age: null };
  };
}

export class Clock {
  t: number;
  constructor(t: number) { this.t = t; }
  now = () => new Date(this.t);
  advance(ms: number) { this.t += ms; }
  iso() { return new Date(this.t).toISOString(); }
}

export const testConfig = (over: Partial<RunnerConfig> = {}): RunnerConfig => ({
  electionId: "TEST-ELECTION", electionDate: "2026-11-03", feedTypes: DEFAULT_FEED_TYPES, windows: defaultWindows(), deadlineMs: 40_000, detailConcurrency: 3, ...over,
});

/** A store that fails on demand, to prove a storage failure is surfaced and never swallowed. */
export class FlakyStore implements ObjectStore {
  readonly kind = "memory" as const;
  readonly durable = false;
  failWrites = false;
  failReads = false;
  inner: ObjectStore;
  constructor(inner: ObjectStore = new MemoryStore()) { this.inner = inner; }
  /** Writes under this key prefix fail, and nothing else does. */
  failPrefix: string | null = null;
  private check(write: boolean, key = "") { if ((write ? this.failWrites : this.failReads) || (write && this.failPrefix !== null && key.startsWith(this.failPrefix))) throw new StoreError("DISK_FULL", "simulated storage failure at /secret/path"); }
  async putIfAbsent(k: string, b: Buffer, c: string) { this.check(true, k); return this.inner.putIfAbsent(k, b, c); }
  async put(k: string, b: Buffer, c: string) { this.check(true, k); return this.inner.put(k, b, c); }
  async get(k: string) { this.check(false); return this.inner.get(k); }
  async list(p: string) { this.check(false); return this.inner.list(p); }
}

export const ELECTION_NIGHT = Date.parse("2026-11-04T01:00:00Z");

export const EXPECTED: ExpectedRace[] = RACES.map((r) => ({ raceId: r.id, state: r.st, expectedJurisdictions: r.cty ?? null }));
export const W = defaultWindows();
export const MIN = 60_000;

/** A recorder over a fake provider, a fake clock and a store. Every tick builds fresh deps, as a new serverless invocation would. */
export function rig(opts: { store?: ObjectStore; t?: number; test?: boolean } = {}) {
  const clock = new Clock(opts.t ?? ELECTION_NIGHT);
  const provider = new FakeProvider(clock, opts.test ?? false);
  const store = opts.store ?? new MemoryStore();
  let n = 0;
  const deps = (): RunnerDeps => ({ store, fetchText: provider.fetchText, now: clock.now, races: RACES, config: testConfig(), newId: () => `r${String(++n).padStart(4, "0")}` });
  const tick = (o: { force?: boolean; trigger?: "CRON" | "MANUAL" } = {}) => runTick(deps(), { force: o.force, trigger: o.trigger ?? "CRON" });
  const health = async () => computeHealth(await readHealthInputs(store, null, clock.iso(), EXPECTED, W));
  return { clock, provider, store, deps, tick, health };
}
export const sen = (p: FakeProvider, d: number, r: number, updated: string | null, pr = 10) => p.set(FAKE_IDS["sen-GA"], { votes: { d, r, o: 0 }, updated, pr });
