import { NextRequest, NextResponse } from "next/server";
import { getLiveWeather, DEFAULT_COORDINATES } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const latParam = url.searchParams.get("lat");
    const lonParam = url.searchParams.get("lon");
    const location = url.searchParams.get("location") || DEFAULT_COORDINATES.location;
    const district = url.searchParams.get("district") || DEFAULT_COORDINATES.district;
    const state = url.searchParams.get("state") || DEFAULT_COORDINATES.state;
    const fresh = url.searchParams.get("fresh") === "true";

    const latitude = latParam ? parseFloat(latParam) : DEFAULT_COORDINATES.latitude;
    const longitude = lonParam ? parseFloat(lonParam) : DEFAULT_COORDINATES.longitude;

    const weather = await getLiveWeather(latitude, longitude, location, district, state, fresh);

    if (!weather) {
      return NextResponse.json({ error: "Live weather data currently unavailable." }, { status: 503 });
    }

    return NextResponse.json(
      { weather },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
        },
      }
    );
  } catch (err: any) {
    console.error("[API Weather] Error:", err?.message || err);
    return NextResponse.json({ error: "Failed to fetch live weather data." }, { status: 500 });
  }
}
