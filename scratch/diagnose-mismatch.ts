import { getDb } from "../lib/db";

async function diagnoseMismatch() {
  const db = getDb();
  console.log("=== DIAGNOSING DATABASE BOOKINGS & STAFF QUEUE ===");

  // 1. All bookings in database
  const bookings = db.prepare(`
    SELECT b.id, b.token, b.status, b.centre_id, b.farmer_id, b.crop_id, b.slot_id, b.created_at,
           u.name as farmerName, u.phone as farmerPhone,
           c.name as centreName, c.code as centreCode,
           s.date as slotDate, s.start_time as slotStart,
           q.id as queueId, q.date as queueDate, q.position, q.centre_id as queueCentreId
    FROM bookings b
    LEFT JOIN farmer_profiles fp ON b.farmer_id = fp.id
    LEFT JOIN users u ON fp.user_id = u.id
    LEFT JOIN procurement_centres c ON b.centre_id = c.id
    LEFT JOIN slots s ON b.slot_id = s.id
    LEFT JOIN queue_entries q ON q.booking_id = b.id
  `).all();

  console.log(`\n1. Total bookings in database: ${bookings.length}`);
  console.log("   Bookings:", JSON.stringify(bookings, null, 2));

  // 2. All Staff users and their assigned centre IDs
  const staff = db.prepare(`
    SELECT u.id as userId, u.name, u.phone, cs.centre_id as assignedCentreId, pc.name as centreName, pc.code as centreCode
    FROM users u
    JOIN centre_staff cs ON cs.user_id = u.id
    JOIN procurement_centres pc ON cs.centre_id = pc.id
    WHERE u.role = 'STAFF'
  `).all();
  console.log("\n2. Staff assignments:", JSON.stringify(staff, null, 2));

  // 3. Check Today's Date representation
  const now = new Date();
  const utcDate = now.toISOString().slice(0, 10);
  const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  console.log("\n3. Date comparison:");
  console.log(`   UTC Date: ${utcDate}`);
  console.log(`   IST Date: ${istDate}`);

  // 4. Test Staff Queue query for each staff
  for (const s of staff as any[]) {
    const qUTC = db.prepare(`
      SELECT b.id, b.token, b.status, u.name as farmerName
      FROM queue_entries q
      JOIN bookings b ON q.booking_id = b.id
      JOIN farmer_profiles fp ON b.farmer_id = fp.id
      JOIN users u ON fp.user_id = u.id
      WHERE q.centre_id = ? AND q.date = ?
    `).all(s.assignedCentreId, utcDate);

    const qIST = db.prepare(`
      SELECT b.id, b.token, b.status, u.name as farmerName
      FROM queue_entries q
      JOIN bookings b ON q.booking_id = b.id
      JOIN farmer_profiles fp ON b.farmer_id = fp.id
      JOIN users u ON fp.user_id = u.id
      WHERE q.centre_id = ? AND q.date = ?
    `).all(s.assignedCentreId, istDate);

    const qBySlotDate = db.prepare(`
      SELECT b.id, b.token, b.status, u.name as farmerName, s.date as slotDate
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      JOIN farmer_profiles fp ON b.farmer_id = fp.id
      JOIN users u ON fp.user_id = u.id
      WHERE b.centre_id = ?
    `).all(s.assignedCentreId);

    console.log(`\n4. Staff [${s.name}] at [${s.centreName}] (${s.assignedCentreId}):`);
    console.log(`   Query with q.date = UTC (${utcDate}): ${qUTC.length} rows`);
    console.log(`   Query with q.date = IST (${istDate}): ${qIST.length} rows`);
    console.log(`   All bookings for this centre (any date):`, qBySlotDate);
  }
}

diagnoseMismatch().catch(console.error);
