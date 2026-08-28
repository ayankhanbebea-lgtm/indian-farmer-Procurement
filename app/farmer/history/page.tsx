"use client";

import { useEffect, useState, useCallback } from "react";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import StatusBadge from "@/components/StatusBadge";
import Timeline from "@/components/Timeline";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { formatDate, formatCurrency } from "@/lib/format";
import { History, ChevronDown, ChevronLeft, Wheat, AlertCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

const PROCUREMENT_STEPS = ["BOOKED", "ARRIVED", "VERIFIED", "WEIGHING", "PROCUREMENT_COMPLETED"];

function buildTimeline(status: string, paymentStatus?: string, t?: (k: any) => string) {
  const procIdx = PROCUREMENT_STEPS.indexOf(
    status === "PAYMENT_PROCESSING" || status === "PAYMENT_COMPLETED" ? "PROCUREMENT_COMPLETED" : status
  );
  const steps = [
    { label: t ? t("procurementCompleted") : "Procurement completed", done: procIdx >= 4 || !!paymentStatus, sub: "" },
    { label: t ? t("paymentProcessing") : "Payment initiated", done: paymentStatus === "PROCESSING" || paymentStatus === "PAID", sub: "" },
    { label: t ? t("paymentCompleted") : "Payment credited", done: paymentStatus === "PAID", active: paymentStatus === "PROCESSING", sub: "" },
  ];
  return steps;
}

export default function HistoryPage() {
  const { t } = useLanguage();
  const [bookings, setBookings] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setMe(meData.user);
      }

      const res = await fetch("/api/farmer/history");
      if (!res.ok) {
        throw new Error("Unable to load booking history.");
      }
      const data = await res.json();
      setBookings(data.bookings ?? []);
    } catch (err: any) {
      console.error("[HistoryPage Error]", err);
      setError(err.message || "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <main className="min-h-screen pb-24 bg-surface">
      <FarmerTopBar name={me?.name || "Farmer"} title={t("myHistory")} />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {/* ERROR STATE */}
        {error && (
          <div className="panel border-error/30 bg-error/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-error">
              <AlertCircle size={18} />
              <p className="font-semibold text-sm">{error}</p>
            </div>
            <button
              onClick={loadHistory}
              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> {t("tryAgain")}
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !error && bookings.length === 0 && (
          <EmptyState
            icon={History}
            title={t("noHistoryFound")}
            description={t("noHistoryDesc")}
            actionLabel={t("bookSlot")}
            actionHref="/farmer/book"
          />
        )}

        {/* BOOKINGS LIST */}
        {!loading &&
          !error &&
          bookings.map((b) => {
            const isOpen = open === b.id;
            return (
              <div key={b.id} className="panel overflow-hidden animate-rise-in">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : b.id)}
                  className="w-full p-4 flex items-start justify-between text-left hover:bg-surface/50 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-ink">{b.token}</span>
                      <StatusBadge status={b.status} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-ink-soft mt-1.5">
                      <Wheat size={12} className="text-brand-600 shrink-0" />
                      <span className="font-medium">{b.cropName}</span>
                      <span className="tnum">· {b.actualQuantity != null ? `${b.actualQuantity} Q` : `${b.quantityQuintal} Q`}</span>
                    </div>
                    <p className="text-[11px] text-ink-faint mt-0.5">
                      {b.centreName} · {formatDate(b.date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    {b.paymentAmount != null && (
                      <p className="font-bold text-sm text-emerald-600 tnum">{formatCurrency(b.paymentAmount)}</p>
                    )}
                    <ChevronDown
                      size={16}
                      className={`text-ink-faint ml-auto mt-1 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-line px-4 py-3 bg-surface-sunken/40 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-ink-soft">
                      <div>
                        <p className="text-ink-faint">{t("date")}</p>
                        <p className="font-semibold text-ink mt-0.5">{formatDate(b.date)}</p>
                      </div>
                      <div>
                        <p className="text-ink-faint">{t("time")}</p>
                        <p className="font-semibold text-ink mt-0.5">
                          {b.startTime} – {b.endTime}
                        </p>
                      </div>
                      <div>
                        <p className="text-ink-faint">{t("bookedQuantity")}</p>
                        <p className="font-semibold text-ink mt-0.5 tnum">{b.quantityQuintal} Quintal</p>
                      </div>
                      <div>
                        <p className="text-ink-faint">{t("scaleWeight")}</p>
                        <p className="font-semibold text-brand-700 mt-0.5 tnum">
                          {b.actualQuantity != null ? `${b.actualQuantity} Quintal` : "—"}
                        </p>
                      </div>
                    </div>

                    {b.paymentReference && (
                      <div className="pt-2 border-t border-line/60">
                        <p className="text-ink-faint">Transaction Ref</p>
                        <p className="font-mono font-semibold text-ink mt-0.5">{b.paymentReference}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t border-line/60">
                      <Timeline steps={buildTimeline(b.status, b.paymentStatus, t)} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      <FarmerNav />
    </main>
  );
}
