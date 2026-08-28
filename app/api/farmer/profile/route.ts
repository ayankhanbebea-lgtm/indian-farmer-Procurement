import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "FARMER") {
    return NextResponse.json({ error: "Please login as a farmer." }, { status: 401 });
  }
  const db = getDb();
  const profile = db
    .prepare(
      `SELECT u.name, u.phone, fp.address, fp.district, fp.state, fp.farmer_code as farmerCode, fp.language
       FROM users u JOIN farmer_profiles fp ON fp.user_id = u.id WHERE u.id = ?`
    )
    .get(session.id);
  return NextResponse.json({ profile });
}
