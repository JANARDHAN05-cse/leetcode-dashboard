-- Migration: 006_multi_community.sql
-- Description: Multi-community architecture with shared LeetCode profiles and scoped memberships

-- 1. Create communities table
CREATE TABLE IF NOT EXISTS communities (
  id                      SERIAL PRIMARY KEY,
  name                    VARCHAR(100) NOT NULL,
  slug                    VARCHAR(100) NOT NULL UNIQUE,
  description             TEXT         NULL,
  owner_id                INTEGER      NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  refresh_interval_hours  INTEGER      NOT NULL DEFAULT 6 CHECK (refresh_interval_hours > 0),
  refresh_concurrency     INTEGER      NOT NULL DEFAULT 3 CHECK (refresh_concurrency > 0),
  status                  VARCHAR(20)  NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'archived')),
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  archived_at             TIMESTAMPTZ  NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_communities_lower_name ON communities (LOWER(name)) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_communities_slug ON communities (slug);

-- 2. Create community_requests table (queue for new community submissions)
CREATE TABLE IF NOT EXISTS community_requests (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  slug              VARCHAR(100) NOT NULL,
  description       TEXT         NULL,
  requester_name    VARCHAR(100) NULL,
  requester_email   VARCHAR(255) NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason  TEXT         NULL,
  reviewed_at       TIMESTAMPTZ  NULL,
  reviewed_by       INTEGER      NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_requests_pending_name ON community_requests (LOWER(name)) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_requests_pending_slug ON community_requests (slug) WHERE status = 'pending';

-- 3. Create community_members table (many-to-many relationship: communities <-> shared user profiles)
CREATE TABLE IF NOT EXISTS community_members (
  id            SERIAL PRIMARY KEY,
  community_id  INTEGER      NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id       INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          VARCHAR(20)  NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  archived_at   TIMESTAMPTZ  NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_members_active ON community_members (community_id, user_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members (community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members (user_id);

-- 4. Create community_member_requests table (requests to add users into specific communities)
CREATE TABLE IF NOT EXISTS community_member_requests (
  id                 SERIAL PRIMARY KEY,
  community_id       INTEGER      NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  leetcode_username  VARCHAR(30)  NOT NULL,
  display_name       VARCHAR(60)  NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason   TEXT         NULL,
  requested_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_at        TIMESTAMPTZ  NULL,
  reviewed_by        INTEGER      NULL REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_mem_req_pending 
  ON community_member_requests (community_id, LOWER(leetcode_username)) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_comm_mem_req_community ON community_member_requests (community_id);

-- 5. Extend admin_users table for roles & community scoping
ALTER TABLE admin_users 
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'platform_admin' 
  CHECK (role IN ('platform_admin', 'community_owner', 'community_moderator'));

ALTER TABLE admin_users 
  ADD COLUMN IF NOT EXISTS community_id INTEGER NULL REFERENCES communities(id) ON DELETE SET NULL;

-- 6. Migrate existing single-community data into default community 'JoyBoys'
INSERT INTO communities (id, name, slug, description, owner_id)
VALUES (
  1,
  'JoyBoys',
  'joyboys',
  'The premier competitive programming leaderboard for LeetCode enthusiasts.',
  1
)
ON CONFLICT (id) DO NOTHING;

-- Advance serial sequence for communities table so new inserts get id > 1
SELECT setval(pg_get_serial_sequence('communities', 'id'), COALESCE(MAX(id), 1)) FROM communities;

-- Migrate all existing non-archived users into JoyBoys community_members
INSERT INTO community_members (community_id, user_id, role, joined_at)
SELECT 1, u.id, 'member', u.created_at
FROM users u
WHERE u.archived_at IS NULL
ON CONFLICT DO NOTHING;

-- Advance serial sequence for community_members table
SELECT setval(pg_get_serial_sequence('community_members', 'id'), COALESCE(MAX(id), 1)) FROM community_members;

-- Migrate existing join_requests into community_member_requests for JoyBoys
INSERT INTO community_member_requests (community_id, leetcode_username, display_name, status, rejection_reason, requested_at, reviewed_at, reviewed_by)
SELECT 1, jr.leetcode_username, jr.display_name, jr.status, jr.rejection_reason, jr.requested_at, jr.reviewed_at, jr.reviewed_by
FROM join_requests jr
ON CONFLICT DO NOTHING;

-- Advance serial sequence for community_member_requests table
SELECT setval(pg_get_serial_sequence('community_member_requests', 'id'), COALESCE(MAX(id), 1)) FROM community_member_requests;

