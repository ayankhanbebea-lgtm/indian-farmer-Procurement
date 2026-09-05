import { NextRequest, NextResponse } from "next/server";
import { sendOtpSchema } from "@/lib/validation";
import { sendOtpToMobile } from "@/lib/otp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Please enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    const result = await sendOtpToMobile(parsed.data.mobileNumber);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, cooldownSeconds: result.cooldownSeconds },
        { status: result.cooldownSeconds ? 429 : 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      resendAvailableIn: result.resendAvailableIn,
    });
  } catch (err: any) {
    console.error("send-otp exception:", err);
    return NextResponse.json(
      { error: "Unable to process OTP request at this time. Please try again." },
      { status: 500 }
    );
  }
}
