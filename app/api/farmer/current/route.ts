import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getFarmerProfileId } from "@/lib/farmer";
import { farmersAhead, estimateWaitMinutes, currentlyServingToken } from "@/lib/services";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }
  const farmerId = getFarmerProfileId(session.id);
  if (!farmerId) return NextResponse.json({ booking: null });

  const db = getDb();
  const booking = db
    .prepare(
      `SELECT b.id, b.token, b.status, b.quantity_quintal as quantityQuintal,
              c.name as cropName, ctr.id as centreId, ctr.name as centreName,
              s.date, s.start_time as startTime, s.end_time as endTime,
              q.position
       FROM bookings b
       JOIN crops c ON b.crop_id = c.id
       JOIN procurement_centres ctr ON b.centre_id = ctr.id
       JOIN slots s ON b.slot_id = s.id
       LEFT JOIN queue_entries q ON q.booking_id = b.id
       WHERE b.farmer_id = ? AND b.status NOT IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED','CANCELLED','NO_SHOW')
       ORDER BY b.created_at DESC LIMIT 1`
    )
    .get(farmerId) as any;

  if (!booking) return NextResponse.json({ booking: null });

  const ahead = booking.position != null ? farmersAhead(booking.centreId, booking.date, booking.position) : 0;
  const waitMins = estimateWaitMinutes(booking.centreId, ahead);
  const serving = currentlyServingToken(booking.centreId, booking.date);

  let statusMessage = "Booked. Please arrive at your slot time.";
  if (ahead === 0 && booking.status === "BOOKED") statusMessage = "Your turn is approaching";
  else if (ahead <= 3 && booking.status === "BOOKED") statusMessage = "Your turn is approaching";
  else if (booking.status === "ARRIVED") statusMessage = "You have checked in. Please wait to be verified.";
  else if (booking.status === "VERIFIED") statusMessage = "Verified. Please proceed to weighing.";
  else if (booking.status === "WEIGHING" || booking.status === "PROCUREMENT_IN_PROGRESS")
    statusMessage = "Your crop is being processed.";

  return NextResponse.json({
    booking: {
      ...booking,
      farmersAhead: ahead,
      estimatedWaitMins: waitMins,
      currentlyServing: serving,
      statusMessage,
    },
  });
}
