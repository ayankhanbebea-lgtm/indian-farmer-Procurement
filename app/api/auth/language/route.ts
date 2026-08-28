import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, nowIso } from "@/lib/db";
import { LANGUAGES } from "@/lib/i18n";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const lang = body?.language;

  if (!lang || !Object.keys(LANGUAGES).includes(lang)) {
    return NextResponse.json({ error: "Invalid language code" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(`UPDATE users SET language = ?, updated_at = ? WHERE id = ?`).run(lang, nowIso(), session.id);

  return NextResponse.json({ ok: true, language: lang });
}
