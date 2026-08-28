async function checkCentre3Staff() {
  const baseUrl = "http://localhost:3001";
  console.log("=== CHECKING STAFF QUEUE FOR CENTRE 03 (MOHIT YADAV - 9100000003) ===");

  // Login as Staff for Centre 03 (Mohit Yadav)
  await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9100000003" }),
  });
  const devOtpRes = await fetch(`${baseUrl}/api/auth/dev-otp?phone=9100000003`);
  const { otp } = await devOtpRes.json();
  const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9100000003", otp }),
  });
  const cookie = verifyRes.headers.get("set-cookie")?.split(";")[0] || "";
  const headers = { Cookie: cookie };

  // Fetch Centre 03 Staff Queue
  const queueRes = await fetch(`${baseUrl}/api/staff/queue`, { headers });
  const queue = await queueRes.json();

  console.log("\nStaff Account:", queue.centre.name, `(${queue.centre.code})`);
  console.log("Total Bookings in Queue:", queue.rows.length);
  console.log("Summary:", queue.summary);
  console.log("Rows:", JSON.stringify(queue.rows, null, 2));

  // Also check Centre 02 Staff Queue (should be 0)
  const c2Verify = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: "9100000002", otp: (await (await fetch(`${baseUrl}/api/auth/dev-otp?phone=9100000002`)).json()).otp || otp }),
  });
  const c2Cookie = c2Verify.headers.get("set-cookie")?.split(";")[0] || "";
  const c2Queue = await (await fetch(`${baseUrl}/api/staff/queue`, { headers: { Cookie: c2Cookie } })).json();
  console.log("\nStaff Centre 02 Account:", c2Queue.centre.name, `(${c2Queue.centre.code})`);
  console.log("Total Bookings in Centre 02 Queue:", c2Queue.rows.length);
}

checkCentre3Staff().catch(console.error);
