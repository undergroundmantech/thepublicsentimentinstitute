-- OnPoint Politics / PostgreSQL object store v1
-- Target: oop database only. This migration does not access the CFPredictor users database.
-- Run only after verifying current_database() = 'oop'.
-- Idempotent and additive. The richer relational handoff is NOT applied here.

BEGIN;

DO $$
BEGIN
  IF current_database() <> 'oop' THEN
    RAISE EXCEPTION 'Refusing migration: expected database oop, got %', current_database();
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS onpoint;

CREATE TABLE IF NOT EXISTS onpoint.recorder_objects (
    object_key TEXT PRIMARY KEY,
    body BYTEA NOT NULL,
    content_type TEXT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT recorder_object_key_length CHECK (length(object_key) BETWEEN 1 AND 241),
    CONSTRAINT recorder_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$')
);

-- ObjectStore.list(prefix) can use an anchored, escaped LIKE query.
CREATE INDEX IF NOT EXISTS recorder_objects_prefix_idx
    ON onpoint.recorder_objects (object_key text_pattern_ops);

-- Guard the immutable evidence; only heads/ and public/timeline/ (see postgresStore.ts MUTABLE_PREFIXES) can be updated.
CREATE OR REPLACE FUNCTION onpoint.guard_recorder_object_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Recorder evidence cannot be deleted';
  END IF;
  IF OLD.object_key <> NEW.object_key THEN
    RAISE EXCEPTION 'Recorder object keys cannot be changed';
  END IF;
  -- heads and the published timelines are derived and rebuildable; everything else is evidence
  IF OLD.object_key NOT LIKE 'heads/%' AND OLD.object_key NOT LIKE 'public/timeline/%' THEN
    RAISE EXCEPTION 'Immutable recorder evidence cannot be overwritten: %', OLD.object_key;
  END IF;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_recorder_object_mutation ON onpoint.recorder_objects;
CREATE TRIGGER guard_recorder_object_mutation
  BEFORE UPDATE OR DELETE ON onpoint.recorder_objects
  FOR EACH ROW EXECUTE FUNCTION onpoint.guard_recorder_object_mutation();

-- TRUNCATE bypasses row triggers; refuse it too.
CREATE OR REPLACE FUNCTION onpoint.refuse_recorder_truncate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Recorder evidence cannot be truncated';
END $$;

DROP TRIGGER IF EXISTS refuse_recorder_truncate ON onpoint.recorder_objects;
CREATE TRIGGER refuse_recorder_truncate
  BEFORE TRUNCATE ON onpoint.recorder_objects
  FOR EACH STATEMENT EXECUTE FUNCTION onpoint.refuse_recorder_truncate();

-- The stored digest must be the body's digest (also checked again on every read by postgresStore.ts).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recorder_sha256_matches_body' AND conrelid = 'onpoint.recorder_objects'::regclass) THEN
    ALTER TABLE onpoint.recorder_objects ADD CONSTRAINT recorder_sha256_matches_body CHECK (sha256 = encode(sha256(body), 'hex'));
  END IF;
END $$;

COMMIT;

SELECT current_database() AS database_name,
       current_user AS database_user,
       to_regclass('onpoint.recorder_objects') AS recorder_table;
