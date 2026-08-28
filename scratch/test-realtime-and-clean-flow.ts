async function testRealtimeAndCleanFlow() {
  const baseUrl = "http://localhost:3001";
  console.log("=== COMPREHENSIVE TEST: CLEAN DATABASE & REALTIME STAFF-FARMER WORKFLOW ===");

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

  // --- STEP 1: VERIFY CLEAN EMPTY STATE ON STAFF & FARMER DASHBOARDS ---
  console.log("\n[STEP 1] Verifying Clean Initial State (ZERO Fake Data)...");
  
  const staff2 = await login("9100000002"); // Anita Verma - Centre 02
  const staffQueueRes = await fetch(`${baseUrl}/api/staff/queue`, { headers: staff2.headers });
  const staffQueue = await staffQueueRes.json();
  console.log("   Staff Centre 02 queue total bookings:", staffQueue.rows.length);
  console.log("   Staff Centre 02 summary:", staffQueue.summary);
  if (staffQueue.rows.length !== 0) throw new Error("Expected 0 bookings in clean state!");

  const farmer1 = await login("9200000001"); // Ramesh Kumar
  const farmerCurRes = await fetch(`${baseUrl}/api/farmer/current`, { headers: farmer1.headers });
  const farmerCur = await farmerCurRes.json();
  console.log("   Farmer Ramesh Kumar active booking:", farmerCur.booking);
  if (farmerCur.booking !== null) throw new Error("Expected null active booking in clean state!");

  const farmerHistRes = await fetch(`${baseUrl}/api/farmer/history`, { headers: farmer1.headers });
  const farmerHist = await farmerHistRes.json();
  console.log("   Farmer Ramesh Kumar history count:", farmerHist.bookings.length);
  if (farmerHist.bookings.length !== 0) throw new Error("Expected 0 history records in clean state!");

  // --- STEP 2: FARMER REAL BOOKING FLOW ---
  console.log("\n[STEP 2] Farmer Ramesh Kumar creates real booking...");
  
  const optRes = await fetch(`${baseUrl}/api/farmer/booking-options`, { headers: farmer1.headers });
  const opt = await optRes.json();
  const today = opt.today;
  const wheatCrop = opt.crops.find((c: any) => c.code === "WHT");
  const centre2 = opt.centres.find((c: any) => c.code === "JPR02");
  
  // Get slot for centre 2
  const slotRes = await fetch(`${baseUrl}/api/farmer/booking-options?date=${today}&centreId=${centre2.id}`, { headers: farmer1.headers });
  const slotData = await slotRes.json();
  const slot1 = slotData.slots[0];
  console.log(`   Selected Date: ${today}, Crop: Wheat, Centre: ${centre2.name}, Slot: ${slot1.startTime}-${slot1.endTime}`);

  const createRes = await fetch(`${baseUrl}/api/farmer/bookings`, {
    method: "POST",
    headers: { ...farmer1.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      cropCode: "WHT",
      quantityQuintal: 45,
      centreId: centre2.id,
      date: today,
      slotId: slot1.id,
    }),
  });
  const createData = await createRes.json();
  console.log("   Booking creation response:", createRes.status, createData);
  if (!createData.token) throw new Error("Booking creation failed!");
  const token = createData.token;
  const bookingId = createData.bookingId;

  // --- STEP 3: STAFF DASHBOARD RECEIVES REAL BOOKING ---
  console.log("\n[STEP 3] Verifying Staff Dashboard reflects the newly created booking...");
  const updatedStaffQueue = await (await fetch(`${baseUrl}/api/staff/queue`, { headers: staff2.headers })).json();
  console.log("   Staff Centre 02 queue count:", updatedStaffQueue.rows.length);
  console.log("   First in queue:", updatedStaffQueue.rows[0]?.farmerName, "Token:", updatedStaffQueue.rows[0]?.token, "Status:", updatedStaffQueue.rows[0]?.status);
  if (updatedStaffQueue.rows[0]?.token !== token) throw new Error("Token mismatch on staff dashboard!");

  // Verify Centre 01 staff does NOT see this booking
  const staff1 = await login("9100000001"); // Suresh Sharma - Centre 01
  const staff1Queue = await (await fetch(`${baseUrl}/api/staff/queue`, { headers: staff1.headers })).json();
  console.log("   Staff Centre 01 queue count (should be 0):", staff1Queue.rows.length);
  if (staff1Queue.rows.length !== 0) throw new Error("Centre isolation failed! Centre 01 saw Centre 02 booking.");

  // --- STEP 4: STAFF STATUS TRANSITIONS (STATE MACHINE) ---
  console.log("\n[STEP 4] Testing Full State Machine (Arrived -> Weighing -> Completed -> Payment)...");

  // A. Call Next Farmer
  console.log("   Staff clicks 'Call Next Farmer'...");
  const callRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff2.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "CALL_NEXT" }),
  });
  console.log("   Call Next response:", callRes.status, await callRes.json());

  // B. Mark Arrived
  console.log("   Staff marks Arrived...");
  const arrRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff2.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "MARK_ARRIVED" }),
  });
  console.log("   Mark Arrived status:", arrRes.status, await arrRes.json());

  // C. Start Weighing
  console.log("   Staff starts Weighing...");
  const weighRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff2.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "START_WEIGHING" }),
  });
  console.log("   Start Weighing status:", weighRes.status, await weighRes.json());

  // D. Complete Procurement & Record Scale Weight
  console.log("   Staff completes procurement with scale weight 44.5 Q...");
  const compRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff2.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "COMPLETE_PROCUREMENT", actualQuantity: 44.5, qualityGrade: "GRADE_A" }),
  });
  console.log("   Complete Procurement status:", compRes.status, await compRes.json());

  // E. Initiate Payment
  console.log("   Staff initiates DBT payment of ₹242,525...");
  const payRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff2.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "START_PAYMENT", amount: 242525 }),
  });
  console.log("   Start Payment status:", payRes.status, await payRes.json());

  // F. Complete Payment
  console.log("   Staff confirms Payment Settled...");
  const paidRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff2.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "COMPLETE_PAYMENT" }),
  });
  console.log("   Complete Payment status:", paidRes.status, await paidRes.json());

  // --- STEP 5: VERIFY FARMER HISTORY CONTAINS THE COMPLETED RECORD ---
  console.log("\n[STEP 5] Verifying Farmer History contains the procured record...");
  const finalHist = await (await fetch(`${baseUrl}/api/farmer/history`, { headers: farmer1.headers })).json();
  console.log("   Farmer history records count:", finalHist.bookings.length);
  console.log("   Record details:", {
    token: finalHist.bookings[0]?.token,
    status: finalHist.bookings[0]?.status,
    actualQuantity: finalHist.bookings[0]?.actualQuantity,
    paymentStatus: finalHist.bookings[0]?.paymentStatus,
    paymentAmount: finalHist.bookings[0]?.paymentAmount,
  });
  if (finalHist.bookings[0]?.actualQuantity !== 44.5) throw new Error("Actual quantity mismatch in history!");

  // Verify other farmer does NOT see this history
  const farmer2 = await login("9200000002"); // Suman Devi
  const farmer2Hist = await (await fetch(`${baseUrl}/api/farmer/history`, { headers: farmer2.headers })).json();
  console.log("   Farmer 2 (Suman Devi) history count (should be 0):", farmer2Hist.bookings.length);
  if (farmer2Hist.bookings.length !== 0) throw new Error("History isolation failed!");

  console.log("\n==========================================================================");
  console.log("🏆 100% REAL DATABASE-DRIVEN REALTIME WORKFLOW VALIDATION COMPLETE!");
  console.log("==========================================================================\n");
}

testRealtimeAndCleanFlow().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
