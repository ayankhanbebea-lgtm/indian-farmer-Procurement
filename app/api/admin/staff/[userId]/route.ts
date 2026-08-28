import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, newId, nowIso } from "@/lib/db";
import { recordAudit } from "@/lib/services";

export async function PATCH(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const user = db.prepare(`SELECT id, role FROM users WHERE id = ? AND role = 'STAFF'`).get(params.userId);
  if (!user) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  if (body.active !== undefined) {
    db.prepare(`UPDATE users SET active = ?, updated_at = ? WHERE id = ?`).run(body.active ? 1 : 0, nowIso(), params.userId);
    recordAudit(session.id, body.active ? "ACTIVATE_STAFF" : "DEACTIVATE_STAFF", "user", params.userId);
  }

  if (body.centreId !== undefined) {
    const centre = db.prepare(`SELECT id FROM procurement_centres WHERE id = ?`).get(body.centreId);
    if (!centre) return NextResponse.json({ error: "Centre not found" }, { status: 404 });
    // Remove old assignment and create new one
    db.prepare(`DELETE FROM centre_staff WHERE user_id = ?`).run(params.userId);
    db.prepare(`INSERT INTO centre_staff (id, user_id, centre_id) VALUES (?, ?, ?)`)
      .run(newId("cst_"), params.userId, body.centreId);
    recordAudit(session.id, "REASSIGN_STAFF_CENTRE", "user", params.userId);
  }

  if (body.name !== undefined) {
    db.prepare(`UPDATE users SET name = ?, updated_at = ? WHERE id = ?`).run(body.name.trim(), nowIso(), params.userId);
  }

  return NextResponse.json({ ok: true });
}