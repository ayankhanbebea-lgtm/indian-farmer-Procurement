import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const search = `%${q}%`;
  const farmers = db.prepare(`
    SELECT u.id, u.phone, u.name, u.active, u.created_at as createdAt,
           fp.id as farmerId, fp.district, fp.state, fp.farmer_code as farmerCode,
           COUNT(b.id) as totalBookings,
           SUM(CASE WHEN b.status = 'PAYMENT_COMPLETED' THEN 1 ELSE 0 END) as completedBookings
    FROM users u
    JOIN farmer_profiles fp ON fp.user_id = u.id
    LEFT JOIN bookings b ON b.farmer_id = fp.id
    WHERE u.role = 'FARMER' AND (u.name LIKE ? OR u.phone LIKE ?)
    GROUP BY u.id
    ORDER BY u.name
    LIMIT ? OFFSET ?
  `).all(search, search, limit, offset);

  const total = (db.prepare(`
    SELECT COUNT(*) as c FROM users u JOIN farmer_profiles fp ON fp.user_id = u.id
    WHERE u.role = 'FARMER' AND (u.name LIKE ? OR u.phone LIKE ?)
  `).get(search, search) as { c: number }).c;

  return NextResponse.json({ farmers, total, page, limit });
}