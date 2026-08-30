"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import StatusBadge from "@/components/StatusBadge";
import QueueRail from "@/components/QueueRail";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { formatDate } from "@/lib/format";
import { ListOrdered, WifiOff, MapPin, Wheat, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export default function QueuePage() {
  return (
    <Suspense fallback={<main className="min-h-screen pb-24 bg-surface p-4"><CardSkeleton /></main>}>
      <QueuePageContent />
    </Suspense>
  );
}

function QueuePageContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const paramBookingId = searchParams.get("bookingId");

  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const res = await fetch("/api/farmer/current");
      if (!res.ok) {
        setBookings([]);
        setStale(true);
        return;
      }
      const data = await res.json();
      const activeList = data.bookings || (data.booking ? [data.booking] : []);
      setBookings(activeList);

      if (activeList.length > 0) {
        if (paramBookingId && activeList.some((b: any) => b.id === paramBookingId)) {
          setSelectedId(paramBookingId);
        } else if (!selectedId || !activeList.some((b: any) => b.id === selectedId)) {
          setSelectedId(activeList[0].id);
        }
      } else {
        setSelectedId("");
      }

      setLastUpdated(new Date());
      setStale(false);
      setError("");
    } catch {
      setStale(true);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [paramBookingId, selectedId]);

  useEffect(() => {
    load(true);

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/realtime/events");
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type && payload.type !== "CONNECTED") {
            load(false);
          }
        } catch {}
      };
    } catch {}

    const interval = setInterval(() => load(false), 5000); // 5-second polling fallback
    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (lastUpdated) setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const activeBooking = bookings.find((b) => b.id === selectedId) || bookings[0] || null;

  async function handleCancel() {
    if (!activeBooking) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`/api/farmer/bookings?bookingId=${encodeURIComponent(activeBooking.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel booking.");
        return;
      }
      setShowCancelModal(false);
      load(false);
    } catch {
      setError("Failed to cancel booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = activeBooking && ["BOOKED", "ARRIVED"].includes(activeBooking.status);

  return (
    <main className="min-h-screen pb-24 bg-surface">
      <FarmerTopBar name="Farmer" title={t("liveQueue")} />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {error && <p className="text-sm text-error bg-error/5 rounded-lg px-3 py-2">{error}</p>}

        {stale && (
          <p className="text-xs bg-grain-soft text-grain rounded-lg px-3 py-2 flex items-center gap-1.5">
            <WifiOff size={13} /> Connection is weak. Your latest queue information may be a few seconds old.
          </p>
        )}

        {loading && <CardSkeleton />}

        {!loading && bookings.length === 0 && (
          <EmptyState
            icon={ListOrdered}
            title="Nothing to track yet"
            description="Book a procurement slot to see your live queue position here."
            actionLabel="Book Procurement Slot"
            actionHref="/farmer/book"
          />
        )}

        {!loading && activeBooking && (
          <>
            {/* MULTI-TOKEN SELECTOR TABS IF > 1 ACTIVE TOKEN */}
            {bookings.length > 1 && (
              <div className="flex items-center gap-1.5 p-1 bg-surface-sunken rounded-lg border border-line overflow-x-auto text-xs">
                {bookings.map((b, i) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`flex-1 py-1.5 px-2.5 rounded-md font-bold transition-all text-center whitespace-nowrap ${
                      activeBooking.id === b.id
                        ? "bg-white text-ink shadow-sm ring-1 ring-black/5"
                        : "text-ink-faint hover:text-ink"
                    }`}
                  >
                    Token #{i + 1}: <span className="font-mono text-brand-700">{b.token}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                <span className="live-dot" /> LIVE QUEUE
              </span>
              <span className="text-xs text-ink-faint">Updated {secondsAgo}s ago</span>
            </div>

            <div className="panel p-5 text-center relative overflow-hidden">
              <p className="text-xs text-ink-faint uppercase tracking-wide">Digital Token</p>
              <p className="font-display text-5xl font-extrabold text-grain tnum my-2 font-mono">{activeBooking.token}</p>
              <StatusBadge status={activeBooking.status} />

              <div className="mt-4 pt-3 border-t border-line grid grid-cols-2 gap-2 text-left text-xs">
                <p className="text-ink-soft flex items-center gap-1">
                  <Wheat size={13} className="text-brand-600 shrink-0" />
                  <span>{activeBooking.cropName} · {activeBooking.quantityQuintal} Q</span>
                </p>
                <p className="text-ink-soft flex items-center gap-1">
                  <Clock size={13} className="text-brand-600 shrink-0" />
                  <span>{activeBooking.startTime}–{activeBooking.endTime}</span>
                </p>
                <p className="text-ink-soft flex items-center gap-1 col-span-2">
                  <MapPin size={13} className="text-brand-600 shrink-0" />
                  <span className="truncate">{activeBooking.centreName} · {formatDate(activeBooking.date)}</span>
                </p>
              </div>
            </div>

            <div className="panel p-5">
              <QueueRail
                servingToken={activeBooking.currentlyServing}
                farmersAhead={activeBooking.farmersAhead}
                myToken={activeBooking.token}
              />
            </div>

            <div className="panel divide-y divide-line">
              <Row label="Currently serving" value={activeBooking.currentlyServing || "Not started"} />
              <Row label="Farmers ahead of you" value={String(activeBooking.farmersAhead)} emphasize />
              <Row label="Estimated waiting time" value={`~${activeBooking.estimatedWaitMins} min`} emphasize />
            </div>

            <div className="panel p-4 text-center bg-brand-50 border-brand-600/15">
              <p className="font-medium text-brand-700 text-sm">{activeBooking.statusMessage}</p>
            </div>

            {canCancel && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="btn-danger w-full !py-2.5 text-xs font-semibold"
                >
                  Cancel Token ({activeBooking.token})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50 animate-rise-in">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-raised space-y-4">
            <div className="flex items-center gap-2 text-error">
              <AlertCircle size={20} />
              <h3 className="font-display font-bold text-base text-ink">Cancel Appointment?</h3>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              Are you sure you want to cancel token <strong className="text-ink">{activeBooking?.token}</strong>? Your slot will be freed and you will be removed from the active queue.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="btn-ghost flex-1 text-xs !py-2.5"
                disabled={cancelling}
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="btn-danger flex-1 text-xs !py-2.5 font-bold"
                disabled={cancelling}
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      <FarmerNav />
    </main>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-ink-soft text-sm">{label}</span>
      <span className={`tnum ${emphasize ? "font-display font-bold text-lg text-ink" : "font-semibold text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

