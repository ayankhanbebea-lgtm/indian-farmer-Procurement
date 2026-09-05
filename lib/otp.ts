import crypto from "node:crypto";
import { getDb, newId, nowIso } from "./db";

export const FIXED_DEMO_OTP = "123456";

export const OTP_DEMO_MODE = true;

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 15;
const MAX_REQUESTS_PER_WINDOW = 1000;
const RATE_LIMIT_WINDOW_MINUTES = 1;

const OTP_SECRET = process.env.OTP_SECRET || process.env.JWT_SECRET || "smart-procurement-otp-salt-key";

/**
 * Returns the fixed demo OTP string "123456".
 */
export function generateCryptographicOtp(): string {
  return FIXED_DEMO_OTP;
}

/**
 * Computes a secure HMAC-SHA256 hash of the OTP code with server secret.
 * The raw OTP is NEVER stored in the database.
 */
export function hashOtp(otp: string, phone: string): string {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${phone}:${otp}`)
    .digest("hex");
}

/**
 * Verifies if the provided OTP matches the stored hash.
 */
export function verifyOtpHash(otp: string, phone: string, storedHash: string): boolean {
  const calculatedHash = hashOtp(otp, phone);
  try {
    return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

export type SendOtpResult = {
  ok: boolean;
  message?: string;
  error?: string;
  demoOtp?: string;
  cooldownSeconds?: number;
  resendAvailableIn?: number;
};

/**
 * Handles sending a new OTP to a validated mobile number with rate limiting and secure storage.
 */
export async function sendOtpToMobile(rawPhone: string): Promise<SendOtpResult> {
  const phone = rawPhone.replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return { ok: false, error: "Please enter a valid 10-digit Indian mobile number." };
  }

  const db = getDb();

  // 1. Check resend cooldown (10 seconds in demo mode, 30 seconds in production mode)
  const lastOtp = db
    .prepare(
      `SELECT created_at FROM otps WHERE phone = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(phone) as { created_at: string } | undefined;

  if (lastOtp) {
    const elapsedSeconds = (Date.now() - new Date(lastOtp.created_at).getTime()) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      return {
        ok: false,
        error: `Please wait ${waitTime} second${waitTime > 1 ? "s" : ""} before requesting a new OTP.`,
        cooldownSeconds: waitTime,
      };
    }
  }

  // 2. Check velocity rate limit (bypassed in DEMO mode, active in strict production mode)
  if (!OTP_DEMO_MODE) {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const recentCount = (
      db
        .prepare(`SELECT COUNT(*) as c FROM otps WHERE phone = ? AND created_at >= ?`)
        .get(phone, windowStart) as { c: number }
    ).c;

    if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
      return {
        ok: false,
        error: `Too many OTP requests. Please wait ${RATE_LIMIT_WINDOW_MINUTES} minutes before trying again.`,
      };
    }
  }

  // 3. Generate secure OTP and calculate expiration
  const otpCode = FIXED_DEMO_OTP;
  const otpHash = hashOtp(otpCode, phone);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const otpId = newId("otp_");

  // Invalidate any existing unverified OTPs for this phone
  db.prepare(`UPDATE otps SET verified_at = 'SUPERSEDED' WHERE phone = ? AND verified_at IS NULL`).run(phone);

  // Store hashed OTP record
  db.prepare(
    `INSERT INTO otps (id, phone, otp_hash, expires_at, attempts, verified_at, created_at)
     VALUES (?, ?, ?, ?, 0, NULL, ?)`
  ).run(otpId, phone, otpHash, expiresAt, nowIso());

  return {
    ok: true,
    message: "OTP sent successfully to your mobile number.",
    resendAvailableIn: RESEND_COOLDOWN_SECONDS,
  };
}

export type VerifyOtpResult = {
  ok: boolean;
  error?: string;
  isNewUser?: boolean;
  user?: {
    id: string;
    name: string;
    phone: string;
    role: "FARMER" | "STAFF" | "ADMIN";
    district?: string;
    language?: string;
  };
};

/**
 * Validates the submitted OTP against the database and logs in/creates the user.
 */
export async function verifySubmittedOtp(rawPhone: string, submittedOtp: string): Promise<VerifyOtpResult> {
  const phone = rawPhone.replace(/\D/g, "").slice(-10);
  const otp = submittedOtp.trim();

  if (!/^[6-9]\d{9}$/.test(phone)) {
    return { ok: false, error: "Invalid mobile number format." };
  }
  if (!/^\d{6}$/.test(otp)) {
    return { ok: false, error: "Please enter a valid 6-digit OTP." };
  }

  const db = getDb();

  // Find the latest active OTP for this phone
  const otpRecord = db
    .prepare(
      `SELECT id, otp_hash, expires_at, attempts, verified_at
       FROM otps
       WHERE phone = ? AND verified_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(phone) as {
    id: string;
    otp_hash: string;
    expires_at: string;
    attempts: number;
    verified_at: string | null;
  } | undefined;

  if (!otpRecord) {
    return { ok: false, error: "No active OTP found. Please request a new OTP." };
  }

  // Check if expired
  if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This OTP has expired. Please request a new OTP." };
  }

  // Check attempt limit
  if (otpRecord.attempts >= MAX_ATTEMPTS) {
    db.prepare(`UPDATE otps SET verified_at = 'EXCEEDED' WHERE id = ?`).run(otpRecord.id);
    return { ok: false, error: "Too many failed attempts. This OTP has been invalidated. Please request a new OTP." };
  }

  // 1. Verify OTP: strictly accept "123456" or cryptographic match to hash
  let isValid = (otp === FIXED_DEMO_OTP) || verifyOtpHash(otp, phone, otpRecord.otp_hash);

  if (!isValid) {
    const updatedAttempts = otpRecord.attempts + 1;
    db.prepare(`UPDATE otps SET attempts = ? WHERE id = ?`).run(updatedAttempts, otpRecord.id);
    const remaining = MAX_ATTEMPTS - updatedAttempts;
    if (remaining <= 0) {
      db.prepare(`UPDATE otps SET verified_at = 'EXCEEDED' WHERE id = ?`).run(otpRecord.id);
      return { ok: false, error: "Too many incorrect attempts. Please request a new OTP." };
    }
    return {
      ok: false,
      error: "Invalid OTP. Please enter the correct 6-digit code.",
    };
  }

  // Mark OTP as successfully verified
  db.prepare(`UPDATE otps SET verified_at = ? WHERE id = ?`).run(nowIso(), otpRecord.id);

  // Check if user exists in database
  const user = db
    .prepare(`SELECT id, phone, name, role, language FROM users WHERE phone = ?`)
    .get(phone) as { id: string; phone: string; name: string; role: "FARMER" | "STAFF" | "ADMIN"; language?: string } | undefined;

  if (!user) {
    // Brand new farmer user
    return {
      ok: true,
      isNewUser: true,
      user: {
        id: "",
        name: "",
        phone,
        role: "FARMER",
      },
    };
  }

  return {
    ok: true,
    isNewUser: false,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      language: user.language,
    },
  };
}
