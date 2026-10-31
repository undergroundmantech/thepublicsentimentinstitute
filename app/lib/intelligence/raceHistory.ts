// Race history: data contract and chart-ready series for the "Race History" section of a race page.
//
// Pure and client-safe: no node imports, no I/O, no fetches. The server reads the stores (raceHistoryStore.ts) and hands
// HistoryPoints to prepareHistory(); the chart component only calls the functions below.
//
// Two record kinds that are NOT interchangeable
//   MODEL_OUTPUT        what a model published at a moment: win probabilities, projected final margin, projected final votes.
//                       Stored as published; never recomputed with a newer model.
//   RESULT_OBSERVATION  what a results source reported at a moment: reported votes. Never turned into a probability here.
//
// Source classes
//   FROZEN_FORECAST   a pre-election OnPoint forecast, as published
//   LIVE_PROJECTION   a published election-night projection
//   RESULT_FEED       reported votes from a results provider
//   SHADOW_MODEL      the research / shadow pipeline. Never on a public surface; the preview may show it only as its own,
//                     labelled overlay.
//
// Rules the series builders keep
//   - A missing value is a gap (null), never a number. A series is never drawn across a gap.
//   - A published value stands until the next publication supersedes it, so model series are step-after lines.
//     That is what the page showed, not interpolation. Nothing is generated between observations.
//   - Decreases and corrections are kept as recorded and flagged.
//   - Display decimation (decimate()) is a view-layer function: it keeps the first, last, minimum and maximum of every
//     pixel column and every gap, so an extreme or a downward correction is never smoothed away. The history itself is
//     never reduced.

export const HISTORY_SCHEMA = "TPSI_RACE_HISTORY/1" as const;

export type SourceClass = "FROZEN_FORECAST" | "LIVE_PROJECTION" | "RESULT_FEED" | "SHADOW_MODEL";
/** NOT_PROVIDED: the source states neither live nor test (the civicAPI search feed). It is shown, labelled, and never called live. */
export type DataStatus = "LIVE" | "TEST" | "NOT_PROVIDED" | "SYNTHETIC";
export type RevisionStatus = "ORIGINAL" | "REVISION" | "CORRECTION";
export type Surface = "PUBLIC" | "PREVIEW";

export interface HistoryCandidate {
  id: string;
  name: string;
  /** Party code as the source gave it; null when it gave none. */
  party: string | null;
  /** Margin slot: "A" is the minus side of the reference, "B" the plus side. Null for candidates outside the margin. */
  side: "A" | "B" | null;
}

/** margin = plus − minus, in percentage points of the total vote. The site convention is plus = GOP candidate. */
export interface MarginReference { plus: string; minus: string }
export interface ModelId { id: string; version: string; snapshot: string; asOf: string | null }
export interface Revision { status: RevisionStatus; supersedes: string | null; note: string | null }
/** pct is 0–100. `definition` says what it measures; it is never assumed. */
export interface Reporting { pct: number | null; definition: string }

interface PointBase {
  schema: typeof HISTORY_SCHEMA;
  pointId: string;
  raceId: string;
  /** UTC ISO. When the figure was published (model) or first observed by us (results). */
  observedAt: string;
  /** UTC ISO. What the source says its figures were current at. Null when it says nothing; never filled in. */
  sourceTimestamp: string | null;
  sourceClass: SourceClass;
  status: DataStatus;
  candidates: HistoryCandidate[];
  revision: Revision;
  reporting: Reporting | null;
}

export interface ModelMargin {
  pp: number;
  reference: MarginReference;
  /** Interval bounds in the same units and sign as pp. Only where the model published them. */
  low: number | null;
  high: number | null;
  intervalBasis: string | null;
}

/** Whether a frozen snapshot was verifiably public. Only PUBLISHED frozen points may appear on a public surface. */
export type PublicationClass = "PUBLISHED" | "UNVERIFIED" | "INTERNAL" | "REVERTED";
export interface Publication { class: PublicationClass; publishedAt: string | null; evidence: string; revertedBy: string | null }

export interface ModelOutputPoint extends PointBase {
  kind: "MODEL_OUTPUT";
  sourceClass: "FROZEN_FORECAST" | "LIVE_PROJECTION" | "SHADOW_MODEL";
  model: ModelId;
  /** Required for FROZEN_FORECAST on a public surface. A live projection is recorded when published, so it carries none. */
  publication?: Publication;
  /** Fractions 0–1 by candidate id. null as a whole, or per candidate, means the model published no valid probability. */
  winProbability: Record<string, number | null> | null;
  /** What the probabilities cover. TWO_SIDE: only the two margin sides are priced; others are "not priced", not 0. */
  winProbabilityBasis: "TWO_SIDE" | "MULTI_CANDIDATE" | null;
  margin: ModelMargin | null;
  /** Projected final votes by candidate id. */
  projectedFinalVotes: Record<string, number | null> | null;
  provenance: { origin: string; ref: string | null };
}

export interface ResultPoint extends PointBase {
  kind: "RESULT_OBSERVATION";
  sourceClass: "RESULT_FEED";
  provider: string;
  reportedVotes: Record<string, number>;
  /** Counted-vote margin in pp of the votes counted so far. It is not a projection. */
  countedMargin: { pp: number; reference: MarginReference } | null;
  /** The total fell against the observation before it. */
  totalsDecreased: boolean;
  outOfOrder: boolean;
  /** The last time a later reading confirmed these same figures. An unchanged feed is a held value, not a gap. */
  confirmedThrough: string | null;
  provenance: { origin: string; ref: string | null };
}

export type HistoryPoint = ModelOutputPoint | ResultPoint;

const ms = (s: string | null | undefined) => (s ? Date.parse(s) : NaN);

// ---- validation and preparation ----------------------------------------------------------------------------------------

/** Why a point cannot be charted, or null. */
export function invalidReason(p: HistoryPoint): string | null {
  if (!Number.isFinite(ms(p.observedAt))) return "observedAt is not a date";
  if (p.sourceTimestamp !== null && !Number.isFinite(ms(p.sourceTimestamp))) return "sourceTimestamp is not a date";
  if (p.kind === "MODEL_OUTPUT") {
    if (!p.model?.version || !p.model.snapshot) return "a model output needs a model version and snapshot";
    if (p.winProbability) for (const [k, v] of Object.entries(p.winProbability)) if (v !== null && !(Number.isFinite(v) && v >= 0 && v <= 1)) return `win probability for ${k} is ${String(v)}`;
    if (p.winProbability) { const s = Object.values(p.winProbability).reduce<number>((a, v) => a + (v ?? 0), 0); if (s > 1.0005) return `win probabilities sum to ${s.toFixed(4)}`; }
    if (p.margin && !Number.isFinite(p.margin.pp)) return "margin is not a number";
    if (p.projectedFinalVotes) for (const [k, v] of Object.entries(p.projectedFinalVotes)) if (v !== null && !(Number.isFinite(v) && v >= 0)) return `projected votes for ${k} is ${String(v)}`;
  } else {
    for (const [k, v] of Object.entries(p.reportedVotes ?? {})) if (!(Number.isFinite(v) && v >= 0)) return `reported votes for ${k} is ${String(v)}`;
    if (!Object.keys(p.reportedVotes ?? {}).length) return "no reported votes";
  }
  return null;
}

export interface PrepareOptions {
  surface: Surface;
  /** Statuses to admit. Public default: LIVE and NOT_PROVIDED. Test data needs TEST here, synthetic data SYNTHETIC. */
  statuses?: readonly DataStatus[];
  /** Periods when a results source was known to be unavailable. The chart marks them; nothing is drawn or inferred inside them. */
  outages?: readonly SourceOutage[];
}

export interface SourceOutage {
  /** Provider name as on the result points, or "*" for every provider. */
  provider: string;
  from: string;
  /** null: still unavailable. */
  to: string | null;
  reason: string;
}

export interface PreparedHistory {
  raceId: string;
  surface: Surface;
  candidates: HistoryCandidate[];
  /** FROZEN_FORECAST and LIVE_PROJECTION outputs in time order. Never contains SHADOW_MODEL. */
  models: ModelOutputPoint[];
  results: ResultPoint[];
  /** Preview only. Empty on a public surface. */
  shadow: ModelOutputPoint[];
  excluded: { shadow: number; invalid: number; duplicate: number; unpublished: number; status: Record<string, number> };
  bounds: [number, number] | null;
  /** Index in `models` of the last frozen forecast, or -1. */
  finalFrozenIndex: number;
  outOfOrder: number;
  /** Known results-source outages, as epoch-ms intervals; `to` null means still unavailable. */
  outages: { provider: string; from: number; to: number | null; reason: string }[];
}

const byTime = (a: HistoryPoint, b: HistoryPoint) => ms(a.observedAt) - ms(b.observedAt) || a.pointId.localeCompare(b.pointId);

/** Mark a model output that restates an earlier snapshot with different figures as a REVISION of it (derived, never stored). */
function deriveRevisions(models: ModelOutputPoint[]): ModelOutputPoint[] {
  const seen = new Map<string, ModelOutputPoint>();
  return models.map((m) => {
    const k = `${m.sourceClass}|${m.status}|${m.model.id}|${m.model.snapshot}`;
    const prior = seen.get(k);
    seen.set(k, m);
    if (!prior || m.revision.status !== "ORIGINAL") return m;
    return { ...m, revision: { status: "REVISION", supersedes: prior.pointId, note: m.revision.note ?? "same snapshot, different figures" } };
  });
}

export function prepareHistory(raceId: string, input: readonly HistoryPoint[], opts: PrepareOptions): PreparedHistory {
  const statuses = new Set<DataStatus>(opts.statuses ?? ["LIVE", "NOT_PROVIDED"]);
  const excluded: PreparedHistory["excluded"] = { shadow: 0, invalid: 0, duplicate: 0, unpublished: 0, status: {} };
  const ids = new Set<string>();
  const models: ModelOutputPoint[] = [], results: ResultPoint[] = [], shadow: ModelOutputPoint[] = [];
  for (const p of input) {
    if (p.raceId !== raceId) continue;
    if (ids.has(p.pointId)) { excluded.duplicate++; continue; }
    ids.add(p.pointId);
    const bad = invalidReason(p);
    if (bad) { excluded.invalid++; continue; }
    if (p.sourceClass === "SHADOW_MODEL") {
      // the shadow model is never part of a public series; the preview keeps it apart and labelled
      if (opts.surface === "PUBLIC") { excluded.shadow++; continue; }
      if (p.kind === "MODEL_OUTPUT" && statuses.has(p.status)) shadow.push(p); else excluded.status[p.status] = (excluded.status[p.status] ?? 0) + 1;
      continue;
    }
    if (!statuses.has(p.status)) { excluded.status[p.status] = (excluded.status[p.status] ?? 0) + 1; continue; }
    if (opts.surface === "PUBLIC" && p.sourceClass === "FROZEN_FORECAST" && p.publication?.class !== "PUBLISHED") { excluded.unpublished++; continue; }
    if (p.kind === "MODEL_OUTPUT") models.push(p); else results.push(p);
  }
  models.sort(byTime); results.sort(byTime); shadow.sort(byTime);
  const dm = deriveRevisions(models);
  let finalFrozenIndex = -1;
  dm.forEach((m, i) => { if (m.sourceClass === "FROZEN_FORECAST") finalFrozenIndex = i; });
  let outOfOrder = 0, maxSource = -Infinity;
  for (const r of results) { const t = ms(r.sourceTimestamp); if (Number.isFinite(t)) { if (t < maxSource) outOfOrder++; maxSource = Math.max(maxSource, t); } }

  // roster: newest figures first, so a renamed candidate shows the latest name
  const roster = new Map<string, HistoryCandidate>();
  for (const p of [...dm, ...results].sort((a, b) => ms(b.observedAt) - ms(a.observedAt))) for (const c of p.candidates) if (!roster.has(c.id)) roster.set(c.id, c);
  const order = new Map<string, number>();
  for (const p of [...dm, ...results]) for (const c of p.candidates) if (!order.has(c.id)) order.set(c.id, order.size);
  const candidates = [...roster.values()].sort((a, b) => rank(a) - rank(b) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const all = [...dm, ...results, ...shadow].map((p) => ms(p.observedAt));
  const outages = (opts.outages ?? []).map((o) => ({ provider: o.provider, from: ms(o.from), to: o.to === null ? null : ms(o.to), reason: o.reason }))
    .filter((o) => Number.isFinite(o.from) && (o.to === null || (Number.isFinite(o.to) && o.to > o.from))).sort((a, b) => a.from - b.from);
  return {
    raceId, surface: opts.surface, candidates, models: dm, results, shadow, excluded,
    bounds: all.length ? [Math.min(...all), Math.max(...all)] : null, finalFrozenIndex, outOfOrder, outages,
  };
}

/** The latest moment any figure on the page was published or re-confirmed. */
export function lastUpdated(p: PreparedHistory): number | null {
  let t = -Infinity;
  for (const m of p.models) t = Math.max(t, ms(m.observedAt));
  for (const r of p.results) { t = Math.max(t, ms(r.observedAt)); const c = ms(r.confirmedThrough); if (Number.isFinite(c)) t = Math.max(t, c); }
  return Number.isFinite(t) ? t : null;
}

const rank = (c: HistoryCandidate) => (c.party === "D" ? 0 : c.party === "R" ? 1 : c.side === "A" ? 0 : c.side === "B" ? 1 : 2);

// ---- colors and labels -------------------------------------------------------------------------------------------------

// Colors are theme tokens defined on .rh in raceHistory.css, so dark, light and future themes restyle the chart without code changes.
export const PARTY_COLOR: Record<string, string> = { D: "var(--rh-d)", R: "var(--rh-r)", I: "var(--rh-i)", IND: "var(--rh-i)", NPA: "var(--rh-i)", L: "var(--rh-l)", G: "var(--rh-g)" };
const OTHER = ["var(--rh-o1)", "var(--rh-o2)", "var(--rh-o3)", "var(--rh-o4)"];

export function candidateColor(c: HistoryCandidate, index: number): string {
  if (c.party && PARTY_COLOR[c.party]) return PARTY_COLOR[c.party];
  if (c.side === "A") return PARTY_COLOR.D;
  if (c.side === "B") return PARTY_COLOR.R;
  return OTHER[index % OTHER.length];
}
export const SHADOW_COLOR = "var(--rh-shadow)";
export const NEUTRAL_COLOR = "var(--rh-neutral)";

export const lastName = (name: string) => { const p = name.trim().split(/\s+/); return p.length > 1 && /^(jr|sr|ii|iii|iv)\.?$/i.test(p[p.length - 1]) ? p[p.length - 2] : p[p.length - 1] ?? name; };

// ---- series --------------------------------------------------------------------------------------------------------------

export type ChartId = "prob" | "margin" | "votes";
export type Phase = "FROZEN" | "LIVE" | "SHADOW";
export type PointFlag = "DECREASE" | "CORRECTION" | "OUT_OF_ORDER" | "REVISION";

export interface SeriesPoint {
  t: number;
  /** null: the source published no valid value here. The line stops. */
  v: number | null;
  lo?: number | null;
  hi?: number | null;
  /** Index into the prepared array this point came from (see Series.source). */
  src: number;
  /** The value was re-confirmed unchanged until this time; the line is held to here before a gap can begin. */
  until?: number;
  flag?: PointFlag;
  /** The value held over from before the window. Drawn, never marked. */
  carried?: boolean;
}

export interface Series {
  key: string;
  candidateId: string | null;
  label: string;
  color: string;
  /** SOLID: reported or published. DASHED: an estimate of the final count. */
  dash: "SOLID" | "DASHED";
  phase: Phase;
  source: "MODEL" | "RESULT" | "SHADOW";
  /** The figure's meaning, for the legend and the tooltip. */
  meaning: string;
  /** A value older than this is not carried forward; the line breaks. null: carried until the next point. */
  breakAfterMs: number | null;
  /** The last value is held to this time (frozen forecast until the first live projection). */
  extendTo: number | null;
  band: boolean;
  pts: SeriesPoint[];
}

export interface Marker { t: number; kind: "FREEZE" | "MODEL_VERSION" | "LIVE_START"; label: string }

export interface ChartData {
  chart: ChartId;
  series: Series[];
  markers: Marker[];
  /** Candidates present in the race that this chart has no value for, with the reason. */
  notShown: { candidateId: string; name: string; reason: string }[];
  /** Margin chart only. */
  reference: { plus: HistoryCandidate; minus: HistoryCandidate } | null;
  emptyReason: string | null;
  /** Sorted distinct observation times across all series; the keyboard cursor steps through these. */
  times: number[];
  yDomain: [number, number];
}

export interface BuildOptions {
  /** Include the shadow series as its own labelled overlay. Ignored on a public surface. */
  overlayShadow?: boolean;
}

const untilOf = (r: ResultPoint): { until?: number } => { const u = ms(r.confirmedThrough); return Number.isFinite(u) && u > ms(r.observedAt) ? { until: u } : {}; };
const phaseOf = (c: SourceClass): Phase => (c === "FROZEN_FORECAST" ? "FROZEN" : c === "SHADOW_MODEL" ? "SHADOW" : "LIVE");

function markersFor(p: PreparedHistory): Marker[] {
  const out: Marker[] = [];
  if (p.finalFrozenIndex >= 0) out.push({ t: ms(p.models[p.finalFrozenIndex].observedAt), kind: "FREEZE", label: "Final forecast" });
  const firstLive = p.models.find((m) => m.sourceClass === "LIVE_PROJECTION");
  if (firstLive) out.push({ t: ms(firstLive.observedAt), kind: "LIVE_START", label: "Live projections begin" });
  let version: string | null = null;
  for (const m of p.models) {
    if (version !== null && m.model.version !== version && m.model.version !== "UNVERSIONED" && version !== "UNVERSIONED") out.push({ t: ms(m.observedAt), kind: "MODEL_VERSION", label: `Model ${m.model.version}` });
    version = m.model.version;
  }
  return out;
}

const extendFor = (p: PreparedHistory, phase: Phase): number | null => {
  if (phase !== "FROZEN") return null;
  const live = p.models.find((m) => m.sourceClass === "LIVE_PROJECTION");
  return live ? ms(live.observedAt) : null;
};

function nice(lo: number, hi: number, minSpan: number): [number, number] {
  let span = Math.max(hi - lo, minSpan);
  const mid = (hi + lo) / 2;
  const step = Math.pow(10, Math.floor(Math.log10(span / 4)));
  const f = span / 4 / step;
  const unit = (f > 5 ? 10 : f > 2 ? 5 : f > 1 ? 2 : 1) * step;
  span = Math.max(span, unit * 2);
  return [Math.floor((mid - span / 2) / unit) * unit, Math.ceil((mid + span / 2) / unit) * unit];
}

export function buildChart(p: PreparedHistory, chart: ChartId, opts: BuildOptions = {}): ChartData {
  const overlay = !!opts.overlayShadow && p.surface === "PREVIEW";
  const markers = markersFor(p);
  const series: Series[] = [];
  const notShown: ChartData["notShown"] = [];
  let reference: ChartData["reference"] = null;
  let emptyReason: string | null = null;
  const byId = new Map(p.candidates.map((c) => [c.id, c]));
  const idx = new Map(p.candidates.map((c, i) => [c.id, i]));
  const colorOf = (id: string) => { const c = byId.get(id); return c ? candidateColor(c, idx.get(id) ?? 0) : OTHER[0]; };
  const modelSets: { pts: ModelOutputPoint[]; shadow: boolean }[] = [{ pts: p.models, shadow: false }, ...(overlay ? [{ pts: p.shadow, shadow: true }] : [])];

  if (chart === "prob") {
    for (const c of p.candidates) {
      let any = false;
      for (const phase of ["FROZEN", "LIVE", "SHADOW"] as const) {
        const pts: SeriesPoint[] = [];
        for (const set of modelSets) set.pts.forEach((m, i) => {
          if (phaseOf(m.sourceClass) !== phase) return;
          const v = m.winProbability ? m.winProbability[c.id] ?? null : null;
          pts.push({ t: ms(m.observedAt), v: v === null ? null : Math.round(v * 1e8) / 1e6, src: i, ...(m.revision.status !== "ORIGINAL" ? { flag: "REVISION" as const } : {}) });
        });
        if (!pts.some((q) => q.v !== null)) continue;
        any = true;
        series.push({
          key: `prob:${c.id}:${phase}`, candidateId: c.id, label: c.name, color: phase === "SHADOW" ? SHADOW_COLOR : colorOf(c.id), dash: "SOLID", phase,
          source: phase === "SHADOW" ? "SHADOW" : "MODEL", meaning: phase === "FROZEN" ? "Pre-election forecast, frozen" : phase === "SHADOW" ? "Shadow model, not published" : "Published live projection",
          breakAfterMs: null, extendTo: extendFor(p, phase), band: false, pts,
        });
      }
      if (!any) notShown.push({ candidateId: c.id, name: c.name, reason: "no win probability published for this candidate" });
    }
    if (!series.length) emptyReason = p.models.length ? "No win probability has been published for this race." : "No forecast has been published for this race.";
    return finish(chart, series, markers, notShown, null, emptyReason, [0, 100]);
  }

  if (chart === "margin") {
    const latest = [...p.models, ...p.results].sort((a, b) => ms(b.observedAt) - ms(a.observedAt)).find((x) => (x.kind === "MODEL_OUTPUT" ? x.margin?.reference : x.countedMargin?.reference));
    const ref = latest ? (latest.kind === "MODEL_OUTPUT" ? latest.margin!.reference : latest.countedMargin!.reference) : null;
    const plus = ref ? byId.get(ref.plus) : undefined, minus = ref ? byId.get(ref.minus) : undefined;
    if (!ref || !plus || !minus) return finish(chart, [], markers, notShown, null, "No margin has been published for this race.", [-10, 10]);
    reference = { plus, minus };
    const align = (r: MarginReference, pp: number): number | null => (r.plus === ref.plus && r.minus === ref.minus ? pp : r.plus === ref.minus && r.minus === ref.plus ? -pp : null);
    const alignOpt = (r: MarginReference, v: number | null) => (v === null ? null : align(r, v));
    for (const phase of ["FROZEN", "LIVE", "SHADOW"] as const) {
      const pts: SeriesPoint[] = [];
      for (const set of modelSets) set.pts.forEach((m, i) => {
        if (phaseOf(m.sourceClass) !== phase) return;
        if (!m.margin) { pts.push({ t: ms(m.observedAt), v: null, src: i }); return; }
        const v = align(m.margin.reference, m.margin.pp);
        const flip = v !== null && m.margin.reference.plus !== ref.plus;
        let lo = alignOpt(m.margin.reference, m.margin.low), hi = alignOpt(m.margin.reference, m.margin.high);
        if (flip) [lo, hi] = [hi, lo];
        pts.push({ t: ms(m.observedAt), v, lo, hi, src: i, ...(m.revision.status !== "ORIGINAL" ? { flag: "REVISION" as const } : {}) });
      });
      if (!pts.some((q) => q.v !== null)) continue;
      series.push({
        key: `margin:${phase}`, candidateId: null, label: phase === "FROZEN" ? "Forecast margin (frozen)" : phase === "SHADOW" ? "Shadow margin (not published)" : "Projected final margin",
        color: phase === "SHADOW" ? SHADOW_COLOR : NEUTRAL_COLOR, dash: "SOLID", phase, source: phase === "SHADOW" ? "SHADOW" : "MODEL",
        meaning: phase === "FROZEN" ? "Pre-election forecast of the final margin, frozen" : phase === "SHADOW" ? "Shadow model, not published" : "Published projection of the FINAL margin",
        breakAfterMs: null, extendTo: extendFor(p, phase), band: pts.some((q) => q.lo != null && q.hi != null), pts,
      });
    }
    const counted: SeriesPoint[] = [];
    p.results.forEach((r, i) => {
      const v = r.countedMargin ? align(r.countedMargin.reference, r.countedMargin.pp) : null;
      counted.push({ t: ms(r.observedAt), v, src: i, ...untilOf(r), ...(r.totalsDecreased ? { flag: "DECREASE" as const } : r.revision.status === "CORRECTION" ? { flag: "CORRECTION" as const } : {}) });
    });
    if (counted.some((q) => q.v !== null)) series.push({
      key: "margin:counted", candidateId: null, label: "Counted-vote margin", color: NEUTRAL_COLOR, dash: "DASHED", phase: "LIVE", source: "RESULT",
      meaning: "Margin among votes counted so far. Not a projection.", breakAfterMs: null, extendTo: null, band: false, pts: counted,
    });
    if (!series.length) emptyReason = "No margin has been published for this race.";
    // The scale follows the forecast. An early count with a lopsided first batch can run far past it; it is capped and marked
    // off scale rather than allowed to flatten the forecast into a line.
    const abs = (ss: Series[]) => ss.flatMap((s) => s.pts.flatMap((q) => [q.v, q.lo, q.hi])).filter((x): x is number => typeof x === "number").map(Math.abs);
    const m1 = Math.max(0, ...abs(series.filter((s) => s.source !== "RESULT")));
    const m2 = Math.max(0, ...abs(series.filter((s) => s.source === "RESULT")));
    const m = Math.max(m1, m1 > 0 ? Math.min(m2, Math.max(m1 * 2, m1 + 10)) : m2) || 5;
    const [lo, hi] = nice(-m, m, 4);
    const ext = Math.max(Math.abs(lo), Math.abs(hi));
    return finish(chart, series, markers, notShown, reference, emptyReason, [-ext, ext]);
  }

  // votes: solid lines are what a results source reported; dashed lines are a model's estimate of the final count
  for (const c of p.candidates) {
    const rep: SeriesPoint[] = [];
    p.results.forEach((r, i) => {
      const v = r.reportedVotes[c.id];
      rep.push({ t: ms(r.observedAt), v: v === undefined ? null : v, src: i, ...untilOf(r), ...(r.totalsDecreased ? { flag: "DECREASE" as const } : r.revision.status === "CORRECTION" ? { flag: "CORRECTION" as const } : r.outOfOrder ? { flag: "OUT_OF_ORDER" as const } : {}) });
    });
    let any = false;
    if (rep.some((q) => q.v !== null)) {
      any = true;
      series.push({ key: `votes:${c.id}:reported`, candidateId: c.id, label: c.name, color: colorOf(c.id), dash: "SOLID", phase: "LIVE", source: "RESULT", meaning: "Votes reported by the results source", breakAfterMs: null, extendTo: null, band: false, pts: rep });
    }
    for (const phase of ["FROZEN", "LIVE", "SHADOW"] as const) {
      const est: SeriesPoint[] = [];
      for (const set of modelSets) set.pts.forEach((m, i) => {
        if (phaseOf(m.sourceClass) !== phase) return;
        const v = m.projectedFinalVotes ? m.projectedFinalVotes[c.id] ?? null : null;
        est.push({ t: ms(m.observedAt), v, src: i });
      });
      if (!est.some((q) => q.v !== null)) continue;
      any = true;
      series.push({
        key: `votes:${c.id}:est:${phase}`, candidateId: c.id, label: `${c.name} (estimated final)`, color: phase === "SHADOW" ? SHADOW_COLOR : colorOf(c.id), dash: "DASHED", phase,
        source: phase === "SHADOW" ? "SHADOW" : "MODEL", meaning: phase === "FROZEN" ? "Pre-election estimate of the final vote, frozen" : phase === "SHADOW" ? "Shadow estimate, not published" : "Published estimate of the final vote",
        breakAfterMs: null, extendTo: extendFor(p, phase), band: false, pts: est,
      });
    }
    if (!any) notShown.push({ candidateId: c.id, name: c.name, reason: "no vote figure for this candidate" });
  }
  if (!series.length) emptyReason = "No votes have been reported or estimated for this race.";
  const vmax = Math.max(0, ...series.flatMap((s) => s.pts.map((q) => q.v ?? 0)));
  return finish(chart, series, markers, notShown, null, emptyReason, [0, niceMax(vmax)]);
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / step;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * step;
}

function finish(chart: ChartId, series: Series[], markers: Marker[], notShown: ChartData["notShown"], reference: ChartData["reference"], emptyReason: string | null, yDomain: [number, number]): ChartData {
  const times = [...new Set(series.flatMap((s) => s.pts.map((q) => q.t)))].sort((a, b) => a - b);
  return { chart, series, markers, notShown, reference, emptyReason, times, yDomain };
}

// ---- time range and display decimation ---------------------------------------------------------------------------------

export type RangeId = "NIGHT" | "24H" | "7D" | "ALL";
export const ELECTION_NIGHT_START = Date.parse("2026-11-03T21:00:00Z");
const HOUR = 3_600_000, DAY = 24 * HOUR;
export const RANGE_LABEL: Record<RangeId, string> = { NIGHT: "Election night", "24H": "24 hours", "7D": "7 days", ALL: "All" };

export function rangeWindow(range: RangeId, bounds: [number, number] | null, nowMs?: number): [number, number] {
  if (!bounds) return [ELECTION_NIGHT_START, ELECTION_NIGHT_START + 12 * HOUR];
  const end = Math.max(bounds[1], nowMs ?? 0);
  let t0 = range === "NIGHT" ? ELECTION_NIGHT_START : range === "24H" ? end - DAY : range === "7D" ? end - 7 * DAY : bounds[0];
  let t1 = range === "NIGHT" ? Math.max(end, ELECTION_NIGHT_START + 6 * HOUR) : end;
  if (t1 - t0 < HOUR) { t0 -= 30 * 60_000; t1 += 30 * 60_000; }
  else if (range === "ALL") { const pad = (t1 - t0) * 0.02; t0 -= pad; t1 += pad; }
  return [t0, t1];
}

/** Whether a range holds any observation, so the control can disable the ones that would show nothing. */
export function rangeHasData(c: ChartData, range: RangeId, bounds: [number, number] | null, nowMs?: number): boolean {
  const [t0, t1] = rangeWindow(range, bounds, nowMs);
  return c.series.some((s) => s.pts.some((q) => q.t >= t0 && q.t <= t1 && q.v !== null));
}

export function defaultRange(c: ChartData, bounds: [number, number] | null, nowMs?: number): RangeId {
  return rangeHasData(c, "NIGHT", bounds, nowMs) ? "NIGHT" : "ALL";
}

/** Points inside [t0, t1], plus the value held over from before t0 (flagged carried), which is what the page showed at t0. */
export function windowSeries(s: Series, t0: number, t1: number): SeriesPoint[] {
  const i = lowerBound(s.pts, t0);
  const out: SeriesPoint[] = [];
  const prev = i > 0 ? s.pts[i - 1] : null;
  if (prev && prev.v !== null && (s.breakAfterMs === null || t0 - (prev.until ?? prev.t) <= s.breakAfterMs)) out.push({ ...prev, t: t0, carried: true });
  for (let k = i; k < s.pts.length && s.pts[k].t <= t1; k++) out.push(s.pts[k]);
  return out;
}

function lowerBound(a: { t: number }[], t: number): number {
  let lo = 0, hi = a.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].t < t) lo = m + 1; else hi = m; }
  return lo;
}

/**
 * Display only. Per pixel column keeps the first, last, minimum and maximum, and every gap marker and flagged point, so extremes and
 * downward corrections survive. Never applied to the stored history.
 */
export function decimate(pts: SeriesPoint[], t0: number, t1: number, columns: number): SeriesPoint[] {
  if (pts.length <= columns * 4 || t1 <= t0) return pts;
  const keep = new Set<number>();
  const w = (t1 - t0) / columns;
  let col = -1, first = 0, minI = -1, maxI = -1;
  const flush = (lastI: number) => { if (col < 0) return; keep.add(first); keep.add(lastI); if (minI >= 0) keep.add(minI); if (maxI >= 0) keep.add(maxI); };
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    const c = Math.max(0, Math.min(columns - 1, Math.floor((q.t - t0) / w)));
    if (c !== col) { flush(i - 1); col = c; first = i; minI = -1; maxI = -1; }
    if (q.v === null || q.flag || q.carried) keep.add(i);
    else {
      if (minI < 0 || q.v < (pts[minI].v as number)) minI = i;
      if (maxI < 0 || q.v > (pts[maxI].v as number)) maxI = i;
    }
  }
  flush(pts.length - 1);
  return [...keep].sort((a, b) => a - b).map((i) => pts[i]);
}

// ---- cursor readout ------------------------------------------------------------------------------------------------------

export interface Held { point: SeriesPoint; ageMs: number }

/** The value the page showed at time t for this series: the last point at or before t, unless a gap, a break or the end of the series intervenes. */
export function heldAt(s: Series, t: number): Held | null {
  const i = lowerBound(s.pts, t + 1) - 1;
  if (i < 0) return null;
  const q = s.pts[i];
  if (q.v === null) return null;
  const age = t - q.t;
  const isLast = i === s.pts.length - 1;
  if (s.breakAfterMs !== null && t - (q.until ?? q.t) > s.breakAfterMs) return null;
  if (isLast && s.extendTo !== null && t > s.extendTo) return null;
  return { point: q, ageMs: age };
}

export interface ReadoutRow {
  seriesKey: string;
  label: string;
  color: string;
  dash: "SOLID" | "DASHED";
  phase: Phase;
  meaning: string;
  value: number | null;
  band: [number, number] | null;
  asOf: number | null;
  flag: PointFlag | null;
  source: PreparedHistory["models"][number] | ResultPoint | null;
  /** Results only. What was known at the cursor time about whether the value was still current; never uses later information. */
  freshness: Freshness | null;
}
export type Freshness =
  | { kind: "NEW" }
  | { kind: "CONFIRMED"; at: number }
  | { kind: "NO_NEW"; since: number }
  | { kind: "SOURCE_UNAVAILABLE"; since: number; reason: string };
export interface Readout { t: number; rows: ReadoutRow[] }

function freshnessAt(p: PreparedHistory, src: ResultPoint, q: SeriesPoint, t: number): Freshness {
  const out = p.outages.find((o) => (o.provider === "*" || o.provider === src.provider) && o.from <= t && (o.to === null || t < o.to));
  if (out) return { kind: "SOURCE_UNAVAILABLE", since: out.from, reason: out.reason };
  if (q.t === t) return { kind: "NEW" };
  // confirmedThrough is the latest re-confirmation. If it is after t, the earlier ones were not kept, so nothing is claimed.
  if (q.until !== undefined && q.until <= t) return { kind: "CONFIRMED", at: q.until };
  return { kind: "NO_NEW", since: q.t };
}

export function readoutAt(c: ChartData, p: PreparedHistory, t: number): Readout {
  const rows: ReadoutRow[] = c.series.map((s) => {
    const h = heldAt(s, t);
    const src = h ? (s.source === "RESULT" ? p.results[h.point.src] : s.source === "SHADOW" ? p.shadow[h.point.src] : p.models[h.point.src]) ?? null : null;
    return {
      seriesKey: s.key, label: s.label, color: s.color, dash: s.dash, phase: s.phase, meaning: s.meaning, value: h ? h.point.v : null,
      band: h && h.point.lo != null && h.point.hi != null ? [h.point.lo, h.point.hi] : null, asOf: h ? h.point.t : null, flag: h?.point.flag ?? null, source: src,
      freshness: h && src?.kind === "RESULT_OBSERVATION" ? freshnessAt(p, src, h.point, t) : null,
    };
  });
  return { t, rows };
}

/** The observation time nearest after/before t, for keyboard stepping. */
export function stepTime(times: number[], t: number | null, dir: 1 | -1): number | null {
  if (!times.length) return null;
  if (t === null) return dir === 1 ? times[0] : times[times.length - 1];
  let lo = 0, hi = times.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (times[m] < t) lo = m + 1; else hi = m; }
  const i = lo;
  if (dir === 1) { const j = times[i] === t ? i + 1 : i; return times[Math.min(j, times.length - 1)]; }
  return times[Math.max(0, i - 1)];
}

// ---- time zones ------------------------------------------------------------------------------------------------------------

export type ZoneId = "ET" | "UTC" | "LOCAL";
export const ZONE_LABEL: Record<ZoneId, string> = { ET: "ET", UTC: "UTC", LOCAL: "Local" };
export const zoneName = (z: ZoneId): string | undefined => (z === "ET" ? "America/New_York" : z === "UTC" ? "UTC" : undefined);

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(tz: string | undefined, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${tz ?? "local"}|${JSON.stringify(opts)}`;
  let f = dtfCache.get(k);
  if (!f) { f = new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }); dtfCache.set(k, f); }
  return f;
}

/** Offset of the zone from UTC at an instant, in ms (positive east). */
export function zoneOffset(t: number, tz: string | undefined): number {
  const parts = dtf(tz, { hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(t));
  const g = (type: string) => Number(parts.find((x) => x.type === type)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(t / 1000) * 1000;
}

/** The instant at which the zone's wall clock reads y-m-d h:mi. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string | undefined): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - zoneOffset(guess, tz);
  const off2 = zoneOffset(t, tz);
  if (guess - off2 !== t) t = guess - off2;
  return t;
}

export function zoneDate(t: number, tz: string | undefined): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = dtf(tz, { hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(new Date(t));
  const g = (type: string) => Number(parts.find((x) => x.type === type)?.value);
  return { y: g("year"), mo: g("month"), d: g("day"), h: g("hour"), mi: g("minute") };
}

export interface Tick { t: number; label: string; major: boolean }

const STEPS_H = [0.25, 0.5, 1, 2, 3, 6, 12];

/** Ticks on whole hours or midnights of the zone's own clock, so they stay put across the November change from EDT to EST. */
export function timeTicks(t0: number, t1: number, tz: string | undefined, max: number): Tick[] {
  const span = t1 - t0;
  const out: Tick[] = [];
  const lab = (t: number, major: boolean): Tick => {
    const z = zoneDate(t, tz);
    if (z.h === 0 && z.mi === 0) return { t, major: true, label: dtf(tz, { month: "short", day: "numeric" }).format(new Date(t)) };
    return { t, major, label: dtf(tz, { hour: "numeric", ...(z.mi ? { minute: "2-digit" } : {}) }).format(new Date(t)).replace(" ", "\u202f") };
  };
  const dayStep = [1, 2, 3, 7, 14, 30].find((n) => span / (n * DAY) <= max) ?? 60;
  const hourStep = span <= 36 * HOUR ? STEPS_H.find((h) => span / (h * HOUR) <= max) : undefined;
  const s = zoneDate(t0, tz), e = zoneDate(t1, tz);
  const firstDay = Date.UTC(s.y, s.mo - 1, s.d), lastDay = Date.UTC(e.y, e.mo - 1, e.d);
  if (hourStep !== undefined) {
    for (let day = firstDay; day <= lastDay; day += DAY) {
      const dd = new Date(day);
      for (let h = 0; h < 24; h += hourStep) {
        const hh = Math.floor(h), mi = Math.round((h - hh) * 60);
        const t = zonedToUtc(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate(), hh, mi, tz);
        if (t >= t0 && t <= t1) out.push(lab(t, hh === 0 && mi === 0));
      }
    }
  } else {
    let n = 0;
    for (let day = firstDay; day <= lastDay; day += DAY, n++) {
      if (n % dayStep) continue;
      const dd = new Date(day);
      const t = zonedToUtc(dd.getUTCFullYear(), dd.getUTCMonth() + 1, dd.getUTCDate(), 0, 0, tz);
      if (t >= t0 && t <= t1) out.push({ t, major: true, label: dtf(tz, { month: "short", day: "numeric" }).format(new Date(t)) });
    }
  }
  const seen = new Set<number>();
  return out.filter((x) => (seen.has(x.t) ? false : (seen.add(x.t), true))).sort((a, b) => a.t - b.t);
}

/** "Nov 3, 9:45 PM EST". */
export function fmtStamp(t: number, tz: string | undefined, seconds = false): string {
  return dtf(tz, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}), timeZoneName: "short" }).format(new Date(t)).replace(",", "");
}

// ---- value formatting ------------------------------------------------------------------------------------------------------

export const fmtVotes = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("en-US"));
export const fmtProb = (pct: number | null | undefined) => (pct == null || !Number.isFinite(pct) ? "—" : pct > 0 && pct < 1 ? "<1%" : pct < 100 && pct > 99 ? ">99%" : `${Math.round(pct)}%`);
export const fmtPp = (pp: number | null | undefined) => (pp == null || !Number.isFinite(pp) ? "—" : `${pp > 0 ? "+" : pp < 0 ? "−" : ""}${Math.abs(pp).toFixed(1)} pp`);

/** "R +1.2" / "D +0.4" / "Even": the lead, named by the side that holds it. */
export function fmtLead(pp: number | null | undefined, ref: { plus: HistoryCandidate; minus: HistoryCandidate } | null): string {
  if (pp == null || !Number.isFinite(pp)) return "—";
  if (Math.abs(pp) < 0.05) return "Even";
  const c = pp > 0 ? ref?.plus : ref?.minus;
  const tag = c?.party && c.party.length <= 3 ? c.party : c ? lastName(c.name) : pp > 0 ? "+" : "−";
  return `${tag} +${Math.abs(pp).toFixed(1)}`;
}
