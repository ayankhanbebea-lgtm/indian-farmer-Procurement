import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getFarmerProfileId, MAX_ACTIVE_BOOKINGS, ACTIVE_BOOKING_STATUSES } from "@/lib/farmer";
import { farmersAhead, estimateWaitMinutes, currentlyServingToken } from "@/lib/services";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }
  const farmerId = getFarmerProfileId(session.id);
  if (!farmerId) return NextResponse.json({ bookings: [], activeCount: 0, maxLimit: MAX_ACTIVE_BOOKINGS, isMaxReached: false, booking: null });

  const db = getDb();
  const placeholders = ACTIVE_BOOKING_STATUSES.map(() => "?").join(",");
  const rawBookings = db
    .prepare(
      `SELECT b.id, b.token, b.status, b.quantity_quintal as quantityQuintal, b.actual_quantity as actualQuantity,
              b.created_at as createdAt,
              c.name as cropName, c.code as cropCode,
              ctr.id as centreId, ctr.name as centreName, ctr.code as centreCode,
              s.date, s.start_time as startTime, s.end_time as endTime,
              q.position
       FROM bookings b
       JOIN crops c ON b.crop_id = c.id
       JOIN procurement_centres ctr ON b.centre_id = ctr.id
       JOIN slots s ON b.slot_id = s.id
       LEFT JOIN queue_entries q ON q.booking_id = b.id
       WHERE b.farmer_id = ? AND b.status IN (${placeholders})
       ORDER BY s.date ASC, s.start_time ASC, b.created_at ASC`
    )
    .all(farmerId, ...ACTIVE_BOOKING_STATUSES) as any[];

  const bookings = rawBookings.map((b) => {
    const ahead = b.position != null ? farmersAhead(b.centreId, b.date, b.position) : 0;
    const waitMins = estimateWaitMinutes(b.centreId, ahead);
    const serving = currentlyServingToken(b.centreId, b.date);

    let statusMessage = "Booked. Please arrive at your slot time.";
    if (ahead === 0 && b.status === "BOOKED") statusMessage = "Your turn is approaching";
    else if (ahead <= 3 && b.status === "BOOKED") statusMessage = "Your turn is approaching";
    else if (b.status === "ARRIVED") statusMessage = "You have checked in. Please wait to be verified.";
    else if (b.status === "VERIFIED") statusMessage = "Verified. Please proceed to weighing.";
    else if (b.status === "WEIGHING" || b.status === "PROCUREMENT_IN_PROGRESS")
      statusMessage = "Your crop is being processed.";
    else if (b.status === "PAYMENT_PROCESSING")
      statusMessage = "Procurement complete. Payment is processing.";

    return {
      ...b,
      farmersAhead: ahead,
      estimatedWaitMins: waitMins,
      currentlyServing: serving,
      statusMessage,
    };
  });

  const activeCount = bookings.length;
  const isMaxReached = activeCount >= MAX_ACTIVE_BOOKINGS;

  return NextResponse.json({
    bookings,
    activeCount,
    maxLimit: MAX_ACTIVE_BOOKINGS,
    isMaxReached,
    booking: bookings[0] ?? null,
  });
}

