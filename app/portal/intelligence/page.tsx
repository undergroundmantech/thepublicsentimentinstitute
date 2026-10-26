// Election-night intelligence diagnostics. Protected developer page: the middleware gates /portal/*, and this page
// checks the session again before reading anything. It shows the shadow pipeline beside the published engine and
// publishes nothing.
//
//   /portal/intelligence                    the Top 50 register with research coverage and shadow status
//   /portal/intelligence?race=<id>          one race, forecast and research only
//   ...&live=1                              add civicAPI returns for that race
//   ...&live=1&test=1                       also admit civicAPI test data (labelled TEST on the page)

import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_COOKIE, verifySession } from "@/app/lib/portalSession";
import { researchCoverage } from "@/app/lib/intelligence/baseline";
import { loadResearchDir, RESEARCH_DIR } from "@/app/lib/intelligence/load";
import { appendObservations, fromCivicDetail } from "@/app/lib/intelligence/observations";
import { runPipeline } from "@/app/lib/intelligence/pipeline";
import type { BaselineRace, DiagnosticReport, Interval, Issue, LoggedObservation, Register, ResearchCoverage, StageStatus } from "@/app/lib/intelligence/types";
import type { XIndex } from "@/app/results/2026/live";
import baselineFile from "@/data/intelligence/baseline/2026-10-25.json";
import registerFile from "@/data/intelligence/register/top50-2026-10-25.json";
import { fetchCivicDetail, readCountyExpectations, readIndex } from "./inputs";
import { ENI_CSS } from "./styles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Election-night intelligence (shadow)", robots: { index: false, follow: false } };

const register = registerFile as unknown as Register;
const baseline = (baselineFile as unknown as { races: BaselineRace[] }).races;
const baselineById = new Map(baseline.map((b) => [b.raceId, b]));
const knownIds: ReadonlySet<string> = new Set(baselineById.keys());

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const n0 = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US"));
const p1 = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `${n.toFixed(1)}%`);
const mg = (m: number | null | undefined) => (m == null || !Number.isFinite(m) ? "—" : m === 0 ? "even" : `${m > 0 ? "R" : "D"}+${Math.abs(m).toFixed(2)}`);
const iv = (i: Interval | null | undefined, f: (n: number) => string = n0) => (!i ? "unavailable" : `${f(i.low)} – ${i.central == null ? "no central" : f(i.central)} – ${Number.isFinite(i.high) ? f(i.high) : "unbounded"}`);
const ivM = (i: Interval | null | undefined) => iv(i, (n) => mg(n));
const ivPct = (i: Interval | null | undefined) => iv(i, p1);
const ivShare = (i: Interval | null | undefined) => iv(i, (n) => p1(n * 100));

const tone = (s: string) => (["OK", "AVAILABLE", "PRESENT", "MEDIUM", "NOT_REQUIRED"].includes(s) ? "ok" : ["DEGRADED", "PARTIAL", "LOW"].includes(s) ? "warn" : ["FAILED", "MISSING", "NONE"].includes(s) ? "bad" : "");
const Pill = ({ v }: { v: string }) => <span className={`pill ${tone(v)}`}>{v.replace(/_/g, " ")}</span>;

function Issues({ list }: { list: Issue[] }) {
  if (!list.length) return null;
  return <ul>{list.map((i, k) => <li key={k} className="issue"><code>{i.severity} {i.code}</code> {i.message}{i.recordId ? ` (${i.recordId})` : ""}</li>)}</ul>;
}

async function guard(next: string) {
  const ok = await verifySession((await cookies()).get(PORTAL_COOKIE)?.value);
  if (!ok) redirect(`/portal/login?next=${encodeURIComponent(next)}`);
}

export default async function IntelligencePage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const raceParam = one(sp.race);
  const raceId = raceParam && knownIds.has(raceParam) ? raceParam : null;
  await guard(raceId ? `/portal/intelligence?race=${raceId}` : "/portal/intelligence");

  const research = loadResearchDir(RESEARCH_DIR, knownIds);
  const index = await readIndex();
  const asOf = new Date().toISOString();

  return (
    <main className="eni">
      <style>{ENI_CSS}</style>
      <span className="eye">Developer diagnostics · shadow only · not published</span>
      <div className="banner"><b>Shadow</b>Nothing on this page reaches a public page. The shadow pipeline is a software architecture, not a validated forecasting model: it has no backtest, gives no win probability, and does not call races.</div>
      {raceParam && !raceId ? <div className="banner"><b>Unmatched</b>{`"${raceParam.slice(0, 40)}" is not a race id in the October 25 baseline.`}</div> : null}
      {raceId
        ? <RaceView raceId={raceId} sp={sp} index={index} research={research} asOf={asOf} />
        : <RegisterView index={index} research={research} asOf={asOf} />}
    </main>
  );
}

type Research = ReturnType<typeof loadResearchDir>;

function RegisterView({ index, research, asOf }: { index: XIndex | null; research: Research; asOf: string }) {
  const byId = new Map((index?.races ?? []).map((r) => [r.id, r]));
  const rows = register.entries.map((e) => {
    const x = byId.get(e.raceId);
    const report = runPipeline({ raceId: e.raceId, asOf, baseline: baselineById.get(e.raceId) ?? null, log: [], research: research.records, expectedJurisdictions: null, forecastExpectedTotal: x?.tot ?? null, forecastSource: x ? "public/results/2026/index.json" : null });
    return { e, cov: researchCoverage(e, research.records), report };
  });
  const comps = ["reporting", "outstanding", "geography", "methods"] as const;
  return (
    <>
      <h1>Election-night intelligence: Top {register.n} register</h1>
      <p className="deck">The {register.n} closest Senate, governor and House races in the forecast of {register.source.snapshotDate}, ranked by {register.rankedBy}. Coverage is the research loaded from <span className="mono">data/intelligence/research</span>; shadow status is computed now, with no live returns.</p>
      <div className="grid">
        <section className="panel">
          <h2>Research packages</h2>
          <dl className="kv">
            <dt>files loaded</dt><dd>{research.files.length}</dd>
            <dt>records accepted</dt><dd>{research.records.length}</dd>
            <dt>records rejected</dt><dd>{research.files.reduce((s, f) => s + f.result.rejected.length, 0)}</dd>
            <dt>expected-results index</dt><dd>{index ? `as of ${index.asOf}` : "unreadable"}</dd>
          </dl>
          <Issues list={research.issues} />
          {research.files.map((f) => <p key={f.file} className="issue"><code>{f.file}</code> {f.result.accepted.length} accepted, {f.result.rejected.length} rejected</p>)}
        </section>
        <section className="panel">
          <h2>Snapshot</h2>
          <dl className="kv">
            <dt>baseline</dt><dd>{register.source.snapshotDate}</dd>
            {register.source.files.map((f) => <Fragment key={f.path}><dt>{f.path.split("/").pop()}</dt><dd>{f.gitRef?.slice(0, 10) ?? "—"} · {f.sha256?.slice(0, 12) ?? "—"}</dd></Fragment>)}
            <dt>evaluated</dt><dd>{asOf}</dd>
          </dl>
        </section>
      </div>
      <section className="panel wide scroll">
        <table>
          <thead><tr><th className="r">#</th><th>Race</th><th className="r">Forecast</th><th className="r">P(R)</th>{comps.map((c) => <th key={c}>{c}</th>)}<th>Shadow</th><th>Confidence</th><th className="r">Gaps</th></tr></thead>
          <tbody>
            {rows.map(({ e, cov, report }) => (
              <tr key={e.raceId}>
                <td className="r">{e.rank}</td>
                <td><Link href={`/portal/intelligence?race=${e.raceId}`}>{e.name}</Link> <span className="mute">{e.raceId}</span></td>
                <td className={`r ${e.baseline.margin > 0 ? "gop" : e.baseline.margin < 0 ? "dem" : ""}`}>{mg(e.baseline.margin)}</td>
                <td className="r">{e.baseline.probB == null ? "—" : `${(e.baseline.probB * 100).toFixed(1)}%`}</td>
                {comps.map((c) => <td key={c}><Pill v={cov[c] as ResearchCoverage} /></td>)}
                <td><Pill v={report.shadow?.status ?? "UNAVAILABLE"} /></td>
                <td><Pill v={report.confidence} /></td>
                <td className="r">{report.missingResearch.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

async function RaceView({ raceId, sp, index, research, asOf }: { raceId: string; sp: Record<string, string | string[] | undefined>; index: XIndex | null; research: Research; asOf: string }) {
  const b = baselineById.get(raceId) ?? null;
  const x = index?.races.find((r) => r.id === raceId) ?? null;
  const live = one(sp.live) === "1";
  const includeTest = live && one(sp.test) === "1";
  const exp = x && x.k !== "house" ? await readCountyExpectations(x.st, raceId) : null;

  let log: LoggedObservation[] = [];
  const notes: string[] = [];
  let detail = null;
  if (live && x) {
    const got = await fetchCivicDetail(x);
    if (got.error) notes.push(`civicAPI: ${got.error}`);
    detail = got.detail;
    if (detail) {
      const appended = appendObservations([], fromCivicDetail(x, detail, asOf, got.url));
      log = appended.log;
      appended.issues.forEach((i) => notes.push(`${i.code}: ${i.message}`));
      if (detail.test) notes.push(includeTest ? "civicAPI marks these returns as TEST data; they are admitted because test=1" : "civicAPI marks these returns as TEST data; they are excluded (add test=1 to admit them)");
    }
  } else if (live) notes.push("the race is not in the expected-results index, so civicAPI cannot be matched");

  const report = runPipeline({
    raceId, asOf, baseline: b, log, research: research.records, includeTest,
    expectedJurisdictions: exp ? Object.keys(exp) : null,
    forecastExpectedTotal: x?.tot ?? null,
    forecastSource: x ? "public/results/2026/index.json" : null,
    published: x ? { race: x, exp, detail: detail && (!detail.test || includeTest) ? detail : null } : null,
  });
  const base = `/portal/intelligence?race=${raceId}`;
  return (
    <>
      <div className="links"><Link href="/portal/intelligence">← Register</Link><Link href={base}>forecast + research only</Link><Link href={`${base}&live=1`}>with civicAPI returns</Link><Link href={`${base}&live=1&test=1`}>with civicAPI test data</Link></div>
      <h1>{b?.name ?? raceId}</h1>
      <p className="deck"><span className="mono">{raceId}</span> · forecast {mg(b?.margin)} ({b?.sideA ?? "side A"} vs {b?.sideB ?? "side B"}) · evaluated {asOf}</p>
      {includeTest && detail?.test ? <div className="banner"><b>Test data</b>civicAPI marks these returns as test data. They are not real results.</div> : null}
      {notes.length ? <div className="banner"><b>Inputs</b>{notes.join(" · ")}</div> : null}
      <Report r={report} />
    </>
  );
}

function Report({ r }: { r: DiagnosticReport }) {
  const ret = r.returns, geo = r.geography, inv = r.outstanding, sh = r.shadow, pub = r.published, rep = r.reporting, met = r.methods;
  return (
    <>
      <div className="grid">
        <section className="panel">
          <h2>Status</h2>
          <dl className="kv">
            <dt>shadow</dt><dd><Pill v={sh?.status ?? "UNAVAILABLE"} /></dd>
            <dt>confidence</dt><dd><Pill v={r.confidence} /></dd>
            <dt>win probability</dt><dd>unavailable</dd>
          </dl>
          <ul>{r.confidenceReasons.map((s, k) => <li key={k}>{s}</li>)}</ul>
          {sh?.reasons.length ? <ul>{sh.reasons.map((s, k) => <li key={k} className="mute">{s}</li>)}</ul> : null}
        </section>
        <section className="panel">
          <h2>Pipeline stages</h2>
          <table><tbody>{r.stages.map((s) => <tr key={s.stage}><td>{s.stage}</td><td><Pill v={s.status as StageStatus} /></td><td><Issues list={s.issues} /></td></tr>)}</tbody></table>
        </section>
      </div>
      <div className="grid">
        <section className="panel">
          <h2>Reported votes</h2>
          {ret ? <dl className="kv">
            <dt>total</dt><dd>{n0(ret.reported.t)}</dd>
            <dt>{r.baseline?.sideA ?? "side A"}</dt><dd className="dem">{n0(ret.reported.a)}</dd>
            <dt>{r.baseline?.sideB ?? "side B"}</dt><dd className="gop">{n0(ret.reported.b)}</dd>
            <dt>other</dt><dd>{n0(ret.reported.o)}</dd>
            <dt>basis</dt><dd>{ret.basis}</dd>
            <dt>latest source time</dt><dd>{ret.latestSourceTimestamp ?? "—"}</dd>
            <dt>readings used / ignored</dt><dd>{ret.observationsUsed} / {ret.observationsIgnored}</dd>
          </dl> : <p className="mute">unavailable</p>}
        </section>
        <section className="panel">
          <h2>Outstanding vote</h2>
          {inv ? <dl className="kv">
            <dt>reported</dt><dd>{n0(inv.reported)}</dd>
            <dt>confirmed outstanding</dt><dd>{n0(inv.officiallyConfirmedOutstanding.value)} <span className="mute">{inv.officiallyConfirmedOutstanding.evidenceClass}</span></dd>
            <dt>not yet eligible</dt><dd>{n0(inv.notYetEligible.value)} <span className="mute">{inv.notYetEligible.evidenceClass}</span></dd>
            <dt>estimated outstanding</dt><dd>{iv(inv.estimatedOutstanding)}</dd>
            <dt>expected final</dt><dd>{iv(inv.expectedFinal)}</dd>
            <dt>uncertainty</dt><dd>{inv.uncertainty}</dd>
            <dt>turnout basis</dt><dd>{inv.turnoutBasis.kind} <span className="mute">{inv.turnoutBasis.evidenceClass}</span></dd>
            <dt>inventory</dt><dd>{inv.unknownInventory ? "unknown: no usable official statement" : "official statement in use"}</dd>
          </dl> : <p className="mute">unavailable</p>}
        </section>
        <section className="panel">
          <h2>Geography</h2>
          {geo ? <dl className="kv">
            <dt>scope</dt><dd>{geo.raceScope}</dd>
            <dt>crosswalk</dt><dd>{geo.raceScope === "STATEWIDE" ? "not needed (statewide)" : geo.crosswalkAvailable ? "available" : "not available"}</dd>
            <dt>jurisdictions reporting</dt><dd>{geo.jurisdictionsReporting} of {geo.jurisdictionsExpected ?? "unknown"}</dd>
            <dt>whole / partial / unknown</dt><dd>{geo.wholeJurisdictions.length} / {geo.partialJurisdictions.length} / {geo.unknownMembership.length}</dd>
            <dt>votes observed</dt><dd>{n0(geo.votesObserved)}</dd>
            <dt>estimated by weight</dt><dd>{n0(geo.votesEstimatedByWeight)} <span className="mute">not counted</span></dd>
            <dt>unallocated</dt><dd>{n0(geo.votesUnallocated)}</dd>
          </dl> : <p className="mute">unavailable</p>}
        </section>
      </div>
      <div className="grid">
        <section className="panel">
          <h2>Voting method</h2>
          {met ? <>
            <p className="mute" style={{ fontSize: 13, marginBottom: 8 }}>Known-method share of reported votes: {met.knownMethodShare == null ? "—" : p1(met.knownMethodShare * 100)}. Remaining vote by method is not estimated in Phase 1.</p>
            <table>
              <thead><tr><th>method</th><th className="r">reported</th><th className="r">official outstanding</th><th>history</th></tr></thead>
              <tbody>{met.methods.map((m) => <tr key={m.method}><td>{m.method}</td><td className="r">{n0(m.reported)}</td><td className="r">{n0(m.officialOutstanding)}</td><td>{m.historical.map((h) => `${h.year}: ${h.share != null ? p1(h.share * 100) : n0(h.votes)}`).join(", ") || "—"}</td></tr>)}</tbody>
            </table>
          </> : <p className="mute">unavailable</p>}
        </section>
        <section className="panel">
          <h2>Reporting context</h2>
          {rep ? <dl className="kv">
            <dt>polls closed</dt><dd>{rep.pollsClosed}</dd>
            <dt>verified closing times</dt><dd>{rep.pollClose.map((p) => `${p.jurisdictionId} ${p.closesAtUtc}`).join(", ") || "none"}</dd>
            <dt>historical windows</dt><dd>{rep.historicalWindows.length} <span className="mute">context only, not a 2026 schedule</span></dd>
            <dt>deadlines</dt><dd>{rep.deadlines.map((d) => `${d.kind ?? "?"} ${d.deadlineUtc ?? "?"}`).join(", ") || "none"}</dd>
          </dl> : <p className="mute">unavailable</p>}
        </section>
      </div>
      <div className="grid">
        <section className="panel">
          <h2>Shadow projection</h2>
          {sh ? <dl className="kv">
            <dt>reported margin</dt><dd>{mg(sh.reportedMargin)}</dd>
            <dt>share of expected counted</dt><dd>{ivPct(sh.shareOfExpectedCounted)}</dd>
            <dt>leader / votes ahead</dt><dd>{sh.arithmetic.leader ?? "—"} / {n0(sh.arithmetic.votesAhead)}</dd>
            <dt>trailing side needs</dt><dd>{ivShare(sh.arithmetic.trailingNeedsShare)} <span className="mute">of the two-party outstanding vote</span></dd>
            <dt>lead exceeds outstanding high</dt><dd>{sh.arithmetic.leadExceedsOutstandingHigh == null ? "—" : sh.arithmetic.leadExceedsOutstandingHigh ? "yes (not a race call)" : "no"}</dd>
            {sh.scenarios.map((s) => <Fragment key={s.id}><dt title={s.description}>{s.id.replace(/_/g, " ").toLowerCase()}</dt><dd>{ivM(s.finalMargin)}</dd></Fragment>)}
            <dt>win probability</dt><dd>{sh.winProbability.reason}</dd>
          </dl> : <p className="mute">unavailable</p>}
        </section>
        <section className="panel">
          <h2>Published engine (read only)</h2>
          {pub?.available && pub.published ? <dl className="kv">
            <dt>expected final</dt><dd>{n0(pub.published.expectedFinal)}</dd>
            <dt>% in</dt><dd>{p1(pub.published.pctIn)}</dd>
            <dt>margin</dt><dd>{mg(pub.published.margin)}</dd>
            <dt>P(R)</dt><dd>{p1(pub.published.pB * 100)}</dd>
            <dt>expected final − shadow</dt><dd>{n0(pub.diff?.expectedFinalVsShadowCentral)}</dd>
            <dt>% in − shadow</dt><dd>{pub.diff?.pctInVsShadowCentral == null ? "—" : `${pub.diff.pctInVsShadowCentral.toFixed(1)} pts`}</dd>
            <dt>margin − forecast scenario</dt><dd>{pub.diff?.marginVsForecastScenario == null ? "—" : `${pub.diff.marginVsForecastScenario.toFixed(2)} pts`}</dd>
          </dl> : <p className="mute">{pub?.reason ?? "unavailable"}</p>}
        </section>
      </div>
      <section className="panel wide">
        <h2>Missing research</h2>
        {r.missingResearch.length ? <ul>{r.missingResearch.map((m, k) => <li key={k}><span className="pill">{m.component}</span> {m.need}</li>)}</ul> : <p className="mute">none listed</p>}
      </section>
    </>
  );
}
