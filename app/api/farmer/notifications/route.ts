import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please login." }, { status: 401 });

  const db = getDb();
  const notifications = db
    .prepare(
      `SELECT id, type, message, read, created_at as createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    )
    .all(session.id);
  return NextResponse.json({ notifications });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please login." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const db = getDb();
  if (body?.markAllRead) {
    db.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).run(session.id);
  } else if (body?.id) {
    db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`).run(body.id, session.id);
  }
  return NextResponse.json({ ok: true });
}
