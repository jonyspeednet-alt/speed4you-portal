-- ISP Entertainment Portal content-store schema
-- Current backend persists the media library as JSONB documents in content_catalog
-- and tracks application-level metadata like nextId in app_state.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS content_catalog (
  id BIGINT PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_state (key, value, updated_at)
VALUES ('catalog_meta', '{"nextId":1}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_state (key, value, updated_at)
VALUES
  ('scanner_roots', '[]'::jsonb, NOW()),
  ('scanner_log', '{"runs":[]}'::jsonb, NOW()),
  ('scanner_state', '{"roots":{}}'::jsonb, NOW()),
  ('scanner_runtime', '{"currentJob":null,"queue":[]}'::jsonb, NOW()),
  ('media_normalizer_log', '{"lines":[]}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, content_type, content_id)
);

CREATE TABLE IF NOT EXISTS watch_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id BIGINT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, content_type, content_id)
);

INSERT INTO admin_users (username, password_hash, role, updated_at)
VALUES ('admin', '$2a$10$ejyljPiCt5J0tvO68DS99OnzyystXkHwgn9pN44txXcxGs/XLlKtK', 'super_admin', NOW())
ON CONFLICT (username) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_content_catalog_updated_at
  ON content_catalog (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_catalog_status
  ON content_catalog ((payload->>'status'));

CREATE INDEX IF NOT EXISTS idx_content_catalog_type
  ON content_catalog ((payload->>'type'));

CREATE INDEX IF NOT EXISTS idx_content_catalog_featured
  ON content_catalog (((payload->>'featured')::boolean))
  WHERE payload ? 'featured';

CREATE INDEX IF NOT EXISTS idx_content_catalog_source
  ON content_catalog ((payload->>'sourceType'), (payload->>'sourceRootId'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_catalog_scan_signature
  ON content_catalog ((payload->>'scanSignature'))
  WHERE payload ? 'scanSignature';

CREATE INDEX IF NOT EXISTS idx_content_catalog_title_trgm
  ON content_catalog
  USING GIN (
    (
      lower(
        coalesce(payload->>'title', '') || ' ' || coalesce(payload->>'originalTitle', '')
      )
    ) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS idx_watchlist_entries_user_created_at
  ON watchlist_entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watch_progress_user_updated_at
  ON watch_progress (user_id, updated_at DESC);
