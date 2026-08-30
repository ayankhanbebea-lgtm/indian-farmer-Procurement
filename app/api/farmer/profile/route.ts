import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, newId, nowIso } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }

  const db = getDb();
  let profile = db
    .prepare(
      `SELECT u.id as userId, u.name, u.phone, u.language,
              fp.id as farmerId, fp.address, fp.district, fp.state, fp.farmer_code as farmerCode
       FROM users u
       LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
       WHERE u.id = ?`
    )
    .get(session.id) as any;

  // Auto-heal: If profile record is missing in farmer_profiles table, create it immediately
  if (profile && !profile.farmerId) {
    const newFarmerId = newId("fp_");
    const farmerCode = `FP-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      db.prepare(`
        INSERT INTO farmer_profiles (id, user_id, farmer_code, district, state, language, created_at, updated_at)
        VALUES (?, ?, ?, 'Jaipur', 'Rajasthan', 'en', ?, ?)
      `).run(newFarmerId, session.id, farmerCode, nowIso(), nowIso());

      profile = db
        .prepare(
          `SELECT u.id as userId, u.name, u.phone, u.language,
                  fp.id as farmerId, fp.address, fp.district, fp.state, fp.farmer_code as farmerCode
           FROM users u
           LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
           WHERE u.id = ?`
        )
        .get(session.id) as any;
    } catch (e) {
      console.error("[Profile Auto-Create Error]", e);
    }
  }

  return NextResponse.json({ profile: profile || null });
}
