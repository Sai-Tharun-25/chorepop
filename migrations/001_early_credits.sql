PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS skip_credits (
  chore_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL,
  PRIMARY KEY (chore_id, member_id),
  FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS early_completions (
  id TEXT PRIMARY KEY,
  chore_id TEXT,
  chore_title TEXT NOT NULL,
  member_id TEXT,
  member_name TEXT NOT NULL,
  done_at INTEGER NOT NULL,
  FOREIGN KEY (chore_id) REFERENCES chores(id) ON DELETE SET NULL,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_early_done ON early_completions(done_at DESC);
