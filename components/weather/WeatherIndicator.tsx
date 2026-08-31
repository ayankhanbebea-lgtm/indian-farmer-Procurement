"use client";

import React from "react";
import { WeatherData } from "@/lib/weather";
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
} from "lucide-react";

interface WeatherIndicatorProps {
  weather: WeatherData | null;
  loading?: boolean;
  className?: string;
}

export default function WeatherIndicator({ weather, loading = false, className = "" }: WeatherIndicatorProps) {
  if (loading) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/70 text-xs ${className}`}>
        <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        <span>Loading live weather...</span>
      </div>
    );
  }

  if (!weather) return null;

  const { temperature, condition, conditionLabel, isDay, humidity, windSpeed } = weather;

  const renderIcon = () => {
    switch (condition) {
      case "CLEAR":
        return isDay ? (
          <Sun size={15} className="text-amber-300 shrink-0 animate-[spin_24s_linear_infinite]" />
        ) : (
          <Moon size={15} className="text-blue-200 shrink-0" />
        );
      case "PARTLY_CLOUDY":
        return isDay ? (
          <CloudSun size={15} className="text-amber-200 shrink-0" />
        ) : (
          <CloudMoon size={15} className="text-blue-200 shrink-0" />
        );
      case "CLOUDY":
        return <Cloud size={15} className="text-slate-300 shrink-0" />;
      case "RAIN":
        return <CloudRain size={15} className="text-cyan-300 shrink-0" />;
      case "THUNDERSTORM":
        return <CloudLightning size={15} className="text-amber-300 shrink-0" />;
      case "FOG_HAZE":
        return <CloudFog size={15} className="text-slate-300 shrink-0" />;
      default:
        return <Sun size={15} className="text-amber-300 shrink-0" />;
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.12] backdrop-blur-md border border-white/15 text-white shadow-sm transition-all text-xs select-none ${className}`}
      title={`Live Weather: ${conditionLabel}, ${temperature}°C, ${humidity}% Humidity, ${windSpeed} km/h Wind`}
    >
      <div className="flex items-center gap-1.5">
        {renderIcon()}
        <span className="font-bold text-white tnum">{temperature}°C</span>
      </div>

      <span className="text-white/30 font-thin">·</span>

      <span className="text-white/90 font-medium">
        {conditionLabel}
      </span>

      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 pl-1 border-l border-white/15">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        LIVE
      </span>
    </div>
  );
}
