import { NextRequest, NextResponse } from "next/server";
import { completeProfileSchema } from "@/lib/validation";
import { getDb, newId, nowIso } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = completeProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid registration details" },
      { status: 400 }
    );
  }
  const { name, mobileNumber, district, address, language } = parsed.data;
  const phone = mobileNumber.replace(/\D/g, "").slice(-10);

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  if (existing) {
    return NextResponse.json(
      { error: "This mobile number is already registered. Please login with OTP." },
      { status: 409 }
    );
  }

  const userId = newId("usr_");
  const farmerId = newId("frm_");
  const farmerCode = `FP-${Date.now().toString().slice(-4)}`;

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO users (id, phone, role, name, language, created_at, updated_at) VALUES (?, ?, 'FARMER', ?, ?, ?, ?)`
    ).run(userId, phone, name, language || "en", nowIso(), nowIso());

    db.prepare(
      `INSERT INTO farmer_profiles (id, user_id, address, district, state, farmer_code, language, created_at, updated_at) VALUES (?, ?, ?, ?, 'Rajasthan', ?, ?, ?, ?)`
    ).run(farmerId, userId, address || null, district, farmerCode, language || "en", nowIso(), nowIso());

    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: "Unable to create farmer account. Please try again." }, { status: 500 });
  }

  const sessionUser = { id: userId, name, phone, role: "FARMER" as const };
  const token = await createSessionToken(sessionUser);
  await setSessionCookie(token);

  return NextResponse.json({ user: sessionUser });
}
