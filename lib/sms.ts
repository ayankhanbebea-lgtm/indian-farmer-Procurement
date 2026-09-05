/**
 * SMS Provider Abstraction for KRISHIDHENU
 * Supports real SMS gateways (MSG91, Twilio, Exotel) and isolated local development mode.
 */

export type SendSmsOptions = {
  phone: string;
  otp: string;
  templateId?: string;
};

export type SendSmsResult = {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
};

// In-memory store for development/testing verification only
declare global {
  // eslint-disable-next-line no-var
  var __devLastOtp: Record<string, string> | undefined;
}

if (!global.__devLastOtp) {
  global.__devLastOtp = {};
}

/**
 * Sends an OTP SMS using the configured SMS provider.
 */
export async function sendSmsOtp({ phone, otp, templateId }: SendSmsOptions): Promise<SendSmsResult> {
  const isDemoMode =
    process.env.OTP_DEMO_MODE !== undefined
      ? process.env.OTP_DEMO_MODE === "true"
      : process.env.NODE_ENV !== "production";
  const provider = (process.env.SMS_PROVIDER || (isDemoMode ? "dev" : "twilio")).toLowerCase();
  const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone.replace(/^0+/, "")}`;
  const raw10Digit = phone.replace(/^\+91/, "").replace(/^0+/, "");

  // GUARANTEED DEMO / DEV SHORT-CIRCUIT:
  // ONLY if demo mode is explicitly enabled or provider is dev/mock:
  if (isDemoMode && (provider === "dev" || provider === "mock")) {
    global.__devLastOtp![raw10Digit] = otp;
    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEMO SMS GATEWAY] Simulated SMS for +91-${raw10Digit} (Demo mode active)`);
    }
    return { success: true, provider: "dev-demo", messageId: `demo_${Date.now()}` };
  }

  // 1. MSG91 Integration (Indian SMS Gateway)
  if (provider === "msg91") {
    const authKey = process.env.MSG91_AUTH_KEY || process.env.SMS_API_KEY;
    const template = templateId || process.env.MSG91_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID;
    
    if (!authKey) {
      console.error("[SMS MSG91] Missing MSG91_AUTH_KEY in environment variables.");
      return { success: false, provider: "msg91", error: "Missing MSG91_AUTH_KEY in environment configuration." };
    }
    if (!template) {
      console.error("[SMS MSG91] Missing MSG91_TEMPLATE_ID in environment variables.");
      return { success: false, provider: "msg91", error: "Missing MSG91_TEMPLATE_ID in environment configuration." };
    }

    try {
      // MSG91 v5 OTP API Endpoint
      const url = new URL("https://control.msg91.com/api/v5/otp");
      url.searchParams.set("template_id", template);
      url.searchParams.set("mobile", `91${raw10Digit}`);
      url.searchParams.set("otp", otp);
      url.searchParams.set("otp_expiry", "5");

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authkey: authKey,
        },
        body: JSON.stringify({
          otp: otp,
        }),
      });

      const data = await res.json().catch(() => ({}));
      
      if (!res.ok || data.type === "error" || data.status === "error") {
        const errorMsg = data.message || data.error || `MSG91 returned HTTP ${res.status}`;
        console.error("[SMS MSG91 Error]", data);
        return { success: false, provider: "msg91", error: errorMsg };
      }

      console.log(`[SMS MSG91 SUCCESS] SMS dispatched to +91-${raw10Digit}. Request ID: ${data.request_id || data.message}`);
      return { success: true, provider: "msg91", messageId: data.request_id || data.message };
    } catch (err: any) {
      console.error("[SMS MSG91 Exception]", err);
      return { success: false, provider: "msg91", error: err?.message || "MSG91 network connection failed" };
    }
  }

  // 2. Twilio Integration (Supports Twilio Verify & Twilio Programmable SMS)
  if (provider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.SMS_SENDER_ID;

    if (!accountSid || !authToken) {
      console.error("[SMS Twilio] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN.");
      return { success: false, provider: "twilio", error: "Twilio credentials unconfigured" };
    }

    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    // Option A: If Twilio Verify Service SID is configured (Direct, carrier-approved OTP delivery)
    if (verifyServiceSid) {
      try {
        const res = await fetch(`https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: formattedPhone,
            Channel: "sms",
            CodeLength: "6",
          }).toString(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.status === "failed" || data.error_code) {
          console.warn("[SMS Twilio Verify Error]", data.message || `Status: ${data.status}`);
          return { success: false, provider: "twilio", error: data.message || "Twilio Verify dispatch failed" };
        }
        if (process.env.NODE_ENV !== "production") {
          global.__devLastOtp![raw10Digit] = otp;
        }
        console.log(`[SMS TWILIO VERIFY SUCCESS] OTP SMS dispatched to ${formattedPhone}. SID: ${data.sid}`);
        return { success: true, provider: "twilio-verify", messageId: data.sid };
      } catch (err: any) {
        console.error("[SMS Twilio Verify Exception]", err?.message);
        return { success: false, provider: "twilio-verify", error: err?.message || "Twilio network failure" };
      }
    }

    // Option B: Standard Twilio Programmable SMS
    if (!fromNumber) {
      return { success: false, provider: "twilio", error: "Missing TWILIO_PHONE_NUMBER or TWILIO_VERIFY_SERVICE_SID" };
    }

    try {
      const body = new URLSearchParams({
        To: formattedPhone,
        From: fromNumber,
        Body: `Your KRISHIDHENU verification OTP is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
      });

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error_code) {
        console.error("[SMS Twilio Error]", data.message || `Code: ${data.error_code}`);
        return { success: false, provider: "twilio", error: data.message || "Failed to deliver SMS via Twilio" };
      }
      if (process.env.NODE_ENV !== "production") {
        global.__devLastOtp![raw10Digit] = otp;
      }
      console.log(`[SMS TWILIO SUCCESS] Message dispatched to ${formattedPhone}. SID: ${data.sid}`);
      return { success: true, provider: "twilio", messageId: data.sid };
    } catch (err: any) {
      console.error("[SMS Twilio Exception]", err?.message);
      return { success: false, provider: "twilio", error: err?.message || "Twilio network failure" };
    }
  }

  // 3. Exotel Integration (Indian Cloud Telephony)
  if (provider === "exotel") {
    const sid = process.env.EXOTEL_SID || process.env.SMS_API_KEY;
    const token = process.env.EXOTEL_TOKEN || process.env.SMS_API_SECRET;
    const subdomain = process.env.EXOTEL_SUBDOMAIN || "api.exotel.com";
    const senderId = process.env.EXOTEL_SENDER_ID || process.env.SMS_SENDER_ID || "SPROCR";

    if (!sid || !token) {
      console.error("[SMS Exotel] Missing EXOTEL_SID or EXOTEL_TOKEN.");
      return { success: false, provider: "exotel", error: "Exotel credentials unconfigured" };
    }

    try {
      const basicAuth = Buffer.from(`${sid}:${token}`).toString("base64");
      const body = new URLSearchParams({
        From: senderId,
        To: raw10Digit,
        Body: `Your KRISHIDHENU OTP is ${otp}. Valid for 5 minutes.`,
      });

      const res = await fetch(`https://${subdomain}/v1/Accounts/${sid}/Sms/send.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, provider: "exotel", error: "Exotel SMS delivery failed" };
      }
      return { success: true, provider: "exotel", messageId: data?.SMSMessage?.Sid };
    } catch (err: any) {
      return { success: false, provider: "exotel", error: err?.message || "Exotel network failure" };
    }
  }

  // 4. Development / Mock Mode (Isolated)
  // Used in local development or test suites only when explicitly configured
  if (process.env.NODE_ENV !== "production" && (isDemoMode || provider === "dev" || provider === "mock")) {
    global.__devLastOtp![raw10Digit] = otp;
    console.log(`[DEV SMS GATEWAY] Simulated OTP for +91-${raw10Digit} (expires in 5 mins)`);
    return { success: true, provider: "dev-mock", messageId: `dev_${Date.now()}` };
  }

  return {
    success: false,
    provider: provider || "unknown",
    error: `SMS provider '${provider}' delivery failed or provider unconfigured.`,
  };
}

/**
 * Checks a verification code with Twilio Verify Service if active.
 */
export async function checkTwilioVerification(phone: string, code: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !verifyServiceSid) return false;

  try {
    const formattedPhone = phone.startsWith("+91") ? phone : `+91${phone.replace(/^0+/, "")}`;
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const res = await fetch(`https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedPhone,
        Code: code,
      }).toString(),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.status === "approved";
  } catch (err) {
    console.error("[Twilio VerificationCheck Exception]", err);
    return false;
  }
}

/**
 * Development helper for automated test suites to inspect the last generated OTP in dev mode.
 */
export function getDevLastOtp(phone: string): string | null {
  const raw10Digit = phone.replace(/^\+91/, "").replace(/^0+/, "");
  return global.__devLastOtp?.[raw10Digit] || null;
}
