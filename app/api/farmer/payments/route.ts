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
  if (!farmerId) {
    return NextResponse.json({ payments: [], stats: { totalDisbursed: 0, pendingAmount: 0, count: 0 } });
  }

  const db = getDb();

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
      COALESCE(p.total_amount, p.amount, 0) as totalAmount,
      COALESCE(p.payment_status, p.status, 'PENDING') as paymentStatus,
      p.payment_method as paymentMethod,
      p.bank_account_last4 as bankAccountLast4,
      p.upi_id as upiId,
      COALESCE(p.transaction_id, p.reference_no) as transactionId,
      p.failure_reason as failureReason,
      p.hold_reason as holdReason,
      p.initiated_at as initiatedAt,
      p.paid_at as paidAt,
      p.created_at as createdAt,
      p.updated_at as updatedAt,
      b.token,
      b.status as bookingStatus,
      b.quality_grade as qualityGrade,
      ctr.name as centreName,
      ctr.code as centreCode,
      fp.farmer_code as farmerCode,
      s.date as slotDate,
      s.start_time as startTime,
      s.end_time as endTime
    FROM payments p
    JOIN bookings b ON p.booking_id = b.id
    JOIN farmer_profiles fp ON p.farmer_id = fp.id
    JOIN procurement_centres ctr ON p.procurement_centre_id = ctr.id
    JOIN slots s ON b.slot_id = s.id
    WHERE p.farmer_id = ?
    ORDER BY p.created_at DESC
  `;

  const payments = db.prepare(query).all(farmerId) as any[];

  let totalDisbursed = 0;
  let pendingAmount = 0;
  let inProcessingAmount = 0;

  for (const p of payments) {
    if (p.paymentStatus === "PAID") {
      totalDisbursed += p.totalAmount;
    } else if (p.paymentStatus === "PROCESSING") {
      inProcessingAmount += p.totalAmount;
    } else {
      pendingAmount += p.totalAmount;
    }
  }

  return NextResponse.json({
    payments,
    stats: {
      totalDisbursed,
      pendingAmount,
      inProcessingAmount,
      totalCount: payments.length,
      paidCount: payments.filter((p) => p.paymentStatus === "PAID").length,
    },
  });
}
