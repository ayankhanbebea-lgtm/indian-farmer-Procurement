import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 50;
  const offset = (page - 1) * limit;
  
  const logs = db.prepare(`
    SELECT a.id, a.action, a.entity, a.entity_id as entityId, a.created_at as createdAt,
           u.name as userName, u.role as userRole, u.phone as userPhone
    FROM audit_logs a JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  
  const total = (db.prepare(`SELECT COUNT(*) as c FROM audit_logs`).get() as { c: number }).c;
  
  return NextResponse.json({ logs, total, page, limit });
}
