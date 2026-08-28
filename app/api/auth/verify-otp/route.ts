import { NextRequest, NextResponse } from "next/server";
import { verifyOtpSchema } from "@/lib/validation";
import { verifySubmittedOtp } from "@/lib/otp";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid OTP submission." },
        { status: 400 }
      );
    }

    const { mobileNumber, otp } = parsed.data;
    const result = await verifySubmittedOtp(mobileNumber, otp);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // If existing user, create authenticated session cookie
    if (!result.isNewUser && result.user && result.user.id) {
      const token = await createSessionToken({
        id: result.user.id,
        name: result.user.name,
        phone: result.user.phone,
        role: result.user.role,
      });
      await setSessionCookie(token);

      const res = NextResponse.json({
        ok: true,
        isNewUser: false,
        user: result.user,
      });

      res.cookies.set("sp_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });

      return res;
    }

    // New farmer user needs basic profile info (Name & District)
    return NextResponse.json({
      ok: true,
      isNewUser: true,
      mobileNumber: mobileNumber.replace(/\D/g, "").slice(-10),
    });
  } catch (err: any) {
    console.error("verify-otp exception:", err);
    return NextResponse.json(
      { error: "Unable to verify OTP right now. Please try again." },
      { status: 500 }
    );
  }
}
