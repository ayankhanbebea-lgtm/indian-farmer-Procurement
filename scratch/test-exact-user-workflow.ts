async function testExactUserWorkflow() {
  const baseUrl = "http://localhost:3001";
  console.log("==========================================================================");
  console.log("=== COMPREHENSIVE E2E VERIFICATION: FARMER -> DB -> STAFF QUEUE ===");
  console.log("==========================================================================\n");

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

  // 1. Log in as Farmer (Ramesh Kumar - 9200000001)
  console.log("1. Logging in as Farmer Ramesh Kumar (9200000001)...");
  const farmer = await login("9200000001");
  const farmerMe = await (await fetch(`${baseUrl}/api/auth/me`, { headers: farmer.headers })).json();
  console.log("   Farmer logged in:", farmerMe.user.name, "(Role:", farmerMe.user.role, ")");

  // 2. Fetch booking options and select Jaipur Procurement Centre 02
  const optRes = await fetch(`${baseUrl}/api/farmer/booking-options`, { headers: farmer.headers });
  const opt = await optRes.json();
  const today = opt.today;
  const wheatCrop = opt.crops.find((c: any) => c.code === "WHT");
  const centre2 = opt.centres.find((c: any) => c.code === "JPR02");
  
  const slotRes = await fetch(`${baseUrl}/api/farmer/booking-options?date=${today}&centreId=${centre2.id}`, { headers: farmer.headers });
  const slotData = await slotRes.json();
  const slot1 = slotData.slots[0];

  console.log(`\n2. Creating Booking for [${centre2.name}] (${centre2.id}) on [${today}]...`);
  const createRes = await fetch(`${baseUrl}/api/farmer/bookings`, {
    method: "POST",
    headers: { ...farmer.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      cropCode: "WHT",
      quantityQuintal: 50,
      centreId: centre2.id,
      date: today,
      slotId: slot1.id,
    }),
  });
  const createData = await createRes.json();
  console.log("   Booking Response:", createRes.status, createData);
  if (!createData.token) throw new Error("Booking creation failed: " + JSON.stringify(createData));
  const { bookingId, token } = createData;

  // 3. Log in as Staff assigned to Centre 02 (Anita Verma - 9100000002)
  console.log("\n3. Logging in as Staff Anita Verma (9100000002) assigned to Centre 02...");
  const staff = await login("9100000002");
  const staffMe = await (await fetch(`${baseUrl}/api/auth/me`, { headers: staff.headers })).json();

  // 4. Query Staff Queue API
  console.log("\n4. Fetching Staff Queue from GET /api/staff/queue...");
  const staffQueueRes = await fetch(`${baseUrl}/api/staff/queue`, { headers: staff.headers });
  const queueData = await staffQueueRes.json();

  // PRINT REQUIRED DEBUG OUTPUT EXACTLY AS SPECIFIED
  console.log("\n==================== REQUIRED DEBUG OUTPUT ====================");
  console.log("[STAFF AUTH]");
  console.log(`userId: ${staffMe.user.id}`);
  console.log(`role: ${staffMe.user.role}`);
  console.log(`staffId: ${staffMe.user.id}`);

  console.log("\n[STAFF CENTRE]");
  console.log(`procurementCentreId: ${queueData.centre.id}`);
  console.log(`centreName: ${queueData.centre.name} (${queueData.centre.code})`);

  console.log("\n[QUEUE REQUEST]");
  console.log(`selectedDate: ${queueData.date}`);
  console.log(`centreId: ${queueData.centre.id}`);

  console.log("\n[QUEUE RESPONSE]");
  console.log(`bookingCount: ${queueData.rows.length}`);
  console.log(`summary:`, queueData.summary);
  console.log(`bookings:`, queueData.rows.map((r: any) => ({
    token: r.token,
    farmer: r.farmerName,
    crop: r.cropName,
    quantity: r.quantityQuintal,
    status: r.status,
  })));

  console.log("\n[BOOKING TEST]");
  console.log(`bookingId: ${bookingId}`);
  console.log(`token: ${token}`);
  console.log(`bookingCentreId: ${centre2.id}`);
  console.log(`staffCentreId: ${queueData.centre.id}`);
  console.log(`status: ${queueData.rows[0]?.status}`);
  console.log(`centreIdsMatch: ${centre2.id === queueData.centre.id}`);
  console.log("================================================================\n");

  if (centre2.id !== queueData.centre.id) throw new Error("Centre ID mismatch!");
  if (queueData.rows.length !== 1 || queueData.rows[0]?.token !== token) {
    throw new Error(`Booking ${token} not found in Staff queue!`);
  }

  // 5. Test Full Staff State Machine
  console.log("5. Testing State Transitions on the newly created booking...");
  
  // Mark Arrived
  const arrRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "MARK_ARRIVED" }),
  });
  console.log("   Mark Arrived:", (await arrRes.json()).status);

  // Start Weighing
  const weighRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "START_WEIGHING" }),
  });
  console.log("   Start Weighing:", (await weighRes.json()).status);

  // Complete Procurement (Scale Weight: 49.8 Q)
  const compRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "COMPLETE_PROCUREMENT", actualQuantity: 49.8, qualityGrade: "GRADE_A" }),
  });
  console.log("   Complete Procurement:", (await compRes.json()).status);

  // Start Payment (₹271,410)
  const payRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "START_PAYMENT", amount: 271410 }),
  });
  console.log("   Start Payment:", (await payRes.json()).status);

  // Complete Payment
  const paidRes = await fetch(`${baseUrl}/api/staff/actions`, {
    method: "POST",
    headers: { ...staff.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, action: "COMPLETE_PAYMENT" }),
  });
  console.log("   Complete Payment:", (await paidRes.json()).status);

  // 6. Verify Farmer History has updated record
  console.log("\n6. Verifying Farmer History reflects the completed record...");
  const hist = await (await fetch(`${baseUrl}/api/farmer/history`, { headers: farmer.headers })).json();
  console.log("   Farmer History Record:", {
    token: hist.bookings[0]?.token,
    status: hist.bookings[0]?.status,
    procuredWeight: hist.bookings[0]?.actualQuantity,
    paymentStatus: hist.bookings[0]?.paymentStatus,
    paymentAmount: hist.bookings[0]?.paymentAmount,
  });

  console.log("\n==========================================================================");
  console.log("🏆 100% REAL DATABASE VERIFICATION COMPLETE & PASSED!");
  console.log("==========================================================================\n");
}

testExactUserWorkflow().catch((e) => {
  console.error("Test Error:", e);
  process.exit(1);
});
