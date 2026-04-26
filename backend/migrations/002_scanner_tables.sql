-- Migration 002: Proper relational tables for scanner state
-- Replaces the app_state key-value entries for scanner_roots and scanner_log
-- with dedicated, typed, queryable tables.
BEGIN;

-- ── scanner_roots ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scanner_roots (
  id              TEXT        PRIMARY KEY,
  label           TEXT        NOT NULL DEFAULT '',
  scan_path       TEXT        NOT NULL DEFAULT '',
  public_base_url TEXT        NOT NULL DEFAULT '',
  type            TEXT        NOT NULL DEFAULT 'movie',
  language        TEXT        NOT NULL DEFAULT '',
  category        TEXT        NOT NULL DEFAULT '',
  max_depth       INT,
  batch_size      INT,
  enabled         BOOLEAN     NOT NULL DEFAULT true,
  discovered      BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── scanner_runs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scanner_runs (
  id                      TEXT        PRIMARY KEY,
  status                  TEXT        NOT NULL DEFAULT 'completed',
  started_at              TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  root_ids                JSONB       NOT NULL DEFAULT '[]',
  roots_requested         INT         NOT NULL DEFAULT 0,
  roots_scanned           INT         NOT NULL DEFAULT 0,
  total_created           INT         NOT NULL DEFAULT 0,
  total_updated           INT         NOT NULL DEFAULT 0,
  total_deleted           INT         NOT NULL DEFAULT 0,
  total_unchanged         INT         NOT NULL DEFAULT 0,
  total_duplicate_drafts  INT         NOT NULL DEFAULT 0,
  skipped                 JSONB       NOT NULL DEFAULT '[]',
  errors                  JSONB       NOT NULL DEFAULT '[]',
  root_results            JSONB       NOT NULL DEFAULT '[]',
  error                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scanner_runs_created_at ON scanner_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_runs_status     ON scanner_runs(status);

-- ── Backfill scanner_roots from app_state ────────────────────────────────────
INSERT INTO scanner_roots (
  id, label, scan_path, public_base_url, type, language, category,
  max_depth, batch_size, enabled, discovered, created_at, updated_at
)
SELECT
  r->>'id',
  COALESCE(NULLIF(r->>'label', ''), r->>'id', 'Root'),
  COALESCE(r->>'scanPath', ''),
  COALESCE(r->>'publicBaseUrl', ''),
  COALESCE(NULLIF(r->>'type', ''), 'movie'),
  COALESCE(r->>'language', ''),
  COALESCE(r->>'category', ''),
  CASE WHEN (r->>'maxDepth')   ~ '^\d+$' THEN (r->>'maxDepth')::int   ELSE NULL END,
  CASE WHEN (r->>'batchSize')  ~ '^\d+$' THEN (r->>'batchSize')::int  ELSE NULL END,
  COALESCE((r->>'enabled')::boolean,    true),
  COALESCE((r->>'discovered')::boolean, false),
  NOW(), NOW()
FROM (
  SELECT jsonb_array_elements(value) AS r
  FROM   app_state
  WHERE  key = 'scanner_roots'
) AS src
WHERE r->>'id' IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  label           = EXCLUDED.label,
  scan_path       = EXCLUDED.scan_path,
  public_base_url = EXCLUDED.public_base_url,
  type            = EXCLUDED.type,
  language        = EXCLUDED.language,
  category        = EXCLUDED.category,
  max_depth       = EXCLUDED.max_depth,
  batch_size      = EXCLUDED.batch_size,
  enabled         = EXCLUDED.enabled,
  discovered      = EXCLUDED.discovered,
  updated_at      = NOW();

-- ── Backfill scanner_runs from app_state scanner_log ─────────────────────────
INSERT INTO scanner_runs (
  id, status, started_at, completed_at, root_ids,
  roots_requested, roots_scanned,
  total_created, total_updated, total_deleted, total_unchanged, total_duplicate_drafts,
  skipped, errors, root_results, error, created_at
)
SELECT
  COALESCE(NULLIF(r->>'id', ''), md5(r::text)),
  COALESCE(NULLIF(r->>'status', ''), 'completed'),
  CASE WHEN COALESCE(r->>'startedAt', '')  ~ '^\d{4}-\d{2}-\d{2}' THEN (r->>'startedAt')::timestamptz  ELSE NULL END,
  CASE WHEN COALESCE(r->>'completedAt', '') ~ '^\d{4}-\d{2}-\d{2}' THEN (r->>'completedAt')::timestamptz ELSE NULL END,
  COALESCE(r->'rootIds',     '[]'::jsonb),
  CASE WHEN COALESCE(r->>'rootsRequested', '') ~ '^\d+$' THEN (r->>'rootsRequested')::int ELSE 0 END,
  CASE WHEN COALESCE(r->>'rootsScanned', '') ~ '^\d+$' THEN (r->>'rootsScanned')::int ELSE 0 END,
  CASE WHEN COALESCE(r->>'created', '') ~ '^\d+$' THEN (r->>'created')::int ELSE 0 END,
  CASE WHEN COALESCE(r->>'updated', '') ~ '^\d+$' THEN (r->>'updated')::int ELSE 0 END,
  CASE WHEN COALESCE(r->>'deleted', '') ~ '^\d+$' THEN (r->>'deleted')::int ELSE 0 END,
  CASE WHEN COALESCE(r->>'unchanged', '') ~ '^\d+$' THEN (r->>'unchanged')::int ELSE 0 END,
  CASE WHEN COALESCE(r->>'duplicateDrafts', '') ~ '^\d+$' THEN (r->>'duplicateDrafts')::int ELSE 0 END,
  COALESCE(r->'skipped',     '[]'::jsonb),
  COALESCE(r->'errors',      '[]'::jsonb),
  COALESCE(r->'rootResults', '[]'::jsonb),
  r->>'error',
  COALESCE(
    CASE WHEN COALESCE(r->>'startedAt', '') ~ '^\d{4}-\d{2}-\d{2}' THEN (r->>'startedAt')::timestamptz ELSE NULL END,
    NOW()
  )
FROM (
  SELECT jsonb_array_elements(value->'runs') AS r
  FROM   app_state
  WHERE  key = 'scanner_log'
) AS src
ON CONFLICT (id) DO NOTHING;

COMMIT;
