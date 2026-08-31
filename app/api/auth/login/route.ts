import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      error: "KRISHIDHENU has transitioned to passwordless mobile OTP authentication. Please use /api/auth/send-otp and /api/auth/verify-otp.",
    },
    { status: 400 }
  );
}
