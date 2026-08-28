import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 200 });

  // Fetch language preference from DB (not stored in JWT)
  let language = "en";
  try {
    const db = getDb();
    const row = db.prepare(`SELECT language FROM users WHERE id = ?`).get(session.id) as
      | { language: string }
      | undefined;
    if (row?.language) language = row.language;
  } catch {
    // fallback to en
  }

  return NextResponse.json({ user: { ...session, language } });
}
