import { NextResponse } from "next/server";
import { revokeSession } from "@/lib/auth";

export async function POST() {
  await revokeSession();
  return NextResponse.json({ ok: true });
}
