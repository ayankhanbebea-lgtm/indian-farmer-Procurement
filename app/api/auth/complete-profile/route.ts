import { NextRequest, NextResponse } from "next/server";
import { completeProfileSchema } from "@/lib/validation";
import { getDb, newId, nowIso } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = completeProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid profile details." },
        { status: 400 }
      );
    }

    const { mobileNumber, name, district, address, language } = parsed.data;
    const phone = mobileNumber.replace(/\D/g, "").slice(-10);

    const db = getDb();

    // Verify that this phone number had an OTP successfully verified recently (within last 15 mins)
    const recentVerified = db
      .prepare(
        `SELECT id FROM otps
         WHERE phone = ? AND verified_at IS NOT NULL AND verified_at != 'SUPERSEDED' AND verified_at != 'EXCEEDED'
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(phone);

    if (!recentVerified) {
      return NextResponse.json(
        { error: "Mobile number verification expired. Please verify with OTP again." },
        { status: 403 }
      );
    }

    // Check if user already exists
    let existingUser = db
      .prepare(`SELECT id, phone, name, role FROM users WHERE phone = ?`)
      .get(phone) as { id: string; phone: string; name: string; role: "FARMER" | "STAFF" | "ADMIN" } | undefined;

    let userId = existingUser?.id;

    if (!existingUser) {
      userId = newId("usr_");
      const farmerProfileId = newId("frm_");
      const farmerCode = `FP-${Date.now().toString().slice(-4)}`;

      db.exec("BEGIN");
      try {
        db.prepare(
          `INSERT INTO users (id, phone, role, name, language, created_at, updated_at)
           VALUES (?, ?, 'FARMER', ?, ?, ?, ?)`
        ).run(userId, phone, name, language || "en", nowIso(), nowIso());

        db.prepare(
          `INSERT INTO farmer_profiles (id, user_id, address, district, state, farmer_code, language, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'Rajasthan', ?, ?, ?, ?)`
        ).run(
          farmerProfileId,
          userId,
          address || null,
          district,
          farmerCode,
          language || "en",
          nowIso(),
          nowIso()
        );

        // Add welcome notification
        db.prepare(
          `INSERT INTO notifications (id, user_id, booking_id, type, message, read, created_at)
           VALUES (?, ?, NULL, 'WELCOME', 'Welcome to KRISHIDHENU. You can now book your procurement slots.', 0, ?)`
        ).run(newId("ntf_"), userId, nowIso());

        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        console.error("Profile creation error:", e);
        return NextResponse.json({ error: "Failed to create farmer profile." }, { status: 500 });
      }
    }

    const sessionUser = {
      id: userId!,
      name: name,
      phone: phone,
      role: "FARMER" as const,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    const res = NextResponse.json({
      ok: true,
      user: sessionUser,
    });

    res.cookies.set("sp_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return res;
  } catch (err: any) {
    console.error("complete-profile exception:", err);
    return NextResponse.json(
      { error: "Unable to complete profile. Please try again." },
      { status: 500 }
    );
  }
}
