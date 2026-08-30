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

  // Add `msp_rate` column to crops if missing
  try {
    db.exec(`ALTER TABLE crops ADD COLUMN msp_rate REAL NOT NULL DEFAULT 2275`);
  } catch {}

  // Update default MSP rates for standard crops
  try {
    db.exec(`UPDATE crops SET msp_rate = 2275 WHERE code = 'WHT'`);
    db.exec(`UPDATE crops SET msp_rate = 2300 WHERE code = 'RIC'`);
    db.exec(`UPDATE crops SET msp_rate = 5650 WHERE code = 'MUS'`);
    db.exec(`UPDATE crops SET msp_rate = 2500 WHERE code = 'BAJ'`);
    db.exec(`UPDATE crops SET msp_rate = 2090 WHERE code = 'MAZ'`);
    db.exec(`UPDATE crops SET msp_rate = 5440 WHERE code = 'GRM'`);
  } catch {}

  // Migrate payments table columns safely
  const paymentColumns = [
    `ALTER TABLE payments ADD COLUMN farmer_id TEXT REFERENCES farmer_profiles(id)`,
    `ALTER TABLE payments ADD COLUMN farmer_name TEXT`,
    `ALTER TABLE payments ADD COLUMN procurement_centre_id TEXT REFERENCES procurement_centres(id)`,
    `ALTER TABLE payments ADD COLUMN crop TEXT`,
    `ALTER TABLE payments ADD COLUMN final_quantity REAL`,
    `ALTER TABLE payments ADD COLUMN quantity_unit TEXT NOT NULL DEFAULT 'Quintal'`,
    `ALTER TABLE payments ADD COLUMN rate_per_unit REAL`,
    `ALTER TABLE payments ADD COLUMN total_amount REAL`,
    `ALTER TABLE payments ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PENDING'`,
    `ALTER TABLE payments ADD COLUMN payment_method TEXT`,
    `ALTER TABLE payments ADD COLUMN bank_account_last4 TEXT`,
    `ALTER TABLE payments ADD COLUMN upi_id TEXT`,
    `ALTER TABLE payments ADD COLUMN transaction_id TEXT`,
    `ALTER TABLE payments ADD COLUMN failure_reason TEXT`,
    `ALTER TABLE payments ADD COLUMN hold_reason TEXT`,
    `ALTER TABLE payments ADD COLUMN initiated_at TEXT`,
  ];

  for (const sql of paymentColumns) {
    try {
      db.exec(sql);
    } catch {
      // column already exists
    }
  }

  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_farmer_id ON payments(farmer_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_centre ON payments(procurement_centre_id)`);
  } catch {}

  // Backfill payment_status from status if needed, and sync total_amount with amount
  try {
    db.exec(`UPDATE payments SET payment_status = status WHERE payment_status IS NULL AND status IS NOT NULL`);
    db.exec(`UPDATE payments SET total_amount = amount WHERE total_amount IS NULL AND amount IS NOT NULL`);
    db.exec(`UPDATE payments SET transaction_id = reference_no WHERE transaction_id IS NULL AND reference_no IS NOT NULL`);
  } catch {}

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
