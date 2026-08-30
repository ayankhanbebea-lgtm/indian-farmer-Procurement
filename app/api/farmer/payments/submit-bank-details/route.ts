import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { getFarmerProfileId } from "@/lib/farmer";
import { farmerBankDetailsSchema } from "@/lib/validation";
import { broadcastRealtimeEvent } from "@/lib/realtime";
import { recordAudit } from "@/lib/services";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer to submit bank details." }, { status: 401 });
  }

  const farmerId = getFarmerProfileId(session.id);
  if (!farmerId) {
    return NextResponse.json({ error: "Farmer profile not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = farmerBankDetailsSchema.safeParse(body);
  if (!parsed.success) {
    const firstErr = parsed.error.issues[0]?.message || "Invalid bank details provided.";
    return NextResponse.json({ error: firstErr }, { status: 400 });
  }

  const { bookingId, paymentId, accountHolderName, bankName, accountNumber, ifscCode, upiId } = parsed.data;

  const db = getDb();

  // Find payment and verify farmer ownership
  const payment = db
    .prepare(
      `SELECT p.*, b.status as bookingStatus, b.centre_id as bookingCentreId
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN farmer_profiles fp ON (p.farmer_id = fp.id OR b.farmer_id = fp.id)
       WHERE (p.id = ? OR p.booking_id = ? OR b.id = ?)
         AND (p.farmer_id = ? OR b.farmer_id = ? OR fp.user_id = ?)`
    )
    .get(paymentId, bookingId, bookingId, farmerId, farmerId, session.id) as any;

  if (!payment) {
    return NextResponse.json(
      { error: "Payment record not found or does not belong to your account." },
      { status: 404 }
    );
  }

  if (payment.payment_status === "PAID") {
    return NextResponse.json(
      { error: "This procurement payment has already been disbursed and marked as PAID." },
      { status: 400 }
    );
  }

  const last4 = accountNumber.slice(-4);
  const now = nowIso();

  try {
    db.exec("BEGIN IMMEDIATE");

    db.prepare(
      `UPDATE payments SET
        account_holder_name = ?,
        bank_name = ?,
        account_number = ?,
        ifsc_code = ?,
        upi_id = ?,
        bank_account_last4 = ?,
        payment_status = 'BANK_DETAILS_SUBMITTED',
        submitted_at = ?,
        updated_at = ?
      WHERE id = ?`
    ).run(
      accountHolderName.trim(),
      bankName.trim(),
      accountNumber.trim(),
      ifscCode.trim().toUpperCase(),
      upiId ? upiId.trim() : null,
      last4,
      now,
      now,
      payment.id
    );

    db.exec("COMMIT");
  } catch (err: any) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    console.error("[SubmitBankDetails Error]", err);
    return NextResponse.json({ error: "Failed to save bank details to database." }, { status: 500 });
  }

  console.log("[SubmitBankDetails API Success]", {
    loggedInFarmerId: farmerId,
    paymentId: payment.id,
    bookingId: payment.booking_id,
    status: "BANK_DETAILS_SUBMITTED",
    submittedAt: now,
  });

  recordAudit(session.id, "SUBMIT_BANK_DETAILS", "payment", payment.id);

  // Broadcast real-time event to Admin and Farmer dashboards
  broadcastRealtimeEvent({
    type: "PAYMENT_UPDATED",
    centreId: payment.procurement_centre_id || payment.bookingCentreId,
    farmerId,
    bookingId: payment.booking_id,
    paymentId: payment.id,
    paymentStatus: "BANK_DETAILS_SUBMITTED",
  });

  return NextResponse.json({
    ok: true,
    message: "Bank details submitted successfully. Your payment request has been sent for processing.",
  });
}
