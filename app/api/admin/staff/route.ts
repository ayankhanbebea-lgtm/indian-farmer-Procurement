import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, newId, nowIso } from "@/lib/db";
import { recordAudit } from "@/lib/services";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const staffList = db.prepare(`
    SELECT u.id, u.phone, u.name, u.active, u.created_at as createdAt,
           cs.centre_id as centreId, pc.name as centreName, pc.code as centreCode
    FROM users u
    LEFT JOIN centre_staff cs ON cs.user_id = u.id
    LEFT JOIN procurement_centres pc ON cs.centre_id = pc.id
    WHERE u.role = 'STAFF'
    ORDER BY u.name
  `).all();
  return NextResponse.json({ staff: staffList });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.phone || !body?.centreId) {
    return NextResponse.json({ error: "name, phone, and centreId are required" }, { status: 400 });
  }
  const phone = body.phone.replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  if (existing) return NextResponse.json({ error: "User with this phone already exists" }, { status: 409 });

  const centre = db.prepare(`SELECT id FROM procurement_centres WHERE id = ?`).get(body.centreId);
  if (!centre) return NextResponse.json({ error: "Centre not found" }, { status: 404 });

  const uid = newId("usr_");
  db.prepare(`INSERT INTO users (id, phone, role, name, language, active, created_at, updated_at) VALUES (?, ?, 'STAFF', ?, 'en', 1, ?, ?)`)
    .run(uid, phone, body.name.trim(), nowIso(), nowIso());
  db.prepare(`INSERT INTO centre_staff (id, user_id, centre_id) VALUES (?, ?, ?)`)
    .run(newId("cst_"), uid, body.centreId);

  recordAudit(session.id, "CREATE_STAFF", "user", uid);
  return NextResponse.json({ ok: true, id: uid });
}