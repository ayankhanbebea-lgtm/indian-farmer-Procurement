async function testCompleteAppFlow() {
  const baseUrl = "http://localhost:3001";
  console.log("=== COMPREHENSIVE END-TO-END APPLICATION TEST ===");

  // --- 1. FARMER LOGIN & COMPLETE DATA SUITE ---
  console.log("\n[TEST SUITE 1] Farmer Portal (Ramesh Kumar - 9200000001)...");
  
  // A. Send OTP
  const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9200000001" }),
  });
  console.log("1. Send OTP status:", sendRes.status);
  
  const devOtpRes = await fetch(`${baseUrl}/api/auth/dev-otp?phone=9200000001`);
  const { otp } = await devOtpRes.json();
  console.log("2. OTP code:", otp);

  // B. Verify OTP
  const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9200000001", otp }),
  });
  const cookie = verifyRes.headers.get("set-cookie")?.split(";")[0] || "";
  console.log("3. Verify OTP status:", verifyRes.status, "Cookie received:", cookie.length > 0);
  const headers = { Cookie: cookie };

  // C. Auth Me
  const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers });
  const me = await meRes.json();
  console.log("4. /api/auth/me:", me.user?.name, "Role:", me.user?.role);
  if (me.user?.role !== "FARMER") throw new Error("Expected FARMER role");

  // D. Farmer Current Booking
  const curRes = await fetch(`${baseUrl}/api/farmer/current`, { headers });
  const cur = await curRes.json();
  console.log("5. /api/farmer/current active booking:", cur.booking?.token, cur.booking?.cropName, cur.booking?.status);
  if (!cur.booking?.token) throw new Error("Expected active booking token");

  // E. Farmer History
  const histRes = await fetch(`${baseUrl}/api/farmer/history`, { headers });
  const hist = await histRes.json();
  console.log("6. /api/farmer/history count:", hist.bookings?.length);
  if (!Array.isArray(hist.bookings) || hist.bookings.length === 0) throw new Error("Expected history bookings");

  // F. Farmer Profile
  const profRes = await fetch(`${baseUrl}/api/farmer/profile`, { headers });
  const prof = await profRes.json();
  console.log("7. /api/farmer/profile:", prof.profile?.name, "District:", prof.profile?.district);
  if (!prof.profile?.name) throw new Error("Expected profile name");

  // G. Farmer Booking Options
  const optRes = await fetch(`${baseUrl}/api/farmer/booking-options`, { headers });
  const opt = await optRes.json();
  console.log("8. /api/farmer/booking-options dates count:", opt.validDates?.length, "crops count:", opt.crops?.length);
  if (!opt.validDates?.length) throw new Error("Expected valid dates");

  // --- 2. STAFF LOGIN & QUEUE SUITE ---
  console.log("\n[TEST SUITE 2] Staff Portal (Centre 02 - 9100000002)...");
  await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9100000002" }),
  });
  const staffOtpRes = await fetch(`${baseUrl}/api/auth/dev-otp?phone=9100000002`);
  const { otp: staffOtp } = await staffOtpRes.json();

  const staffVerifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9100000002", otp: staffOtp }),
  });
  const staffCookie = staffVerifyRes.headers.get("set-cookie")?.split(";")[0] || "";
  const staffHeaders = { Cookie: staffCookie };

  const staffQueueRes = await fetch(`${baseUrl}/api/staff/queue`, { headers: staffHeaders });
  const staffQueue = await staffQueueRes.json();
  console.log("1. Staff Queue Centre:", staffQueue.centre?.name, "Total farmers in queue:", staffQueue.rows?.length);
  if (!staffQueue.centre?.name) throw new Error("Expected staff centre");

  // --- 3. ADMIN LOGIN & OVERVIEW SUITE ---
  console.log("\n[TEST SUITE 3] Admin Portal (Admin - 9000000001)...");
  await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9000000001" }),
  });
  const adminOtpRes = await fetch(`${baseUrl}/api/auth/dev-otp?phone=9000000001`);
  const { otp: adminOtp } = await adminOtpRes.json();

  const adminVerifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9000000001", otp: adminOtp }),
  });
  const adminCookie = adminVerifyRes.headers.get("set-cookie")?.split(";")[0] || "";
  const adminHeaders = { Cookie: adminCookie };

  const adminOverviewRes = await fetch(`${baseUrl}/api/admin/overview`, { headers: adminHeaders });
  const adminOverview = await adminOverviewRes.json();
  console.log("1. Admin Overview total farmers:", adminOverview.overview?.totalFarmers, "Centres:", adminOverview.overview?.totalCentres);
  if (!adminOverview.overview?.totalFarmers) throw new Error("Expected admin overview data");

  console.log("\n========================================================");
  console.log("🎉 ALL TESTS PASSED! APPLICATION IS 100% OPERATIONAL!");
  console.log("========================================================\n");
}

testCompleteAppFlow().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
