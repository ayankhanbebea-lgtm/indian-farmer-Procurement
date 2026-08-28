import { getDb } from "../lib/db";
import { getDevLastOtp } from "../lib/sms";

async function testHttpFlow() {
  const baseUrl = "http://localhost:3001";
  const phone = "9200000001"; // Ramesh Kumar

  console.log("1. Sending OTP to", phone);
  const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: phone }),
  });
  console.log("Send OTP status:", sendRes.status, await sendRes.json());

  // Get the OTP via dev-otp HTTP endpoint
  const devOtpRes = await fetch(`${baseUrl}/api/auth/dev-otp?phone=${phone}`);
  const devOtpData = await devOtpRes.json();
  const devOtp = devOtpData.otp;
  console.log("Dev OTP code from server is:", devOtp);

  console.log("2. Verifying OTP...");
  const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: phone, otp: devOtp }),
  });
  console.log("Verify status:", verifyRes.status);
  const verifyData = await verifyRes.json();
  console.log("Verify response body:", verifyData);

  const setCookie = verifyRes.headers.get("set-cookie");
  console.log("Set-Cookie header from verify-otp:", setCookie);

  // Extract sp_session cookie
  const cookieValue = setCookie ? setCookie.split(";")[0] : "";
  console.log("Cookie header to send:", cookieValue);

  console.log("\n3. Calling /api/auth/me with cookie...");
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookieValue },
  });
  console.log("Me status:", meRes.status);
  console.log("Me data:", await meRes.json());

  console.log("\n4. Calling /api/farmer/current with cookie...");
  const currentRes = await fetch(`${baseUrl}/api/farmer/current`, {
    headers: { Cookie: cookieValue },
  });
  console.log("Current status:", currentRes.status);
  console.log("Current data:", await currentRes.json());

  console.log("\n5. Calling /api/farmer/current WITHOUT cookie (unauthenticated)...");
  const unauthRes = await fetch(`${baseUrl}/api/farmer/current`);
  console.log("Unauth status:", unauthRes.status);
  console.log("Unauth data:", await unauthRes.json());
}

testHttpFlow().catch(console.error);
