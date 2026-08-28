import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getFarmerProfileId } from "@/lib/farmer";
import { farmersAhead, estimateWaitMinutes, currentlyServingToken, centreLoad } from "@/lib/services";

// This assistant is intentionally deterministic and rule-based, not an LLM.
// It only ever reads the logged-in farmer's own rows, so it structurally
// cannot leak another farmer's booking/queue/payment data. AI_PROVIDER_API_KEY
// is not configured in this prototype; if a provider is added later, this
// route is the seam to plug it in (build the same context object below and
// hand it to the model instead of the if/else matcher).

function activeBooking(farmerId: string) {
  const db = getDb();
  // Prefer an active (non-terminal) booking, same rule as /api/farmer/current,
  // so the assistant never answers about a booking the farmer isn't asking
  // about just because it happens to be their most recently created row.
  const active = db
    .prepare(
      `SELECT b.id, b.token, b.status, b.quantity_quintal as quantityQuintal,
              c.name as cropName, ctr.id as centreId, ctr.name as centreName,
              s.date, s.start_time as startTime, s.end_time as endTime, q.position
       FROM bookings b
       JOIN crops c ON b.crop_id = c.id
       JOIN procurement_centres ctr ON b.centre_id = ctr.id
       JOIN slots s ON b.slot_id = s.id
       LEFT JOIN queue_entries q ON q.booking_id = b.id
       WHERE b.farmer_id = ? AND b.status NOT IN ('PROCUREMENT_COMPLETED','PAYMENT_PROCESSING','PAYMENT_COMPLETED','CANCELLED','NO_SHOW')
       ORDER BY b.created_at DESC LIMIT 1`
    )
    .get(farmerId) as any;
  if (active) return active;

  return db
    .prepare(
      `SELECT b.id, b.token, b.status, b.quantity_quintal as quantityQuintal,
              c.name as cropName, ctr.id as centreId, ctr.name as centreName,
              s.date, s.start_time as startTime, s.end_time as endTime, q.position
       FROM bookings b
       JOIN crops c ON b.crop_id = c.id
       JOIN procurement_centres ctr ON b.centre_id = ctr.id
       JOIN slots s ON b.slot_id = s.id
       LEFT JOIN queue_entries q ON q.booking_id = b.id
       WHERE b.farmer_id = ?
       ORDER BY b.created_at DESC LIMIT 1`
    )
    .get(farmerId) as any;
}

function paymentFor(bookingId: string) {
  const db = getDb();
  return db.prepare(`SELECT status, amount FROM payments WHERE booking_id = ?`).get(bookingId) as
    | { status: string; amount: number | null }
    | undefined;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }
  const farmerId = getFarmerProfileId(session.id);
  const { message } = await req.json().catch(() => ({ message: "" }));
  const text: string = (message || "").toLowerCase();

  if (!farmerId) {
    return NextResponse.json({ reply: "I couldn't find your farmer profile. Please complete your profile first." });
  }

  const booking = activeBooking(farmerId);

  if (!booking) {
    return NextResponse.json({
      reply: "You don't have any bookings yet. Tap 'Book Procurement Slot' on your home screen to get started.",
    });
  }

  const ahead = booking.position != null ? farmersAhead(booking.centreId, booking.date, booking.position) : 0;
  const waitMins = estimateWaitMinutes(booking.centreId, ahead);
  const serving = currentlyServingToken(booking.centreId, booking.date);
  const payment = paymentFor(booking.id);

  const wantsQueue = /number|token|queue|kab aayega|turn|wait/.test(text);
  const wantsPayment = /payment|paisa|paise|paid|credited/.test(text);
  const wantsStatus = /status|procurement|complete|weigh/.test(text);
  const wantsCentre = /centre|center|timing|address|kahan/.test(text);

  if (wantsPayment) {
    const status = payment?.status ?? "PENDING";
    const statusText: Record<string, string> = {
      PENDING: "Your payment has not started yet. It will begin after procurement is completed.",
      PROCESSING: "Your payment is being processed.",
      PAID: `Your payment of ₹${payment?.amount ?? "—"} has been credited.`,
      FAILED: "Your payment failed. Please contact the centre staff.",
    };
    return NextResponse.json({ reply: `${statusText[status]} (Token ${booking.token})` });
  }

  if (wantsStatus && !wantsQueue) {
    return NextResponse.json({
      reply: `Your booking (Token ${booking.token}) is currently: ${booking.status.replaceAll("_", " ")}.`,
    });
  }

  if (wantsCentre) {
    return NextResponse.json({
      reply: `Your booking is at ${booking.centreName} on ${booking.date}, slot ${booking.startTime}–${booking.endTime}.`,
    });
  }

  // Default: queue / token answer (matches the SIH scenario's example question)
  return NextResponse.json({
    reply: `Your token is ${booking.token}. Currently serving: ${serving ?? "not started yet"}. Farmers ahead of you: ${ahead}. Estimated waiting time: about ${waitMins} minutes.`,
  });
}
