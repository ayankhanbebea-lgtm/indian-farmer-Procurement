async function verifyAdminVsStaff() {
  const baseUrl = "http://localhost:3001";
  console.log("=== COMPARING ADMIN DATABASE QUERY VS STAFF DATABASE QUERY ===");

  // Helper for OTP login
  async function login(phone: string) {
    await fetch(`${baseUrl}/api/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobileNumber: phone }),
    });
    const devOtpRes = await fetch(`${baseUrl}/api/auth/dev-otp?phone=${phone}`);
    const { otp } = await devOtpRes.json();
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobileNumber: phone, otp }),
    });
    const cookie = verifyRes.headers.get("set-cookie")?.split(";")[0] || "";
    return { cookie, headers: { Cookie: cookie } };
  }

  // 1. Farmer creates real booking for Centre 02
  const farmer = await login("9200000001");
  const opt = await (await fetch(`${baseUrl}/api/farmer/booking-options`, { headers: farmer.headers })).json();
  const today = opt.today;
  const centre2 = opt.centres.find((c: any) => c.code === "JPR02");
  const slotRes = await fetch(`${baseUrl}/api/farmer/booking-options?date=${today}&centreId=${centre2.id}`, { headers: farmer.headers });
  const slotData = await slotRes.json();
  const slot1 = slotData.slots[0];

  console.log(`\n[STEP 1] Farmer Ramesh Kumar creates booking for [${centre2.name}]...`);
  const createRes = await fetch(`${baseUrl}/api/farmer/bookings`, {
    method: "POST",
    headers: { ...farmer.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      cropCode: "WHT",
      quantityQuintal: 40,
      centreId: centre2.id,
      date: today,
      slotId: slot1.id,
    }),
  });
  const { bookingId, token } = await createRes.json();
  console.log("   Created Booking:", { bookingId, token });

  // 2. Admin retrieves booking via GET /api/admin/bookings
  console.log("\n[STEP 2] Admin queries GET /api/admin/bookings...");
  const admin = await login("9000000001");
  const adminRes = await fetch(`${baseUrl}/api/admin/bookings?centreId=${centre2.id}&date=${today}`, { headers: admin.headers });
  const adminData = await adminRes.json();
  const adminBooking = adminData.bookings.find((b: any) => b.id === bookingId);
  console.log("   Admin booking count:", adminData.bookings.length);
  console.log("   Admin booking found:", {
    id: adminBooking?.id,
    token: adminBooking?.token,
    farmer: adminBooking?.farmerName,
    centre: adminBooking?.centreName,
    date: adminBooking?.date,
    status: adminBooking?.status,
  });

  // 3. Staff at Centre 02 retrieves queue via GET /api/staff/queue
  console.log("\n[STEP 3] Staff Anita Verma (Centre 02) queries GET /api/staff/queue...");
  const staff = await login("9100000002");
  const staffRes = await fetch(`${baseUrl}/api/staff/queue?date=${today}`, { headers: staff.headers });
  const staffData = await staffRes.json();
  const staffBooking = staffData.rows.find((b: any) => b.id === bookingId);
  console.log("   Staff queue count:", staffData.rows.length);
  console.log("   Staff booking found:", {
    id: staffBooking?.id,
    token: staffBooking?.token,
    farmer: staffBooking?.farmerName,
    centre: staffData.centre.name,
    date: staffBooking?.slotDate,
    status: staffBooking?.status,
  });

  // 4. Side-by-side comparison
  console.log("\n==================== COMPARISON PROOF ====================");
  console.log("Admin Booking ID: ", adminBooking?.id);
  console.log("Staff Booking ID: ", staffBooking?.id);
  console.log("IDs Match?        ", adminBooking?.id === staffBooking?.id);

  console.log("Admin Token:      ", adminBooking?.token);
  console.log("Staff Token:      ", staffBooking?.token);
  console.log("Tokens Match?     ", adminBooking?.token === staffBooking?.token);

  console.log("Admin Status:     ", adminBooking?.status);
  console.log("Staff Status:     ", staffBooking?.status);
  console.log("Status Matches?   ", adminBooking?.status === staffBooking?.status);
  console.log("==========================================================\n");

  if (adminBooking?.id !== staffBooking?.id || adminBooking?.token !== staffBooking?.token) {
    throw new Error("Admin and Staff queries are out of sync!");
  }

  console.log("🏆 Admin and Staff queries read the EXACT same database record!");
}

verifyAdminVsStaff().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
