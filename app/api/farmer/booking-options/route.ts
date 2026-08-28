import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { rankCentres, getSlotAvailability, ensureSlotsForDate } from "@/lib/services";
import { getTodayIST, normalizeDateToYMD } from "@/lib/format";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }

  const url = new URL(req.url);
  const selectedDate = url.searchParams.get("date");
  const centreId = url.searchParams.get("centreId");

  const todayStr = getTodayIST();
  const date = normalizeDateToYMD(selectedDate || todayStr);

  ensureSlotsForDate(date);

  const db = getDb();
  const crops = db.prepare(`SELECT id, name, code FROM crops ORDER BY name`).all();

  // Generate 14-day booking window strictly aligned with IST calendar
  const validDates = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const [tYear, tMonth, tDay] = todayStr.split("-").map(Number);
  const baseDate = new Date(tYear, tMonth - 1, tDay, 12, 0, 0);

  for (let i = 0; i < 14; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dt = String(d.getDate()).padStart(2, "0");
    const dStr = `${y}-${m}-${dt}`;
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

