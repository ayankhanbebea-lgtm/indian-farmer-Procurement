import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { sendNotification, recordAudit } from "@/lib/services";
import { adminPaymentActionSchema } from "@/lib/validation";
import { broadcastRealtimeEvent } from "@/lib/realtime";
import { formatCurrency } from "@/lib/format";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized. Please login as Admin." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = adminPaymentActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid request payload." }, { status: 400 });
  }

  const { paymentId, action, paymentMethod, transactionId, bankAccountLast4, upiId, paidAt, failureReason, holdReason } = parsed.data;
  const db = getDb();

  const payment = db.prepare(`
    SELECT
      p.id, p.booking_id as bookingId, p.farmer_id as farmerId, p.farmer_name as farmerName,
      p.procurement_centre_id as centreId, p.crop, p.final_quantity as finalQuantity,
      p.rate_per_unit as ratePerUnit, COALESCE(p.total_amount, p.amount, 0) as totalAmount,
      COALESCE(p.payment_status, p.status, 'PENDING') as paymentStatus,
      b.token, b.status as bookingStatus,
      u.id as farmerUserId, u.name as farmerUserName
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN farmer_profiles fp ON p.farmer_id = fp.id
    JOIN users u ON fp.user_id = u.id
    WHERE p.id = ?
  `).get(paymentId) as any;

  if (!payment) {
    return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
  }

  const currentStatus = payment.paymentStatus;

  if (action === "START_PROCESSING") {
    if (currentStatus !== "PENDING" && currentStatus !== "ON_HOLD") {
      return NextResponse.json({ error: `Cannot start processing a payment that is ${currentStatus}.` }, { status: 409 });
    }

    try {
      db.exec("BEGIN IMMEDIATE");

      db.prepare(`
        UPDATE payments
        SET payment_status = 'PROCESSING', status = 'PROCESSING', initiated_at = COALESCE(initiated_at, ?), updated_at = ?
        WHERE id = ?
      `).run(nowIso(), nowIso(), paymentId);

      db.prepare(`
        UPDATE bookings
        SET status = 'PAYMENT_PROCESSING', updated_at = ?
        WHERE id = ?
      `).run(nowIso(), payment.bookingId);

      db.exec("COMMIT");
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch {}
      return NextResponse.json({ error: "Failed to update payment status." }, { status: 500 });
    }

    sendNotification(
      payment.farmerUserId,
      "PAYMENT_PROCESSING",
      `Your payment of ${formatCurrency(payment.totalAmount)} for token ${payment.token} is now processing for bank disbursement.`,
      payment.bookingId
    );
    recordAudit(session.id, "START_PAYMENT_PROCESSING", "payment", paymentId);

    broadcastRealtimeEvent({
      type: "STATUS_CHANGED",
      centreId: payment.centreId,
      farmerId: payment.farmerId,
      bookingId: payment.bookingId,
      status: "PAYMENT_PROCESSING",
    });
    broadcastRealtimeEvent({
      type: "PAYMENT_UPDATED",
      centreId: payment.centreId,
      farmerId: payment.farmerId,
      bookingId: payment.bookingId,
      paymentId,
      paymentStatus: "PROCESSING",
    });

    return NextResponse.json({ ok: true, status: "PROCESSING" });
  }

  if (action === "MARK_PAID") {
    if (!transactionId || transactionId.trim().length === 0) {
      return NextResponse.json({ error: "Transaction / Reference ID is required to mark payment as Paid." }, { status: 400 });
    }
    if (!paymentMethod) {
      return NextResponse.json({ error: "Payment method is required." }, { status: 400 });
    }

    const payTimestamp = paidAt && !isNaN(new Date(paidAt).getTime()) ? new Date(paidAt).toISOString() : nowIso();

    try {
      db.exec("BEGIN IMMEDIATE");

      db.prepare(`
        UPDATE payments
        SET
          payment_status = 'PAID',
          status = 'PAID',
          payment_method = ?,
          transaction_id = ?,
          reference_no = ?,
          bank_account_last4 = ?,
          upi_id = ?,
          paid_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        paymentMethod,
        transactionId.trim(),
        transactionId.trim(),
        bankAccountLast4 ? bankAccountLast4.trim() : null,
        upiId ? upiId.trim() : null,
        payTimestamp,
        nowIso(),
        paymentId
      );

      db.prepare(`
        UPDATE bookings
        SET status = 'PAYMENT_COMPLETED', updated_at = ?
        WHERE id = ?
      `).run(nowIso(), payment.bookingId);

      db.exec("COMMIT");
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch {}
      return NextResponse.json({ error: "Failed to mark payment as paid." }, { status: 500 });
    }

    sendNotification(
      payment.farmerUserId,
      "PAYMENT_COMPLETED",
      `Payment of ${formatCurrency(payment.totalAmount)} for token ${payment.token} has been successfully transferred via ${paymentMethod} (Txn: ${transactionId.trim()}).`,
      payment.bookingId
    );
    recordAudit(session.id, "ADMIN_MARK_PAID", "payment", paymentId);

    broadcastRealtimeEvent({
      type: "STATUS_CHANGED",
      centreId: payment.centreId,
      farmerId: payment.farmerId,
      bookingId: payment.bookingId,
      status: "PAYMENT_COMPLETED",
    });
    broadcastRealtimeEvent({
      type: "PAYMENT_UPDATED",
      centreId: payment.centreId,
      farmerId: payment.farmerId,
      bookingId: payment.bookingId,
      paymentId,
      paymentStatus: "PAID",
    });

    return NextResponse.json({ ok: true, status: "PAID" });
  }

  if (action === "MARK_FAILED") {
    try {
      db.exec("BEGIN IMMEDIATE");
      db.prepare(`
        UPDATE payments
        SET payment_status = 'FAILED', status = 'FAILED', failure_reason = ?, updated_at = ?
        WHERE id = ?
      `).run(failureReason || "Bank transfer could not be completed.", nowIso(), paymentId);
      db.exec("COMMIT");
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch {}
      return NextResponse.json({ error: "Failed to update payment status." }, { status: 500 });
    }

    sendNotification(
      payment.farmerUserId,
      "PAYMENT_FAILED",
      `Payment processing for token ${payment.token} encountered an issue: ${failureReason || "Verification issue"}. Mandi staff is reviewing.`,
      payment.bookingId
    );
    recordAudit(session.id, "MARK_PAYMENT_FAILED", "payment", paymentId);

    broadcastRealtimeEvent({
      type: "PAYMENT_UPDATED",
      centreId: payment.centreId,
      farmerId: payment.farmerId,
      bookingId: payment.bookingId,
      paymentId,
      paymentStatus: "FAILED",
    });

    return NextResponse.json({ ok: true, status: "FAILED" });
  }

  if (action === "PUT_ON_HOLD") {
    try {
      db.exec("BEGIN IMMEDIATE");
      db.prepare(`
        UPDATE payments
        SET payment_status = 'ON_HOLD', hold_reason = ?, updated_at = ?
        WHERE id = ?
      `).run(holdReason || "Under administrative verification.", nowIso(), paymentId);
      db.exec("COMMIT");
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch {}
      return NextResponse.json({ error: "Failed to put payment on hold." }, { status: 500 });
    }

    recordAudit(session.id, "PUT_PAYMENT_ON_HOLD", "payment", paymentId);

    broadcastRealtimeEvent({
      type: "PAYMENT_UPDATED",
      centreId: payment.centreId,
      farmerId: payment.farmerId,
      bookingId: payment.bookingId,
      paymentId,
      paymentStatus: "ON_HOLD",
    });

    return NextResponse.json({ ok: true, status: "ON_HOLD" });
  }

  if (action === "RESUME_PAYMENT") {
    try {
      db.exec("BEGIN IMMEDIATE");
      db.prepare(`
        UPDATE payments
        SET payment_status = 'PENDING', status = 'PENDING', hold_reason = NULL, failure_reason = NULL, updated_at = ?
        WHERE id = ?
      `).run(nowIso(), paymentId);
      db.exec("COMMIT");
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch {}
      return NextResponse.json({ error: "Failed to resume payment." }, { status: 500 });
    }

    recordAudit(session.id, "RESUME_PAYMENT", "payment", paymentId);

    broadcastRealtimeEvent({
      type: "PAYMENT_UPDATED",
      centreId: payment.centreId,
      farmerId: payment.farmerId,
      bookingId: payment.bookingId,
      paymentId,
      paymentStatus: "PENDING",
    });

    return NextResponse.json({ ok: true, status: "PENDING" });
  }

  return NextResponse.json({ error: "Unsupported payment action." }, { status: 400 });
}
