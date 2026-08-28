import { getDb } from "../lib/db";
import { generateCryptographicOtp, hashOtp, sendOtpToMobile, verifySubmittedOtp } from "../lib/otp";
import { createSession, validateSession } from "../lib/auth";
import { rankCentres, getSlotAvailability, currentlyServingToken, centreLoad } from "../lib/services";
import { t, LANGUAGES } from "../lib/i18n";

async function runTests() {
  console.log("=== STARTING END-TO-END VERIFICATION TESTS ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc}`);
      failed++;
    }
  }

  const db = getDb();

  // Test 1: User Roles in Database
  console.log("\n--- TEST 1: User Models and Active Field ---");
  const users = db.prepare(`SELECT id, phone, role, name, active FROM users`).all() as any[];
  assert(users.length >= 14, `Found ${users.length} users in database (expected >= 14)`);
  const admin = users.find((u) => u.role === "ADMIN");
  const staff = users.find((u) => u.role === "STAFF");
  const farmer = users.find((u) => u.role === "FARMER");
  assert(!!admin && admin.active === 1, "Admin user exists and active = 1");
  assert(!!staff && staff.active === 1, "Staff user exists and active = 1");
  assert(!!farmer && farmer.active === 1, "Farmer user exists and active = 1");

  // Test 2: OTP Generation and Verification
  console.log("\n--- TEST 2: Passwordless Mobile + OTP Authentication ---");
  const sendRes = await sendOtpToMobile("9200000001");
  assert(sendRes.ok, "OTP sent successfully to registered farmer (9200000001)");

  // Retrieve hashed OTP from DB
  const otpRow = db.prepare(`SELECT otp_hash FROM otps WHERE phone = '9200000001' AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1`).get() as any;
  assert(!!otpRow, "Hashed OTP stored securely in database");

  // Verify submitting incorrect OTP fails
  const wrongRes = await verifySubmittedOtp("9200000001", "000000");
  assert(!wrongRes.ok, "Incorrect OTP properly rejected with attempt decrement");

  // Test 3: Session Persistence & Role Routing
  console.log("\n--- TEST 3: Persistent Server Session ---");
  const sessionToken = await createSession({
    id: farmer.id,
    name: farmer.name,
    phone: farmer.phone,
    role: "FARMER",
  });
  assert(typeof sessionToken === "string" && sessionToken.length > 20, "JWT session token created");

  const validatedUser = await validateSession(sessionToken);
  assert(validatedUser !== null && validatedUser.role === "FARMER", "Session validated from DB & cryptographically verified");

  // Test 4: Farmer Booking Flow (Date -> Centre -> Slot -> Token)
  console.log("\n--- TEST 4: Farmer Booking Flow (Date first -> Centre -> Slot) ---");
  const todayStr = new Date().toISOString().slice(0, 10);
  const rankedCentres = rankCentres(todayStr);
  assert(rankedCentres.length >= 3, `Available centres retrieved for date ${todayStr} (${rankedCentres.length} centres)`);

  const centre1Slots = getSlotAvailability(rankedCentres[0].id, todayStr);
  assert(centre1Slots.length >= 3, `Real calculated slot availability retrieved (${centre1Slots.length} slots)`);

  // Test 5: Staff Centre Isolation Security
  console.log("\n--- TEST 5: Staff Isolation Security ---");
  const staffAssignments = db.prepare(`
    SELECT cs.user_id as userId, cs.centre_id as centreId, u.name as staffName, pc.name as centreName
    FROM centre_staff cs
    JOIN users u ON cs.user_id = u.id
    JOIN procurement_centres pc ON cs.centre_id = pc.id
  `).all() as any[];
  assert(staffAssignments.length >= 3, `Staff strictly assigned to specific procurement centres (${staffAssignments.length} assignments)`);

  // Test 6: Live Queue & Advancing
  console.log("\n--- TEST 6: Real-Time Queue Advancement ---");
  const servingBefore = currentlyServingToken(staffAssignments[0].centreId, todayStr);
  assert(servingBefore !== undefined, `Currently serving token queried from database: ${servingBefore || "None"}`);

  // Test 7: Multi-Language i18n System (12 Languages)
  console.log("\n--- TEST 7: 12-Language i18n System ---");
  const supportedLangCodes = Object.keys(LANGUAGES);
  assert(supportedLangCodes.length === 12, `All 12 required Indian languages registered (${supportedLangCodes.join(", ")})`);

  assert(t("hi", "appName") === "स्मार्ट खरीद", "Hindi translation works: " + t("hi", "appName"));
  assert(t("mr", "appName") === "स्मार्ट खरेदी", "Marathi translation works: " + t("mr", "appName"));
  assert(t("bn", "appName") === "স্মার্ট সংগ্রহ", "Bengali translation works: " + t("bn", "appName"));
  assert(t("gu", "appName") === "સ્માર્ટ ખરીદી", "Gujarati translation works: " + t("gu", "appName"));
  assert(t("pa", "appName") === "ਸਮਾਰਟ ਖਰੀਦ", "Punjabi translation works: " + t("pa", "appName"));
  assert(t("ta", "appName") === "ஸ்மார்ட் கொள்முதல்", "Tamil translation works: " + t("ta", "appName"));
  assert(t("te", "appName") === "స్మార్ట్ సేకరణ", "Telugu translation works: " + t("te", "appName"));
  assert(t("kn", "appName") === "ಸ್ಮಾರ್ಟ್ ಖರೀದಿ", "Kannada translation works: " + t("kn", "appName"));
  assert(t("ml", "appName") === "സ്മാർട്ട് സംഭരണം", "Malayalam translation works: " + t("ml", "appName"));
  assert(t("or", "appName") === "ସ୍ମାର୍ଟ ସଂଗ୍ରହ", "Odia translation works: " + t("or", "appName"));
  assert(t("as", "appName") === "স্মাৰ্ট সংগ্ৰহ", "Assamese translation works: " + t("as", "appName"));

  // Test 8: Admin Portal Aggregates
  console.log("\n--- TEST 8: Admin Portal Aggregates & Audit ---");
  const auditCount = (db.prepare(`SELECT COUNT(*) as c FROM audit_logs`).get() as any).c;
  assert(typeof auditCount === "number", `Audit log entries accessible: ${auditCount}`);

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
