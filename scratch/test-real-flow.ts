async function testRealBrowserLoginFlow() {
  const baseUrl = "http://localhost:3001";
  console.log("=== TESTING FULL SERVER-AUTHENTICATED BROWSER FLOW ===");

  // 1. Send OTP
  const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9200000001" }),
  });
  console.log("1. Send OTP status:", sendRes.status);

  // 2. Get dev OTP from server
  const devOtpRes = await fetch(`${baseUrl}/api/auth/dev-otp?phone=9200000001`);
  const devOtpData = await devOtpRes.json();
  const otp = devOtpData.otp;
  console.log("2. Retrieved OTP from server:", otp);

  // 3. Verify OTP
  const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9200000001", otp }),
  });
  console.log("3. Verify status:", verifyRes.status);
  const setCookie = verifyRes.headers.get("set-cookie");
  console.log("   Set-Cookie:", setCookie ? "YES" : "NO");
  const cookie = setCookie ? setCookie.split(";")[0] : "";

  // 4. Test /api/auth/me
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  const meData = await meRes.json();
  console.log("4. /api/auth/me:", meRes.status, meData);

  // 5. Test /api/farmer/current
  const currentRes = await fetch(`${baseUrl}/api/farmer/current`, {
    headers: { Cookie: cookie },
  });
  const currentData = await currentRes.json();
  console.log("5. /api/farmer/current:", currentRes.status, currentData);

  // 6. Test /api/farmer/history
  const historyRes = await fetch(`${baseUrl}/api/farmer/history`, {
    headers: { Cookie: cookie },
  });
  const historyData = await historyRes.json();
  console.log("6. /api/farmer/history:", historyRes.status, historyData);

  // 7. Test /api/farmer/profile
  const profileRes = await fetch(`${baseUrl}/api/farmer/profile`, {
    headers: { Cookie: cookie },
  });
  const profileData = await profileRes.json();
  console.log("7. /api/farmer/profile:", profileRes.status, profileData);

  // 8. Test /api/farmer/booking-options
  const optionsRes = await fetch(`${baseUrl}/api/farmer/booking-options`, {
    headers: { Cookie: cookie },
  });
  const optionsData = await optionsRes.json();
  console.log("8. /api/farmer/booking-options:", optionsRes.status, "keys:", Object.keys(optionsData));
}

testRealBrowserLoginFlow().catch(console.error);
