import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFarmerProfileId } from "@/lib/farmer";
import { cancelBooking } from "@/lib/services";

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
  const bookingId = body?.bookingId;
  if (!bookingId) {
    return NextResponse.json({ error: "Booking ID is required." }, { status: 400 });
  }

  const result = cancelBooking(bookingId, farmerId, session.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Unable to cancel booking." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Booking successfully cancelled." });
}
