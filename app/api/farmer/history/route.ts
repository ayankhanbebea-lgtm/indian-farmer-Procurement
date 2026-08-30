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
              b.quality_grade as qualityGrade, b.created_at as createdAt,
              c.name as cropName, c.code as cropCode,
              ctr.name as centreName, ctr.code as centreCode,
              s.date, s.start_time as startTime, s.end_time as endTime,
              p.id as paymentId,
              COALESCE(p.payment_status, p.status) as paymentStatus,
              p.rate_per_unit as ratePerUnit,
              COALESCE(p.total_amount, p.amount) as paymentAmount,
              COALESCE(p.transaction_id, p.reference_no) as paymentReference,
              p.payment_method as paymentMethod,
              p.paid_at as paidAt,
              p.bank_account_last4 as bankAccountLast4,
              p.upi_id as upiId
       FROM bookings b
       JOIN crops c ON b.crop_id = c.id
       JOIN procurement_centres ctr ON b.centre_id = ctr.id
       JOIN slots s ON b.slot_id = s.id
       LEFT JOIN payments p ON p.booking_id = b.id
       WHERE b.farmer_id = ?
       ORDER BY s.date DESC, b.created_at DESC`
    )
    .all(farmerId);

  return NextResponse.json({ bookings });
}

