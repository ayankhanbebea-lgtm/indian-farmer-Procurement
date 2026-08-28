import { t, LANGUAGES } from "../lib/i18n/index";

async function testLanguageSwitching() {
  const baseUrl = "http://localhost:3001";
  console.log("=== COMPREHENSIVE LANGUAGE SYSTEM VERIFICATION ===");

  // 1. Verify translation dictionary for core strings
  console.log("\n[TEST 1] English vs Hindi Dictionary Translations:");
  const testKeys = [
    "farmerDashboard",
    "bookNewSlot",
    "myHistory",
    "callNextFarmer",
    "markArrived",
    "startWeighing",
    "activeQueue",
    "welcomeTitle",
    "today",
    "tomorrowOrDate",
    "allDates",
    "logout",
  ] as const;

  for (const key of testKeys) {
    const enText = t("en", key);
    const hiText = t("hi", key);
    console.log(`  • ${key.padEnd(18)} → EN: "${enText}" | HI: "${hiText}"`);
    if (!enText || !hiText || enText === hiText) {
      throw new Error(`Translation missing or unchanged for key: ${key}`);
    }
  }

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

  // 2. Test User Language Preference Persistence (Farmer Ramesh Kumar)
  console.log("\n[TEST 2] Testing User Language Persistence via PATCH /api/auth/language:");
  const farmer = await login("9200000001");
  
  // Switch to Hindi
  const patchHi = await fetch(`${baseUrl}/api/auth/language`, {
    method: "PATCH",
    headers: { ...farmer.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ language: "hi" }),
  });
  console.log("   Switched Farmer to 'hi': status =", patchHi.status);

  // Check /api/auth/me
  const meHi = await (await fetch(`${baseUrl}/api/auth/me`, { headers: farmer.headers })).json();
  console.log("   Farmer language in DB after switch to 'hi':", meHi.user?.language);
  if (meHi.user?.language !== "hi") throw new Error("Farmer language was not persisted as 'hi'");

  // Switch back to English
  const patchEn = await fetch(`${baseUrl}/api/auth/language`, {
    method: "PATCH",
    headers: { ...farmer.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ language: "en" }),
  });
  console.log("   Switched Farmer to 'en': status =", patchEn.status);

  const meEn = await (await fetch(`${baseUrl}/api/auth/me`, { headers: farmer.headers })).json();
  console.log("   Farmer language in DB after switch to 'en':", meEn.user?.language);
  if (meEn.user?.language !== "en") throw new Error("Farmer language was not persisted as 'en'");

  // 3. Test Session Independence (Staff Anita Verma remains unaffected)
  console.log("\n[TEST 3] Testing Session Independence across Roles:");
  const staff = await login("9100000002");
  const staffMe = await (await fetch(`${baseUrl}/api/auth/me`, { headers: staff.headers })).json();
  console.log("   Staff initial language in DB:", staffMe.user?.language);

  // Switch staff to Hindi
  await fetch(`${baseUrl}/api/auth/language`, {
    method: "PATCH",
    headers: { ...staff.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ language: "hi" }),
  });
  const staffMeHi = await (await fetch(`${baseUrl}/api/auth/me`, { headers: staff.headers })).json();
  const farmerMeCheck = await (await fetch(`${baseUrl}/api/auth/me`, { headers: farmer.headers })).json();

  console.log("   Staff language after updating Staff:", staffMeHi.user?.language);
  console.log("   Farmer language (should remain 'en'):", farmerMeCheck.user?.language);
  if (staffMeHi.user?.language !== "hi" || farmerMeCheck.user?.language !== "en") {
    throw new Error("Role language preferences interfered with each other!");
  }

  // Restore staff to en
  await fetch(`${baseUrl}/api/auth/language`, {
    method: "PATCH",
    headers: { ...staff.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ language: "en" }),
  });

  console.log("\n🏆 ALL LANGUAGE SYSTEM VERIFICATION TESTS PASSED!");
}

testLanguageSwitching().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
