import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, newId, nowIso } from "@/lib/db";
import { getFarmerProfileId, MAX_ACTIVE_BOOKINGS, ACTIVE_BOOKING_STATUSES } from "@/lib/farmer";
import { createBookingSchema } from "@/lib/validation";
import { generateToken, nextQueuePosition, sendNotification, recordAudit } from "@/lib/services";
import { broadcastRealtimeEvent } from "@/lib/realtime";

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
              b.created_at as createdAt, c.name as cropName, c.code as cropCode,
              ctr.name as centreName, s.date, s.start_time as startTime, s.end_time as endTime,
              p.status as paymentStatus, p.amount as paymentAmount, p.reference_no as paymentReference
       FROM bookings b
       JOIN crops c ON b.crop_id = c.id
       JOIN procurement_centres ctr ON b.centre_id = ctr.id
       JOIN slots s ON b.slot_id = s.id
       LEFT JOIN payments p ON p.booking_id = b.id
       WHERE b.farmer_id = ?
       ORDER BY b.created_at DESC`
    )
    .all(farmerId);

  return NextResponse.json({ bookings });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }
  const farmerId = getFarmerProfileId(session.id);
  if (!farmerId) {
    return NextResponse.json({ error: "Farmer profile not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message || "Invalid booking details" }, { status: 400 });
  }
  const { cropCode, quantityQuintal, centreId, date, slotId } = parsed.data;

  const db = getDb();

  const crop = db.prepare(`SELECT id FROM crops WHERE code = ?`).get(cropCode) as { id: string } | undefined;
  if (!crop) return NextResponse.json({ error: "Please select a valid crop." }, { status: 400 });

  const slot = db.prepare(`SELECT id, capacity, date FROM slots WHERE id = ? AND centre_id = ?`).get(slotId, centreId) as
    | { id: string; capacity: number; date: string }
    | undefined;
  if (!slot) return NextResponse.json({ error: "Please select a valid slot." }, { status: 400 });

  try {
    db.exec("BEGIN IMMEDIATE");

    // Atomic Active Bookings Count Check (Maximum 3 active tokens)
    const placeholders = ACTIVE_BOOKING_STATUSES.map(() => "?").join(",");
    const activeCount = (
      db
        .prepare(`SELECT COUNT(*) as c FROM bookings WHERE farmer_id = ? AND status IN (${placeholders})`)
        .get(farmerId, ...ACTIVE_BOOKING_STATUSES) as { c: number }
    ).c;

    if (activeCount >= MAX_ACTIVE_BOOKINGS) {
      db.exec("ROLLBACK");
      return NextResponse.json(
        {
          error: "You already have 3 active tokens. Please wait until one of your existing tokens is completed before booking another slot.",
        },
        { status: 409 }
      );
    }

    // Atomic Slot capacity check inside immediate transaction
    const bookedCount = (
      db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE slot_id = ? AND status != 'CANCELLED'`).get(slotId) as {
        c: number;
      }
    ).c;
    if (bookedCount >= slot.capacity) {
      db.exec("ROLLBACK");
      return NextResponse.json({ error: "This slot is now full. Please choose another slot." }, { status: 409 });
    }

    const { token, seq } = generateToken(cropCode, centreId, date);
    const bookingId = newId("bkg_");
    db.prepare(
      `INSERT INTO bookings (id, farmer_id, centre_id, crop_id, slot_id, quantity_quintal, token, token_seq, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BOOKED', ?, ?)`
    ).run(bookingId, farmerId, centreId, crop.id, slotId, quantityQuintal, token, seq, nowIso(), nowIso());


    const position = nextQueuePosition(centreId, date);
    db.prepare(
      `INSERT INTO queue_entries (id, booking_id, centre_id, date, position, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(newId("q_"), bookingId, centreId, date, position, nowIso());

    db.exec("COMMIT");

    console.log(`\n==================================================`);
    console.log(`[STEP 1: CREATE] Token created: ${token} (Booking ID: ${bookingId})`);
    console.log(`  Farmer ID: ${farmerId}, Centre ID: ${centreId}, Date: ${date}, Crop: ${cropCode}`);

    const allFarmerActive = db.prepare(`
      SELECT b.id, b.token, b.farmer_id as farmerId, b.status, b.centre_id as centreId, s.date
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      WHERE b.farmer_id = ? AND b.status IN ('BOOKED', 'ARRIVED', 'VERIFIED', 'WEIGHING', 'PROCUREMENT_IN_PROGRESS', 'PAYMENT_PROCESSING')
    `).all(farmerId);

    console.log(`[STEP 2: STORAGE] Raw active booking records immediately after creation:`);
    console.log(JSON.stringify(allFarmerActive, null, 2));
    console.log(`  TOTAL ACTIVE RECORDS FOR THIS FARMER: ${allFarmerActive.length}`);
    console.log(`==================================================\n`);

    sendNotification(
      session.id,
      "BOOKING_CONFIRMED",
      `Your procurement slot has been booked successfully. Your token is ${token}.`,
      bookingId
    );
    recordAudit(session.id, "BOOKING_CREATED", "booking", bookingId);

    // Broadcast real-time SSE event to Staff and Farmer dashboards
    broadcastRealtimeEvent({
      type: "BOOKING_CREATED",
      centreId,
      farmerId,
      bookingId,
      token,
      date,
      status: "BOOKED",
    });

    return NextResponse.json({ bookingId, token });
  } catch (e: any) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    console.error("Booking error:", e);
    return NextResponse.json({ error: e?.message || "Unable to confirm your booking. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }
  const farmerId = getFarmerProfileId(session.id);
  if (!farmerId) {
    return NextResponse.json({ error: "Farmer profile not found." }, { status: 404 });
  }

  const url = new URL(req.url);
  const bookingId = url.searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "Booking ID is required." }, { status: 400 });
  }

  const { cancelBooking } = await import("@/lib/services");
  const result = cancelBooking(bookingId, farmerId, session.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Unable to cancel booking." }, { status: 400 });
  }

  const db = getDb();
  const b = db.prepare(`SELECT centre_id as centreId FROM bookings WHERE id = ?`).get(bookingId) as any;
  if (b?.centreId) {
    broadcastRealtimeEvent({
      type: "BOOKING_UPDATED",
      centreId: b.centreId,
      farmerId,
      bookingId,
      status: "CANCELLED",
    });
  }

  return NextResponse.json({ ok: true, message: "Booking successfully cancelled." });
}
