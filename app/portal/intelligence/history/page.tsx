// Race History preview. Protected: the middleware gates /portal/*, and this page checks the session again.
// Nothing here is on a public page. It exists so the chart design and the data semantics can be reviewed first.
//
//   /portal/intelligence/history                       index: tracked races and the synthetic scenarios
//   /portal/intelligence/history?race=<id>             a real race: frozen forecasts, plus whatever the recorder store holds
//   ...&test=1                                         also admit provider TEST data (labelled)
//   /portal/intelligence/history?demo=three-way|sparse|pre    SYNTHETIC scenarios, labelled on the chart

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_COOKIE, verifySession } from "@/app/lib/portalSession";
import { resolveStore } from "@/app/lib/intelligence/captureStore";
import { loadTrackedRaces } from "@/app/lib/intelligence/captureConfig";
import { prepareHistory, type DataStatus, type PreparedHistory } from "@/app/lib/intelligence/raceHistory";
import { frozenPointsFor, HistoryError, loadFrozenDataset, loadRaceHistory } from "@/app/lib/intelligence/raceHistoryStore";
import { DEMO_RACE_ID, syntheticNight, syntheticOutages } from "@/app/lib/intelligence/raceHistoryDemo";
import RaceHistory from "@/app/components/opp/RaceHistory";
import { ENI_CSS } from "../styles";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Race history preview", robots: { index: false, follow: false } };

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SAFE_RACE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const DEMOS = {
  "three-way": { label: "Three candidates, full night", note: "Frozen forecasts, a live projection that starts without a valid probability, a model version change, a revision, a downward correction, a 40-minute feed outage, an out-of-order reading and a shadow model." },
  sparse: { label: "Sparse observations", note: "Ten readings over the night and three frozen forecasts. Long silences break the reported-vote lines." },
  pre: { label: "Before any votes", note: "Frozen forecasts only: what a race page shows until the first live projection or result." },
} as const;
type DemoId = keyof typeof DEMOS;

function demoHistory(id: DemoId): PreparedHistory {
  const pts = id === "sparse" ? syntheticNight({ results: 10, frozen: 3, seed: 11 }) : syntheticNight();
  const kept = id === "pre" ? pts.filter((p) => p.sourceClass === "FROZEN_FORECAST") : pts;
  return prepareHistory(DEMO_RACE_ID, kept, { surface: "PREVIEW", statuses: ["SYNTHETIC"], outages: id === "sparse" || id === "pre" ? [] : syntheticOutages() });
}

export default async function HistoryPreview({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const demoParam = one(sp.demo);
  const demo = demoParam && demoParam in DEMOS ? (demoParam as DemoId) : null;
  const raceParam = one(sp.race);
  const raceId = !demo && raceParam && SAFE_RACE.test(raceParam) ? raceParam : null;
  const test = one(sp.test) === "1";
  const diag = one(sp.diag) === "1";
  const qs = demo ? `?demo=${demo}` : raceId ? `?race=${encodeURIComponent(raceId)}${test ? "&test=1" : ""}${diag ? "&diag=1" : ""}` : "";
  if (!(await verifySession((await cookies()).get(PORTAL_COOKIE)?.value))) redirect(`/portal/login?next=${encodeURIComponent(`/portal/intelligence/history${qs}`)}`);

  let history: PreparedHistory | null = null;
  let title = "";
  const notes: string[] = [];
  let corrupt = { model: 0, observations: 0 };
  const nowMs = demo ? undefined : Date.now();
  let ds: ReturnType<typeof loadFrozenDataset> | null = null;
  const frozenInclude = diag ? "ALL" : "PUBLISHED";

  if (demo) {
    history = demoHistory(demo);
    title = `SYNTHETIC: ${DEMOS[demo].label}`;
    notes.push(DEMOS[demo].note, "Every name and number in this scenario is invented.");
  } else if (raceId) {
    ds = (() => { try { return loadFrozenDataset(); } catch { return null; } })();
    const frozen = ds?.races[raceId] ?? null;
    title = frozen?.dem && frozen?.gop ? `${raceId}: ${frozen.dem} vs. ${frozen.gop}` : raceId;
    const statuses: DataStatus[] = test ? ["LIVE", "NOT_PROVIDED", "TEST"] : ["LIVE", "NOT_PROVIDED"];
    const choice = resolveStore(process.env);
    if (choice.store) {
      try {
        const loaded = await loadRaceHistory(choice.store, raceId, { surface: "PREVIEW", statuses, includeShadow: true, frozenInclude });
        history = loaded.prepared; corrupt = loaded.corrupt;
      } catch (e) {
        notes.push(e instanceof HistoryError ? `History could not be read (${e.code}). Showing the frozen forecasts only.` : "The recorder store could not be read. Showing the frozen forecasts only.");
      }
    } else notes.push(`No recorder store: ${choice.problem ?? "not configured"}. Showing the frozen forecasts only.`);
    history ??= prepareHistory(raceId, frozenPointsFor(raceId, undefined, frozenInclude), { surface: "PREVIEW", statuses });
    if (diag) notes.push("Diagnostics: every frozen snapshot is drawn at its commit time, including any never verified as published. A public page shows only published forecasts, at the time each went live.");
    if (!frozen) notes.push("This race is not in the frozen forecast dataset.");
  }

  const tracked = !history ? await loadTrackedRaces().catch(() => ({ races: [], expected: [], missing: [] as string[] })) : null;

  return (
    <main className="eni">
      <style>{ENI_CSS}</style>
      <span className="eye">Developer preview · not published</span>
      <h1>Race history</h1>
      <p className="deck">Win probability, expected margin and vote totals over time, drawn from published model outputs and reported votes only. The shadow model is never on a public page; here it is available only as a labelled overlay. <Link href="/portal/intelligence">Back to diagnostics</Link></p>

      {history ? (
        <>
          {notes.map((n, i) => <div className="banner" key={i}><b>Note</b>{n}</div>)}
          <section className="panel wide" style={{ marginBottom: 14 }}>
            <RaceHistory history={history} title={title} nowMs={nowMs} allowShadowOverlay />
          </section>
          <section className="panel wide">
            <h2>What the chart was given</h2>
            <dl className="kv">
              <dt>Frozen forecasts</dt><dd>{history.models.filter((m) => m.sourceClass === "FROZEN_FORECAST").length}{(() => { const c: Record<string, number> = {}; for (const m of history.models) if (m.publication) c[m.publication.class] = (c[m.publication.class] ?? 0) + 1; const s = Object.entries(c).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(", "); return s ? ` (${s})` : ""; })()}</dd>
              {ds && !demo ? <><dt>Publication evidence</dt><dd>{ds.evidence.successful} successful of {ds.evidence.deployments} production deployments, {ds.evidence.first?.slice(0, 10)} to {ds.evidence.last?.slice(0, 10)}. Dataset: {ds.snapshots.filter((s) => s.class === "PUBLISHED").length} published, {ds.snapshots.filter((s) => s.class !== "PUBLISHED").length} not verified as published. <Link href={`/portal/intelligence/history?race=${encodeURIComponent(raceId!)}${test ? "&test=1" : ""}${diag ? "" : "&diag=1"}`}>{diag ? "Published only" : "Show all snapshots"}</Link></dd></> : null}
              <dt>Live projections</dt><dd>{history.models.filter((m) => m.sourceClass === "LIVE_PROJECTION").length}</dd>
              <dt>Result observations</dt><dd>{history.results.length}{history.outOfOrder ? ` (${history.outOfOrder} out of order by source time)` : ""}</dd>
              <dt>Shadow outputs</dt><dd>{history.shadow.length} (overlay only)</dd>
              <dt>Excluded</dt><dd>{[...Object.entries(history.excluded.status).map(([k, v]) => `${v} ${k}`), history.excluded.invalid ? `${history.excluded.invalid} invalid` : "", history.excluded.duplicate ? `${history.excluded.duplicate} duplicate` : ""].filter(Boolean).join(", ") || "none"}</dd>
              <dt>Unreadable records</dt><dd>{corrupt.model + corrupt.observations}</dd>
              <dt>Span</dt><dd>{history.bounds ? `${new Date(history.bounds[0]).toISOString()} to ${new Date(history.bounds[1]).toISOString()}` : "none"}</dd>
            </dl>
          </section>
        </>
      ) : (
        <div className="grid">
          <section className="panel">
            <h2>Synthetic scenarios</h2>
            <ul>{(Object.keys(DEMOS) as DemoId[]).map((k) => <li key={k} style={{ margin: "6px 0" }}><Link href={`/portal/intelligence/history?demo=${k}`}>{DEMOS[k].label}</Link><div className="mute" style={{ fontSize: 12.5 }}>{DEMOS[k].note}</div></li>)}</ul>
          </section>
          <section className="panel">
            <h2>Tracked races</h2>
            <p className="mute" style={{ fontSize: 13, marginBottom: 8 }}>Frozen forecast history from the published model, plus anything the recorder store holds.</p>
            <ul style={{ columns: 2, fontSize: 13 }}>{tracked!.races.map((r) => <li key={r.id}><Link href={`/portal/intelligence/history?race=${encodeURIComponent(r.id)}`}>{r.id}</Link></li>)}</ul>
          </section>
        </div>
      )}
    </main>
  );
}
