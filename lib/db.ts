import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrate";

// Prototype data layer: SQLite via Node's built-in node:sqlite module.
// Canonical schema resides in prisma/schema.sql.

declare global {
  // eslint-disable-next-line no-var
  var __procurementDb: DatabaseSync | undefined;
}

const FALLBACK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('FARMER','STAFF','ADMIN')),
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS farmer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  address TEXT,
  district TEXT,
  state TEXT NOT NULL DEFAULT 'Rajasthan',
  farmer_code TEXT UNIQUE,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otps (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otps_phone_created ON otps(phone, created_at);

CREATE TABLE IF NOT EXISTS procurement_centres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  district TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  distance_km REAL DEFAULT 10,
  daily_capacity INTEGER NOT NULL DEFAULT 120,
  avg_service_time_mins INTEGER NOT NULL DEFAULT 5,
  high_load_threshold INTEGER NOT NULL DEFAULT 50,
  open_time TEXT NOT NULL DEFAULT '09:00',
  close_time TEXT NOT NULL DEFAULT '17:00',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  active INTEGER NOT NULL DEFAULT 1,
  location TEXT
);

CREATE TABLE IF NOT EXISTS centre_staff (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
  centre_id TEXT NOT NULL REFERENCES procurement_centres(id)
);

CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  msp_rate REAL NOT NULL DEFAULT 2275
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  centre_id TEXT NOT NULL REFERENCES procurement_centres(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 30,
  UNIQUE(centre_id, date, start_time)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmer_profiles(id),
  centre_id TEXT NOT NULL REFERENCES procurement_centres(id),
  crop_id TEXT NOT NULL REFERENCES crops(id),
  slot_id TEXT NOT NULL REFERENCES slots(id),
  quantity_quintal REAL NOT NULL,
  token TEXT UNIQUE NOT NULL,
  token_seq INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN (
    'BOOKED','ARRIVED','VERIFIED','WEIGHING','PROCUREMENT_IN_PROGRESS',
    'PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED','CANCELLED','NO_SHOW'
  )),
  actual_quantity REAL,
  quality_grade TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_bookings_centre_status ON bookings(centre_id, status);

CREATE TABLE IF NOT EXISTS queue_entries (
  id TEXT PRIMARY KEY,
  booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
  centre_id TEXT NOT NULL REFERENCES procurement_centres(id),
  date TEXT NOT NULL,
  position INTEGER NOT NULL,
  called_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_queue_centre_date ON queue_entries(centre_id, date);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT UNIQUE NOT NULL REFERENCES bookings(id),
  token_number TEXT,
  farmer_id TEXT NOT NULL REFERENCES farmer_profiles(id),
  farmer_name TEXT NOT NULL,
  procurement_centre_id TEXT NOT NULL REFERENCES procurement_centres(id),
  crop TEXT NOT NULL,
  final_quantity REAL NOT NULL,
  quantity_unit TEXT NOT NULL DEFAULT 'Quintal',
  rate_per_unit REAL NOT NULL,
  deductions REAL NOT NULL DEFAULT 0,
  final_payable_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  amount REAL,
  account_holder_name TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'BANK_DETAILS_REQUIRED' CHECK (payment_status IN ('BANK_DETAILS_REQUIRED','BANK_DETAILS_SUBMITTED','PENDING','PROCESSING','PAID','FAILED','ON_HOLD')),
  status TEXT DEFAULT 'PENDING',
  payment_method TEXT,
  bank_account_last4 TEXT,
  transaction_reference TEXT,
  transaction_id TEXT,
  reference_no TEXT,
  failure_reason TEXT,
  hold_reason TEXT,
  submitted_at TEXT,
  processed_at TEXT,
  initiated_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_farmer_id ON payments(farmer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_centre ON payments(procurement_centre_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  booking_id TEXT REFERENCES bookings(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
`;

function initSchema(db: DatabaseSync) {
  let applied = false;
  const possiblePaths = [
    path.join(process.cwd(), "prisma", "schema.sql"),
    path.join(__dirname, "..", "prisma", "schema.sql"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const sql = fs.readFileSync(p, "utf-8");
        db.exec(sql);
        applied = true;
        break;
      } catch {}
    }
  }

  // Fallback to embedded schema if file could not be read
  if (!applied) {
    try {
      db.exec(FALLBACK_SCHEMA_SQL);
    } catch (err) {
      console.error("[Database] Error executing fallback schema:", err);
    }
  }
}

/**
 * Idempotent, self-healing baseline data initializer.
 * Checks each entity independently and inserts only missing baseline records.
 * NEVER deletes or overwrites existing user data, bookings, tokens, or payments.
 */
export function ensureBaselineData(db: DatabaseSync) {
  try {
    // 1. Procurement Centres (Idempotent: ensure JPR01, JPR02, JPR03 exist)
    const centreDefs = [
      {
        name: "Jaipur Procurement Centre 01",
        code: "JPR01",
        district: "Jaipur",
        distance: 12,
        avg: 4,
        threshold: 60,
        capacity: 120,
        location: "Sitapura Industrial Area, Jaipur, Rajasthan",
      },
      {
        name: "Jaipur Procurement Centre 02",
        code: "JPR02",
        district: "Jaipur",
        distance: 8,
        avg: 5,
        threshold: 20,
        capacity: 120,
        location: "Sanganer Mandi, Jaipur, Rajasthan",
      },
      {
        name: "Jaipur Procurement Centre 03",
        code: "JPR03",
        district: "Jaipur",
        distance: 15,
        avg: 6,
        threshold: 15,
        capacity: 120,
        location: "Chaksu Road, Jaipur, Rajasthan",
      },
    ];

    const centreIds: Record<string, string> = {};
    for (const c of centreDefs) {
      const existing = db.prepare(`SELECT id FROM procurement_centres WHERE code = ?`).get(c.code) as any;
      if (existing?.id) {
        centreIds[c.code] = existing.id;
        // Ensure active=1 and missing properties are populated
        db.prepare(
          `UPDATE procurement_centres
           SET active = 1,
               location = COALESCE(location, ?),
               district = COALESCE(district, ?),
               daily_capacity = COALESCE(daily_capacity, ?),
               avg_service_time_mins = COALESCE(avg_service_time_mins, ?),
               high_load_threshold = COALESCE(high_load_threshold, ?)
           WHERE id = ?`
        ).run(c.location, c.district, c.capacity, c.avg, c.threshold, existing.id);
      } else {
        const id = newId("ctr_");
        centreIds[c.code] = id;
        db.prepare(
          `INSERT INTO procurement_centres (id, name, code, district, distance_km, daily_capacity, avg_service_time_mins, high_load_threshold, open_time, close_time, created_at, active, location)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '09:00', '17:00', ?, 1, ?)`
        ).run(id, c.name, c.code, c.district, c.distance, c.capacity, c.avg, c.threshold, nowIso(), c.location);
        console.log(`[Database] Inserted missing baseline centre ${c.code} (${c.name})`);
      }
    }

    // 2. Standard Slots for next 14 days across all active centres
    const today = new Date();
    const dateStr = (d: Date) => d.toISOString().slice(0, 10);
    const windows = [
      ["09:00", "11:00"],
      ["11:00", "13:00"],
      ["14:00", "16:00"],
    ];
    const activeCentres = db.prepare(`SELECT id FROM procurement_centres WHERE active = 1`).all() as { id: string }[];
    for (const ctr of activeCentres) {
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dStr = dateStr(d);
        for (const [start, end] of windows) {
          try {
            db.prepare(
              `INSERT OR IGNORE INTO slots (id, centre_id, date, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?, 40)`
            ).run(newId("slt_"), ctr.id, dStr, start, end);
          } catch {}
        }
      }
    }

    // 3. Admin Account (9258879190)
    const admin = db.prepare(`SELECT id FROM users WHERE phone = ?`).get("9258879190") as any;
    if (!admin) {
      const adminId = newId("usr_");
      db.prepare(`INSERT INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'ADMIN', ?, 'en', ?, ?, 1)`).run(
        adminId,
        "9258879190",
        "Administrator",
        nowIso(),
        nowIso()
      );
    } else {
      db.prepare(`UPDATE users SET role = 'ADMIN', active = 1 WHERE id = ?`).run(admin.id);
    }

    // 4. Staff Accounts & Centre Links (Sitapura JPR01, Sanganer JPR02, Chaksu JPR03)
    const staffAccounts = [
      { name: "Suresh Sharma", phone: "9509082087", code: "JPR01" },
      { name: "Anita Verma", phone: "7870844405", code: "JPR02" },
      { name: "Mohit Yadav", phone: "7015962317", code: "JPR03" },
    ];
    for (const staff of staffAccounts) {
      let staffUser = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(staff.phone) as any;
      let uid = staffUser?.id;
      if (!uid) {
        uid = newId("usr_");
        db.prepare(`INSERT INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'STAFF', ?, 'en', ?, ?, 1)`).run(
          uid,
          staff.phone,
          staff.name,
          nowIso(),
          nowIso()
        );
      } else {
        db.prepare(`UPDATE users SET role = 'STAFF', active = 1 WHERE id = ?`).run(uid);
      }

      const targetCentreId = centreIds[staff.code] || (db.prepare(`SELECT id FROM procurement_centres WHERE code = ?`).get(staff.code) as any)?.id;
      if (targetCentreId) {
        const link = db.prepare(`SELECT id FROM centre_staff WHERE user_id = ?`).get(uid) as any;
        if (!link) {
          db.prepare(`INSERT INTO centre_staff (id, user_id, centre_id) VALUES (?, ?, ?)`).run(
            newId("cst_"),
            uid,
            targetCentreId
          );
        } else {
          db.prepare(`UPDATE centre_staff SET centre_id = ? WHERE user_id = ?`).run(targetCentreId, uid);
        }
      }
    }

    // 5. Default Farmer Account (9829124370) & Profile
    let farmerUser = db.prepare(`SELECT id FROM users WHERE phone = ?`).get("9829124370") as any;
    let farmerUid = farmerUser?.id;
    if (!farmerUid) {
      farmerUid = newId("usr_");
      db.prepare(`INSERT INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'FARMER', ?, 'en', ?, ?, 1)`).run(
        farmerUid,
        "9829124370",
        "Ramesh Kumar",
        nowIso(),
        nowIso()
      );
    } else {
      db.prepare(`UPDATE users SET role = 'FARMER', active = 1 WHERE id = ?`).run(farmerUid);
    }

    const farmerProfile = db.prepare(`SELECT id FROM farmer_profiles WHERE user_id = ?`).get(farmerUid) as any;
    if (!farmerProfile) {
      db.prepare(
        `INSERT INTO farmer_profiles (id, user_id, address, district, state, farmer_code, language, created_at, updated_at) VALUES (?, ?, 'Village Rd, Ward 1, Jaipur', 'Jaipur', 'Rajasthan', 'FP-1000', 'en', ?, ?)`
      ).run(newId("frm_"), farmerUid, nowIso(), nowIso());
    }

    // 6. Additional Seed Farmers (for demo history & realistic active tokens)
    const additionalFarmers = [
      { name: "Suman Devi", phone: "9200000002", code: "FP-1001" },
      { name: "Kailash Chand", phone: "9200000003", code: "FP-1002" },
      { name: "Geeta Bai", phone: "9200000004", code: "FP-1003" },
      { name: "Om Prakash", phone: "9200000005", code: "FP-1004" },
    ];
    for (let i = 0; i < additionalFarmers.length; i++) {
      const f = additionalFarmers[i];
      let u = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(f.phone) as any;
      if (!u) {
        const uid = newId("usr_");
        db.prepare(`INSERT INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'FARMER', ?, 'en', ?, ?, 1)`).run(
          uid,
          f.phone,
          f.name,
          nowIso(),
          nowIso()
        );
        db.prepare(
          `INSERT INTO farmer_profiles (id, user_id, address, district, state, farmer_code, language, created_at, updated_at) VALUES (?, ?, ?, 'Jaipur', 'Rajasthan', ?, 'en', ?, ?)`
        ).run(newId("frm_"), uid, `Village Rd, Ward ${i + 2}, Jaipur`, f.code, nowIso(), nowIso());
      }
    }
  } catch (err) {
    console.error("[Database] Error during baseline data check:", err);
  }
}

export function getDb(): DatabaseSync {
  if (!global.__procurementDb) {
    const defaultDbPath = path.join(process.cwd(), "prisma", "dev.db");
    const dbPath = process.env.DATABASE_PATH || defaultDbPath;
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA busy_timeout = 5000;");

    // 1. Initialize schema first to ensure all 13 tables exist
    initSchema(db);
    // 2. Run schema migrations and alterations safely
    runMigrations(db);
    // 3. Ensure baseline centres, slots, accounts, and profile links exist idempotently
    ensureBaselineData(db);

    global.__procurementDb = db;
  }
  return global.__procurementDb;
}

export function newId(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
