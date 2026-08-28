"use client";

import React, { useEffect, useRef, useState } from "react";
import { WeatherData } from "@/lib/weather";

interface WeatherBackgroundProps {
  weather: WeatherData | null;
  className?: string;
}

export default function WeatherBackground({ weather, className = "" }: WeatherBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lightningIntensity, setLightningIntensity] = useState(0);

  // Check user prefers-reduced-motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Lightning effect scheduler for THUNDERSTORM (Realistic double-flash)
  useEffect(() => {
    if (!weather || weather.condition !== "THUNDERSTORM" || reducedMotion) return;

    let timeoutId: NodeJS.Timeout;
    const triggerLightning = () => {
      // Primary flash
      setLightningIntensity(0.85);
      setTimeout(() => {
        setLightningIntensity(0.1);
        // Secondary softer bounce flash
        setTimeout(() => {
          setLightningIntensity(0.5);
          setTimeout(() => setLightningIntensity(0), 100);
        }, 60);
      }, 70);

      // Next lightning flash scheduled randomly in 10-22 seconds
      const nextDelay = 10000 + Math.random() * 12000;
      timeoutId = setTimeout(triggerLightning, nextDelay);
    };

    timeoutId = setTimeout(triggerLightning, 6000);
    return () => clearTimeout(timeoutId);
  }, [weather, reducedMotion]);

  // Canvas Animation loop with multi-layer physics
  useEffect(() => {
    if (reducedMotion || !weather) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 450);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", handleResize);

    const condition = weather.condition;
    const isNight = !weather.isDay;
    const windSpeed = weather.windSpeed || 8;
    const precipitation = weather.precipitation || weather.rain || 0;

    // Wind angle calculation (-0.1 to 0.25 based on real wind)
    const windTilt = Math.min(0.22, Math.max(0.04, (windSpeed / 50) * 0.2));

    // Particle Setup with 3 depth layers
    type Particle = {
      x: number;
      y: number;
      layer: 1 | 2 | 3; // 1: background, 2: midground, 3: foreground
      length: number;
      speed: number;
      opacity: number;
      size: number;
      twinkleSpeed: number;
      twinklePhase: number;
    };

    const particles: Particle[] = [];

    if (condition === "RAIN" || condition === "THUNDERSTORM") {
      // Scale count with condition & precipitation intensity
      const baseCount = condition === "THUNDERSTORM" ? 140 : precipitation > 5 ? 130 : precipitation > 1 ? 95 : 70;

      for (let i = 0; i < baseCount; i++) {
        const layer = (Math.random() < 0.35 ? 1 : Math.random() < 0.75 ? 2 : 3) as 1 | 2 | 3;
        const layerMultiplier = layer === 1 ? 0.65 : layer === 2 ? 1.0 : 1.4;

        particles.push({
          x: Math.random() * (width + 100) - 50,
          y: Math.random() * height,
          layer,
          length: (12 + Math.random() * 14) * layerMultiplier,
          speed: (9 + Math.random() * 6) * layerMultiplier,
          opacity: (layer === 1 ? 0.15 : layer === 2 ? 0.28 : 0.45) + Math.random() * 0.1,
          size: layer === 3 ? 1.4 : 1.0,
          twinkleSpeed: 0,
          twinklePhase: 0,
        });
      }
    } else if (condition === "CLEAR" && isNight) {
      // Night Starfield
      const starCount = 65;
      for (let i = 0; i < starCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * (height * 0.88),
          layer: 1,
          length: 0,
          speed: 0,
          opacity: 0.2 + Math.random() * 0.65,
          size: 0.7 + Math.random() * 1.6,
          twinkleSpeed: 0.018 + Math.random() * 0.03,
          twinklePhase: Math.random() * Math.PI * 2,
        });
      }
    } else if (condition === "CLEAR" && !isNight) {
      // Sunny Day - subtle golden ambient sunbeam particles
      const sunbeamCount = 30;
      for (let i = 0; i < sunbeamCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          layer: 2,
          length: 0,
          speed: 0.2 + Math.random() * 0.35,
          opacity: 0.12 + Math.random() * 0.28,
          size: 1.2 + Math.random() * 2.2,
          twinkleSpeed: 0.015 + Math.random() * 0.02,
          twinklePhase: Math.random() * Math.PI * 2,
        });
      }
    }

    let lastTime = performance.now();

    const render = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      if (condition === "RAIN" || condition === "THUNDERSTORM") {
        for (const p of particles) {
          p.y += p.speed * 60 * delta;
          p.x += windTilt * p.speed * 60 * delta;

          if (p.y > height + 20) {
            p.y = -25;
            p.x = Math.random() * (width + 100) - 50;
          }
          if (p.x > width + 50) p.x = -30;

          ctx.beginPath();
          ctx.lineWidth = p.size;
          ctx.strokeStyle = `rgba(215, 235, 255, ${p.opacity})`;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + windTilt * p.length, p.y + p.length);
          ctx.stroke();
        }
      } else if (condition === "CLEAR" && isNight) {
        // Starfield twinkling with gentle sine modulation
        for (const p of particles) {
          p.twinklePhase += p.twinkleSpeed;
          const currentOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.twinklePhase));

          ctx.fillStyle = `rgba(240, 248, 255, ${Math.max(0.12, currentOpacity)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (condition === "CLEAR" && !isNight) {
        // Floating warm sunbeams
        for (const p of particles) {
          p.y -= p.speed * 30 * delta;
          p.twinklePhase += p.twinkleSpeed;
          const currentOpacity = p.opacity * (0.7 + 0.3 * Math.sin(p.twinklePhase));

          if (p.y < -15) {
            p.y = height + 15;
            p.x = Math.random() * width;
          }

          ctx.fillStyle = `rgba(253, 230, 138, ${Math.max(0.06, currentOpacity)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [weather, reducedMotion]);

  if (!weather) {
    // Neutral fallback navy gradient
    return (
      <div className={`pointer-events-none absolute inset-0 z-0 bg-navy ${className}`} aria-hidden="true" />
    );
  }

  const { condition, isDay, cloudCover } = weather;

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      {/* 1. Base Atmospheric Sky Background */}
      <div
        className={`absolute inset-0 transition-colors duration-1000 ${
          condition === "CLEAR" && isDay
            ? "bg-gradient-to-b from-[#0e274c] via-[#12305c] to-[#0c1f3d]"
            : condition === "CLEAR" && !isDay
            ? "bg-gradient-to-b from-[#050c18] via-[#081427] to-[#071122]"
            : condition === "PARTLY_CLOUDY" && isDay
            ? "bg-gradient-to-b from-[#11294d] via-[#15325c] to-[#0d213f]"
            : condition === "PARTLY_CLOUDY" && !isDay
            ? "bg-gradient-to-b from-[#071120] via-[#0c1a32] to-[#060e1b]"
            : condition === "CLOUDY"
            ? "bg-gradient-to-b from-[#142236] via-[#192b42] to-[#0f1b2c]"
            : condition === "RAIN"
            ? "bg-gradient-to-b from-[#0c1a2d] via-[#102238] to-[#091423]"
            : condition === "THUNDERSTORM"
            ? "bg-gradient-to-b from-[#08111e] via-[#0d1a2c] to-[#060c16]"
            : condition === "FOG_HAZE"
            ? "bg-gradient-to-b from-[#17263b] via-[#1c2e45] to-[#121f31]"
            : "bg-navy"
        }`}
      />

      {/* 2. Celestial Radiance (Sun / Moon Glow) */}
      {condition === "CLEAR" && isDay && (
        <div
          className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full opacity-35 filter blur-3xl pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(251, 191, 36, 0.5) 0%, rgba(245, 158, 11, 0.22) 50%, transparent 80%)",
          }}
        />
      )}

      {condition === "CLEAR" && !isDay && (
        <div
          className="absolute -top-20 -right-20 w-[360px] h-[360px] rounded-full opacity-25 filter blur-3xl pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(216, 235, 255, 0.45) 0%, rgba(147, 197, 253, 0.18) 50%, transparent 80%)",
          }}
        />
      )}

      {condition === "PARTLY_CLOUDY" && isDay && (
        <div
          className="absolute -top-20 -right-16 w-[360px] h-[360px] rounded-full opacity-25 filter blur-3xl pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(252, 211, 77, 0.4) 0%, rgba(245, 158, 11, 0.12) 60%, transparent 80%)",
          }}
        />
      )}

      {/* 3. Drifting Clouds for PARTLY_CLOUDY and CLOUDY (Scaled by cloudCover) */}
      {(condition === "PARTLY_CLOUDY" || condition === "CLOUDY" || condition === "RAIN") && !reducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
          style={{ opacity: Math.max(0.18, Math.min(0.45, (cloudCover || 50) / 180)) }}
        >
          <div
            className="absolute top-2 -left-1/4 w-[160%] h-52 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-3xl animate-[cloudDrift_50s_linear_infinite]"
          />
          <div
            className="absolute top-16 -left-1/3 w-[170%] h-44 bg-gradient-to-r from-transparent via-slate-300/15 to-transparent blur-3xl animate-[cloudDrift_70s_linear_infinite_reverse]"
          />
        </div>
      )}

      {/* 4. Translucent Fog Layers for FOG_HAZE */}
      {condition === "FOG_HAZE" && !reducedMotion && (
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-200/15 to-transparent blur-3xl animate-[cloudDrift_30s_linear_infinite]"
          />
          <div
            className="absolute inset-0 bg-gradient-to-b from-slate-300/10 via-slate-200/20 to-transparent blur-2xl"
          />
        </div>
      )}

      {/* 5. Lightning Flash Overlay for THUNDERSTORM */}
      {condition === "THUNDERSTORM" && (
        <div
          className="absolute inset-0 bg-cyan-100/30 pointer-events-none transition-opacity duration-75 z-10"
          style={{ opacity: lightningIntensity }}
        />
      )}

      {/* 6. HTML5 Canvas for Animated Precipitation, Stars, or Sunbeams */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* 7. Depth Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-transparent to-navy/30 pointer-events-none" />
    </div>
  );
}
