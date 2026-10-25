PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  sort_order INTEGER NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chores (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🧹',
  current_member_id TEXT NOT NULL,
  turn_started_at INTEGER NOT NULL,
  last_reminder_at INTEGER,
  completed_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (current_member_id) REFERENCES members(id)
);
CREATE INDEX IF NOT EXISTS idx_chores_member ON chores(current_member_id);
CREATE INDEX IF NOT EXISTS idx_chores_reminder ON chores(turn_started_at, last_reminder_at);

CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  chore_id TEXT,
  chore_title TEXT NOT NULL,
  member_id TEXT,
  member_name TEXT NOT NULL,
  done_at INTEGER NOT NULL,
  FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE SET NULL,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_history_done ON history(done_at DESC);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_push_member ON push_subscriptions(member_id);
