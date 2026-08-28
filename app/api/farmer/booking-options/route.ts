import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { rankCentres, getSlotAvailability, ensureSlotsForDate } from "@/lib/services";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }

  const url = new URL(req.url);
  const selectedDate = url.searchParams.get("date");
  const centreId = url.searchParams.get("centreId");

  const todayDateObj = new Date();
  const todayStr = todayDateObj.toISOString().slice(0, 10);
  const date = selectedDate || todayStr;

  ensureSlotsForDate(date);

  const db = getDb();
  const crops = db.prepare(`SELECT id, name, code FROM crops ORDER BY name`).all();

  // Generate 14-day booking window
  const validDates = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let i = 0; i < 14; i++) {
    const d = new Date(todayDateObj);
    d.setDate(d.getDate() + i);
    const dStr = d.toISOString().slice(0, 10);
    ensureSlotsForDate(dStr);

    validDates.push({
      date: dStr,
      dayName: dayNames[d.getDay()],
      dayNumber: d.getDate(),
      monthName: monthNames[d.getMonth()],
      year: d.getFullYear(),
      isToday: i === 0,
      isAvailable: true,
      status: "Available",
    });
  }

  const centres = rankCentres(date);
  const recommended = centres[0] || null;

  let slots: any[] = [];
  if (centreId) {
    slots = getSlotAvailability(centreId, date);
  }

  return NextResponse.json({
    crops,
    centres,
    slots,
    validDates,
    today: todayStr,
    selectedDate: date,
    recommended,
  });
}
