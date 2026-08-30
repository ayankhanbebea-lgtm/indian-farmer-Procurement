import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { normalizeDateToYMD } from "@/lib/format";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Please login as admin." }, { status: 401 });
  }

  const db = getDb();
  const url = new URL(req.url);

  const status = url.searchParams.get("status") || "";
  const centreId = url.searchParams.get("centreId") || "";
  const date = url.searchParams.get("date") || "";
  const search = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const vals: unknown[] = [];

  if (status && status !== "ALL") {
    conditions.push("(p.payment_status = ? OR (p.payment_status IS NULL AND p.status = ?))");
    vals.push(status, status);
  }

  if (centreId && centreId !== "ALL") {
    conditions.push("p.procurement_centre_id = ?");
    vals.push(centreId);
  }

  if (date) {
    conditions.push("(s.date = ? OR date(p.created_at) = ?)");
    const ymd = normalizeDateToYMD(date);
    vals.push(ymd, ymd);
  }

  if (search) {
    const sTerm = `%${search.trim().toLowerCase()}%`;
    conditions.push("(LOWER(p.farmer_name) LIKE ? OR LOWER(b.token) LIKE ? OR u.phone LIKE ? OR LOWER(COALESCE(p.transaction_id, '')) LIKE ?)");
    vals.push(sTerm, sTerm, `%${search.trim()}%`, sTerm);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const query = `
    SELECT
      p.id,
      p.booking_id as bookingId,
      p.farmer_id as farmerId,
      p.farmer_name as farmerName,
      p.procurement_centre_id as procurementCentreId,
      p.crop,
      p.final_quantity as finalQuantity,
      p.quantity_unit as quantityUnit,
      p.rate_per_unit as ratePerUnit,
      COALESCE(p.deductions, 0) as deductions,
      COALESCE(p.final_payable_amount, p.total_amount, p.amount, 0) as finalPayableAmount,
      COALESCE(p.total_amount, p.final_payable_amount, p.amount, 0) as totalAmount,
      COALESCE(p.payment_status, p.status, 'BANK_DETAILS_REQUIRED') as paymentStatus,
      p.account_holder_name as accountHolderName,
      p.bank_name as bankName,
      p.account_number as accountNumber,
      p.bank_account_last4 as bankAccountLast4,
      p.ifsc_code as ifscCode,
      p.upi_id as upiId,
      p.payment_method as paymentMethod,
      COALESCE(p.transaction_reference, p.transaction_id, p.reference_no) as transactionId,
      COALESCE(p.transaction_reference, p.transaction_id, p.reference_no) as transactionReference,
      p.failure_reason as failureReason,
      p.hold_reason as holdReason,
      p.submitted_at as submittedAt,
      p.processed_at as processedAt,
      p.initiated_at as initiatedAt,
      p.paid_at as paidAt,
      p.created_at as createdAt,
      p.updated_at as updatedAt,
      b.token,
      b.status as bookingStatus,
      b.quality_grade as qualityGrade,
      u.phone as farmerPhone,
      ctr.name as centreName,
      ctr.code as centreCode,
      s.date as slotDate,
      s.start_time as startTime,
      s.end_time as endTime
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN farmer_profiles fp ON p.farmer_id = fp.id
    JOIN users u ON fp.user_id = u.id
    JOIN procurement_centres ctr ON p.procurement_centre_id = ctr.id
    JOIN slots s ON b.slot_id = s.id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(query).all(...vals, limit, offset) as any[];

  const countQuery = `
    SELECT COUNT(p.id) as total
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN farmer_profiles fp ON p.farmer_id = fp.id
    JOIN users u ON fp.user_id = u.id
    JOIN slots s ON b.slot_id = s.id
    ${whereClause}
  `;
  const totalCount = (db.prepare(countQuery).get(...vals) as any)?.total || 0;

  // Stats across all payments
  const stats = db.prepare(`
    SELECT
      COUNT(id) as totalRecords,
      COALESCE(SUM(CASE WHEN payment_status = 'PAID' OR status = 'PAID' THEN COALESCE(final_payable_amount, total_amount, amount, 0) ELSE 0 END), 0) as totalDisbursed,
      COALESCE(SUM(CASE WHEN payment_status IN ('BANK_DETAILS_SUBMITTED', 'PENDING', 'PROCESSING', 'ON_HOLD') OR status IN ('PENDING', 'PROCESSING') THEN COALESCE(final_payable_amount, total_amount, amount, 0) ELSE 0 END), 0) as pendingDisbursement,
      COUNT(CASE WHEN payment_status = 'BANK_DETAILS_SUBMITTED' OR payment_status = 'PENDING' OR (payment_status IS NULL AND status = 'PENDING') THEN 1 END) as pendingCount,
      COUNT(CASE WHEN payment_status = 'BANK_DETAILS_REQUIRED' THEN 1 END) as bankDetailsRequiredCount,
      COUNT(CASE WHEN payment_status = 'BANK_DETAILS_SUBMITTED' THEN 1 END) as bankDetailsSubmittedCount,
      COUNT(CASE WHEN payment_status = 'PROCESSING' OR (payment_status IS NULL AND status = 'PROCESSING') THEN 1 END) as processingCount,
      COUNT(CASE WHEN payment_status = 'PAID' OR (payment_status IS NULL AND status = 'PAID') THEN 1 END) as paidCount,
      COUNT(CASE WHEN payment_status = 'FAILED' OR (payment_status IS NULL AND status = 'FAILED') THEN 1 END) as failedCount,
      COUNT(CASE WHEN payment_status = 'ON_HOLD' THEN 1 END) as onHoldCount
    FROM payments
  `).get() as any;

  const centres = db.prepare(`SELECT id, name, code, district FROM procurement_centres ORDER BY name`).all();

  return NextResponse.json({
    payments: rows,
    total: totalCount,
    page,
    limit,
    stats: {
      totalRecords: stats?.totalRecords || 0,
      totalDisbursed: stats?.totalDisbursed || 0,
      pendingDisbursement: stats?.pendingDisbursement || 0,
      pendingCount: stats?.pendingCount || 0,
      bankDetailsRequiredCount: stats?.bankDetailsRequiredCount || 0,
      bankDetailsSubmittedCount: stats?.bankDetailsSubmittedCount || 0,
      processingCount: stats?.processingCount || 0,
      paidCount: stats?.paidCount || 0,
      failedCount: stats?.failedCount || 0,
      onHoldCount: stats?.onHoldCount || 0,
    },
    centres,
  });
}
