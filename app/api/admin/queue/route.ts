import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { currentlyServingToken, centreLoad } from "@/lib/services";
import { getTodayIST, normalizeDateToYMD } from "@/lib/format";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const url = new URL(req.url);
  const rawDate = url.searchParams.get("date");
  const date = rawDate ? normalizeDateToYMD(rawDate) : getTodayIST();

  
  const centres = db.prepare(`SELECT id, name, code FROM procurement_centres ORDER BY name`).all() as any[];
  
  const result = centres.map((centre) => {
    const queue = db.prepare(`
      SELECT b.id, b.token, b.status, u.name as farmerName, u.phone as farmerPhone,
             q.position, q.called_at as calledAt, cr.name as cropName
      FROM queue_entries q
      JOIN bookings b ON q.booking_id = b.id
      JOIN farmer_profiles fp ON b.farmer_id = fp.id
      JOIN users u ON fp.user_id = u.id
      JOIN crops cr ON b.crop_id = cr.id
      WHERE q.centre_id = ? AND q.date = ?
      ORDER BY q.position ASC
    `).all(centre.id, date);
    
    const serving = currentlyServingToken(centre.id, date);
    const load = centreLoad(centre.id, date);
    
    return { ...centre, queue, serving, load };
  });
  
  return NextResponse.json({ centres: result, date });
}
