-- OnPoint Politics election archive: DRAFT schema. NOT EXECUTED. NOT REVIEWED FOR THE SHARED SERVER.
--
-- Staging only. Do not run this against any server until server access and this migration are explicitly authorized.
-- Target: a separate OnPoint database on the CFPredictor PostgreSQL server, with its own role, credentials and backups.
-- Nothing here touches, references or grants on any CFPredictor database, role or schema.
--
-- Derived from the code contracts in app/lib/intelligence/{capture,captureStore,captureRunner,checkpointArchive,
-- publicSnapshot,raceHistory,raceHistoryStore,ghRecorder}.ts. See docs/POSTGRES_RECONCILIATION.md.
-- To be reconciled against OnPoint_Politics_Postgres_Schema_Handoff.zip when that file is supplied.
--
-- Conventions
--   vote counts            BIGINT
--   instants               TIMESTAMPTZ, always written in UTC
--   percentages            NUMERIC(7,4), 0-100. Provider "% reporting" and the model's "% of final vote counted" are
--                          separate columns and are never combined.
--   margins                NUMERIC(8,4), percentage points, + = side B (Republican in two-party races), as in the engine
--   records                JSONB: the exact record the code wrote, so a row can be replayed without loss
--   raw provider payloads  BYTEA holding the gzip bytes as stored today (raw/<sha256>.gz); STORAGE EXTERNAL so
--                          PostgreSQL does not try to compress them again
--   internal race id       race_id TEXT, e.g. sen-GA, house-FL-07
--   provider race id       provider + provider_race_id, never stored in race_id

BEGIN;

CREATE SCHEMA IF NOT EXISTS onpoint_raw;
CREATE SCHEMA IF NOT EXISTS onpoint_calc;
CREATE SCHEMA IF NOT EXISTS onpoint_forecast;
CREATE SCHEMA IF NOT EXISTS onpoint_pub;
CREATE SCHEMA IF NOT EXISTS onpoint_ops;

-- ---------------------------------------------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE onpoint_raw.race (
  race_id        TEXT PRIMARY KEY CHECK (race_id ~ '^[a-z]+-[A-Z]{2}(-[0-9A-Z]{1,3})?$'),
  election_id    TEXT NOT NULL,
  kind           TEXT NOT NULL,              -- sen | gov | house | other index kinds
  state          CHAR(2) NOT NULL,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One internal race may map to several provider ids over time (civicAPI numeric id today).
CREATE TABLE onpoint_raw.race_provider_id (
  provider          TEXT NOT NULL,           -- 'civicapi'
  provider_race_id  TEXT NOT NULL,           -- civicId as text; providers differ in id type
  race_id           TEXT NOT NULL REFERENCES onpoint_raw.race(race_id),
  first_seen_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (provider, provider_race_id)
);
CREATE INDEX ON onpoint_raw.race_provider_id (race_id);

-- ---------------------------------------------------------------------------------------------------------------
-- RAW layer: what the provider returned, unmodified
-- ---------------------------------------------------------------------------------------------------------------

-- raw/<sha256>.gz. Content-addressed: an unchanged response is stored once.
CREATE TABLE onpoint_raw.payload (
  sha256         CHAR(64) PRIMARY KEY,       -- of the uncompressed response
  body_gz        BYTEA NOT NULL,
  raw_bytes      BIGINT NOT NULL,            -- uncompressed size
  payload_form   TEXT NOT NULL,
  first_stored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE onpoint_raw.payload ALTER COLUMN body_gz SET STORAGE EXTERNAL;

-- runs/<day>/<compactTime>_<runId>.json  (RunRecord, TPSI_CAPTURE/2)
CREATE TABLE onpoint_raw.capture_run (
  run_id         TEXT PRIMARY KEY,
  trigger        TEXT NOT NULL CHECK (trigger IN ('CRON','MANUAL','PRIMARY')),
  phase          TEXT NOT NULL,
  interval_minutes INTEGER,
  started_at     TIMESTAMPTZ NOT NULL,
  finished_at    TIMESTAMPTZ NOT NULL,
  deadline_hit   BOOLEAN NOT NULL,
  ok             BOOLEAN NOT NULL,
  any_material   BOOLEAN NOT NULL,
  record         JSONB NOT NULL,             -- provider requests, feeds, races, errors, deployment
  checksum       CHAR(64) NOT NULL
);
CREATE INDEX ON onpoint_raw.capture_run (started_at);

-- obs/<raceId>/<compactTime>_<contentId12>.json  (ObservationRecord, TPSI_CAPTURE/2)
CREATE TABLE onpoint_raw.observation (
  observation_id        TEXT PRIMARY KEY,
  content_id            TEXT NOT NULL,
  values_sha256         CHAR(64) NOT NULL,
  election_id           TEXT NOT NULL,
  race_id               TEXT NOT NULL REFERENCES onpoint_raw.race(race_id),
  provider              TEXT NOT NULL,
  provider_race_id      TEXT,
  provider_endpoint     TEXT NOT NULL,       -- no query string, as the code stores it
  state                 CHAR(2) NOT NULL,
  reporting_jurisdiction TEXT,
  test_status           TEXT NOT NULL,
  source_timestamp      TIMESTAMPTZ,         -- provider's own update time; NULL when it gave none
  first_observed_at     TIMESTAMPTZ NOT NULL,
  ingested_at           TIMESTAMPTZ NOT NULL,
  provider_reporting_pct NUMERIC(7,4),       -- provider figure, as published
  provider_reporting_basis TEXT NOT NULL,    -- 'PROVIDER_UNSPECIFIED' today
  official_outstanding_ballots BIGINT,
  jurisdiction_count    INTEGER,
  raw_sha256            CHAR(64) NOT NULL REFERENCES onpoint_raw.payload(sha256),
  run_id                TEXT NOT NULL REFERENCES onpoint_raw.capture_run(run_id),
  record                JSONB NOT NULL,      -- candidates, toplineSides, precincts, votingMethods, observations
  checksum              CHAR(64) NOT NULL,
  UNIQUE (race_id, content_id),
  FOREIGN KEY (provider, provider_race_id) REFERENCES onpoint_raw.race_provider_id(provider, provider_race_id)
);
CREATE INDEX ON onpoint_raw.observation (race_id, first_observed_at);

CREATE TABLE onpoint_raw.observation_candidate (
  observation_id TEXT NOT NULL REFERENCES onpoint_raw.observation(observation_id),
  ordinal        SMALLINT NOT NULL,
  name           TEXT NOT NULL,
  party          TEXT,
  votes          BIGINT NOT NULL CHECK (votes >= 0),
  provider_percent NUMERIC(7,4),
  provider_winner BOOLEAN NOT NULL,
  PRIMARY KEY (observation_id, ordinal)
);

-- feed/<feed>/<compactTime>_<sha12>.json
CREATE TABLE onpoint_raw.feed_delta (
  feed           TEXT NOT NULL,
  observed_at    TIMESTAMPTZ NOT NULL,
  delta_sha12    CHAR(12) NOT NULL,
  changed        INTEGER NOT NULL,
  removed        INTEGER NOT NULL,
  row_count      INTEGER NOT NULL,
  record         JSONB NOT NULL,
  PRIMARY KEY (feed, observed_at, delta_sha12)
);

-- heads/race/<race>.json and heads/feed/<feed>.json: mutable pointers, compare-and-set on checksum
CREATE TABLE onpoint_raw.race_head (
  race_id            TEXT PRIMARY KEY REFERENCES onpoint_raw.race(race_id),
  observation_id     TEXT NOT NULL REFERENCES onpoint_raw.observation(observation_id),
  content_id         TEXT NOT NULL,
  last_confirmed_at  TIMESTAMPTZ NOT NULL,   -- an unchanged reading confirms; it never changes first_observed_at
  checksum           CHAR(64) NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE onpoint_raw.feed_head (
  feed           TEXT PRIMARY KEY,
  head           JSONB NOT NULL,
  checksum       CHAR(64) NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------------------------------------------
-- CALCULATED layer: engine outputs per checkpoint (ONPOINT_CHECKPOINT/1)
-- ---------------------------------------------------------------------------------------------------------------

-- archive/<day>/checkpoints/<checkpointId>.json  (CheckpointManifest)
CREATE TABLE onpoint_calc.checkpoint (
  checkpoint_id      TEXT PRIMARY KEY,       -- <compactTime>_<runId>
  run_id             TEXT NOT NULL REFERENCES onpoint_raw.capture_run(run_id),
  phase              TEXT NOT NULL,
  started_at         TIMESTAMPTZ NOT NULL,
  raw_finished_at    TIMESTAMPTZ NOT NULL,
  archived_at        TIMESTAMPTZ NOT NULL,
  engine_name        TEXT NOT NULL,
  engine_version     TEXT NOT NULL,
  engine_config_sha256 CHAR(64) NOT NULL,
  shadow_model       JSONB,
  raw_status         TEXT NOT NULL CHECK (raw_status IN ('COMPLETE','PARTIAL')),
  publication        TEXT NOT NULL CHECK (publication IN ('CANONICAL','NONE_BROWSER_DESK')),
  complete           BOOLEAN NOT NULL,
  incomplete_reasons TEXT[] NOT NULL DEFAULT '{}',
  record             JSONB NOT NULL,         -- layers, counts, raceHistory, feeds, issues
  checksum           CHAR(64) NOT NULL
);
CREATE INDEX ON onpoint_calc.checkpoint (started_at);

-- RaceCapture.raw (RawSnapshotRef) per checkpoint and race. An UNCHANGED source points at the earlier observation,
-- so its original first_observed_at and freshness carry through.
CREATE TABLE onpoint_calc.checkpoint_source (
  checkpoint_id      TEXT NOT NULL REFERENCES onpoint_calc.checkpoint(checkpoint_id),
  race_id            TEXT NOT NULL REFERENCES onpoint_raw.race(race_id),
  provider_race_id   TEXT,
  outcome            TEXT,                   -- RecordOutcome: NEW | UNCHANGED | ...
  observation_id     TEXT REFERENCES onpoint_raw.observation(observation_id),
  response_sha256    CHAR(64) REFERENCES onpoint_raw.payload(sha256),
  failure            TEXT,
  PRIMARY KEY (checkpoint_id, race_id)
);

-- archive/<day>/calculated/<checkpointId>.jsonl  (CalcRecord)
CREATE TABLE onpoint_calc.calculation (
  calculation_id     TEXT PRIMARY KEY,       -- checkpoint/race/designation/model@version
  checkpoint_id      TEXT NOT NULL REFERENCES onpoint_calc.checkpoint(checkpoint_id),
  race_id            TEXT NOT NULL REFERENCES onpoint_raw.race(race_id),
  provider_race_id   TEXT,
  designation        TEXT NOT NULL CHECK (designation IN ('PUBLIC_ENGINE','SHADOW')),
  classification     TEXT NOT NULL CHECK (classification IN ('CALCULATED_PUBLIC_ENGINE','CALCULATED_SHADOW')),
  observed_at        TIMESTAMPTZ,
  calculated_at      TIMESTAMPTZ,            -- a reused calculation keeps its original time
  model_name         TEXT NOT NULL,
  model_version      TEXT NOT NULL,
  model_config_sha256 CHAR(64) NOT NULL,
  input_sha256       CHAR(64),
  status             TEXT NOT NULL CHECK (status IN ('OK','FAILED','UNAVAILABLE')),
  reason             TEXT,
  reused_from        TEXT REFERENCES onpoint_calc.calculation(calculation_id),
  -- extracted from EngineOutputs for querying; outputs stays the record of truth
  model_completeness_pct  NUMERIC(7,4),      -- MODEL ESTIMATE of the share of the final vote counted
  counted_margin_pp       NUMERIC(8,4),
  expected_final_margin_pp NUMERIC(8,4),
  forecast_margin_pp      NUMERIC(8,4),      -- pre-election forecast margin the engine started from
  reported_total          BIGINT,
  estimated_final_total   BIGINT,
  outputs            JSONB,
  output_sha256      CHAR(64),
  contest            JSONB,                  -- untracked feed contest, recorded as UNAVAILABLE
  CHECK ((designation = 'PUBLIC_ENGINE') = (classification = 'CALCULATED_PUBLIC_ENGINE')),
  UNIQUE (calculation_id, designation)
);
CREATE INDEX ON onpoint_calc.calculation (race_id, checkpoint_id);

-- ---------------------------------------------------------------------------------------------------------------
-- PREDICTIVE FORECASTS: model-output ledger (raceHistoryStore: model/<race>/..., model-shadow/<race>/...)
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE onpoint_forecast.model_output (
  point_id           TEXT PRIMARY KEY,
  race_id            TEXT NOT NULL REFERENCES onpoint_raw.race(race_id),
  source_class       TEXT NOT NULL CHECK (source_class IN ('FROZEN_FORECAST','LIVE_PROJECTION','SHADOW_MODEL')),
  status             TEXT NOT NULL,          -- OFFICIAL | TEST | SYNTHETIC | ...
  model_id           TEXT NOT NULL,
  model_version      TEXT NOT NULL,
  observed_at        TIMESTAMPTZ NOT NULL,
  recorded_at        TIMESTAMPTZ NOT NULL,
  values_sha256      CHAR(64) NOT NULL,
  record             JSONB NOT NULL,         -- winProbability, margin, projectedFinalVotes, reporting, publication, provenance
  checksum           CHAR(64) NOT NULL
);
CREATE INDEX ON onpoint_forecast.model_output (race_id, source_class, observed_at);

CREATE TABLE onpoint_forecast.model_head (
  source_class       TEXT NOT NULL,
  race_id            TEXT NOT NULL REFERENCES onpoint_raw.race(race_id),
  point_id           TEXT NOT NULL REFERENCES onpoint_forecast.model_output(point_id),
  values_sha256      CHAR(64) NOT NULL,
  last_confirmed_at  TIMESTAMPTZ NOT NULL,
  checksum           CHAR(64) NOT NULL,
  PRIMARY KEY (source_class, race_id)
);

-- ---------------------------------------------------------------------------------------------------------------
-- PUBLISHED layer. SHADOW output cannot enter it: every row references a calculation through
-- (calculation_id, designation) with designation fixed to PUBLIC_ENGINE.
-- ---------------------------------------------------------------------------------------------------------------

-- archive/<day>/snapshot/<checkpointId>.jsonl  (SnapshotRecord)
CREATE TABLE onpoint_pub.snapshot_race (
  checkpoint_id      TEXT NOT NULL REFERENCES onpoint_calc.checkpoint(checkpoint_id),
  race_id            TEXT NOT NULL REFERENCES onpoint_raw.race(race_id),
  provider_race_id   TEXT,
  classification     TEXT NOT NULL CHECK (classification IN ('PUBLICATION_READY','PUBLIC_ENGINE_RECOMPUTED_NOT_VERIFIED_PUBLISHED')),
  status             TEXT NOT NULL CHECK (status IN ('OK','UNAVAILABLE')),
  reason             TEXT,
  calculation_id     TEXT NOT NULL,
  designation        TEXT NOT NULL DEFAULT 'PUBLIC_ENGINE' CHECK (designation = 'PUBLIC_ENGINE'),
  calculated_output_sha256 CHAR(64),
  observed_at        TIMESTAMPTZ,
  source_updated_at  TIMESTAMPTZ,
  test_data          BOOLEAN,
  visibility         TEXT CHECK (visibility IN ('SHOWN','SHOWN_AS_TEST','HIDDEN_BEFORE_CLOSE')),
  provider_reporting_pct NUMERIC(7,4),       -- Displayed.providerReportingPct (provider)
  model_completeness_pct NUMERIC(7,4),       -- Displayed.completenessPct (model estimate)
  displayed          JSONB,
  provider_calls     TEXT[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (checkpoint_id, race_id),
  FOREIGN KEY (calculation_id, designation) REFERENCES onpoint_calc.calculation(calculation_id, designation)
);

-- public/snapshots/<day>/<snapshotId>.json  (PublicSnapshotDocument)
CREATE TABLE onpoint_pub.snapshot_document (
  snapshot_id        TEXT PRIMARY KEY,
  checkpoint_id      TEXT NOT NULL REFERENCES onpoint_calc.checkpoint(checkpoint_id),
  document           JSONB NOT NULL,
  document_sha256    CHAR(64) NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL
);

-- archive/<day>/published/<checkpointId>.json  (PublicationEvent). Written only after the canonical head moved.
CREATE TABLE onpoint_pub.publication_event (
  publication_id     TEXT PRIMARY KEY,
  snapshot_id        TEXT NOT NULL REFERENCES onpoint_pub.snapshot_document(snapshot_id),
  checkpoint_id      TEXT NOT NULL REFERENCES onpoint_calc.checkpoint(checkpoint_id),
  published_at       TIMESTAMPTZ NOT NULL,
  delivery           TEXT NOT NULL,
  previous_publication_id TEXT REFERENCES onpoint_pub.publication_event(publication_id),
  record             JSONB NOT NULL,
  checksum           CHAR(64) NOT NULL
);

CREATE TABLE onpoint_pub.publication_race (
  publication_id     TEXT NOT NULL REFERENCES onpoint_pub.publication_event(publication_id),
  race_id            TEXT NOT NULL REFERENCES onpoint_raw.race(race_id),
  provider_race_id   TEXT,
  calculation_id     TEXT NOT NULL,
  designation        TEXT NOT NULL DEFAULT 'PUBLIC_ENGINE' CHECK (designation = 'PUBLIC_ENGINE'),
  calculated_output_sha256 CHAR(64) NOT NULL,
  PRIMARY KEY (publication_id, race_id),
  FOREIGN KEY (calculation_id, designation) REFERENCES onpoint_calc.calculation(calculation_id, designation)
);

-- heads/public-snapshot.json: one row
CREATE TABLE onpoint_pub.public_head (
  id                 BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  snapshot_id        TEXT REFERENCES onpoint_pub.snapshot_document(snapshot_id),
  publication_id     TEXT REFERENCES onpoint_pub.publication_event(publication_id),
  published_at       TIMESTAMPTZ,
  checksum           CHAR(64) NOT NULL
);

-- public/timeline/civic-<civicId>.json, keyed by provider id as the public route is
CREATE TABLE onpoint_pub.timeline_entry (
  provider           TEXT NOT NULL,
  provider_race_id   TEXT NOT NULL,
  publication_id     TEXT NOT NULL REFERENCES onpoint_pub.publication_event(publication_id),
  published_at       TIMESTAMPTZ NOT NULL,
  entry              JSONB NOT NULL,
  PRIMARY KEY (provider, provider_race_id, publication_id)
);

-- ---------------------------------------------------------------------------------------------------------------
-- Operations: scheduler slots, worker leases, health
-- ---------------------------------------------------------------------------------------------------------------

-- slots/<day>/<compactTime>.json (SlotRecord) and the primary recorder's checkpoint slots
CREATE TABLE onpoint_ops.slot (
  recorder           TEXT NOT NULL,          -- 'primary' | 'github'
  slot_at            TIMESTAMPTZ NOT NULL,   -- scheduled instant, UTC
  started_at         TIMESTAMPTZ NOT NULL,
  finished_at        TIMESTAMPTZ,
  delay_seconds      NUMERIC(10,3),
  status             TEXT NOT NULL,
  checkpoint_id      TEXT REFERENCES onpoint_calc.checkpoint(checkpoint_id),
  missed_slots       TIMESTAMPTZ[] NOT NULL DEFAULT '{}',
  record             JSONB NOT NULL,
  PRIMARY KEY (recorder, slot_at)
);

-- One active worker per recorder; a lease that is not renewed lapses so a standby can take over.
CREATE TABLE onpoint_ops.worker_lease (
  recorder           TEXT PRIMARY KEY,
  holder             TEXT NOT NULL,
  acquired_at        TIMESTAMPTZ NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL
);

CREATE TABLE onpoint_ops.health (
  recorder           TEXT PRIMARY KEY,
  updated_at         TIMESTAMPTZ NOT NULL,
  last_slot_at       TIMESTAMPTZ,
  last_status        TEXT,
  last_recorded_slot_at TIMESTAMPTZ,
  record             JSONB NOT NULL
);

COMMIT;

-- Roles (to be created by the server administrator, with credentials issued outside the repository):
--   onpoint_owner   owns the schemas; used only for migrations
--   onpoint_writer  INSERT on raw/calc/forecast/ops; INSERT on pub; UPDATE only on the head tables; no DELETE
--   onpoint_reader  SELECT on onpoint_pub only (site and API)
-- No grant in this file names any CFPredictor object.
