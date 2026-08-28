import { NextRequest, NextResponse } from "next/server";
import { getDevLastOtp } from "@/lib/sms";

export async function GET(req: NextRequest) {
  // STRICT SAFETY: Never accessible in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const phone = url.searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "Phone required" }, { status: 400 });
  }

  const otp = getDevLastOtp(phone);
  return NextResponse.json({ phone, otp });
}
