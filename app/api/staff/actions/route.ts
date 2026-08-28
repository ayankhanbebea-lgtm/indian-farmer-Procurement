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
  MARK_ARRIVED: ["BOOKED", "NO_SHOW"],
  VERIFY: ["ARRIVED", "BOOKED"],
  START_WEIGHING: ["ARRIVED", "VERIFIED", "BOOKED"],
  COMPLETE_PROCUREMENT: ["WEIGHING", "ARRIVED", "VERIFIED", "PROCUREMENT_IN_PROGRESS"],
  START_PAYMENT: ["PROCUREMENT_COMPLETED"],
  COMPLETE_PAYMENT: ["PAYMENT_PROCESSING"],
  PAYMENT_FAILED: ["PAYMENT_PROCESSING"],
  SKIP: ["BOOKED", "ARRIVED", "WEIGHING"],
  MARK_NO_SHOW: ["BOOKED", "ARRIVED", "WEIGHING"],
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
  const centre = getStaffCentre(session.id);
  if (!centre) return NextResponse.json({ error: "No centre assigned to this staff account." }, { status: 404 });

  const body = await req.json().catch(() => null);

  const db = getDb();
  const today = getTodayIST();

  if (body?.action === "CALL_NEXT") {
    const targetDate = body?.date && body.date !== "all" ? normalizeDateToYMD(body.date) : null;
    let next = targetDate
      ? (db
          .prepare(
            `SELECT q.id as queueId, b.id as bookingId, b.token FROM queue_entries q JOIN bookings b ON q.booking_id = b.id
             WHERE q.centre_id = ? AND q.date = ? AND q.called_at IS NULL AND b.status = 'BOOKED'
             ORDER BY q.position ASC LIMIT 1`
          )
          .get(centre.id, targetDate) as { queueId: string; bookingId: string; token: string } | undefined)
      : (db
          .prepare(
            `SELECT q.id as queueId, b.id as bookingId, b.token FROM queue_entries q JOIN bookings b ON q.booking_id = b.id
             WHERE q.centre_id = ? AND q.date = ? AND q.called_at IS NULL AND b.status = 'BOOKED'
             ORDER BY q.position ASC LIMIT 1`
          )
          .get(centre.id, today) as { queueId: string; bookingId: string; token: string } | undefined);

    if (!next && !targetDate) {
      // Fallback to earliest active booking at this centre if today's queue is empty
      next = db
        .prepare(
          `SELECT q.id as queueId, b.id as bookingId, b.token FROM queue_entries q JOIN bookings b ON q.booking_id = b.id
           WHERE q.centre_id = ? AND q.called_at IS NULL AND b.status = 'BOOKED'
           ORDER BY q.date ASC, q.position ASC LIMIT 1`
        )
        .get(centre.id) as { queueId: string; bookingId: string; token: string } | undefined;
    }

    if (!next) {
      return NextResponse.json({ error: "No more farmers waiting in the queue." }, { status: 409 });
    }
    db.prepare(`UPDATE queue_entries SET called_at = ? WHERE id = ?`).run(nowIso(), next.queueId);


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

  const farmerUser = db
    .prepare(`SELECT u.id FROM farmer_profiles fp JOIN users u ON fp.user_id = u.id WHERE fp.id = ?`)
    .get(booking.farmerId) as { id: string } | undefined;

  const newStatus = RESULT_STATUS[action] || action;

  try {
    db.exec("BEGIN IMMEDIATE");

    if (action === "COMPLETE_PROCUREMENT") {
      db.prepare(`UPDATE bookings SET status = ?, actual_quantity = ?, quality_grade = ?, remarks = ?, updated_at = ? WHERE id = ?`).run(
        newStatus,
        actualQuantity ?? null,
        qualityGrade ?? null,
        remarks ?? null,
        nowIso(),
        bookingId
      );
      // Ensure a payment row exists, PENDING
      const existingPayment = db.prepare(`SELECT id FROM payments WHERE booking_id = ?`).get(bookingId);
      if (!existingPayment) {
        db.prepare(`INSERT INTO payments (id, booking_id, status, created_at, updated_at) VALUES (?, ?, 'PENDING', ?, ?)`).run(
          newId("pay_"),
          bookingId,
          nowIso(),
          nowIso()
        );
      }
    } else if (action === "START_PAYMENT") {
      db.prepare(`UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, nowIso(), bookingId);
      db.prepare(`UPDATE payments SET status = 'PROCESSING', amount = COALESCE(?, amount), updated_at = ? WHERE booking_id = ?`).run(
        amount ?? null,
        nowIso(),
        bookingId
      );
    } else if (action === "COMPLETE_PAYMENT") {
      db.prepare(`UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, nowIso(), bookingId);
      const ref = `TXN-${booking.token}`;
      db.prepare(`UPDATE payments SET status = 'PAID', reference_no = ?, paid_at = ?, updated_at = ? WHERE booking_id = ?`).run(
        ref,
        nowIso(),
        nowIso(),
        bookingId
      );
    } else if (action === "PAYMENT_FAILED") {
      db.prepare(`UPDATE payments SET status = 'FAILED', updated_at = ? WHERE booking_id = ?`).run(nowIso(), bookingId);
    } else if (action === "SKIP") {
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
    console.error("Staff action error:", e);
    return NextResponse.json({ error: "Queue could not be updated. Please refresh and try again." }, { status: 500 });
  }

  const NOTIF_MESSAGE: Record<string, string> = {
    COMPLETE_PROCUREMENT: "Your crop procurement has been completed.",
    START_PAYMENT: "Your payment is being processed.",
    COMPLETE_PAYMENT: "Your procurement payment has been credited.",
    MARK_NO_SHOW: "You were marked as a no-show for your booked slot.",
  };
  if (farmerUser && NOTIF_MESSAGE[action]) {
    sendNotification(farmerUser.id, action, NOTIF_MESSAGE[action], bookingId);
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

  return NextResponse.json({ ok: true, status: newStatus });
}
