CREATE TABLE IF NOT EXISTS app_settings (
  id                      INTEGER      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  refresh_interval_hours  INTEGER      NOT NULL DEFAULT 6 CHECK (refresh_interval_hours > 0),
  refresh_concurrency     INTEGER      NOT NULL DEFAULT 3 CHECK (refresh_concurrency > 0),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by              INTEGER      NULL REFERENCES admin_users(id) ON DELETE SET NULL
);

INSERT INTO app_settings (id, refresh_interval_hours, refresh_concurrency)
VALUES (1, 6, 3)
ON CONFLICT (id) DO NOTHING;

