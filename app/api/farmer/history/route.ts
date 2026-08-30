import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getFarmerProfileId } from "@/lib/farmer";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }
  const farmerId = getFarmerProfileId(session.id);
  if (!farmerId) return NextResponse.json({ bookings: [] });

  const db = getDb();
  const bookings = db
    .prepare(
      `SELECT b.id, b.token, b.status, b.quantity_quintal as quantityQuintal, b.actual_quantity as actualQuantity,
              b.deductions as bookingDeductions, b.quality_grade as qualityGrade, b.created_at as createdAt,
              b.updated_at as updatedAt,
              c.name as cropName, c.code as cropCode, c.msp_rate as cropMsp,
              ctr.name as centreName, ctr.code as centreCode,
              s.date, s.start_time as startTime, s.end_time as endTime,
              p.id as paymentId,
              COALESCE(p.payment_status, p.status, 'PENDING') as paymentStatus,
              p.rate_per_unit as ratePerUnit,
              COALESCE(p.deductions, b.deductions, 0) as deductions,
              CASE
                WHEN p.final_payable_amount IS NOT NULL AND p.final_payable_amount > 0 THEN p.final_payable_amount
                WHEN p.total_amount IS NOT NULL AND p.total_amount > 0 THEN p.total_amount
                WHEN b.status IN ('PROCUREMENT_COMPLETED', 'PAYMENT_PROCESSING', 'PAYMENT_COMPLETED') THEN
                  ROUND((COALESCE(b.actual_quantity, b.quantity_quintal, 0) * COALESCE(p.rate_per_unit, c.msp_rate, 2275)) - COALESCE(b.deductions, 0), 2)
                ELSE NULL
              END as paymentAmount,
              CASE
                WHEN p.total_amount IS NOT NULL AND p.total_amount > 0 THEN p.total_amount
                WHEN b.status IN ('PROCUREMENT_COMPLETED', 'PAYMENT_PROCESSING', 'PAYMENT_COMPLETED') THEN
                  ROUND((COALESCE(b.actual_quantity, b.quantity_quintal, 0) * COALESCE(p.rate_per_unit, c.msp_rate, 2275)) - COALESCE(b.deductions, 0), 2)
                ELSE NULL
              END as totalAmount,
              COALESCE(p.transaction_reference, p.transaction_id, p.reference_no) as paymentReference,
              COALESCE(p.transaction_reference, p.transaction_id, p.reference_no) as transactionId,
              p.payment_method as paymentMethod,
              p.paid_at as paidAt,
              p.bank_account_last4 as bankAccountLast4,
              p.upi_id as upiId
       FROM bookings b
       JOIN crops c ON b.crop_id = c.id
       JOIN procurement_centres ctr ON b.centre_id = ctr.id
       JOIN slots s ON b.slot_id = s.id
       JOIN farmer_profiles fp ON b.farmer_id = fp.id
       LEFT JOIN payments p ON p.booking_id = b.id
       WHERE (b.farmer_id = ? OR fp.user_id = ?)
       ORDER BY COALESCE(p.paid_at, p.submitted_at, b.updated_at, b.created_at) DESC`
    )
    .all(farmerId, session.id);

  return NextResponse.json({ bookings });
}

