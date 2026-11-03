// Builds the emergency CSV from the same public endpoints the pages read, at the moment of the click. Client side.
// It never writes anything and never calls an election provider directly: civicAPI goes through the site's caching proxy.
import { csvFilename, toCsv, type CsvRow, type DataClass } from "./csv";
import { beforeClose, civicRace, civicRead, FIRST_CLOSE, liveOdds, matchCivic, project, showTest, STN, TYPE_SETS, type CRace, type StFile, type XIndex, type XRace } from "@/app/results/2026/live";
import type { PreparedHistory } from "@/app/lib/intelligence/raceHistory";

const slug = (st: string) => (STN[st] ?? st).toLowerCase().replace(/[^a-z]+/g, "-");
export type Scope = { kind: "national" } | { kind: "state"; st: string } | { kind: "race"; id: string };

/** What the current page is about: a race, a state, or the whole country. */
export function scopeFor(pathname: string, ix: XIndex): Scope {
  const m = /^\/results\/2026\/([^/?#]+)/.exec(pathname) ?? /^\/forecast\/([^/?#]+)/.exec(pathname);
  if (m) {
    const key = decodeURIComponent(m[1]);
    if (ix.races.some((r) => r.id === key)) return { kind: "race", id: key };
    const st = Object.keys(STN).find((s) => slug(s) === key.toLowerCase());
    if (st) return { kind: "state", st };
  }
  return { kind: "national" };
}

export type ExportResult = { filename: string; csv: string; races: number; live: boolean; notes: string[] };

const iso = (t: number | null | undefined) => (t != null && Number.isFinite(t) ? new Date(t).toISOString() : null);

export async function buildExport(pathname: string, fetchFn: typeof fetch = fetch): Promise<ExportResult> {
  const generated = new Date();
  const gen = generated.toISOString();
  const ix = (await (await fetchFn("/results/2026/index.json", { cache: "no-store" })).json()) as XIndex;
  const scope = scopeFor(pathname, ix);
  const races: XRace[] = scope.kind === "race" ? ix.races.filter((r) => r.id === scope.id) : scope.kind === "state" ? ix.races.filter((r) => r.st === scope.st) : ix.races;
  const scopeLabel = scope.kind === "race" ? `race-${scope.id}` : scope.kind === "state" ? `state-${scope.st}` : "national";
  const modelVersion = `OnPoint forecast index, asOf ${ix.asOf}`;
  const notes: string[] = [];
  const rows: CsvRow[] = [];
  const base = { export_generated_utc: gen, export_scope: scopeLabel };
  const note = (text: string, extra: CsvRow = {}) => rows.push({ ...base, record_type: "EXPORT_NOTE", data_class: "EXPORT_NOTE" satisfies DataClass, note: text, ...extra });

  // ---- live returns: raw civicAPI, read through the proxy, test returns excluded before polls close ----
  const isTestWindow = beforeClose();
  const includeTest = isTestWindow && showTest();
  let byId: Record<string, CRace> = {};
  let readAt: number | null = null;
  let liveOk = false;
  if (isTestWindow && !includeTest) {
    notes.push(`civicAPI publishes test returns until the first polls close (${new Date(FIRST_CLOSE).toISOString()}); they are excluded. No live vote values are exported.`);
  } else {
    const types = [...new Set(races.flatMap((r) => r.civ.t ?? []))].filter((t) => Object.values(TYPE_SETS).some((l) => l.includes(t)));
    const got: CRace[] = []; const failed: string[] = [];
    let idx = 0;
    const worker = async () => {
      while (idx < types.length) {
        const t = types[idx++];
        try { const r = await civicRead(t); got.push(...r.races); if (r.at != null) readAt = readAt == null ? r.at : Math.min(readAt, r.at); } catch { failed.push(t); }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    byId = matchCivic(races, got); liveOk = Object.keys(byId).length > 0;
    if (failed.length) notes.push(`civicAPI read failed for: ${failed.join("; ")}. Those races have no live rows.`);
    if (includeTest) notes.push("TEST PREVIEW: values below are civicAPI test returns, not real votes (is_test_data = TRUE).");
  }

  for (const r of races) {
    const common = { ...base, race_id: r.id, race_name: r.nm, state: r.st, office_kind: r.k };
    // pre-election forecast: published figures, never actual votes
    const total = r.tot ?? null;
    if (r.k === "leg") {
      rows.push({ ...common, record_type: "RACE_FORECAST", data_class: "FORECAST_PREELECTION", win_probability: r.pD ?? null, source_label: "OnPoint forecast index (public/results/2026/index.json)", source_timestamp_utc: ix.asOf, model_version: modelVersion, note: `Democratic control probability for ${r.up ?? r.seats ?? ""} seats up; majority ${r.maj ?? ""}; expected D seats ${r.dS ?? ""}, R seats ${r.rS ?? ""}` });
    } else {
      rows.push({ ...common, record_type: "RACE_FORECAST", data_class: "FORECAST_PREELECTION", projected_margin_pts: r.m ?? null, projected_final_votes: total, source_label: "OnPoint forecast index (public/results/2026/index.json)", source_timestamp_utc: ix.asOf, model_version: modelVersion, note: r.k === "measure" ? `Pass probability ${r.pPass ?? ""}; margin is No minus Yes in points (positive = No)` : "Margin is Republican minus Democrat in points (positive = Republican)" });
      for (const [name, party, exp] of r.c ?? []) {
        const wp = r.k === "measure" ? (party === "Y" ? r.pPass ?? null : party === "N" ? (r.pPass != null ? 1 - r.pPass : null) : null) : party === "R" ? r.pR ?? null : party === "D" ? (r.pR != null ? 1 - r.pR : null) : null;
        rows.push({ ...common, record_type: "CANDIDATE_FORECAST", data_class: "FORECAST_PREELECTION", candidate_name: name, party, votes: exp, vote_pct: total ? Math.round((1000 * exp) / total) / 10 : null, win_probability: wp, source_label: "OnPoint forecast index: expected votes, not reported votes", source_timestamp_utc: ix.asOf, model_version: modelVersion, note: wp == null ? "not priced in the two-side forecast" : "" });
      }
    }
    const c = byId[r.id];
    if (!c) continue;
    const hasVotes = c.pr > 0 || c.c.some((x) => x[2] > 0);
    const rawBase = { ...common, civic_race_id: c.id, is_test_data: includeTest ? true : false, source_label: "civicAPI via /api/civic/search", observed_at_utc: gen, source_timestamp_utc: iso(readAt) };
    rows.push({ ...rawBase, record_type: "RACE_REPORTED", data_class: "RAW_REPORTED", percent_reporting: hasVotes ? c.pr : null, note: hasVotes ? "" : "no votes reported yet; vote cells left blank, not zero" });
    for (const [name, party, votes, pct, win] of c.c) rows.push({ ...rawBase, record_type: "CANDIDATE_REPORTED", data_class: "RAW_REPORTED", candidate_name: name, party, votes: hasVotes ? votes : null, vote_pct: hasVotes ? pct : null, percent_reporting: hasVotes ? c.pr : null, called_winner: win ? true : false });
  }

  // ---- race scope: county returns, our live projection, and the recorded history ----
  if (scope.kind === "race" && races[0]) {
    const r = races[0]; const c = byId[r.id];
    const common = { ...base, race_id: r.id, race_name: r.nm, state: r.st, office_kind: r.k };
    let det: Awaited<ReturnType<typeof civicRace>> | null = null;
    if (c && (c.pr > 0 || c.c.some((x) => x[2] > 0))) {
      try { det = await civicRace(c.id); } catch { notes.push("County returns could not be read from civicAPI; county rows omitted."); }
    }
    if (det && (!det.test || includeTest)) {
      for (const [f, g] of Object.entries(det.regions ?? {})) for (const [name, party, votes, pct, win] of g.c) {
        rows.push({ ...common, civic_race_id: det.id, record_type: "COUNTY_REPORTED", data_class: "RAW_REPORTED", is_test_data: !!det.test, county_or_region: g.n || f, candidate_name: name, party, votes, vote_pct: pct, percent_reporting: g.pr, called_winner: win ? true : false, observed_at_utc: gen, source_timestamp_utc: det.updated, source_label: "civicAPI via /api/civic/race" });
      }
    } else if (det) notes.push("civicAPI race detail is marked test; county rows excluded.");
    // OnPoint live projection: the same project()/liveOdds() the race desk runs, MODEL_PROJECTED and never a call
    if (det && (!det.test || includeTest) && r.k !== "leg" && c) {
      try {
        const sf = (await (await fetchFn(`/results/2026/st/${r.st}.json`)).json()) as StFile;
        const P = project(sf.counties?.[r.id] ?? null, det.regions ?? null, r, c.c, r.tot); const o = liveOdds(r, P);
        if (P.rep.t > 0) {
          const A = r.c?.find((x) => x[1] === "D" || x[1] === "Y" || x[1] === "I"), B = r.c?.find((x) => x[1] === "R" || x[1] === "N");
          const mp = { ...common, record_type: "RACE_PROJECTION", data_class: "MODEL_PROJECTED" satisfies DataClass, is_test_data: !!det.test, observed_at_utc: gen, source_timestamp_utc: det.updated, source_label: "OnPoint live projection (client recompute of project()/liveOdds())", model_version: modelVersion };
          rows.push({ ...mp, projected_margin_pts: P.m, margin_low_pts: o.lo, margin_high_pts: o.hi, percent_reporting: P.pctIn, note: "Margin = Republican/No minus Democrat/Yes in points; range is 95%. Model estimate, not a race call." });
          for (const [cd, p, v] of [[A, o.pA, P.fin.a], [B, o.pB, P.fin.b]] as const) rows.push({ ...mp, record_type: "CANDIDATE_PROJECTION", candidate_name: cd?.[0], party: cd?.[1], win_probability: p, projected_final_votes: Math.round(v) });
        }
      } catch { notes.push("State county file unavailable; live projection rows omitted."); }
    }
    if (/^(sen|gov|house)-/.test(r.id)) {
      try {
        const res = await fetchFn(`/api/race-history/${encodeURIComponent(r.id)}`);
        if (!res.ok) throw new Error(String(res.status));
        const h = ((await res.json()) as { history: PreparedHistory }).history;
        const nm = new Map(h.candidates.map((k) => [k.id, k] as const));
        for (const p of h.results) for (const [cid, votes] of Object.entries(p.reportedVotes)) rows.push({ ...common, record_type: "HISTORY_RESULT", data_class: "HISTORY_RESULT" satisfies DataClass, is_test_data: p.status === "TEST" || p.status === "SYNTHETIC", candidate_id: cid, candidate_name: nm.get(cid)?.name, party: nm.get(cid)?.party, votes, percent_reporting: p.reporting?.pct ?? null, counted_margin_pts: p.countedMargin?.pp ?? null, observed_at_utc: p.observedAt, source_timestamp_utc: p.sourceTimestamp, source_label: `${p.provider} (${p.status})`, note: p.totalsDecreased ? "total fell against the prior observation (kept as recorded)" : "" });
        for (const p of h.models) {
          const ids = [...new Set([...Object.keys(p.winProbability ?? {}), ...Object.keys(p.projectedFinalVotes ?? {})])];
          if (!ids.length) rows.push({ ...common, record_type: "HISTORY_MODEL", data_class: "HISTORY_MODEL", projected_margin_pts: p.margin?.pp ?? null, margin_low_pts: p.margin?.low ?? null, margin_high_pts: p.margin?.high ?? null, observed_at_utc: p.observedAt, source_timestamp_utc: p.sourceTimestamp, source_label: p.sourceClass, model_version: `${p.model.id} ${p.model.version} ${p.model.snapshot}` });
          for (const cid of ids) rows.push({ ...common, record_type: "HISTORY_MODEL", data_class: "HISTORY_MODEL", is_test_data: p.status === "TEST" || p.status === "SYNTHETIC", candidate_id: cid, candidate_name: nm.get(cid)?.name, party: nm.get(cid)?.party, win_probability: p.winProbability?.[cid] ?? null, projected_final_votes: p.projectedFinalVotes?.[cid] ?? null, projected_margin_pts: p.margin?.pp ?? null, margin_low_pts: p.margin?.low ?? null, margin_high_pts: p.margin?.high ?? null, percent_reporting: p.reporting?.pct ?? null, observed_at_utc: p.observedAt, source_timestamp_utc: p.sourceTimestamp, source_label: p.sourceClass, model_version: `${p.model.id} ${p.model.version} ${p.model.snapshot}`, note: p.revision.status !== "ORIGINAL" ? `revision: ${p.revision.status}` : "" });
        }
        if (!h.results.length && !h.models.length) notes.push("The race-history store returned no recorded points for this race.");
      } catch { notes.push("Recorded history was unavailable at export time; only the current snapshot is included."); }
    } else notes.push("Recorded history is kept for Senate, Governor and House races only; this export is the current snapshot.");
  }

  notes.unshift(`Generated ${gen}. RAW_REPORTED rows are counted votes from civicAPI; MODEL_PROJECTED rows are OnPoint estimates; FORECAST_PREELECTION rows are published before the election. Blank cells mean not available, never zero. Browser export is a manual fallback, not the archival recorder.`);
  for (const n of notes) note(n);
  return { filename: csvFilename(scopeLabel, generated), csv: toCsv(rows), races: races.length, live: liveOk, notes };
}
