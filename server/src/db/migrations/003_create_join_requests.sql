CREATE TABLE IF NOT EXISTS join_requests (
  id                 SERIAL PRIMARY KEY,
  leetcode_username  VARCHAR(30)   NOT NULL,
  display_name       VARCHAR(60)   NULL,
  status             VARCHAR(10)   NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  requested_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  reviewed_at        TIMESTAMPTZ   NULL,
  reviewed_by        INTEGER       NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  rejection_reason   TEXT          NULL
);

CREATE INDEX IF NOT EXISTS idx_join_requests_status   ON join_requests (status);
CREATE INDEX IF NOT EXISTS idx_join_requests_username ON join_requests (leetcode_username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_unique_pending
  ON join_requests (leetcode_username)
  WHERE status = 'pending';

