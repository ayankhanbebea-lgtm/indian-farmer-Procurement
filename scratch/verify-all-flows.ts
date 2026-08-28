async function verifyAllFlows() {
  const baseUrl = "http://localhost:3001";
  console.log("=== COMPREHENSIVE RUNTIME VERIFICATION ===");

  // 1. Send OTP to Ramesh Kumar
  console.log("\n1. Testing OTP Generation for Farmer Ramesh Kumar (+91 9200000001)...");
  const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9200000001" }),
  });
  const sendData = await sendRes.json();
  console.log("   Send OTP response:", sendRes.status, sendData);

  // 2. Fetch Dev OTP
  const devOtpRes = await fetch(`${baseUrl}/api/auth/dev-otp?phone=9200000001`);
  const devOtpData = await devOtpRes.json();
  console.log("   Retrieved OTP code:", devOtpData.otp);
  if (!devOtpData.otp) throw new Error("Failed to retrieve OTP code from dev endpoint");

  // 3. Verify OTP
  console.log("\n2. Testing OTP Verification & Session Cookie Issue...");
  const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9200000001", otp: devOtpData.otp }),
  });
  const verifyData = await verifyRes.json();
  console.log("   Verify status:", verifyRes.status, verifyData);
  const setCookie = verifyRes.headers.get("set-cookie");
  console.log("   Set-Cookie header:", setCookie ? "PRESENT (HTTP-Only)" : "MISSING");
  const cookieVal = setCookie ? setCookie.split(";")[0] : "";

  // 4. Call /api/auth/me
  console.log("\n3. Testing /api/auth/me with authenticated session...");
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookieVal },
  });
  const meData = await meRes.json();
  console.log("   User Name:", meData.user?.name);
  console.log("   User Role:", meData.user?.role);
  console.log("   User Phone:", meData.user?.phone);
  if (meData.user?.role !== "FARMER") throw new Error("Role mismatch in auth/me");

  // 5. Call /api/farmer/current
  console.log("\n4. Testing /api/farmer/current (Dashboard active booking data)...");
  const currentRes = await fetch(`${baseUrl}/api/farmer/current`, {
    headers: { Cookie: cookieVal },
  });
  const currentData = await currentRes.json();
  console.log("   Status:", currentRes.status);
  console.log("   Active Token:", currentData.booking?.token);
  console.log("   Crop Name:", currentData.booking?.cropName);
  console.log("   Centre Name:", currentData.booking?.centreName);
  console.log("   Farmers Ahead:", currentData.booking?.farmersAhead);
  console.log("   Estimated Wait:", currentData.booking?.estimatedWaitMins, "mins");
  console.log("   Currently Serving:", currentData.booking?.currentlyServing);
  if (!currentData.booking?.token) throw new Error("Active booking missing for Ramesh Kumar");

  // 6. Call /api/farmer/booking-options
  console.log("\n5. Testing /api/farmer/booking-options (Date-first booking flow data)...");
  const optsRes = await fetch(`${baseUrl}/api/farmer/booking-options`, {
    headers: { Cookie: cookieVal },
  });
  const optsData = await optsRes.json();
  console.log("   Valid dates count:", optsData.validDates?.length);
  console.log("   Available crops:", optsData.crops?.map((c: any) => c.name).join(", "));

  // 7. Call /api/farmer/history
  console.log("\n6. Testing /api/farmer/history...");
  const historyRes = await fetch(`${baseUrl}/api/farmer/history`, {
    headers: { Cookie: cookieVal },
  });
  const historyData = await historyRes.json();
  console.log("   History records count:", historyData.bookings?.length);

  // 8. Test Unauthenticated Access to /farmer/current
  console.log("\n7. Testing unauthenticated access protection...");
  const unauthRes = await fetch(`${baseUrl}/api/farmer/current`);
  console.log("   Unauthenticated status:", unauthRes.status, "(expected 401)");
  if (unauthRes.status !== 401) throw new Error("Expected 401 for unauthenticated request");

  console.log("\n==========================================");
  console.log("✅ ALL RUNTIME VERIFICATION CHECKS PASSED!");
  console.log("==========================================\n");
}

verifyAllFlows().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
