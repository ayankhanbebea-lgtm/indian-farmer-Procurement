import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "./migrate";

// Prototype data layer: SQLite via Node's built-in node:sqlite module.
// See prisma/schema.sql for the canonical schema (kept in the prisma/ dir
// for continuity with the intended Supabase/Postgres migration path).
//
// To move to Supabase/Postgres later: replace this file with a
// @supabase/supabase-js or `pg` client and keep the same exported function
// names (getDb, query helpers) so callers don't change.

declare global {
  // eslint-disable-next-line no-var
  var __procurementDb: DatabaseSync | undefined;
}

function initSchema(db: DatabaseSync) {
  const possiblePaths = [
    path.join(process.cwd(), "prisma", "schema.sql"),
    path.join(__dirname, "..", "prisma", "schema.sql"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const sql = fs.readFileSync(p, "utf-8");
        db.exec(sql);
        return;
      } catch {}
    }
  }
}

function ensureBaselineData(db: DatabaseSync) {
  try {
    const userCount = (db.prepare(`SELECT count(*) as c FROM users`).get() as any)?.c || 0;
    if (userCount > 0) return; // Already initialized; never overwrite existing data

    console.log("[Database] Fresh database detected. Initializing baseline centres, slots, and accounts...");

    // 1. Centres
    const centreDefs = [
      { name: "Jaipur Procurement Centre 01", code: "JPR01", district: "Jaipur", distance: 12, avg: 4, threshold: 60, capacity: 120, location: "Sitapura Industrial Area, Jaipur, Rajasthan" },
      { name: "Jaipur Procurement Centre 02", code: "JPR02", district: "Jaipur", distance: 8, avg: 5, threshold: 20, capacity: 120, location: "Sanganer Mandi, Jaipur, Rajasthan" },
      { name: "Jaipur Procurement Centre 03", code: "JPR03", district: "Jaipur", distance: 15, avg: 6, threshold: 15, capacity: 120, location: "Chaksu Road, Jaipur, Rajasthan" },
    ];
    const centreIds: Record<string, string> = {};
    for (const c of centreDefs) {
      const existing = db.prepare(`SELECT id FROM procurement_centres WHERE code = ?`).get(c.code) as any;
      if (existing) {
        centreIds[c.code] = existing.id;
      } else {
        const id = newId("ctr_");
        centreIds[c.code] = id;
        db.prepare(
          `INSERT INTO procurement_centres (id, name, code, district, distance_km, daily_capacity, avg_service_time_mins, high_load_threshold, open_time, close_time, created_at, active, location)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '09:00', '17:00', ?, 1, ?)`
        ).run(id, c.name, c.code, c.district, c.distance, c.capacity, c.avg, c.threshold, nowIso(), c.location);
      }
    }

    // 2. Slots (14 days)
    const today = new Date();
    const dateStr = (d: Date) => d.toISOString().slice(0, 10);
    const windows = [
      ["09:00", "11:00"],
      ["11:00", "13:00"],
      ["14:00", "16:00"],
    ];
    for (const centreCode of Object.keys(centreIds)) {
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        const dStr = dateStr(d);
        for (const [start, end] of windows) {
          try {
            db.prepare(
              `INSERT OR IGNORE INTO slots (id, centre_id, date, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?, 40)`
            ).run(newId("slt_"), centreIds[centreCode], dStr, start, end);
          } catch {}
        }
      }
    }

    // 3. Admin Account
    const adminId = newId("usr_");
    db.prepare(`INSERT OR IGNORE INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'ADMIN', ?, 'en', ?, ?, 1)`).run(
      adminId,
      "9000000001",
      "Administrator",
      nowIso(),
      nowIso()
    );

    // 4. Staff Accounts
    const staffNames = ["Suresh Sharma", "Anita Verma", "Mohit Yadav"];
    let staffPhoneSeq = 9100000001;
    for (let i = 0; i < centreDefs.length; i++) {
      const uid = newId("usr_");
      db.prepare(`INSERT OR IGNORE INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'STAFF', ?, 'en', ?, ?, 1)`).run(
        uid,
        String(staffPhoneSeq++),
        staffNames[i],
        nowIso(),
        nowIso()
      );
      db.prepare(`INSERT OR IGNORE INTO centre_staff (id, user_id, centre_id) VALUES (?, ?, ?)`).run(
        newId("cst_"),
        uid,
        centreIds[centreDefs[i].code]
      );
    }

    // 5. Default Farmers
    const farmerNames = [
      "Ramesh Kumar", "Suman Devi", "Kailash Chand", "Geeta Bai", "Om Prakash",
      "Lakshmi Nagar", "Hari Singh", "Radha Kumari", "Devendra Choudhary", "Kamla Meena"
    ];
    let farmerPhoneSeq = 9200000001;
    for (let i = 0; i < farmerNames.length; i++) {
      const uid = newId("usr_");
      db.prepare(`INSERT OR IGNORE INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'FARMER', ?, 'en', ?, ?, 1)`).run(
        uid,
        String(farmerPhoneSeq++),
        farmerNames[i],
        nowIso(),
        nowIso()
      );
      const fpId = newId("frm_");
      db.prepare(
        `INSERT OR IGNORE INTO farmer_profiles (id, user_id, address, district, state, farmer_code, language, created_at, updated_at) VALUES (?, ?, ?, 'Jaipur', 'Rajasthan', ?, 'en', ?, ?)`
      ).run(fpId, uid, `Village Rd, Ward ${i + 1}, Jaipur`, `FP-${1000 + i}`, nowIso(), nowIso());
    }

    console.log("[Database] Baseline data successfully initialized.");
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
    runMigrations(db);
    try {
      initSchema(db);
    } catch {}
    runMigrations(db);
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
