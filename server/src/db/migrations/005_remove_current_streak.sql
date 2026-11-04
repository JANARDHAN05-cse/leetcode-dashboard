-- Migration: 005_remove_current_streak.sql
-- Description: Completely remove current_streak column and its index from users table

DROP INDEX IF EXISTS idx_users_current_streak;

ALTER TABLE users
  DROP COLUMN IF EXISTS current_streak;

