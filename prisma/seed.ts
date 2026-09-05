import { getDb, newId, nowIso } from "../lib/db";

async function main() {
  const db = getDb();

  console.log("Clearing existing data...");
  const tables = [
    "sessions",
    "otps",
    "audit_logs",
    "notifications",
    "payments",
    "queue_entries",
    "bookings",
    "slots",
    "crops",
    "centre_staff",
    "farmer_profiles",
    "procurement_centres",
    "users",
  ];
  for (const t of tables) db.exec(`DELETE FROM ${t}`);

  const today = new Date();
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  // ---------- Crops ----------
  const crops = [
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
  for (const c of crops) {
    db.prepare(`INSERT INTO crops (id, name, code, msp_rate) VALUES (?, ?, ?, ?)`).run(newId("crop_"), c.name, c.code, c.msp_rate);
  }

  // ---------- Centres ----------
  const centreDefs = [
    { name: "Jaipur Procurement Centre 01", code: "JPR01", district: "Jaipur", distance: 12, avg: 4, threshold: 60, capacity: 120, location: "Sitapura Industrial Area, Jaipur, Rajasthan" },
    { name: "Jaipur Procurement Centre 02", code: "JPR02", district: "Jaipur", distance: 8, avg: 5, threshold: 20, capacity: 120, location: "Sanganer Mandi, Jaipur, Rajasthan" },
    { name: "Jaipur Procurement Centre 03", code: "JPR03", district: "Jaipur", distance: 15, avg: 6, threshold: 15, capacity: 120, location: "Chaksu Road, Jaipur, Rajasthan" },
  ];
  const centreIds: Record<string, string> = {};
  for (const c of centreDefs) {
    const id = newId("ctr_");
    centreIds[c.code] = id;
    db.prepare(
      `INSERT INTO procurement_centres (id, name, code, district, distance_km, daily_capacity, avg_service_time_mins, high_load_threshold, open_time, close_time, created_at, active, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '09:00', '17:00', ?, ?, ?)`
    ).run(id, c.name, c.code, c.district, c.distance, c.capacity, c.avg, c.threshold, nowIso(), 1, c.location);
  }

  // ---------- Slots (14 days window, 3 windows each centre) ----------
  const windows = [
    ["09:00", "11:00"],
    ["11:00", "13:00"],
    ["14:00", "16:00"],
  ];
  const allSeedDates: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    allSeedDates.push(dateStr(d));
  }

  for (const centreCode of Object.keys(centreIds)) {
    for (const dStr of allSeedDates) {
      for (const [start, end] of windows) {
        db.prepare(
          `INSERT INTO slots (id, centre_id, date, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?, 40)`
        ).run(newId("slt_"), centreIds[centreCode], dStr, start, end);
      }
    }
  }

  // ---------- Users: Admin, Staff (one per centre), Farmers ----------
  const adminId = newId("usr_");
  db.prepare(`INSERT INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'ADMIN', ?, 'en', ?, ?, 1)`).run(
    adminId,
    "9258879190",
    "Administrator",
    nowIso(),
    nowIso()
  );

  const staffAccounts = [
    { name: "Suresh Sharma", phone: "9509082087", code: "JPR01" },
    { name: "Anita Verma", phone: "7870844405", code: "JPR02" },
    { name: "Mohit Yadav", phone: "7015962317", code: "JPR03" },
  ];
  for (const staff of staffAccounts) {
    const uid = newId("usr_");
    db.prepare(`INSERT INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'STAFF', ?, 'en', ?, ?, 1)`).run(
      uid,
      staff.phone,
      staff.name,
      nowIso(),
      nowIso()
    );
    db.prepare(`INSERT INTO centre_staff (id, user_id, centre_id) VALUES (?, ?, ?)`).run(
      newId("cst_"),
      uid,
      centreIds[staff.code]
    );
  }

  const farmerNames = [
    "Ramesh Kumar",
    "Suman Devi",
    "Kailash Chand",
    "Geeta Bai",
    "Om Prakash",
    "Lakshmi Nagar",
    "Hari Singh",
    "Radha Kumari",
    "Devendra Choudhary",
    "Kamla Meena",
  ];
  const farmerPhones = [
    "9829124370",
    "9200000002",
    "9200000003",
    "9200000004",
    "9200000005",
    "9200000006",
    "9200000007",
    "9200000008",
    "9200000009",
    "9200000010",
  ];
  for (let i = 0; i < farmerNames.length; i++) {
    const uid = newId("usr_");
    db.prepare(`INSERT INTO users (id, phone, role, name, language, created_at, updated_at, active) VALUES (?, ?, 'FARMER', ?, 'en', ?, ?, 1)`).run(
      uid,
      farmerPhones[i],
      farmerNames[i],
      nowIso(),
      nowIso()
    );
    const fpId = newId("frm_");
    db.prepare(
      `INSERT INTO farmer_profiles (id, user_id, address, district, state, farmer_code, language, created_at, updated_at) VALUES (?, ?, ?, 'Jaipur', 'Rajasthan', ?, 'en', ?, ?)`
    ).run(fpId, uid, `Village Rd, Ward ${i + 1}, Jaipur`, `FP-${1000 + i}`, nowIso(), nowIso());

    // Welcome notifications
    db.prepare(
      `INSERT INTO notifications (id, user_id, booking_id, type, message, read, created_at) VALUES (?, ?, NULL, 'WELCOME', 'Welcome to Smart Procurement. Book a slot to start your procurement visit.', 0, ?)`
    ).run(newId("ntf_"), uid, nowIso());
  }

  console.log("Database initialized with Clean Schema and Zero Bookings.");
  console.log("Registered Accounts:");
  console.log("  Admin: 9258879190");
  console.log("  Staff (JPR01 - Sitapura): 9509082087 (Suresh Sharma)");
  console.log("  Staff (JPR02 - Sanganer): 7870844405 (Anita Verma)");
  console.log("  Staff (JPR03 - Chaksu): 7015962317 (Mohit Yadav)");
  console.log("  Farmer: 9829124370 (Ramesh Kumar)");
  console.log("Bookings: 0 (All bookings must be created through real farmer actions)");
}

main();
