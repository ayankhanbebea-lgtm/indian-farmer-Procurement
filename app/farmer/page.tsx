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
import { CalendarPlus, History, MapPin, Wheat, AlertCircle, RefreshCw, CreditCard } from "lucide-react";
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [maxLimit, setMaxLimit] = useState(3);
  const [isMaxReached, setIsMaxReached] = useState(false);
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

      // 2. Fetch current active bookings (up to 3)
      const bRes = await fetch("/api/farmer/current");
      if (!bRes.ok) {
        if (bRes.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load booking information.");
      }
      const bData = await bRes.json();
      setBookings(bData.bookings || (bData.booking ? [bData.booking] : []));
      setActiveCount(bData.activeCount ?? (bData.bookings ? bData.bookings.length : (bData.booking ? 1 : 0)));
      setMaxLimit(bData.maxLimit ?? 3);
      setIsMaxReached(Boolean(bData.isMaxReached));
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

        {/* ACTIVE TOKENS SECTION HEADER & WARNING */}
        {!loading && !error && bookings.length > 0 && (
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
              <span>My Active Tokens</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                isMaxReached ? "bg-amber-100 text-amber-800" : "bg-brand-50 text-brand-700"
              }`}>
                {activeCount} / {maxLimit}
              </span>
            </h2>
            {isMaxReached ? (
              <span className="text-[11px] font-semibold text-amber-700">Max limit reached</span>
            ) : (
              <Link href="/farmer/book" className="text-xs font-bold text-brand-600 hover:text-brand-700 underline">
                + Book Another ({maxLimit - activeCount} left)
              </Link>
            )}
          </div>
        )}

        {/* MAX LIMIT REACHED BANNER */}
        {!loading && !error && isMaxReached && (
          <div className="panel border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 animate-rise-in">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Maximum 3 active tokens reached.</strong> Please wait until one of your existing bookings is completed or cleared before booking another slot.
            </p>
          </div>
        )}

        {/* SUCCESS STATE - NO ACTIVE BOOKING */}
        {!loading && !error && bookings.length === 0 && (
          <EmptyState
            icon={CalendarPlus}
            title={t("noActiveBooking")}
            description={t("noActiveBookingDesc")}
            actionLabel={t("bookSlot")}
            actionHref="/farmer/book"
          />
        )}

        {/* SUCCESS STATE - MULTIPLE ACTIVE BOOKINGS */}
        {!loading && !error && bookings.length > 0 && (
          <div className="space-y-4">
            {bookings.map((b, idx) => (
              <div key={b.id} className="panel relative overflow-hidden animate-rise-in">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink-faint uppercase tracking-wide">
                        Token #{idx + 1}
                      </span>
                      <span className="font-display font-black text-xl text-grain font-mono">
                        {b.token}
                      </span>
                    </div>
                    <StatusBadge status={b.status} />
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-ink-soft mt-2">
                    <Wheat size={14} className="text-brand-600 shrink-0" />
                    <span className="font-semibold text-ink">{b.cropName}</span>
                    <span className="tnum">· {b.quantityQuintal} Quintal</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-ink-soft mt-1">
                    <MapPin size={14} className="text-brand-600 shrink-0" />
                    <span>{b.centreName}</span>
                  </div>
                  <p className="text-xs text-ink-faint mt-1">
                    {formatDate(b.date)} · {b.startTime} – {b.endTime}
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-line">
                    <QueueRail
                      servingToken={b.currentlyServing}
                      farmersAhead={b.farmersAhead}
                      myToken={b.token}
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-surface-sunken rounded-lg py-2">
                      <p className="text-[10px] text-ink-faint">{t("estimatedWait")}</p>
                      <p className="font-display font-bold text-ink tnum">{b.estimatedWaitMins} min</p>
                    </div>
                    <div className="bg-surface-sunken rounded-lg py-2 px-1">
                      <p className="text-[10px] text-ink-faint">{t("status")}</p>
                      <p className="font-display font-bold text-brand-600 text-xs leading-tight truncate mt-0.5">
                        {b.statusMessage || t("yourTurnApproaching")}
                      </p>
                    </div>
                  </div>

                  <Link href={`/farmer/queue?bookingId=${b.id}`} className="btn-primary w-full mt-3 !py-2 text-xs font-bold block text-center">
                    {t("viewLiveQueue")} ({b.token})
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* QUICK ACTION TILES */}
        <div className="grid grid-cols-3 gap-2.5 pt-2">
          {isMaxReached ? (
            <div className="card opacity-60 bg-surface-sunken border-line cursor-not-allowed select-none p-3 text-center">
              <CalendarPlus className="text-ink-faint mx-auto mb-1.5" size={18} />
              <p className="font-semibold text-xs text-ink-faint">{t("bookNewSlot")}</p>
              <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1 py-0.5 rounded mt-1 inline-block">
                Limit (3/3)
              </span>
            </div>
          ) : (
            <Link href="/farmer/book" className="card hover:border-brand-600/40 transition-colors p-3 text-center">
              <CalendarPlus className="text-brand-600 mx-auto mb-1.5" size={18} />
              <p className="font-semibold text-xs text-ink">{t("bookNewSlot")}</p>
              <p className="text-[10px] text-ink-faint mt-0.5">
                {activeCount > 0 ? `${maxLimit - activeCount} left` : "Book now"}
              </p>
            </Link>
          )}

          <Link href="/farmer/payments" className="card hover:border-brand-600/40 transition-colors p-3 text-center bg-gradient-to-br from-emerald-50/50 to-white">
            <CreditCard className="text-emerald-700 mx-auto mb-1.5" size={18} />
            <p className="font-semibold text-xs text-ink">{t("payments")}</p>
            <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">DBT Status & Receipts</p>
          </Link>

          <Link href="/farmer/history" className="card hover:border-brand-600/40 transition-colors p-3 text-center">
            <History className="text-brand-600 mx-auto mb-1.5" size={18} />
            <p className="font-semibold text-xs text-ink">{t("myHistory")}</p>
            <p className="text-[10px] text-ink-faint mt-0.5">All visits</p>
          </Link>
        </div>
      </div>
      <FarmerNav />
    </main>
  );
}

