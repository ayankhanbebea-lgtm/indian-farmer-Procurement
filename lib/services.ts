import { getDb, newId, nowIso } from "./db";
import { getTodayIST, normalizeDateToYMD } from "./format";

// Standard daily slots configured for each procurement centre
const STANDARD_SLOT_WINDOWS = [
  { startTime: "09:00", endTime: "11:00", capacity: 40 },
  { startTime: "11:00", endTime: "13:00", capacity: 40 },
  { startTime: "14:00", endTime: "16:00", capacity: 40 },
];

/**
 * Ensures standard slots exist in the database for all active centres on a given date.
 */
export function ensureSlotsForDate(rawDate?: string) {
  const date = normalizeDateToYMD(rawDate);
  const db = getDb();

  const centres = db.prepare(`SELECT id FROM procurement_centres`).all() as { id: string }[];
  
  for (const centre of centres) {
    const existing = (
      db.prepare(`SELECT COUNT(*) as c FROM slots WHERE centre_id = ? AND date = ?`).get(centre.id, date) as { c: number }
    ).c;
    
    if (existing === 0) {
      for (const win of STANDARD_SLOT_WINDOWS) {
        db.prepare(
          `INSERT OR IGNORE INTO slots (id, centre_id, date, start_time, end_time, capacity) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(newId("slt_"), centre.id, date, win.startTime, win.endTime, win.capacity);
      }
    }
  }
}

// ---------- Token generation (server-side, globally collision-safe per crop) ----------
export function generateToken(cropCode: string, centreId?: string, date?: string): { token: string; seq: number } {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(token_seq), 0) as m FROM bookings
       WHERE crop_id IN (SELECT id FROM crops WHERE code = ?)`
    )
    .get(cropCode) as { m: number };
  const seq = Math.max(row.m + 1, 100);
  const token = `${cropCode}-${String(seq).padStart(4, "0")}`;
  return { token, seq };
}

// ---------- Queue ----------
export function nextQueuePosition(centreId: string, rawDate?: string): number {
  const date = normalizeDateToYMD(rawDate);
  const db = getDb();
  const row = db
    .prepare(`SELECT COALESCE(MAX(position), 0) as m FROM queue_entries WHERE centre_id = ? AND date = ?`)
    .get(centreId, date) as { m: number };
  return row.m + 1;
}

export function farmersAhead(centreId: string, rawDate: string, position: number): number {
  const date = normalizeDateToYMD(rawDate);
  const db = getDb();
  // "Ahead" = queue entries on the same date with a lower position whose booking is still active
  // (i.e. not completed, cancelled, or marked no-show).
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM queue_entries q
       JOIN bookings b ON q.booking_id = b.id
       WHERE q.centre_id = ? AND q.date = ? AND q.position < ?
       AND b.status NOT IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED','CANCELLED','NO_SHOW')`
    )
    .get(centreId, date, position) as { c: number };
  return row.c;
}

export function estimateWaitMinutes(centreId: string, farmersAheadCount: number): number {
  const db = getDb();
  const centre = db.prepare(`SELECT avg_service_time_mins FROM procurement_centres WHERE id = ?`).get(centreId) as
    | { avg_service_time_mins: number }
    | undefined;
  const avg = centre?.avg_service_time_mins ?? 5;
  return Math.max(0, farmersAheadCount * avg);
}

export function currentlyServingToken(centreId: string, rawDate?: string): string | null {
  const date = normalizeDateToYMD(rawDate);
  const db = getDb();
  // 1. Prefer farmer actively being processed (WEIGHING, PROCUREMENT_IN_PROGRESS, VERIFIED, ARRIVED)
  const inProgress = db
    .prepare(
      `SELECT b.token FROM queue_entries q JOIN bookings b ON q.booking_id = b.id
       WHERE q.centre_id = ? AND q.date = ?
       AND b.status IN ('WEIGHING','PROCUREMENT_IN_PROGRESS','VERIFIED','ARRIVED')
       ORDER BY q.called_at DESC, q.position ASC LIMIT 1`
    )
    .get(centreId, date) as { token: string } | undefined;
  if (inProgress?.token) return inProgress.token;

  // 2. Otherwise, the most recently called booking that is not terminal
  const called = db
    .prepare(
      `SELECT b.token FROM queue_entries q JOIN bookings b ON q.booking_id = b.id
       WHERE q.centre_id = ? AND q.date = ? AND q.called_at IS NOT NULL
       AND b.status NOT IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED','CANCELLED','NO_SHOW')
       ORDER BY q.called_at DESC LIMIT 1`
    )
    .get(centreId, date) as { token: string } | undefined;
  return called?.token ?? null;
}

export type CentreLoadInfo = {
  totalCapacity: number;
  bookedCount: number;
  availableCapacity: number;
  waiting: number;
  load: "LOW_LOAD" | "NORMAL" | "BUSY" | "HIGH_LOAD";
  estimatedWaitMins: number;
};

export function centreLoad(centreId: string, rawDate?: string): CentreLoadInfo {
  const date = normalizeDateToYMD(rawDate);
  const db = getDb();
  ensureSlotsForDate(date);


  const centre = db.prepare(`SELECT high_load_threshold, avg_service_time_mins, daily_capacity FROM procurement_centres WHERE id = ?`).get(centreId) as
    | { high_load_threshold: number; avg_service_time_mins: number; daily_capacity: number }
    | undefined;
  const threshold = centre?.high_load_threshold ?? 50;
  const avgServiceTime = centre?.avg_service_time_mins ?? 5;

  // Total slot capacity for that centre on that date
  const capRow = db
    .prepare(`SELECT COALESCE(SUM(capacity), 120) as totalCap FROM slots WHERE centre_id = ? AND date = ?`)
    .get(centreId, date) as { totalCap: number };
  const totalCapacity = capRow?.totalCap || (centre?.daily_capacity ?? 120);

  // Confirmed non-cancelled bookings on this date
  const bookedRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       WHERE b.centre_id = ? AND s.date = ? AND b.status != 'CANCELLED'`
    )
    .get(centreId, date) as { c: number };
  const bookedCount = bookedRow.c;
  const availableCapacity = Math.max(0, totalCapacity - bookedCount);

  // Currently waiting farmers in active queue on that date
  const waitingRow = db
    .prepare(
      `SELECT COUNT(*) as c FROM queue_entries q JOIN bookings b ON q.booking_id = b.id
       WHERE q.centre_id = ? AND q.date = ?
       AND b.status NOT IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED','CANCELLED','NO_SHOW')`
    )
    .get(centreId, date) as { c: number };
  const waiting = waitingRow.c;
  const estimatedWaitMins = waiting * avgServiceTime;

  let load: "LOW_LOAD" | "NORMAL" | "BUSY" | "HIGH_LOAD" = "LOW_LOAD";
  if (waiting >= threshold) load = "HIGH_LOAD";
  else if (waiting >= threshold * 0.6) load = "BUSY";
  else if (waiting >= threshold * 0.25) load = "NORMAL";

  return { totalCapacity, bookedCount, availableCapacity, waiting, load, estimatedWaitMins };
}

// ---------- Notifications (in-app; abstraction point for a real SMS/WhatsApp gateway) ----------
export function sendNotification(userId: string, type: string, message: string, bookingId?: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO notifications (id, user_id, booking_id, type, message, read, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(newId("ntf_"), userId, bookingId ?? null, type, message, nowIso());
}

// ---------- Audit log ----------
export function recordAudit(userId: string, action: string, entity: string, entityId?: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(newId("aud_"), userId, action, entity, entityId ?? null, nowIso());
}

// ---------- Smart centre recommendation (deterministic, rule-based from real database metrics) ----------
export type CentreOption = {
  id: string;
  name: string;
  code: string;
  district: string;
  distanceKm: number;
  totalCapacity: number;
  availableCapacity: number;
  waiting: number;
  load: "LOW_LOAD" | "NORMAL" | "BUSY" | "HIGH_LOAD";
  estimatedWaitMins: number;
};

export function rankCentres(rawDate?: string): (CentreOption & { score: number; reason: string })[] {
  const date = normalizeDateToYMD(rawDate);
  const db = getDb();
  ensureSlotsForDate(date);

  const centres = db.prepare(`SELECT id, name, code, district, distance_km FROM procurement_centres ORDER BY name`).all() as {
    id: string;
    name: string;
    code: string;
    district: string;
    distance_km: number | null;
  }[];

  const defaultDistances: Record<string, number> = {
    JPR01: 12,
    JPR02: 8,
    JPR03: 15,
  };

  const options = centres.map((c) => {
    const { totalCapacity, availableCapacity, waiting, load, estimatedWaitMins } = centreLoad(c.id, date);
    const distanceKm = c.distance_km ?? (defaultDistances[c.code] || 10);
    
    // Rule-based score: lower waiting queue + lower wait time + available capacity = higher rank
    const score = waiting * 2 + estimatedWaitMins + (availableCapacity === 0 ? 1000 : 0);
    let reason = "Shortest queue and fastest available slot.";
    if (availableCapacity === 0) reason = "Capacity reached for this date.";
    else if (load === "HIGH_LOAD") reason = "High queue right now — expect longer wait.";
    else if (load === "BUSY") reason = "Moderate waiting queue.";
    else if (waiting === 0) reason = "No waiting queue — immediate service available.";

    return {
      id: c.id,
      name: c.name,
      code: c.code,
      district: c.district,
      distanceKm,
      totalCapacity,
      availableCapacity,
      waiting,
      load,
      estimatedWaitMins,
      score,
      reason,
    };
  });

  return options.sort((a, b) => a.score - b.score);
}

/**
 * Returns available slots for a given centre and date with real calculated remaining capacities.
 */
export function getSlotAvailability(centreId: string, rawDate?: string) {
  const date = normalizeDateToYMD(rawDate);
  const db = getDb();
  ensureSlotsForDate(date);

  const rawSlots = db
    .prepare(
      `SELECT id, start_time as startTime, end_time as endTime, capacity
       FROM slots WHERE centre_id = ? AND date = ? ORDER BY start_time`
    )
    .all(centreId, date) as { id: string; startTime: string; endTime: string; capacity: number }[];

  return rawSlots.map((s) => {
    const booked = (
      db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE slot_id = ? AND status != 'CANCELLED'`).get(s.id) as {
        c: number;
      }
    ).c;
    const remaining = Math.max(0, s.capacity - booked);
    return {
      ...s,
      bookedCount: booked,
      remaining,
      isFull: remaining <= 0,
    };
  });
}

/**
 * Cancel a farmer's active booking.
 */
export function cancelBooking(bookingId: string, farmerId: string, sessionUserId: string): { ok: boolean; error?: string } {
  const db = getDb();
  const booking = db
    .prepare(`SELECT id, status, farmer_id as farmerId, token FROM bookings WHERE id = ?`)
    .get(bookingId) as { id: string; status: string; farmerId: string; token: string } | undefined;

  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.farmerId !== farmerId) return { ok: false, error: "Unauthorized access to this booking." };

  if (["PROCUREMENT_COMPLETED", "PAYMENT_PROCESSING", "PAYMENT_COMPLETED", "CANCELLED"].includes(booking.status)) {
    return { ok: false, error: `Cannot cancel a booking with status ${booking.status.replaceAll("_", " ")}.` };
  }

  try {
    db.exec("BEGIN");
    db.prepare(`UPDATE bookings SET status = 'CANCELLED', updated_at = ? WHERE id = ?`).run(nowIso(), bookingId);
    db.exec("COMMIT");

    sendNotification(
      sessionUserId,
      "BOOKING_CANCELLED",
      `Your booking with token ${booking.token} has been cancelled.`,
      bookingId
    );
    recordAudit(sessionUserId, "BOOKING_CANCELLED", "booking", bookingId);

    return { ok: true };
  } catch {
    db.exec("ROLLBACK");
    return { ok: false, error: "Failed to cancel booking. Please try again." };
  }
}

// ---------- Waiting time / congestion insight for admin (from real database data) ----------
export function adminOverview() {
  const db = getDb();
  const totalFarmers = (db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'FARMER'`).get() as { c: number }).c;
  const totalStaff = (db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'STAFF'`).get() as { c: number }).c;
  const totalCentres = (db.prepare(`SELECT COUNT(*) as c FROM procurement_centres`).get() as { c: number }).c;
  const today = getTodayIST();
  ensureSlotsForDate(today);


  const todaysBookings = (
    db.prepare(`SELECT COUNT(*) as c FROM slots s JOIN bookings b ON b.slot_id = s.id WHERE s.date = ? AND b.status != 'CANCELLED'`).get(today) as {
      c: number;
    }
  ).c;
  const activeQueues = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM queue_entries q JOIN bookings b ON q.booking_id = b.id
         WHERE q.date = ? AND b.status NOT IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED','CANCELLED','NO_SHOW')`
      )
      .get(today) as { c: number }
  ).c;
  const completed = (
    db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED')`).get() as {
      c: number;
    }
  ).c;
  const pendingPayments = (
    db.prepare(`SELECT COUNT(*) as c FROM payments WHERE status IN ('PENDING','PROCESSING')`).get() as { c: number }
  ).c;
  const cancelled = (db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status IN ('CANCELLED','NO_SHOW')`).get() as {
    c: number;
  }).c;
  const totalBookings = (db.prepare(`SELECT COUNT(*) as c FROM bookings`).get() as { c: number }).c;
  const noShowRate = totalBookings ? Math.round((cancelled / totalBookings) * 1000) / 10 : 0;

  const centres = db.prepare(`SELECT id, name, code, district FROM procurement_centres ORDER BY name`).all() as {
    id: string;
    name: string;
    code: string;
    district: string;
  }[];
  const centreStatus = centres.map((c) => ({ ...c, ...centreLoad(c.id, today) }));

  return { totalFarmers, totalStaff, totalCentres, todaysBookings, activeQueues, completed, pendingPayments, noShowRate, centreStatus, today };
}
