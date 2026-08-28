import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, newId, nowIso } from "@/lib/db";
import { recordAudit } from "@/lib/services";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const centres = db.prepare(`
    SELECT pc.id, pc.name, pc.code, pc.district, pc.location, pc.daily_capacity as dailyCapacity,
           pc.avg_service_time_mins as avgServiceTimeMins, pc.high_load_threshold as highLoadThreshold,
           pc.open_time as openTime, pc.close_time as closeTime, pc.active, pc.created_at as createdAt,
           COUNT(DISTINCT cs.id) as staffCount
    FROM procurement_centres pc
    LEFT JOIN centre_staff cs ON cs.centre_id = pc.id
    GROUP BY pc.id
    ORDER BY pc.name
  `).all();
  return NextResponse.json({ centres });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.code || !body?.district) {
    return NextResponse.json({ error: "name, code, and district are required" }, { status: 400 });
  }
  const db = getDb();
  // Check code uniqueness
  const existing = db.prepare(`SELECT id FROM procurement_centres WHERE code = ?`).get(body.code);
  if (existing) return NextResponse.json({ error: "Centre code already exists" }, { status: 409 });

  const id = newId("ctr_");
  db.prepare(`
    INSERT INTO procurement_centres (id, name, code, district, location, daily_capacity, avg_service_time_mins, high_load_threshold, open_time, close_time, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id, body.name, body.code.toUpperCase(), body.district,
    body.location || null,
    body.dailyCapacity || 120,
    body.avgServiceTimeMins || 5,
    body.highLoadThreshold || 50,
    body.openTime || "09:00",
    body.closeTime || "17:00",
    nowIso()
  );
  recordAudit(session.id, "CREATE_CENTRE", "procurement_centre", id);
  return NextResponse.json({ ok: true, id });
}
