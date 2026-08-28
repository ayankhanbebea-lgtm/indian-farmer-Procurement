import { getDb } from "../lib/db";

async function inspectDb() {
  const db = getDb();
  console.log("=== STEP 1: CURRENT DATABASE STATE ===");

  const users = db.prepare(`SELECT * FROM users`).all();
  console.log("\n[USERS in DB]:", users);

  const centreStaff = db.prepare(`
    SELECT cs.id, cs.user_id, cs.centre_id, u.name as userName, u.phone, pc.name as centreName, pc.code as centreCode
    FROM centre_staff cs
    JOIN users u ON cs.user_id = u.id
    JOIN procurement_centres pc ON cs.centre_id = pc.id
  `).all();
  console.log("\n[CENTRE STAFF ASSIGNMENTS in DB]:", centreStaff);

  const sessions = db.prepare(`
    SELECT s.id, s.user_id, s.token, s.expires_at, u.name, u.phone, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
  `).all();
  console.log("\n[ACTIVE SESSIONS in DB]:", sessions);

  const bookings = db.prepare(`
    SELECT b.id, b.token, b.status, b.centre_id, b.farmer_id, b.crop_id, b.slot_id, b.quantity_quintal,
           u.name as farmerName, u.phone as farmerPhone,
           pc.name as centreName, pc.code as centreCode,
           s.date as slotDate, s.start_time as startTime, s.end_time as endTime
    FROM bookings b
    JOIN farmer_profiles fp ON b.farmer_id = fp.id
    JOIN users u ON fp.user_id = u.id
    JOIN procurement_centres pc ON b.centre_id = pc.id
    JOIN slots s ON b.slot_id = s.id
  `).all();
  console.log("\n[BOOKINGS in DB]:", bookings);
}

inspectDb().catch(console.error);
