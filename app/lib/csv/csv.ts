// Emergency CSV export: pure helpers. No I/O, safe on server and client.
// Rules: a missing value is an empty cell, never 0. Text that a spreadsheet could run as a formula is neutralised.
// Rows are CRLF-terminated (RFC 4180) and the file carries a UTF-8 byte-order mark so Excel reads names correctly.

export type CsvValue = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvValue>;

/** Column order for every OnPoint emergency export. One flat table; `record_type` says what a row is. */
export const CSV_COLUMNS = [
  "export_generated_utc", "export_scope", "record_type", "data_class", "is_test_data",
  "race_id", "civic_race_id", "race_name", "state", "office_kind",
  "candidate_id", "candidate_name", "party",
  "votes", "vote_pct", "percent_reporting", "called_winner",
  "win_probability", "projected_margin_pts", "margin_low_pts", "margin_high_pts", "counted_margin_pts", "projected_final_votes",
  "county_or_region", "observed_at_utc", "source_timestamp_utc", "source_label", "model_version", "note",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** RAW_REPORTED: counted by a results provider. MODEL_PROJECTED: our estimate. FORECAST_PREELECTION: published before votes.
 *  HISTORY_*: a recorded observation from the race-history store. EXPORT_NOTE: a disclosure, not data. */
export type DataClass = "RAW_REPORTED" | "MODEL_PROJECTED" | "FORECAST_PREELECTION" | "HISTORY_RESULT" | "HISTORY_MODEL" | "EXPORT_NOTE";

/** One CSV field. Finite numbers print as-is; null, undefined, NaN and Infinity are blank, never 0. */
export function csvCell(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  let s = String(v).replace(/\r\n|\r|\n/g, " ").replace(/\u0000/g, "");
  // formula injection: a cell starting with = + - @ or a tab is evaluated by Excel/Sheets. Prefix an apostrophe so it stays text.
  if (/^[=+\-@\t]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly CsvRow[], columns: readonly string[] = CSV_COLUMNS): string {
  const head = columns.join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(","));
  return [head, ...body].join("\r\n") + "\r\n";
}

/** onpoint-<scope>-20261103T231500Z.csv: scope reduced to a-z0-9-, time in UTC. */
export function csvFilename(scope: string, now: Date = new Date()): string {
  const safe = scope.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export";
  const t = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `onpoint-${safe}-${t}.csv`;
}
