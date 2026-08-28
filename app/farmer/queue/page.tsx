"use client";

import { useEffect, useState } from "react";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import StatusBadge from "@/components/StatusBadge";
import QueueRail from "@/components/QueueRail";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { formatDate } from "@/lib/format";
import { ListOrdered, WifiOff, MapPin, Wheat, Clock, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export default function QueuePage() {
  const { t } = useLanguage();
  const [booking, setBooking] = useState<any>(undefined);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/farmer/current");
      if (!res.ok) {
        setBooking(null);
        setStale(true);
        return;
      }
      const data = await res.json();
      setBooking(data.booking ?? null);
      setLastUpdated(new Date());
      setStale(false);
    } catch {
      setStale(true);
      setBooking((prev: any) => (prev === undefined ? null : prev));
    }
  }

  useEffect(() => {
    load();

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/realtime/events");
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type && payload.type !== "CONNECTED") {
            load();
          }
        } catch {}
      };
    } catch {}

    const interval = setInterval(load, 5000); // 5-second polling fallback
    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      if (lastUpdated) setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  async function handleCancel() {
    if (!booking) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`/api/farmer/bookings/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel booking.");
        return;
      }
      setShowCancelModal(false);
      load();
    } catch {
      setError("Failed to cancel booking. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = booking && ["BOOKED", "ARRIVED"].includes(booking.status);

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

        {booking === undefined && <CardSkeleton />}

        {booking === null && (
          <EmptyState
            icon={ListOrdered}
            title="Nothing to track yet"
            description="Book a procurement slot to see your live queue position here."
            actionLabel="Book Procurement Slot"
            actionHref="/farmer/book"
          />
        )}

        {booking && (
          <>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                <span className="live-dot" /> LIVE QUEUE
              </span>
              <span className="text-xs text-ink-faint">Updated {secondsAgo}s ago</span>
            </div>

            <div className="panel p-5 text-center relative overflow-hidden">
              <p className="text-xs text-ink-faint uppercase tracking-wide">Your Digital Token</p>
              <p className="font-display text-5xl font-extrabold text-grain tnum my-2">{booking.token}</p>
              <StatusBadge status={booking.status} />

              <div className="mt-4 pt-3 border-t border-line grid grid-cols-2 gap-2 text-left text-xs">
                <p className="text-ink-soft flex items-center gap-1">
                  <Wheat size={13} className="text-brand-600 shrink-0" />
                  <span>{booking.cropName} · {booking.quantityQuintal} Q</span>
                </p>
                <p className="text-ink-soft flex items-center gap-1">
                  <Clock size={13} className="text-brand-600 shrink-0" />
                  <span>{booking.startTime}–{booking.endTime}</span>
                </p>
                <p className="text-ink-soft flex items-center gap-1 col-span-2">
                  <MapPin size={13} className="text-brand-600 shrink-0" />
                  <span className="truncate">{booking.centreName} · {formatDate(booking.date)}</span>
                </p>
              </div>
            </div>

            <div className="panel p-5">
              <QueueRail
                servingToken={booking.currentlyServing}
                farmersAhead={booking.farmersAhead}
                myToken={booking.token}
              />
            </div>

            <div className="panel divide-y divide-line">
              <Row label="Currently serving" value={booking.currentlyServing || "Not started"} />
              <Row label="Farmers ahead of you" value={String(booking.farmersAhead)} emphasize />
              <Row label="Estimated waiting time" value={`~${booking.estimatedWaitMins} min`} emphasize />
            </div>

            <div className="panel p-4 text-center bg-brand-50 border-brand-600/15">
              <p className="font-medium text-brand-700 text-sm">{booking.statusMessage}</p>
            </div>

            {canCancel && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="btn-danger w-full !py-2.5 text-xs font-semibold"
                >
                  Cancel This Booking
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
              Are you sure you want to cancel token <strong className="text-ink">{booking?.token}</strong>? Your slot will be freed and you will be removed from the active queue.
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
