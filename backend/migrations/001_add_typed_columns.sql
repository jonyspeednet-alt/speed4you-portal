-- Migration 001: Add typed columns to content_catalog
-- Replaces slow payload->>'field' JSONB expressions with indexed typed columns
-- for all frequently filtered and sorted fields.
BEGIN;

-- ── Typed columns ────────────────────────────────────────────────────────────
ALTER TABLE content_catalog
  ADD COLUMN IF NOT EXISTS status           TEXT        NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS content_type     TEXT        NOT NULL DEFAULT 'movie',
  ADD COLUMN IF NOT EXISTS title            TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS title_key        TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS language         TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category         TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS collection       TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_type      TEXT        NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_root_id   TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_scan_run_id TEXT        NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS year             INT,
  ADD COLUMN IF NOT EXISTS rating           NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS featured         BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_order   INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trending_score   INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_count  INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata_status  TEXT        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS published_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at      TIMESTAMPTZ;

-- ── Backfill from JSONB payload ──────────────────────────────────────────────
UPDATE content_catalog SET
  status           = COALESCE(NULLIF(payload->>'status', ''), 'draft'),
  content_type     = COALESCE(NULLIF(payload->>'type', ''), 'movie'),
  title            = COALESCE(payload->>'title', ''),
  title_key        = COALESCE(
                       NULLIF(payload->>'titleKey', ''),
                       LOWER(REGEXP_REPLACE(COALESCE(payload->>'title', ''), '[^a-z0-9 ]', '', 'gi'))
                     ),
  language         = COALESCE(payload->>'language', ''),
  category         = COALESCE(payload->>'category', ''),
  collection       = COALESCE(payload->>'collection', ''),
  source_type      = COALESCE(NULLIF(payload->>'sourceType', ''), 'manual'),
  source_root_id   = COALESCE(payload->>'sourceRootId', ''),
  last_scan_run_id = COALESCE(payload->>'lastScanRunId', ''),
  year             = CASE WHEN (payload->>'year')        ~ '^\d{4}$'         THEN (payload->>'year')::int           ELSE NULL END,
  rating           = CASE WHEN (payload->>'rating')      ~ '^\d+(\.\d+)?$'  THEN LEAST((payload->>'rating')::numeric, 10) ELSE NULL END,
  featured         = COALESCE((payload->>'featured')::boolean, false),
  featured_order   = CASE WHEN (payload->>'featuredOrder')  ~ '^\d+$'        THEN (payload->>'featuredOrder')::int   ELSE 0    END,
  trending_score   = CASE WHEN (payload->>'trendingScore')  ~ '^\d+$'        THEN (payload->>'trendingScore')::int   ELSE 0    END,
  duplicate_count  = CASE WHEN (payload->>'duplicateCount') ~ '^\d+$'        THEN (payload->>'duplicateCount')::int  ELSE 0    END,
  metadata_status  = COALESCE(NULLIF(payload->>'metadataStatus', ''), 'pending'),
  published_at     = CASE WHEN COALESCE(payload->>'publishedAt', '') ~ '^\d{4}-\d{2}-\d{2}' THEN (payload->>'publishedAt')::timestamptz ELSE NULL END,
  released_at      = CASE WHEN COALESCE(payload->>'releasedAt',  '') ~ '^\d{4}-\d{2}-\d{2}' THEN (payload->>'releasedAt')::timestamptz  ELSE NULL END;

-- ── Drop old expression-based indexes ────────────────────────────────────────
DROP INDEX IF EXISTS idx_content_catalog_status;
DROP INDEX IF EXISTS idx_content_catalog_type;
DROP INDEX IF EXISTS idx_content_catalog_genre;
DROP INDEX IF EXISTS idx_content_catalog_language;
DROP INDEX IF EXISTS idx_content_catalog_collection;
DROP INDEX IF EXISTS idx_content_catalog_duplicates;

-- ── Fast B-tree indexes on typed columns ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cc_status            ON content_catalog(status);
CREATE INDEX IF NOT EXISTS idx_cc_content_type      ON content_catalog(content_type);
CREATE INDEX IF NOT EXISTS idx_cc_status_type       ON content_catalog(status, content_type);
CREATE INDEX IF NOT EXISTS idx_cc_language          ON content_catalog(language);
CREATE INDEX IF NOT EXISTS idx_cc_source            ON content_catalog(source_type, source_root_id);
CREATE INDEX IF NOT EXISTS idx_cc_last_scan_run_id  ON content_catalog(last_scan_run_id) WHERE last_scan_run_id <> '';
CREATE INDEX IF NOT EXISTS idx_cc_year              ON content_catalog(year);
CREATE INDEX IF NOT EXISTS idx_cc_rating            ON content_catalog(rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_cc_trending          ON content_catalog(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_cc_featured          ON content_catalog(featured_order DESC, id DESC) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_cc_metadata_status   ON content_catalog(metadata_status);
CREATE INDEX IF NOT EXISTS idx_cc_title_key         ON content_catalog(title_key);
CREATE INDEX IF NOT EXISTS idx_cc_published_at      ON content_catalog(published_at DESC NULLS LAST);

COMMIT;
