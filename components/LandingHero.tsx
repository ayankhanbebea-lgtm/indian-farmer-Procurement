"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { WeatherData } from "@/lib/weather";
import WeatherBackground from "@/components/weather/WeatherBackground";
import WeatherIndicator from "@/components/weather/WeatherIndicator";

export default function LandingHero() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWeather = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch("/api/weather");
      if (res.ok) {
        const json = await res.json();
        if (json.weather) {
          setWeather(json.weather);
        }
      }
    } catch (err) {
      console.error("[LandingHero] Weather load error:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather(true);

    // Refresh weather every 10 minutes
    const interval = setInterval(() => {
      fetchWeather(false);
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchWeather]);

  return (
    <section className="relative overflow-hidden bg-navy text-white min-h-[440px]">
      {/* 1. Dynamic Live Weather Background (stays strictly behind content) */}
      <WeatherBackground weather={weather} />

      {/* 2. Original Decorative Background SVG */}
      <svg
        className="absolute -right-16 -top-20 text-white/[0.05] pointer-events-none z-[1]"
        width="480"
        height="480"
        viewBox="0 0 480 480"
        fill="none"
        aria-hidden="true"
      >
        <path d="M120 420 C180 300 210 180 300 60" stroke="currentColor" strokeWidth="26" strokeLinecap="round" />
        <path d="M180 380 C230 280 260 180 330 90" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
      </svg>

      {/* 3. Hero Content Layer */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-12 pb-20 text-center">
        {/* Small Elegant Live Weather Indicator */}
        <div className="mb-6 flex justify-center animate-rise-in">
          <WeatherIndicator weather={weather} loading={loading} />
        </div>

        <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm">
          KRISHIDHENU
        </h1>
        <p className="mt-3 text-lg text-white/80 font-medium">
          Less waiting. Better planning. Transparent procurement.
        </p>
        <p className="mt-4 max-w-xl mx-auto text-white/70 leading-relaxed">
          Helping farmers schedule procurement visits, track their queue, and stay informed about procurement and
          payment status.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="btn-primary !bg-white !text-navy hover:!bg-white/90 shadow-md">
            Book a Procurement Slot
          </Link>
          <Link href="/login" className="btn border border-white/30 !text-white hover:!bg-white/10 backdrop-blur-sm">
            Check Booking Status
          </Link>
        </div>
      </div>
    </section>
  );
}
