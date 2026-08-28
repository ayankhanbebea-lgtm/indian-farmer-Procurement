import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { recordAudit } from "@/lib/services";

export async function PATCH(req: NextRequest, { params }: { params: { centreId: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const centre = db.prepare(`SELECT id FROM procurement_centres WHERE id = ?`).get(params.centreId);
  if (!centre) return NextResponse.json({ error: "Centre not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updates: string[] = [];
  const vals: unknown[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); vals.push(body.name); }
  if (body.district !== undefined) { updates.push("district = ?"); vals.push(body.district); }
  if (body.location !== undefined) { updates.push("location = ?"); vals.push(body.location); }
  if (body.dailyCapacity !== undefined) { updates.push("daily_capacity = ?"); vals.push(body.dailyCapacity); }
  if (body.avgServiceTimeMins !== undefined) { updates.push("avg_service_time_mins = ?"); vals.push(body.avgServiceTimeMins); }
  if (body.highLoadThreshold !== undefined) { updates.push("high_load_threshold = ?"); vals.push(body.highLoadThreshold); }
  if (body.openTime !== undefined) { updates.push("open_time = ?"); vals.push(body.openTime); }
  if (body.closeTime !== undefined) { updates.push("close_time = ?"); vals.push(body.closeTime); }
  if (body.active !== undefined) { updates.push("active = ?"); vals.push(body.active ? 1 : 0); }

  if (updates.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  vals.push(params.centreId);
  db.prepare(`UPDATE procurement_centres SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
  recordAudit(session.id, body.active !== undefined ? (body.active ? "ACTIVATE_CENTRE" : "DEACTIVATE_CENTRE") : "UPDATE_CENTRE", "procurement_centre", params.centreId);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: { centreId: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const centre = db.prepare(`SELECT * FROM procurement_centres WHERE id = ?`).get(params.centreId);
  if (!centre) return NextResponse.json({ error: "Centre not found" }, { status: 404 });
  return NextResponse.json({ centre });
}