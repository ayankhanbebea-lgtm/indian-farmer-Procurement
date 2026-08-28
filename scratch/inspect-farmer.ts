import { getDb } from "../lib/db";
import { getFarmerProfileId } from "../lib/farmer";
import { createSessionToken } from "../lib/auth";

async function inspectFarmerAPIs() {
  const db = getDb();
  console.log("=== INSPECTING FARMER DATABASE & API LAYER ===");

  // 1. Check Ramesh Kumar in users table
  const user = db.prepare(`SELECT * FROM users WHERE phone = '9200000001'`).get() as any;
  console.log("\n1. User record for 9200000001:", user);

  // 2. Check farmer_profiles table
  const profile = db.prepare(`SELECT * FROM farmer_profiles WHERE user_id = ?`).get(user.id) as any;
  console.log("\n2. Farmer profile record:", profile);

  // 3. Check getFarmerProfileId
  const profileId = getFarmerProfileId(user.id);
  console.log("\n3. getFarmerProfileId(user.id):", profileId);

  // 4. Check bookings for farmerId
  const bookings = db.prepare(`SELECT b.*, c.name as cropName, ctr.name as centreName, s.date, s.start_time as startTime FROM bookings b JOIN crops c ON b.crop_id = c.id JOIN procurement_centres ctr ON b.centre_id = ctr.id JOIN slots s ON b.slot_id = s.id WHERE b.farmer_id = ?`).all(profileId);
  console.log(`\n4. Bookings count for farmerId (${profileId}):`, bookings.length);
  console.log("   Bookings:", bookings.map((b: any) => ({ token: b.token, status: b.status, date: b.date, crop: b.cropName, centre: b.centreName })));

  // 5. Test token generation and session validation
  const token = await createSessionToken({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
  });

  const baseUrl = "http://localhost:3001";
  const headers = { Cookie: `sp_session=${token}` };

  console.log("\n5. Testing HTTP endpoints with valid session token:");

  const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers });
  console.log("   /api/auth/me:", meRes.status, await meRes.json());

  const currentRes = await fetch(`${baseUrl}/api/farmer/current`, { headers });
  console.log("   /api/farmer/current:", currentRes.status, await currentRes.json());

  const historyRes = await fetch(`${baseUrl}/api/farmer/history`, { headers });
  console.log("   /api/farmer/history:", historyRes.status, await historyRes.json());

  const profileRes = await fetch(`${baseUrl}/api/farmer/profile`, { headers });
  console.log("   /api/farmer/profile:", profileRes.status, await profileRes.json());

  const optionsRes = await fetch(`${baseUrl}/api/farmer/booking-options`, { headers });
  console.log("   /api/farmer/booking-options:", optionsRes.status, Object.keys(await optionsRes.json()));
}

inspectFarmerAPIs().catch(console.error);
