# Research packages

Every file here is loaded by the protected diagnostics page (`/portal/intelligence`). Files whose names start with `_` or `.` are skipped, so `_template.csv` and `_template.meta.json` are never loaded.

- **JSON:** `{ "meta": { packageId, producer, createdAt, synthetic, baselineSnapshot }, "records": [ ... ] }`. Record keys can be snake_case (the CSV column names) or camelCase. `provenance` and `reportingWindow` objects can be nested.
- **CSV:** one record per row, using the columns in `_template.csv`, plus a sidecar file `<name>.meta.json` that holds the package meta.

Check a package before adding it:

```
npm run intelligence:validate -- data/intelligence/research/<file>.json
npm run intelligence:validate -- data/intelligence/research/<file>.csv
```

A record that breaks a rule is rejected. It is never repaired. Synthetic packages (`"synthetic": true`) are refused here; they belong in `tests/intelligence`.

## Evidence classes

| class | meaning | required |
|---|---|---|
| `VERIFIED` | an official or primary source about **2026** | `source_url`, `retrieved_at`; `historical_year` empty or 2026 |
| `HISTORICAL` | an observation of an **earlier** election | `source_url`, `retrieved_at`, `historical_year` < 2026, `value_kind` OBSERVATION |
| `INFERRED` | an estimate | `value_kind` ESTIMATE, and the basis stated in `limitations` or `notes` |
| `UNKNOWN` | researched but not found | `confidence` NONE and no value |

## Record types

| `record_type` | fields | notes |
|---|---|---|
| `POLL_CLOSE` | `closes_at_utc` | Only a VERIFIED 2026 time is used as a closing time. |
| `REPORTING_WINDOW` | `window_label` or `window_start_min` / `window_end_min`, `sequence_rank`, `share_reported`, `method` | Shown as historical context. Never used as a 2026 schedule. |
| `METHOD_HISTORY` | `method`, `votes` or `share_of_total` | Context only. No method is assumed to favor a party. |
| `TURNOUT_EXPECTATION` | `expected_low`, `expected_high`, optional `expected_central` | A single number is rejected: it has no stated uncertainty. |
| `OUTSTANDING_REPORT` | `outstanding`, `outstanding_status` (CONFIRMED or NOT_YET_ELIGIBLE), `as_of` | Must be VERIFIED. County statements never apply to a House race. |
| `BALLOT_DEADLINE` | `deadline_kind`, `deadline_utc` | |
| `GEO_SPLIT` | `county_fips`, `district_id` (e.g. `PA-07`), `weight`, `weight_basis` | The weights for one county must not add up to more than 1. |

`race_id` uses the forecast ids (`sen-GA`, `gov-AZ`, `house-PA-07`). Leave it empty for a record that applies to the whole state. `jurisdiction_level` is STATE (with `jurisdiction_id` `STATE`), COUNTY (5-digit FIPS), TOWN or DISTRICT.
