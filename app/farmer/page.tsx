"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import StatusBadge from "@/components/StatusBadge";
import QueueRail from "@/components/QueueRail";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { formatDate } from "@/lib/format";
import { CalendarPlus, History, MapPin, Wheat, AlertCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

type Me = { id: string; name: string; role: string; language?: string };
type Booking = {
  id: string;
  token: string;
  status: string;
  cropName: string;
  centreName: string;
  date: string;
  startTime: string;
  endTime: string;
  quantityQuintal: number;
  farmersAhead: number;
  estimatedWaitMins: number;
  currentlyServing: string | null;
  statusMessage: string;
};

export default function FarmerHome() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [me, setMe] = useState<Me | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      // 1. Fetch current user session
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        throw new Error("Unable to verify user session.");
      }
      const meData = await meRes.json();
      if (!meData.user) {
        router.push("/login");
        return;
      }
      if (meData.user.role !== "FARMER") {
        const target = meData.user.role === "STAFF" ? "/staff" : "/admin";
        router.push(target);
        return;
      }

      setMe(meData.user);
      if (meData.user.language && !localStorage.getItem("sp_language")) {
        setLang(meData.user.language);
      }

      // 2. Fetch current active booking
      const bRes = await fetch("/api/farmer/current");
      if (!bRes.ok) {
        if (bRes.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load booking information.");
      }
      const bData = await bRes.json();
      setBooking(bData.booking ?? null);
      setError(null);
    } catch (err: any) {
      console.error("[FarmerHome Error]", err);
      if (isInitial) {
        setError(err.message || "Failed to load dashboard. Please try again.");
      }
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [router, setLang]);

  useEffect(() => {
    loadData(true);

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/realtime/events");
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type && payload.type !== "CONNECTED") {
            loadData(false);
          }
        } catch {}
      };
    } catch {}

    const interval = setInterval(() => {
      loadData(false);
    }, 5000);

    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, [loadData]);

  return (
    <main className="min-h-screen pb-24 bg-surface">
      <FarmerTopBar name={me?.name || "Farmer"} />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* ERROR STATE */}
        {error && (
          <div className="panel border-error/30 bg-error/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-error">
              <AlertCircle size={18} />
              <p className="font-semibold text-sm">{error}</p>
            </div>
            <button
              onClick={() => loadData(true)}
              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> {t("tryAgain")}
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && <CardSkeleton />}

        {/* SUCCESS STATE - NO ACTIVE BOOKING */}
        {!loading && !error && booking === null && (
          <EmptyState
            icon={CalendarPlus}
            title={t("noActiveBooking")}
            description={t("noActiveBookingDesc")}
            actionLabel={t("bookSlot")}
            actionHref="/farmer/book"
          />
        )}

        {/* SUCCESS STATE - HAS ACTIVE BOOKING */}
        {!loading && !error && booking !== null && (
          <div className="panel relative overflow-hidden animate-rise-in">
            {/* Subtle grain-stalk background SVG */}
            <svg
              className="absolute -right-6 -top-6 text-brand-50 pointer-events-none"
              width="160"
              height="160"
              viewBox="0 0 160 160"
              fill="none"
            >
              <path d="M40 140 C60 100 70 60 100 20" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
              <path d="M60 120 C80 90 90 60 115 30" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
            </svg>

            <div className="relative p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-ink-faint uppercase tracking-wide">
                  {t("procurementJourney")}
                </p>
                <StatusBadge status={booking.status} />
              </div>

              <div className="flex items-center gap-1.5 text-sm text-ink-soft mt-2">
                <Wheat size={14} className="text-brand-600" />
                <span className="font-medium">{booking.cropName}</span>
                <span className="tnum">· {booking.quantityQuintal} Quintal</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-ink-soft mt-1">
                <MapPin size={14} className="text-brand-600" />
                <span>{booking.centreName}</span>
              </div>
              <p className="text-xs text-ink-faint mt-1">
                {formatDate(booking.date)} · {booking.startTime} – {booking.endTime}
              </p>

              <div className="mt-4 pt-4 border-t border-line">
                <QueueRail
                  servingToken={booking.currentlyServing}
                  farmersAhead={booking.farmersAhead}
                  myToken={booking.token}
                />
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3 text-center">
                <div className="bg-surface-sunken rounded-lg py-2.5">
                  <p className="text-[11px] text-ink-faint">{t("estimatedWait")}</p>
                  <p className="font-display font-bold text-ink tnum">{booking.estimatedWaitMins} min</p>
                </div>
                <div className="bg-surface-sunken rounded-lg py-2.5">
                  <p className="text-[11px] text-ink-faint">{t("status")}</p>
                  <p className="font-display font-bold text-brand-600 text-sm leading-tight mt-0.5">
                    {booking.statusMessage || t("yourTurnApproaching")}
                  </p>
                </div>
              </div>

              <Link href="/farmer/queue" className="btn-primary w-full mt-4">
                {t("viewLiveQueue")}
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link href="/farmer/book" className="card hover:border-brand-600/40 transition-colors">
            <CalendarPlus className="text-brand-600 mb-2" size={20} />
            <p className="font-semibold text-sm text-ink">{t("bookNewSlot")}</p>
            <p className="text-xs text-ink-faint mt-0.5">{t("bookSlot")}</p>
          </Link>
          <Link href="/farmer/history" className="card hover:border-brand-600/40 transition-colors">
            <History className="text-brand-600 mb-2" size={20} />
            <p className="font-semibold text-sm text-ink">{t("myHistory")}</p>
            <p className="text-xs text-ink-faint mt-0.5">{t("history")}</p>
          </Link>
        </div>
      </div>
      <FarmerNav />
    </main>
  );
}
