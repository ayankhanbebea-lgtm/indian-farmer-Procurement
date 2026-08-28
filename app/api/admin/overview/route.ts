import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adminOverview } from "@/lib/services";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Please login as admin." }, { status: 401 });
  }

  const db = getDb();
  const overview = adminOverview();

  const recentAudit = db
    .prepare(
      `SELECT a.action, a.entity, a.entity_id as entityId, a.created_at as createdAt, u.name as userName, u.role as userRole
       FROM audit_logs a JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC LIMIT 15`
    )
    .all();

  const paymentBreakdown = db
    .prepare(`SELECT status, COUNT(*) as count FROM payments GROUP BY status`)
    .all();

  const dailyBookings = db
    .prepare(
      `SELECT s.date as date, COUNT(*) as count FROM bookings b JOIN slots s ON b.slot_id = s.id GROUP BY s.date ORDER BY s.date`
    )
    .all();

  return NextResponse.json({ overview, recentAudit, paymentBreakdown, dailyBookings });
}
