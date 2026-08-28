import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { farmerId: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();

  const farmer = db.prepare(`
    SELECT u.id, u.phone, u.name, u.active, u.created_at as createdAt,
           fp.id as farmerId, fp.district, fp.state, fp.farmer_code as farmerCode, fp.address
    FROM users u
    JOIN farmer_profiles fp ON fp.user_id = u.id
    WHERE u.id = ? AND u.role = 'FARMER'
  `).get(params.farmerId);
  if (!farmer) return NextResponse.json({ error: "Farmer not found" }, { status: 404 });

  const bookings = db.prepare(`
    SELECT b.id, b.token, b.status, b.quantity_quintal as quantityQuintal, b.actual_quantity as actualQuantity,
           b.created_at as createdAt, c.name as centreName, cr.name as cropName,
           s.date, s.start_time as startTime, p.status as paymentStatus, p.amount as paymentAmount
    FROM bookings b
    JOIN farmer_profiles fp ON b.farmer_id = fp.id
    JOIN procurement_centres c ON b.centre_id = c.id
    JOIN crops cr ON b.crop_id = cr.id
    JOIN slots s ON b.slot_id = s.id
    LEFT JOIN payments p ON p.booking_id = b.id
    WHERE fp.user_id = ?
    ORDER BY b.created_at DESC
    LIMIT 20
  `).all(params.farmerId);

  return NextResponse.json({ farmer, bookings });
}