// Evidence-recorder health for /portal/intelligence. The page has already checked the session before rendering this.
// It reads the capture store and reports; it changes nothing and publishes nothing.

import { foldObservations, readObservationRecords } from "@/app/lib/intelligence/capture";
import { loadTrackedRaces, runnerConfig } from "@/app/lib/intelligence/captureConfig";
import { computeHealth, readHealthInputs, type RecorderStatus } from "@/app/lib/intelligence/captureHealth";
import { resolveStore } from "@/app/lib/intelligence/captureStore";

const TONE: Record<RecorderStatus, string> = { HEALTHY: "ok", ENDED: "", DEGRADED: "warn", RUNNING_NO_NEW_DATA: "warn", NEVER_RAN: "warn", NOT_CONFIGURED: "bad", STORAGE_ERROR: "bad", SCHEDULER_SILENT: "bad", INTERRUPTED: "bad" };
const MEANING: Record<RecorderStatus, string> = {
  HEALTHY: "Polls are succeeding and results are arriving.",
  ENDED: "The capture window has closed.",
  DEGRADED: "Polling works, but the last poll reported errors.",
  RUNNING_NO_NEW_DATA: "The recorder is running and reaching the provider, but nothing new has arrived. This is not the same as a stopped recorder.",
  NEVER_RAN: "No poll has been recorded.",
  NOT_CONFIGURED: "There is no usable capture store.",
  STORAGE_ERROR: "The capture store cannot be read.",
  SCHEDULER_SILENT: "The scheduler has stopped calling the recorder. Capture is interrupted.",
  INTERRUPTED: "The scheduler is calling the recorder, but polls are failing. Capture is interrupted.",
};

const ago = (iso: string | null, now: string) => {
  if (!iso) return "never";
  const m = Math.round((Date.parse(now) - Date.parse(iso)) / 60000);
  return `${iso} (${m < 1 ? "under a minute" : m < 120 ? `${m} min` : `${Math.round(m / 60)} h`} ago)`;
};
const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(0)}%`);

export async function RecorderPanel() {
  const now = new Date().toISOString();
  const choice = resolveStore(process.env);
  const tracked = await loadTrackedRaces().catch(() => ({ races: [], expected: [], missing: [] as string[] }));
  const h = computeHealth(await readHealthInputs(choice.store, choice.problem, now, tracked.expected, runnerConfig().windows, 30));
  const bad = h.alerts.filter((a) => a.level !== "INFO");
  return (
    <>
      {bad.some((a) => a.level === "CRITICAL") ? <div className="banner" role="alert"><b>Capture interrupted or unsafe</b>{bad.filter((a) => a.level === "CRITICAL").map((a) => a.message).join(" ")}</div> : null}
      <section className="panel wide">
        <h2>Evidence recorder</h2>
        <p><span className={`pill ${TONE[h.status]}`}>{h.status.replace(/_/g, " ")}</span> {MEANING[h.status]}</p>
        {h.alerts.filter((a) => a.level !== "CRITICAL").map((a, k) => <p key={k} className="mute" style={{ fontSize: 13 }}>{a.level}: {a.message}</p>)}
        <div className="grid">
          <dl className="kv">
            <dt>phase</dt><dd>{h.phase ?? "—"}{h.intervalMinutes ? ` · every ${h.intervalMinutes} min` : ""}</dd>
            <dt>last attempt</dt><dd>{ago(h.lastAttemptAt, now)}</dd>
            <dt>last successful capture</dt><dd>{ago(h.lastSuccessfulCaptureAt, now)}</dd>
            <dt>last source update</dt><dd>{ago(h.lastSourceUpdateAt, now)} <span className="mute">the provider&apos;s own timestamp</span></dd>
            <dt>last material change</dt><dd>{ago(h.lastMaterialUpdateAt, now)}</dd>
            <dt>observations</dt><dd>{h.observations.toLocaleString("en-US")} <span className="mute">{h.uniqueMaterialUpdates.toLocaleString("en-US")} unique material updates</span></dd>
          </dl>
          <dl className="kv">
            <dt>storage</dt><dd><span className={`pill ${h.storage.ok && h.storage.durable ? "ok" : "bad"}`}>{h.storage.ok ? (h.storage.durable ? "DURABLE" : "NOT DURABLE") : "ERROR"}</span> {h.storage.kind}{h.storage.error ? ` · ${h.storage.error}` : ""}</dd>
            <dt>provider</dt><dd>{h.provider.requests ? `${h.provider.ok} of ${h.provider.requests} recent requests answered 200` : "no requests yet"}{h.provider.medianMs !== null ? ` · median ${h.provider.medianMs} ms` : ""}{h.provider.consecutiveFailedRuns ? ` · ${h.provider.consecutiveFailedRuns} failed poll(s) in a row` : ""}</dd>
            <dt>races captured</dt><dd>{h.coverage.observed} of {h.coverage.tracked} tracked</dd>
            <dt>source timestamps</dt><dd>{pct(h.coverage.sourceTimestampShare)} of observations carry one; {h.coverage.withEverySourceTimestamp} races on every observation</dd>
            <dt>missing counties</dt><dd>{h.missingJurisdictions} across captured races <span className="mute">against the forecast county count</span></dd>
            <dt>replay</dt><dd>{h.replay.available} race(s) replayable, {h.replay.testOnly} test only, {h.replay.noData} without data. <span className="mute">{h.replay.note}</span></dd>
          </dl>
        </div>
        {h.recentErrors.length ? <details><summary>Recent errors ({h.recentErrors.length})</summary><ul>{h.recentErrors.map((e, k) => <li key={k} className="issue"><code>{e.code}</code> {e.scope} · {e.at} · {e.message}</li>)}</ul></details> : <p className="mute" style={{ fontSize: 13 }}>No recent errors.</p>}
        <details><summary>Per race</summary>
          <table>
            <thead><tr><th>Race</th><th>Data</th><th className="r">Observations</th><th className="r">Material</th><th>Last source update</th><th className="r">Counties missing</th><th>Replay</th></tr></thead>
            <tbody>{h.races.map((r) => (
              <tr key={r.raceId}><td className="mono">{r.raceId}</td><td>{r.observed ? r.testStatus : "none"}</td><td className="r">{r.observations}</td><td className="r">{r.materialUpdates}</td><td>{r.lastSourceTimestamp ?? "none given"}</td><td className="r">{r.jurisdictionsMissing ?? "—"}</td><td>{r.replay.replace(/_/g, " ")}</td></tr>
            ))}</tbody>
          </table>
        </details>
      </section>
    </>
  );
}

/** One race's captured history: counts and flags derived by reading the records in observed order. */
export async function RaceCapture({ raceId }: { raceId: string }) {
  const choice = resolveStore(process.env);
  if (!choice.store) return <section className="panel wide"><h2>Evidence capture</h2><p><span className="pill bad">NOT CONFIGURED</span> {choice.problem}</p></section>;
  let views: ReturnType<typeof foldObservations> = [], corrupt = 0, failed = false;
  try { const loaded = await readObservationRecords(choice.store, raceId); views = foldObservations(loaded); corrupt = loaded.corrupt; } catch { failed = true; }
  if (failed) return <section className="panel wide"><h2>Evidence capture</h2><p><span className="pill bad">ERROR</span> the capture store could not be read.</p></section>;
  if (!views.length) return <section className="panel wide"><h2>Evidence capture</h2><p><span className="pill bad">NONE</span> nothing captured for this race; replay of this race is BLOCKED.</p></section>;
  return (
    <section className="panel wide">
      <h2>Evidence capture</h2>
      <dl className="kv">
        <dt>observations</dt><dd>{views.length} <span className="mute">distinct; {views.filter((v) => v.testStatus === "TEST").length} test, {views.filter((v) => v.revisionStatus === "CORRECTION").length} corrections, {views.filter((v) => v.totalsDecreased).length} with lower totals, {views.filter((v) => v.outOfOrder).length} out of order, {views.filter((v) => v.sourceTimestamp === null).length} without a source timestamp</span></dd>
        <dt>first / last observed</dt><dd>{views[0].firstObservedAt} / {views[views.length - 1].lastObservedAt}</dd>
        <dt>record integrity</dt><dd><span className={`pill ${corrupt ? "warn" : "ok"}`}>{corrupt ? "DEGRADED" : "OK"}</span> {corrupt} record(s) failed their checksum</dd>
      </dl>
    </section>
  );
}
