CREATE TABLE IF NOT EXISTS users (
  id                 SERIAL PRIMARY KEY,
  leetcode_username  VARCHAR(30)   NOT NULL UNIQUE,
  display_name       VARCHAR(60)   NULL,
  avatar_url         TEXT          NULL,

  -- Statistics (NULL = unavailable; 0 = confirmed zero)
  solved_total       INTEGER       NULL CHECK (solved_total >= 0),
  solved_easy        INTEGER       NULL CHECK (solved_easy >= 0),
  solved_medium      INTEGER       NULL CHECK (solved_medium >= 0),
  solved_hard        INTEGER       NULL CHECK (solved_hard >= 0),
  contest_rating     NUMERIC(8,2)  NULL,
  contests_attended  INTEGER       NULL CHECK (contests_attended >= 0),
  current_streak     INTEGER       NULL CHECK (current_streak >= 0),

  -- Refresh tracking
  last_attempted_at  TIMESTAMPTZ   NULL,
  last_refreshed_at  TIMESTAMPTZ   NULL,
  fetch_status       VARCHAR(20)   NOT NULL DEFAULT 'pending'
                     CHECK (fetch_status IN ('pending','fetching','ok','error','not_found')),
  last_error         TEXT          NULL,

  -- Lifecycle
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  archived_at        TIMESTAMPTZ   NULL
);

CREATE INDEX IF NOT EXISTS idx_users_archived_at        ON users (archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_fetch_status       ON users (fetch_status);
CREATE INDEX IF NOT EXISTS idx_users_solved_total       ON users (solved_total DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_users_contest_rating     ON users (contest_rating DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_users_contests_attended  ON users (contests_attended DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_users_current_streak     ON users (current_streak DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_users_search             ON users (LOWER(leetcode_username), LOWER(display_name));

