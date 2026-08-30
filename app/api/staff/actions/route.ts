import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, newId, nowIso } from "@/lib/db";
import { getStaffCentre } from "@/lib/staff";
import { sendNotification, recordAudit } from "@/lib/services";
import { staffActionSchema } from "@/lib/validation";
import { broadcastRealtimeEvent } from "@/lib/realtime";

import { getTodayIST, normalizeDateToYMD } from "@/lib/format";

// Complete, robust state machine matching real mandi procurement workflow
const TRANSITIONS: Record<string, string[]> = {
  MARK_ARRIVED: ["BOOKED", "NO_SHOW", "ARRIVED"],
  VERIFY: ["ARRIVED", "BOOKED", "VERIFIED"],
  START_WEIGHING: ["ARRIVED", "VERIFIED", "BOOKED", "WEIGHING"],
  COMPLETE_PROCUREMENT: ["WEIGHING", "ARRIVED", "VERIFIED", "PROCUREMENT_IN_PROGRESS", "BOOKED"],
  START_PAYMENT: ["PROCUREMENT_COMPLETED"],
  COMPLETE_PAYMENT: ["PAYMENT_PROCESSING"],
  PAYMENT_FAILED: ["PAYMENT_PROCESSING"],
  SKIP: ["BOOKED", "ARRIVED", "VERIFIED", "WEIGHING", "NO_SHOW"],
  MARK_NO_SHOW: ["BOOKED", "ARRIVED", "VERIFIED", "WEIGHING"],
};

const RESULT_STATUS: Record<string, string> = {
  MARK_ARRIVED: "ARRIVED",
  VERIFY: "VERIFIED",
  START_WEIGHING: "WEIGHING",
  COMPLETE_PROCUREMENT: "PROCUREMENT_COMPLETED",
  START_PAYMENT: "PAYMENT_PROCESSING",
  COMPLETE_PAYMENT: "PAYMENT_COMPLETED",
  PAYMENT_FAILED: "PAYMENT_PROCESSING",
  SKIP: "ARRIVED",
  MARK_NO_SHOW: "NO_SHOW",
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Please login as staff." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const db = getDb();

  let centre = body?.centreId
    ? (db.prepare(`SELECT id, name, code FROM procurement_centres WHERE id = ?`).get(body.centreId) as any)
    : null;
  if (!centre) centre = getStaffCentre(session.id);
  if (!centre) {
    centre = db.prepare(`SELECT id, name, code FROM procurement_centres ORDER BY code ASC LIMIT 1`).get() as any;
  }
  if (!centre) return NextResponse.json({ error: "No centre assigned to this staff account." }, { status: 404 });

  if (body?.action === "CALL_NEXT") {
    const targetDate = body?.date && body.date !== "all" ? normalizeDateToYMD(body.date) : null;

    // Single source of truth query: Select first eligible waiting farmer
    let next = db
      .prepare(
        `SELECT b.id as bookingId, b.token, q.id as queueId, s.date as slotDate
         FROM bookings b
         JOIN slots s ON b.slot_id = s.id
         LEFT JOIN queue_entries q ON q.booking_id = b.id
         WHERE b.centre_id = ?
           AND b.status IN ('BOOKED', 'ARRIVED')
           ${targetDate ? `AND s.date = '${targetDate}'` : ""}
         ORDER BY
           CASE WHEN b.status = 'BOOKED' AND q.called_at IS NULL THEN 0
                WHEN b.status = 'BOOKED' THEN 1
                ELSE 2 END ASC,
           s.date ASC,
           COALESCE(q.position, 999) ASC,
           b.created_at ASC
         LIMIT 1`
      )
      .get(centre.id) as { queueId?: string; bookingId: string; token: string; slotDate: string } | undefined;

    // Fallback: If date filter was applied and was empty, search all upcoming active bookings at this centre
    if (!next && targetDate) {
      next = db
        .prepare(
          `SELECT b.id as bookingId, b.token, q.id as queueId, s.date as slotDate
           FROM bookings b
           JOIN slots s ON b.slot_id = s.id
           LEFT JOIN queue_entries q ON q.booking_id = b.id
           WHERE b.centre_id = ?
             AND b.status IN ('BOOKED', 'ARRIVED')
           ORDER BY
             CASE WHEN b.status = 'BOOKED' AND q.called_at IS NULL THEN 0
                  WHEN b.status = 'BOOKED' THEN 1
                  ELSE 2 END ASC,
             s.date ASC,
             COALESCE(q.position, 999) ASC,
             b.created_at ASC
           LIMIT 1`
        )
        .get(centre.id) as { queueId?: string; bookingId: string; token: string; slotDate: string } | undefined;
    }

    if (!next) {
      return NextResponse.json({ error: "No more farmers waiting in the queue." }, { status: 409 });
    }

    const calledTimestamp = nowIso();
    if (next.queueId) {
      db.prepare(`UPDATE queue_entries SET called_at = ? WHERE id = ?`).run(calledTimestamp, next.queueId);
    } else {
      const newQueueId = newId("q_");
      db.prepare(`INSERT INTO queue_entries (id, booking_id, centre_id, date, position, called_at, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)`)
        .run(newQueueId, next.bookingId, centre.id, next.slotDate, calledTimestamp, calledTimestamp);
    }

    const farmerUser = db
      .prepare(
        `SELECT u.id FROM bookings b JOIN farmer_profiles fp ON b.farmer_id = fp.id JOIN users u ON fp.user_id = u.id WHERE b.id = ?`
      )
      .get(next.bookingId) as { id: string } | undefined;

    if (farmerUser) {
      sendNotification(farmerUser.id, "QUEUE_APPROACHING", `Your token ${next.token} is approaching. Please reach the procurement centre.`, next.bookingId);
    }
    recordAudit(session.id, "CALL_NEXT", "booking", next.bookingId);

    broadcastRealtimeEvent({
      type: "CALL_NEXT",
      centreId: centre.id,
      bookingId: next.bookingId,
      token: next.token,
      status: "CALLED",
    });

    return NextResponse.json({ ok: true, bookingId: next.bookingId, token: next.token });
  }

  const parsed = staffActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid request" }, { status: 400 });
  }
  const { bookingId, action, actualQuantity, qualityGrade, remarks, amount } = parsed.data;

  const booking = db
    .prepare(`SELECT id, status, centre_id as centreId, farmer_id as farmerId, token FROM bookings WHERE id = ?`)
    .get(bookingId) as { id: string; status: string; centreId: string; farmerId: string; token: string } | undefined;

  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.centreId !== centre.id) {
    return NextResponse.json({ error: "This booking does not belong to your centre." }, { status: 403 });
  }

  const allowedFrom = TRANSITIONS[action];
  if (!allowedFrom || !allowedFrom.includes(booking.status)) {
    return NextResponse.json(
      { error: `Cannot move booking ${booking.token} from status ${booking.status.replaceAll("_", " ")} using action ${action}.` },
      { status: 409 }
    );
  }

  const fullBooking = db
    .prepare(
      `SELECT b.id, b.crop_id, b.farmer_id, b.centre_id, b.token,
              c.name as cropName, COALESCE(c.msp_rate, 2275) as cropMsp,
              u.name as farmerName, u.id as farmerUserId
       FROM bookings b
       JOIN crops c ON b.crop_id = c.id
       JOIN farmer_profiles fp ON b.farmer_id = fp.id
       JOIN users u ON fp.user_id = u.id
       WHERE b.id = ?`
    )
    .get(bookingId) as any;

  const newStatus = RESULT_STATUS[action] || action;

  try {
    db.exec("BEGIN IMMEDIATE");

    if (action === "COMPLETE_PROCUREMENT") {
      const finalQuantity = actualQuantity ?? 0;
      const rate = parsed.data.ratePerUnit && parsed.data.ratePerUnit > 0 ? parsed.data.ratePerUnit : (fullBooking?.cropMsp || 2275);
      const deductions = parsed.data.deductions && parsed.data.deductions > 0 ? parsed.data.deductions : 0;
      const finalPayableAmount = Math.max(0, Math.round(((finalQuantity * rate) - deductions) * 100) / 100);

      db.prepare(`UPDATE bookings SET status = ?, actual_quantity = ?, deductions = ?, quality_grade = ?, remarks = ?, updated_at = ? WHERE id = ?`).run(
        newStatus,
        finalQuantity,
        deductions,
        qualityGrade ?? "GRADE_A",
        remarks ?? null,
        nowIso(),
        bookingId
      );

      // Ensure exactly ONE payment record exists, with status BANK_DETAILS_REQUIRED
      const existingPayment = db.prepare(`SELECT id FROM payments WHERE booking_id = ?`).get(bookingId) as any;
      if (!existingPayment) {
        const payId = newId("pay_");
        db.prepare(
          `INSERT INTO payments (
            id, booking_id, token_number, farmer_id, farmer_name, procurement_centre_id,
            crop, final_quantity, quantity_unit, rate_per_unit, deductions, final_payable_amount, total_amount,
            amount, payment_status, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Quintal', ?, ?, ?, ?, ?, 'BANK_DETAILS_REQUIRED', 'PENDING', ?, ?)`
        ).run(
          payId,
          bookingId,
          booking.token,
          fullBooking?.farmer_id || booking.farmerId,
          fullBooking?.farmerName || "Farmer",
          fullBooking?.centre_id || booking.centreId,
          fullBooking?.cropName || "Crop",
          finalQuantity,
          rate,
          deductions,
          finalPayableAmount,
          finalPayableAmount,
          finalPayableAmount,
          nowIso(),
          nowIso()
        );
      } else {
        db.prepare(
          `UPDATE payments SET
            token_number = COALESCE(?, token_number),
            farmer_name = COALESCE(?, farmer_name),
            crop = COALESCE(?, crop),
            final_quantity = ?,
            rate_per_unit = ?,
            deductions = ?,
            final_payable_amount = ?,
            total_amount = ?,
            amount = ?,
            payment_status = 'BANK_DETAILS_REQUIRED',
            updated_at = ?
          WHERE id = ?`
        ).run(
          booking.token,
          fullBooking?.farmerName,
          fullBooking?.cropName,
          finalQuantity,
          rate,
          deductions,
          finalPayableAmount,
          finalPayableAmount,
          finalPayableAmount,
          nowIso(),
          existingPayment.id
        );
      }
    } else if (action === "SKIP") {
      const today = getTodayIST();
      const maxPos = ((db.prepare(`SELECT MAX(position) as m FROM queue_entries WHERE centre_id = ? AND date = ?`).get(booking.centreId, today) as any)?.m || 10);
      db.prepare(`UPDATE queue_entries SET position = ?, called_at = NULL WHERE booking_id = ?`).run(maxPos + 1, bookingId);
      db.prepare(`UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, nowIso(), bookingId);
    } else {
      db.prepare(`UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, nowIso(), bookingId);
    }

    db.exec("COMMIT");
  } catch (e: any) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    console.error("Queue update failed:", {
      action,
      bookingId,
      centreId: centre.id,
      status: newStatus,
      error: e?.message || e,
    });
    return NextResponse.json({ error: e?.message || "Queue could not be updated. Please refresh and try again." }, { status: 500 });
  }

  const NOTIF_MESSAGE: Record<string, string> = {
    COMPLETE_PROCUREMENT: "Your crop procurement has been successfully completed! Please provide your bank account details on your dashboard to receive your payment.",
    MARK_NO_SHOW: "You were marked as a no-show for your booked slot.",
  };
  if (fullBooking?.farmerUserId && NOTIF_MESSAGE[action]) {
    sendNotification(fullBooking.farmerUserId, action, NOTIF_MESSAGE[action], bookingId);
  }
  recordAudit(session.id, action, "booking", bookingId);

  // Broadcast real-time SSE event to all connected dashboards
  broadcastRealtimeEvent({
    type: "STATUS_CHANGED",
    centreId: centre.id,
    farmerId: booking.farmerId,
    bookingId,
    status: newStatus,
  });

  if (action === "COMPLETE_PROCUREMENT") {
    broadcastRealtimeEvent({
      type: "PAYMENT_CREATED",
      centreId: centre.id,
      farmerId: booking.farmerId,
      bookingId,
      paymentStatus: "BANK_DETAILS_REQUIRED",
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
