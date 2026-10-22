// @ts-nocheck: this file runs inside the Ledger repo, copied there by the deploy command; it is kept here so it ships with the site.
// Export a Ledger snapshot for the On Point Politics Watchdog section.
//
// Run from the Ledger folder, with the same .env.local Ledger uses, after the feeds and bulk files are loaded:
//   npx tsx scripts/export-onpoint.ts --out /workspaces/thepublicsentimentinstitute/public/watchdog/ledger-data
// Options: --houses 120   how many House races get full pages (by outside money, then money raised)
//          --donors 300   how many donors get full pages
//          --graphs 60    how many connection webs to save
//          --quick        a small export for checking the pages: 10 races, 40 donors, 10 webs
//
// It reads Ledger's own queries, so every number matches the Ledger pages. Each call is wrapped: a feed that is not
// loaded leaves its file empty and is listed in meta.json, it never stops the export. Street addresses are dropped.
import "./_env";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";
import * as Q from "../src/lib/queries/index";
import * as H from "../src/lib/queries/health";
import * as N from "../src/lib/queries/network";
import * as S from "../src/lib/queries/signals";
import * as W from "../src/lib/queries/watchdog";
import * as I from "../src/lib/queries/integrity";
import * as HI from "../src/lib/queries/history";
import * as V from "../src/lib/queries/votes";
import * as G from "../src/lib/queries/groups";
import * as M from "../src/lib/queries/map";
import * as C from "../src/lib/queries/counties";
import * as E from "../src/lib/queries/events";
import * as A from "../src/lib/queries/ads";
import * as EV from "../src/lib/queries/earlyvote";
import { config } from "../src/lib/config";

const argv = process.argv.slice(2);
const arg = (k: string, d?: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const QUICK = argv.includes("--quick");
const OUT = path.resolve(arg("--out", "onpoint-ledger-data")!);
const HOUSES = Number(arg("--houses", QUICK ? "4" : "120"));
const DONORS = Number(arg("--donors", QUICK ? "40" : "300"));
const GRAPHS = Number(arg("--graphs", QUICK ? "10" : "60"));
const CONC = Number(arg("--parallel", "4"));

const errors: { what: string; error: string }[] = [];
const files: Record<string, number> = {};
const DROP = /^(street|street_?1|street_?2|address|address_?1|address_?2|contributor_street.*|email|phone)$/i;

function plain(x: unknown): unknown {
  if (x === null || x === undefined) return x ?? null;
  if (typeof x === "bigint") return Number(x);
  if (x instanceof Date) return x.toISOString();
  if (x instanceof Map) return Object.fromEntries([...x.entries()].map(([k, v]) => [String(k), plain(v)]));
  if (x instanceof Set) return [...x].map(plain);
  if (Array.isArray(x)) return x.map(plain);
  if (typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (DROP.test(k) || typeof v === "function") continue;
      o[k] = plain(v);
    }
    return o;
  }
  if (typeof x === "number" && !Number.isFinite(x)) return null;
  return x;
}
const safeName = (s: string) => s.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 120);
function write(rel: string, data: unknown) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const s = JSON.stringify(plain(data));
  fs.writeFileSync(f, s);
  files[rel] = s.length;
}
async function safe<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch (e) { errors.push({ what, error: String((e as Error)?.message ?? e).slice(0, 300) }); return null; }
}
async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const db = await getDb();
fs.mkdirSync(OUT, { recursive: true });
const started = new Date().toISOString();
log("Exporting Ledger to", OUT);

/* --------------------------------------------------------------- desk, tape, flow, outside money */
const demo = await safe("isDemo", () => Q.isDemo(db));
const windows = ["24h", "7d", "30d", "cycle"] as const;
const summary: Record<string, unknown> = {};
for (const w of windows) summary[w] = await safe(`summary ${w}`, () => Q.summary(db, w));
write("summary.json", summary);
write("tape.json", await safe("feed", () => Q.feed(db, { limit: 400 })));
write("tape_big.json", await safe("feed big", () => Q.feed(db, { min: 25_000, limit: 200 })));
write("flow.json", { "30d": await safe("flow 30d", () => Q.flow(db, "30d", { width: 1100, height: 520 })), cycle: await safe("flow cycle", () => Q.flow(db, "cycle", { width: 1100, height: 520 })) });
write("outside.json", { "30d": await safe("outside 30d", () => Q.outsideSpending(db, "30d", 60)), cycle: await safe("outside cycle", () => Q.outsideSpending(db, "cycle", 120)) });
write("alerts.json", await safe("alerts", () => Q.alerts(db, { limit: 120 })));
log("desk done");

/* --------------------------------------------------------------- races and candidates */
const races = (await safe("listRaces", () => H.listRaces(db))) ?? [];
const senate = races.filter((r) => r.office === "S"), govs = races.filter((r) => r.office === "G"), house = races.filter((r) => r.office === "H").slice(0, HOUSES);
const detailRaces = QUICK ? [...senate.slice(0, 3), ...govs.slice(0, 3), ...house] : [...senate, ...govs, ...house];
write("races.json", races.map((r) => ({ ...r, detail: detailRaces.some((d) => d.key === r.key) })));

const candIndex = new Map<string, unknown>();
for (const office of ["S", "H", "G", "P"]) {
  for (const sort of ["receipts", "outside"]) {
    const rows = (await safe(`candidates ${office} ${sort}`, () => Q.candidates(db, { office, sort, limit: 500 }))) ?? [];
    for (const r of rows) candIndex.set(String((r as { id: string }).id), r);
  }
}
write("candidates.json", [...candIndex.values()]);

const candIds = new Set<string>();
for (const r of detailRaces) for (const c of r.candidates.filter((c) => c.nominee).concat(r.candidates.slice(0, 3)).slice(0, 4)) candIds.add(c.id);
for (const c of [...candIndex.values()].slice(0, QUICK ? 10 : 120)) candIds.add(String((c as { id: string }).id));
log("candidates with full pages:", candIds.size);

const committeeIds = new Set<string>();
const scoreById = new Map<string, unknown>();
let done = 0;
await pool([...candIds], CONC, async (id) => {
  const data = await safe(`candidate ${id}`, () => Q.candidate(db, id));
  if (!data) return;
  const [health, ls, timeline, items, history] = await Promise.all([
    safe(`health ${id}`, () => H.campaignHealth(db, id)),
    safe(`ledgerScore ${id}`, () => I.ledgerScore(db, id)),
    safe(`timeline ${id}`, () => H.campaignTimeline(db, id)),
    safe(`feed ${id}`, () => Q.feed(db, { candidateId: id, limit: 30 })),
    safe(`history ${id}`, () => HI.scoreHistory(db, id)),
  ]);
  const c = (data as { candidate: Record<string, unknown> | null }).candidate;
  const leg = (ls as { record?: { legislator?: { name: string; bioguide: string } | null } } | null)?.record?.legislator ?? null;
  const watch = await safe(`watchdog ${id}`, () => W.candidateWatchdog(db, id, leg?.name ?? String(c?.name ?? id), leg?.bioguide ?? null));
  const fed = id.startsWith("G26") ? await safe(`federalId ${id}`, () => V.federalIdFor(db, id)) : null;
  const ev = c?.state && c.office !== "P" ? await safe(`earlyVote ${id}`, () => EV.earlyVoteFor(db, String(c.state))) : null;
  const h = health as H.Health | null, l = ls as { score: number | null; grade: string; worst?: { label: string; reasons: string[] } | null } | null;
  const brief = c && h && l ? H.briefing({
    name: String(c.name), party: (c.party as string) ?? null, office: (c.office as string) ?? null, state: (c.state as string) ?? null, district: (c.district as string) ?? null,
    receipts: c.receipts != null ? Number(c.receipts) : null, cash: c.cash_on_hand != null ? Number(c.cash_on_hand) : null,
    ieFor: Number(c.ie_support ?? 0), ieAgainst: Number(c.ie_oppose ?? 0), health: h,
    ledger: { score: l.score, grade: l.grade, top: l.worst ? `${l.worst.label}. ${l.worst.reasons[0]?.replace(/\.$/, "")}.` : null },
    rival: h.rival?.name ?? null,
  } as Parameters<typeof H.briefing>[0]) : null;
  const move = history ? HI.explainMove(history) : null;
  for (const s of ((data as { ieBySpender?: { recipient_id: string }[] }).ieBySpender ?? []).slice(0, 15)) committeeIds.add(s.recipient_id);
  for (const k of ["committees", "principal"]) for (const x of (((data as Record<string, unknown>)[k] as { id?: string }[] | undefined) ?? [])) if (x?.id) committeeIds.add(x.id);
  scoreById.set(id, { health: h?.score ?? null, healthLabel: h?.label ?? null, ledger: l?.score ?? null, grade: l?.grade ?? null });
  write(`candidate/${safeName(id)}.json`, { id, data, health, ledgerScore: ls, timeline, tape: items, history, move, watchdog: watch, federal: fed, earlyVote: ev, briefing: brief });
  if (++done % 25 === 0) log("candidates", done, "of", candIds.size);
});
log("candidates done");

const raceFiles: Record<string, unknown>[] = [];
for (const r of detailRaces) {
  const field = (await safe(`raceCandidates ${r.key}`, () => H.raceCandidates(db, r.key))) ?? [];
  const lsList = r.candidates.map((c) => scoreById.get(c.id)).filter(Boolean);
  const sen = r.office === "S" ? (await safe("senRaces", () => H.senRaces(db)))?.get(r.state) ?? null : null;
  const gov = r.office === "G" ? (await safe("govRaces", () => H.govRaces(db)))?.get(r.state) ?? null : null;
  const ev = r.office !== "H" ? await safe(`ev ${r.state}`, () => EV.earlyVoteFor(db, r.state)) : null;
  write(`race/${safeName(r.key)}.json`, { race: r, field, scores: Object.fromEntries(r.candidates.map((c) => [c.id, scoreById.get(c.id) ?? null])), info: sen ?? gov, earlyVote: ev });
  raceFiles.push({ key: r.key, n: lsList.length });
}
log("races done", raceFiles.length);

/* --------------------------------------------------------------- committees */
for (const o of ((await safe("outside cycle ids", () => Q.outsideSpending(db, "cycle", 120))) ?? []) as { recipient_id?: string; spender_id?: string }[]) { if (o.recipient_id) committeeIds.add(o.recipient_id); if (o.spender_id) committeeIds.add(o.spender_id); }
const comIndex: unknown[] = [];
await pool([...committeeIds].slice(0, QUICK ? 30 : 400), CONC, async (id) => {
  const data = await safe(`committee ${id}`, () => Q.committee(db, id));
  if (!data) return;
  const [spend, transp, tape] = await Promise.all([
    safe(`committeeSpending ${id}`, () => N.committeeSpending(db, id)),
    safe(`transparency ${id}`, () => I.committeeTransparency(db, id)),
    safe(`feed committee ${id}`, () => Q.feed(db, { recipientId: id, limit: 30 } as Parameters<typeof Q.feed>[1])),
  ]);
  const r = (data as { recipient?: { name?: string; kind?: string; party?: string } }).recipient;
  comIndex.push({ id, name: r?.name ?? id, kind: r?.kind ?? null, party: r?.party ?? null });
  write(`committee/${safeName(id)}.json`, { id, data, spending: spend, transparency: transp, tape });
});
write("committees.json", comIndex);
log("committees done", comIndex.length);

/* --------------------------------------------------------------- donors, vendors, groups */
const donorRows = ((await safe("donors", () => Q.donors(db, { limit: 600, sort: "total" }))) ?? []) as { id: string }[];
write("donors.json", { rows: donorRows, tiers: await safe("tierCounts", () => Q.tierCounts(db)), recent: await safe("donors recent", () => Q.donors(db, { limit: 200, sort: "recent" })) });
await pool(donorRows.slice(0, DONORS), CONC, async (d) => { const x = await safe(`donor ${d.id}`, () => Q.donor(db, d.id)); if (x) write(`donor/${safeName(d.id)}.json`, { id: d.id, data: x }); });
log("donors done");

const vendorRows = ((await safe("vendors", () => N.vendors(db, { limit: 500, sort: "total" }))) ?? []) as { id: string }[];
write("vendors.json", { rows: vendorRows, categories: await safe("vendorCategoryTotals", () => N.vendorCategoryTotals(db)) });
await pool(vendorRows.slice(0, QUICK ? 30 : 300), CONC, async (v) => {
  const [x, tape] = await Promise.all([safe(`vendor ${v.id}`, () => N.vendor(db, v.id)), safe(`feed vendor ${v.id}`, () => Q.feed(db, { vendorId: v.id, kinds: ["disbursement", "independent_expenditure"], limit: 30 } as Parameters<typeof Q.feed>[1]))]);
  if (x) write(`vendor/${safeName(v.id)}.json`, { id: v.id, data: x, tape });
});
log("vendors done");

const groupRows = ((await safe("groups", () => G.listGroups(db))) ?? []) as { id: string }[];
write("groups.json", groupRows);
await pool(groupRows, CONC, async (g) => { const x = await safe(`group ${g.id}`, () => (G as unknown as { groupDetail: (db: unknown, id: string) => Promise<unknown> }).groupDetail(db, g.id)); if (x) write(`group/${safeName(g.id)}.json`, { id: g.id, data: x }); });
log("groups done");

/* --------------------------------------------------------------- connection webs */
const refs: string[] = [];
for (const c of [...candIndex.values()].slice(0, QUICK ? 6 : 30) as { id: string }[]) refs.push(`candidate:${c.id}`);
for (const r of [...senate, ...govs].slice(0, QUICK ? 4 : 71)) for (const c of r.candidates.slice(0, 2)) refs.push(`candidate:${c.id}`);
for (const d of donorRows.slice(0, 20)) refs.push(`donor:${d.id}`);
for (const c of comIndex.slice(0, 20) as { id: string }[]) refs.push(`committee:${c.id}`);
for (const v of vendorRows.slice(0, 10)) refs.push(`vendor:${v.id}`);
const webs: { ref: string; name: string | null; file: string }[] = [];
await pool([...new Set(refs)].slice(0, GRAPHS), CONC, async (ref) => {
  const r = N.parseRef(ref); if (!r) return;
  const g = await safe(`network ${ref}`, () => N.network(db, r, { limit: 60 }));
  if (!g) return;
  const file = `web/${safeName(ref)}.json`;
  write(file, { ref, graph: g });
  webs.push({ ref, name: await safe(`entityName ${ref}`, () => N.entityName(db, r)), file });
});
write("webs.json", webs);
// one combined web for the Watchdog connections view: every node and edge from the saved webs, once each
const allNodes = new Map<string, Record<string, unknown>>(), allEdges = new Map<string, Record<string, unknown>>();
for (const w of webs) {
  try {
    const g = JSON.parse(fs.readFileSync(path.join(OUT, w.file), "utf8")).graph as { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] };
    for (const n of g.nodes) { const k = String(n.key); const prev = allNodes.get(k); allNodes.set(k, prev ? { ...prev, ...n, center: false, value: Math.max(Number(prev.value ?? 0), Number(n.value ?? 0)) } : { ...n, center: false }); }
    for (const e of g.edges) { const k = `${e.source}|${e.target}|${e.kind}`; if (!allEdges.has(k)) allEdges.set(k, e); }
  } catch { /* skipped */ }
}
write("web_all.json", { nodes: [...allNodes.values()], edges: [...allEdges.values()] });
log("webs done", webs.length);

/* --------------------------------------------------------------- signals, scores, watchdog, lobbying, ads, events */
const cycle = config.fec.cycle;
write("signals.json", {
  president: await safe("presidentialWatch", () => S.presidentialWatch(db, 2028)),
  heat: await safe("raceHeat", () => S.raceHeat(db, cycle, 40)),
  trouble: await safe("moneyTrouble", () => S.moneyTrouble(db, cycle, 40)),
  sharedVendors: await safe("sharedVendors", () => S.sharedVendors(db, 60)),
  donorMoves: await safe("donorMoves", () => S.donorMoves(db)),
});
write("scores.json", { balance: await safe("partyBalance", () => HI.partyBalance(db)), all: Object.fromEntries(scoreById) });
write("watchdog.json", {
  foreign: await safe("foreignOverview", () => W.foreignOverview(db)),
  sanctions: await safe("screenHits", () => W.screenHits(db)),
  enforcement: await safe("enforcementRecent", () => W.enforcementRecent(db, 120)),
  doj: await safe("corruptionReleases", () => W.corruptionReleases(db, 100)),
  stocks: await safe("stockReportLeaders", () => W.stockReportLeaders(db)),
});
write("lobbying.json", await safe("lobbying", () => Q.lobbying(db)));
write("ads.json", await safe("adOverview", () => A.adOverview(db, { days: 90 })));
write("events.json", {
  upcoming: await safe("events upcoming", () => E.listEvents(db, { when: "upcoming", limit: 400 })),
  past: await safe("events past", () => E.listEvents(db, { when: "past", limit: 200 })),
  counts: await safe("eventCounts", () => E.eventCounts(db)),
});
log("signals, watchdog, lobbying, ads, events done");

/* --------------------------------------------------------------- states and counties */
const stateTotals = await safe("stateTotals", () => Q.stateTotals(db));
write("states.json", { metrics: await safe("stateMetrics", () => M.stateMetrics(db)), totals: stateTotals });
const CODES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
await pool(QUICK ? CODES.slice(0, 6) : CODES, CONC, async (code) => {
  const [detail, panel, counties, tape] = await Promise.all([
    safe(`stateDetail ${code}`, () => Q.stateDetail(db, code)),
    safe(`statePanel ${code}`, () => M.statePanel(db, code)),
    safe(`stateCounties ${code}`, () => C.stateCounties(db, code)),
    safe(`feed state ${code}`, () => Q.feed(db, { jurisdiction: code, limit: 30 } as Parameters<typeof Q.feed>[1])),
  ]);
  write(`state/${code}.json`, { code, detail, panel, counties, tape });
});
const model = await safe("partisanModel", () => C.partisanModel(db));
if (model) {
  const explain: Record<string, unknown> = {};
  for (const [f, row] of model.rows) explain[f] = { predicted: row.predicted, actual: row.actual, traits: C.explainCounty(model, f).slice(0, 5), similar: C.similarCounties(model, f, 6) };
  write("county_model.json", { model: { n: model.n, r2: model.r2, mean: model.mean, features: model.features }, explain });
}
log("states and counties done");

write("sources.json", await safe("sourceHealth", () => Q.sourceHealth(db)));
const pagesOf = (dir: string) => Object.keys(files).filter((f) => f.startsWith(dir + "/")).map((f) => f.slice(dir.length + 1, -5));
write("meta.json", { app: "Ledger", pages: { candidate: pagesOf("candidate"), committee: pagesOf("committee"), donor: pagesOf("donor"), vendor: pagesOf("vendor"), group: pagesOf("group"), race: pagesOf("race") }, exportedAt: new Date().toISOString(), started, demo, cycle, quick: QUICK, counts: { races: races.length, detailRaces: detailRaces.length, candidates: candIndex.size, candidatePages: candIds.size, committees: comIndex.length, donors: donorRows.length, vendors: vendorRows.length, groups: groupRows.length, webs: webs.length }, errors, files });
log("Done.", Object.keys(files).length, "files,", Math.round(Object.values(files).reduce((a, b) => a + b, 0) / 1e6), "MB,", errors.length, "calls skipped (see meta.json).");
await db.close();
