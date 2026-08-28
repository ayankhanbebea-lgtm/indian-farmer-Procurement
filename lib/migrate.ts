import { DatabaseSync } from "node:sqlite";

/**
 * Idempotent schema migrations. Called at DB init time.
 * SQLite supports ALTER TABLE ADD COLUMN safely — it's a no-op if column exists.
 */
export function runMigrations(db: DatabaseSync) {
  // Add `active` column to users if missing
  try {
    db.exec(`ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // Column already exists — safe to ignore
  }

  // Add `active` column to procurement_centres if missing
  try {
    db.exec(`ALTER TABLE procurement_centres ADD COLUMN active INTEGER NOT NULL DEFAULT 1`);
  } catch {
    // Column already exists — safe to ignore
  }

  // Add `location` TEXT column to procurement_centres if missing
  try {
    db.exec(`ALTER TABLE procurement_centres ADD COLUMN location TEXT`);
  } catch {
    // Column already exists — safe to ignore
  }

  // Add `name` column for mobileNumber alias if ever needed (already phone in schema)
  // users already has `name` — skip

  // Ensure sessions table is present (created by schema.sql normally)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  } catch { /* ignore */ }
}
