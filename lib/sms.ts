/**
 * SMS Provider Abstraction for KRISHIDHENU
 * Demo mode: fully isolated, no external network requests.
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
 * Neutralized for demo mode: always returns success without calling external APIs.
 */
export async function sendSmsOtp({ phone, otp }: SendSmsOptions): Promise<SendSmsResult> {
  const raw10Digit = phone.replace(/^\+91/, "").replace(/^0+/, "");
  global.__devLastOtp![raw10Digit] = otp;
  return { success: true, provider: "demo-fixed", messageId: `demo_${Date.now()}` };
}

/**
 * Checks a verification code with Twilio Verify Service if active.
 */
export async function checkTwilioVerification(_phone: string, _code: string): Promise<boolean> {
  return false;
}

/**
 * Development helper for automated test suites to inspect the last generated OTP in dev mode.
 */
export function getDevLastOtp(phone: string): string | null {
  const raw10Digit = phone.replace(/^\+91/, "").replace(/^0+/, "");
  return global.__devLastOtp?.[raw10Digit] || null;
}

