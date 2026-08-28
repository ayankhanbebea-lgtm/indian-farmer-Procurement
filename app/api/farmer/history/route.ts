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
              c.name as cropName, ctr.name as centreName, s.date, s.start_time as startTime,
              p.status as paymentStatus, p.amount as paymentAmount
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
