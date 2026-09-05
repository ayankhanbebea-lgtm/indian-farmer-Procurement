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

  // Ensure all standard crops exist with updated MSP rates
  const standardCrops = [
    { name: "Wheat", code: "WHT", msp_rate: 2275 },
    { name: "Paddy / Rice", code: "RIC", msp_rate: 2300 },
    { name: "Mustard", code: "MUS", msp_rate: 5650 },
    { name: "Bajra", code: "BAJ", msp_rate: 2500 },
    { name: "Maize", code: "MAZ", msp_rate: 2090 },
    { name: "Gram", code: "GRM", msp_rate: 5440 },
    { name: "Groundnut", code: "GND", msp_rate: 6783 },
    { name: "Kharif Pulses", code: "PLS", msp_rate: 7550 },
    { name: "Barley", code: "BAR", msp_rate: 1850 },
  ];

  for (const c of standardCrops) {
    try {
      const existing = db.prepare(`SELECT id FROM crops WHERE code = ?`).get(c.code) as { id: string } | undefined;
      if (!existing) {
        const rand = Math.random().toString(36).slice(2, 10);
        const time = Date.now().toString(36);
        const cropId = `crop_${time}${rand}`;
        db.prepare(`INSERT INTO crops (id, name, code, msp_rate) VALUES (?, ?, ?, ?)`).run(cropId, c.name, c.code, c.msp_rate);
      } else {
        db.prepare(`UPDATE crops SET name = ?, msp_rate = ? WHERE code = ?`).run(c.name, c.msp_rate, c.code);
      }
    } catch {}
  }

  // Add `deductions` column to bookings if missing
  try {
    db.exec(`ALTER TABLE bookings ADD COLUMN deductions REAL DEFAULT 0`);
  } catch {}

  // Migrate payments table columns safely
  const paymentColumns = [
    `ALTER TABLE payments ADD COLUMN token_number TEXT`,
    `ALTER TABLE payments ADD COLUMN farmer_id TEXT REFERENCES farmer_profiles(id)`,
    `ALTER TABLE payments ADD COLUMN farmer_name TEXT`,
    `ALTER TABLE payments ADD COLUMN procurement_centre_id TEXT REFERENCES procurement_centres(id)`,
    `ALTER TABLE payments ADD COLUMN crop TEXT`,
    `ALTER TABLE payments ADD COLUMN final_quantity REAL`,
    `ALTER TABLE payments ADD COLUMN quantity_unit TEXT NOT NULL DEFAULT 'Quintal'`,
    `ALTER TABLE payments ADD COLUMN rate_per_unit REAL`,
    `ALTER TABLE payments ADD COLUMN deductions REAL DEFAULT 0`,
    `ALTER TABLE payments ADD COLUMN final_payable_amount REAL`,
    `ALTER TABLE payments ADD COLUMN total_amount REAL`,
    `ALTER TABLE payments ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'BANK_DETAILS_REQUIRED'`,
    `ALTER TABLE payments ADD COLUMN account_holder_name TEXT`,
    `ALTER TABLE payments ADD COLUMN bank_name TEXT`,
    `ALTER TABLE payments ADD COLUMN account_number TEXT`,
    `ALTER TABLE payments ADD COLUMN ifsc_code TEXT`,
    `ALTER TABLE payments ADD COLUMN upi_id TEXT`,
    `ALTER TABLE payments ADD COLUMN payment_method TEXT`,
    `ALTER TABLE payments ADD COLUMN bank_account_last4 TEXT`,
    `ALTER TABLE payments ADD COLUMN transaction_reference TEXT`,
    `ALTER TABLE payments ADD COLUMN transaction_id TEXT`,
    `ALTER TABLE payments ADD COLUMN failure_reason TEXT`,
    `ALTER TABLE payments ADD COLUMN hold_reason TEXT`,
    `ALTER TABLE payments ADD COLUMN submitted_at TEXT`,
    `ALTER TABLE payments ADD COLUMN processed_at TEXT`,
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

  // Backfill payment_status, crop, rate, final_payable_amount, token_number
  try {
    db.exec(`
      UPDATE payments
      SET
        farmer_id = COALESCE(payments.farmer_id, (SELECT farmer_id FROM bookings WHERE bookings.id = payments.booking_id)),
        procurement_centre_id = COALESCE(payments.procurement_centre_id, (SELECT centre_id FROM bookings WHERE bookings.id = payments.booking_id)),
        crop = COALESCE(payments.crop, (SELECT crops.name FROM bookings JOIN crops ON bookings.crop_id = crops.id WHERE bookings.id = payments.booking_id)),
        final_quantity = COALESCE(payments.final_quantity, (SELECT COALESCE(actual_quantity, quantity_quintal) FROM bookings WHERE bookings.id = payments.booking_id)),
        rate_per_unit = COALESCE(payments.rate_per_unit, (SELECT COALESCE(crops.msp_rate, 2275) FROM bookings JOIN crops ON bookings.crop_id = crops.id WHERE bookings.id = payments.booking_id)),
        token_number = COALESCE(payments.token_number, (SELECT token FROM bookings WHERE bookings.id = payments.booking_id)),
        transaction_reference = COALESCE(transaction_reference, transaction_id, reference_no),
        transaction_id = COALESCE(transaction_id, transaction_reference, reference_no)
      WHERE payments.crop IS NULL OR payments.rate_per_unit IS NULL OR payments.final_quantity IS NULL OR payments.token_number IS NULL
    `);

    db.exec(`
      UPDATE payments
      SET
        final_payable_amount = CASE
          WHEN final_payable_amount IS NOT NULL AND final_payable_amount > 0 THEN final_payable_amount
          ELSE ROUND(COALESCE(final_quantity, 1) * COALESCE(rate_per_unit, 2275) - COALESCE(deductions, 0), 2)
        END,
        total_amount = CASE
          WHEN total_amount IS NOT NULL AND total_amount > 0 THEN total_amount
          ELSE ROUND(COALESCE(final_quantity, 1) * COALESCE(rate_per_unit, 2275) - COALESCE(deductions, 0), 2)
        END
      WHERE final_payable_amount IS NULL OR final_payable_amount = 0
    `);
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

  // Ensure the 5 primary accounts use the updated phone numbers:
  // Farmer: 9829124370
  // Admin: 9258879190
  // Staff Centre 01 (Sitapura): 9509082087 (Suresh)
  // Staff Centre 02 (Sanganer): 7870844405 (Anita)
  // Staff Centre 03 (Chaksu): 7015962317 (Mohit)
  const phoneMappings = [
    { oldPhone: "9000000001", newPhone: "9258879190", role: "ADMIN", name: "Administrator" },
    { oldPhone: "9100000001", newPhone: "9509082087", role: "STAFF", name: "Suresh Sharma", centreCode: "JPR01" },
    { oldPhone: "9100000002", newPhone: "7870844405", role: "STAFF", name: "Anita Verma", centreCode: "JPR02" },
    { oldPhone: "9100000003", newPhone: "7015962317", role: "STAFF", name: "Mohit Yadav", centreCode: "JPR03" },
    { oldPhone: "9200000001", newPhone: "9829124370", role: "FARMER", name: "Ramesh Kumar" },
  ];

  for (const m of phoneMappings) {
    try {
      const oldUser = db.prepare("SELECT id FROM users WHERE phone = ?").get(m.oldPhone) as any;
      const newUser = db.prepare("SELECT id FROM users WHERE phone = ?").get(m.newPhone) as any;
      if (oldUser && !newUser) {
        db.prepare("UPDATE users SET phone = ?, name = ?, role = ? WHERE phone = ?").run(m.newPhone, m.name, m.role, m.oldPhone);
      } else if (oldUser && newUser) {
        // Old user exists and new user was already created separately (e.g. from an ad-hoc signup)
        // Migrate any relations from oldUser to newUser if needed, ensure newUser has correct role & name
        db.prepare("UPDATE users SET role = ?, name = ? WHERE id = ?").run(m.role, m.name, newUser.id);
        // Link centre if staff
        if (m.role === "STAFF" && m.centreCode) {
          const centre = db.prepare("SELECT id FROM procurement_centres WHERE code = ?").get(m.centreCode) as any;
          if (centre) {
            const existingLink = db.prepare("SELECT id FROM centre_staff WHERE user_id = ?").get(newUser.id) as any;
            if (!existingLink) {
              const csId = `cst_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
              db.prepare("INSERT INTO centre_staff (id, user_id, centre_id) VALUES (?, ?, ?)").run(csId, newUser.id, centre.id);
            } else {
              db.prepare("UPDATE centre_staff SET centre_id = ? WHERE user_id = ?").run(centre.id, newUser.id);
            }
          }
        }
        // Remove duplicate oldUser placeholder if its phone is the old dummy number
        db.prepare("DELETE FROM users WHERE id = ?").run(oldUser.id);
      } else if (!oldUser && newUser) {
        db.prepare("UPDATE users SET role = ?, name = ? WHERE id = ?").run(m.role, m.name, newUser.id);
        if (m.role === "STAFF" && m.centreCode) {
          const centre = db.prepare("SELECT id FROM procurement_centres WHERE code = ?").get(m.centreCode) as any;
          if (centre) {
            const existingLink = db.prepare("SELECT id FROM centre_staff WHERE user_id = ?").get(newUser.id) as any;
            if (!existingLink) {
              const csId = `cst_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
              db.prepare("INSERT INTO centre_staff (id, user_id, centre_id) VALUES (?, ?, ?)").run(csId, newUser.id, centre.id);
            }
          }
        }
      } else if (!oldUser && !newUser) {
        const uid = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();
        db.prepare("INSERT INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, ?, ?, 'en', ?, ?, 1)")
          .run(uid, m.newPhone, m.role, m.name, now, now);
        if (m.role === "FARMER") {
          const fpId = `frm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          db.prepare("INSERT OR IGNORE INTO farmer_profiles (id, user_id, address, district, state, farmer_code, language, created_at, updated_at) VALUES (?, ?, 'Village Rd, Jaipur', 'Jaipur', 'Rajasthan', 'FP-1000', 'en', ?, ?)")
            .run(fpId, uid, now, now);
        } else if (m.role === "STAFF" && m.centreCode) {
          const centre = db.prepare("SELECT id FROM procurement_centres WHERE code = ?").get(m.centreCode) as any;
          if (centre) {
            const csId = `cst_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
            db.prepare("INSERT OR IGNORE INTO centre_staff (id, user_id, centre_id) VALUES (?, ?, ?)").run(csId, uid, centre.id);
          }
        }
      }
    } catch {}
  }
}
