import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  
  // Daily bookings for the last 30 days
  const dailyBookings = db.prepare(`
    SELECT s.date, COUNT(*) as count,
           SUM(CASE WHEN b.status IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED') THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
    FROM bookings b JOIN slots s ON b.slot_id = s.id
    WHERE s.date >= date('now', '-30 days')
    GROUP BY s.date ORDER BY s.date
  `).all();
  
  // Centre utilization
  const centreStats = db.prepare(`
    SELECT pc.name, pc.code, COUNT(b.id) as totalBookings,
           SUM(CASE WHEN b.status IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED') THEN 1 ELSE 0 END) as completed,
           pc.daily_capacity as capacity
    FROM procurement_centres pc
    LEFT JOIN bookings b ON b.centre_id = pc.id
    GROUP BY pc.id ORDER BY pc.name
  `).all();
  
  // Payment summary
  const paymentSummary = db.prepare(`
    SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as totalAmount
    FROM payments GROUP BY status
  `).all();
  
  // Status breakdown
  const statusBreakdown = db.prepare(`
    SELECT status, COUNT(*) as count FROM bookings GROUP BY status ORDER BY count DESC
  `).all();
  
  // Average service time (from completed bookings with actual_quantity)
  const avgServiceStats = db.prepare(`
    SELECT pc.name, pc.avg_service_time_mins as avgServiceTimeMins,
           COUNT(b.id) as completedCount
    FROM procurement_centres pc
    LEFT JOIN bookings b ON b.centre_id = pc.id
      AND b.status IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED')
    GROUP BY pc.id
  `).all();
  
  const totalRevenue = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'PAID'`).get() as any;
  const totalFarmers = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'FARMER'`).get() as any;
  const totalBookings = db.prepare(`SELECT COUNT(*) as c FROM bookings`).get() as any;
  const completedBookings = db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED')`).get() as any;
  
  return NextResponse.json({
    dailyBookings,
    centreStats,
    paymentSummary,
    statusBreakdown,
    avgServiceStats,
    totalRevenue: totalRevenue.total,
    totalFarmers: totalFarmers.c,
    totalBookings: totalBookings.c,
    completedBookings: completedBookings.c,
  });
}
