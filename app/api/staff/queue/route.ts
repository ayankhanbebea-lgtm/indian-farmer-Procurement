import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getStaffCentre } from "@/lib/staff";
import { currentlyServingToken, centreLoad } from "@/lib/services";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "STAFF") {
    return NextResponse.json({ error: "Please login as a staff member." }, { status: 401 });
  }

  const centre = getStaffCentre(session.id);
  if (!centre) {
    return NextResponse.json({ error: "No procurement centre assigned to this staff account." }, { status: 404 });
  }

  const url = new URL(req.url);
  const todayIST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const requestedDate = url.searchParams.get("date");

  const db = getDb();

  // Unified Query matching Admin Database Query
  const allRows = db
    .prepare(
      `SELECT b.id, b.token, b.status, b.quantity_quintal as quantityQuintal, b.actual_quantity as actualQuantity,
              b.created_at as createdAt, b.updated_at as updatedAt,
              u.name as farmerName, u.phone as farmerPhone,
              c.id as centreId, c.name as centreName, c.code as centreCode,
              cr.name as cropName, cr.code as cropCode,
              s.date as slotDate, s.start_time as startTime, s.end_time as endTime,
              COALESCE(q.position, 1) as position, q.called_at as calledAt,
              p.status as paymentStatus, p.amount as paymentAmount
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN farmer_profiles fp ON b.farmer_id = fp.id
       JOIN users u ON fp.user_id = u.id
       JOIN procurement_centres c ON b.centre_id = c.id
       JOIN crops cr ON b.crop_id = cr.id
       LEFT JOIN queue_entries q ON q.booking_id = b.id
       LEFT JOIN payments p ON p.booking_id = b.id
       WHERE b.centre_id = ?
       ORDER BY s.date ASC, COALESCE(q.position, 999) ASC, b.created_at ASC`
    )
    .all(centre.id) as any[];

  // Filter by date if requested (unless "all")
  const activeDate = requestedDate === "all" ? "all" : (requestedDate || todayIST);
  
  // If user requested specific date, filter rows for that date; otherwise if "all", show all
  const filteredRows = activeDate === "all"
    ? allRows
    : allRows.filter((r) => r.slotDate === activeDate);

  const summary = {
    total: filteredRows.length,
    waiting: filteredRows.filter((r) => r.status === "BOOKED").length,
    inProgress: filteredRows.filter((r) => ["ARRIVED", "VERIFIED", "WEIGHING", "PROCUREMENT_IN_PROGRESS"].includes(r.status)).length,
    completed: filteredRows.filter((r) => ["PROCUREMENT_COMPLETED", "PAYMENT_PROCESSING", "PAYMENT_COMPLETED"].includes(r.status)).length,
    paymentPending: filteredRows.filter((r) => r.paymentStatus && r.paymentStatus !== "PAID").length,
  };

  // Group upcoming active bookings by date
  const upcomingSummary = db
    .prepare(
      `SELECT s.date, COUNT(b.id) as count
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       WHERE b.centre_id = ? AND b.status NOT IN ('CANCELLED', 'NO_SHOW')
       GROUP BY s.date
       ORDER BY s.date ASC`
    )
    .all(centre.id) as { date: string; count: number }[];

  const serving = currentlyServingToken(centre.id, activeDate === "all" ? todayIST : activeDate);
  const load = centreLoad(centre.id, activeDate === "all" ? todayIST : activeDate);

  return NextResponse.json({
    centre,
    date: activeDate,
    todayIST,
    totalCentreBookings: allRows.length,
    rows: filteredRows,
    summary,
    upcomingSummary,
    serving,
    load,
  });
}
