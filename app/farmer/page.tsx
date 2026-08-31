"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import StatusBadge from "@/components/StatusBadge";
import QueueRail from "@/components/QueueRail";
import { CardSkeleton } from "@/components/Skeleton";
import FarmerBankDetailsModal from "@/components/FarmerBankDetailsModal";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";
import {
  CalendarPlus,
  Wheat,
  MapPin,
  Clock,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Building2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  FileText,
  Plus,
  Layers,
  ChevronRight,
  Receipt,
  Sparkles,
  History,
} from "lucide-react";

export default function FarmerHomePage() {
  const { t, setLang } = useLanguage();
  const router = useRouter();

  const [me, setMe] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [maxLimit, setMaxLimit] = useState<number>(3);
  const [isMaxReached, setIsMaxReached] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bank Details Modal state
  const [modalPayment, setModalPayment] = useState<any | null>(null);
  // Receipt Modal state
  const [receiptPayment, setReceiptPayment] = useState<any | null>(null);

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      // 1. Fetch authenticated user profile
      const meRes = await fetch("/api/auth/me");
      const meData = await meRes.json();
      if (!meRes.ok || !meData.user) {
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

      // 2. Fetch current active bookings from real database
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

      // 3. Fetch completed procurements and payments from real database
      try {
        const pRes = await fetch("/api/farmer/payments");
        if (pRes.ok) {
          const pData = await pRes.json();
          setPayments(pData.payments || []);
        }
      } catch (pErr) {
        console.error("[Farmer Dashboard Payments Error]", pErr);
      }

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

  // Payment groupings
  const bankRequiredList = payments.filter((p) => p.paymentStatus === "BANK_DETAILS_REQUIRED");
  const inProgressPaymentList = payments.filter(
    (p) => p.paymentStatus === "BANK_DETAILS_SUBMITTED" || p.paymentStatus === "PROCESSING" || p.paymentStatus === "ON_HOLD"
  );
  const paidPaymentList = payments.filter((p) => p.paymentStatus === "PAID");

  const hasAnyPayments = payments.length > 0;

  return (
    <main className="min-h-screen pb-28 bg-surface">
      {/* 1. TOP SECTION — FARMER WELCOME */}
      <FarmerTopBar name={me?.name || "Farmer"} />

      <div className="max-w-lg mx-auto px-4 py-4 space-y-5">
        {/* ERROR STATE */}
        {error && (
          <div className="panel border-error/30 bg-error/5 p-4 space-y-3 animate-rise-in">
            <div className="flex items-center gap-2 text-error">
              <AlertCircle size={18} />
              <p className="font-semibold text-sm">{error}</p>
            </div>
            <button
              onClick={() => loadData(true)}
              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 font-bold"
            >
              <RefreshCw size={13} /> {t("tryAgain")}
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {!loading && !error && (
          <>
            {/* 2. PRIMARY SECTION — PROCUREMENT BOOKING */}
            <section className="space-y-2">
              <div className="panel bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white p-5 shadow-lg relative overflow-hidden">
                {/* Background decorative wheat badge */}
                <div className="absolute right-[-10px] bottom-[-15px] opacity-10 pointer-events-none">
                  <Wheat size={140} />
                </div>

                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div></div>

                    <span className="text-[11px] font-mono font-semibold text-white/80 bg-black/20 px-2 py-0.5 rounded">
                      Active: {activeCount} / {maxLimit}
                    </span>
                  </div>

                  <div>
                    <h2 className="font-display font-black text-xl text-white tracking-tight">
                      Procurement Booking
                    </h2>
                    <p className="text-xs text-white/80 mt-1 leading-relaxed">
                      Book a slot to sell your crop at a procurement centre.
                    </p>
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
                    {isMaxReached ? (
                      <div className="flex-1 p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs flex items-center justify-between">
                        <span>Maximum 3 active tokens reached.</span>
                        <Link
                          href="/farmer/book"
                          className="font-bold underline text-white hover:text-amber-200"
                        >
                          View Slots
                        </Link>
                      </div>
                    ) : (
                      <Link
                        href="/farmer/book"
                        className="flex-1 btn-primary !py-3 text-sm font-bold inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md border border-emerald-400/30 transition-all transform active:scale-[0.99]"
                      >
                        <Plus size={18} strokeWidth={2.5} />
                        <span>+ Book New Slot</span>
                      </Link>
                    )}

                    <Link
                      href="/farmer/history"
                      className="btn-secondary !py-3 !px-4 text-xs font-bold inline-flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 shadow-xs backdrop-blur-xs transition-all"
                    >
                      <History size={16} />
                      <span>My History</span>
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. ACTIVE BOOKINGS SECTION */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={15} className="text-brand-600" />
                  <span>Your Active Bookings</span>
                  <span
                    className={`px-2 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                      isMaxReached ? "bg-amber-100 text-amber-800" : "bg-brand-50 text-brand-700"
                    }`}
                  >
                    {activeCount}
                  </span>
                </h2>

                {activeCount > 0 && !isMaxReached && (
                  <Link
                    href="/farmer/book"
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 underline"
                  >
                    + Add Another
                  </Link>
                )}
              </div>

              {/* ACTIVE BOOKINGS LIST */}
              {bookings.length > 0 ? (
                <div className="space-y-3">
                  {bookings.map((b, idx) => (
                    <div
                      key={b.id}
                      className="panel relative overflow-hidden bg-white border border-line p-4 shadow-sm animate-rise-in space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-ink-faint uppercase tracking-wide">
                            Token #{idx + 1}
                          </span>
                          <span className="font-display font-black text-lg text-ink font-mono bg-surface px-2 py-0.5 rounded border border-line">
                            {b.token}
                          </span>
                        </div>
                        <StatusBadge status={b.status} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-ink-faint uppercase font-bold block">Crop & Quantity</span>
                          <span className="font-semibold text-ink flex items-center gap-1 mt-0.5">
                            <Wheat size={13} className="text-brand-600 shrink-0" />
                            {b.cropName} · {b.quantityQuintal} Q
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-ink-faint uppercase font-bold block">Procurement Centre</span>
                          <span className="font-semibold text-ink flex items-center gap-1 mt-0.5 truncate" title={b.centreName}>
                            <MapPin size={13} className="text-brand-600 shrink-0" />
                            {b.centreName}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-ink-faint flex items-center gap-1.5 pt-1">
                        <Clock size={13} className="text-ink-faint shrink-0" />
                        <span>
                          {formatDate(b.date)} · {b.startTime} – {b.endTime}
                        </span>
                      </div>

                      {/* Real-time Queue Tracking Rail */}
                      <div className="pt-2 border-t border-line/70">
                        <QueueRail
                          servingToken={b.currentlyServing}
                          farmersAhead={b.farmersAhead}
                          myToken={b.token}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                        <div className="bg-surface-sunken rounded-lg py-2">
                          <p className="text-ink-faint text-[10px] uppercase font-bold tracking-wider">{t("farmersAhead")}</p>
                          <p className="font-display font-black text-base text-ink mt-0.5">{b.farmersAhead}</p>
                        </div>
                        <div className="bg-surface-sunken rounded-lg py-2">
                          <p className="text-ink-faint text-[10px] uppercase font-bold tracking-wider">{t("estimatedWait")}</p>
                          <p className="font-display font-black text-base text-ink mt-0.5">
                            ~{b.estimatedWaitMins} <span className="text-xs font-normal text-ink-faint">{t("mins")}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="panel bg-white border border-line p-5 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center mx-auto">
                    <CalendarPlus size={24} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-ink">No active bookings</p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      Book a procurement slot to get started.
                    </p>
                  </div>
                  <Link
                    href="/farmer/book"
                    className="btn-secondary !py-2 !px-4 text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>Book a Slot</span>
                  </Link>
                </div>
              )}
            </section>

            {/* 4. PAYMENT & DISBURSEMENTS SECTION (BELOW BOOKINGS) */}
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-t border-line/80 pt-4">
                <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard size={15} className="text-emerald-700" />
                  <span>Payments & Disbursements</span>
                </h2>

                {hasAnyPayments && (
                  <Link
                    href="/farmer/payments"
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 underline flex items-center gap-0.5"
                  >
                    <span>View All ({payments.length})</span>
                    <ChevronRight size={13} />
                  </Link>
                )}
              </div>

              {/* A. ACTION REQUIRED (BANK_DETAILS_REQUIRED) */}
              {bankRequiredList.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded inline-block">
                    Action Required ({bankRequiredList.length})
                  </span>

                  {bankRequiredList.map((p) => (
                    <div
                      key={p.id || p.bookingId}
                      className="panel bg-gradient-to-br from-amber-50 via-amber-50/80 to-orange-50/90 border-2 border-amber-400 p-4 shadow-sm animate-rise-in space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold uppercase tracking-wide">
                            <CheckCircle2 size={12} className="text-amber-700" />
                            <span>Procurement Completed!</span>
                          </div>
                          <h3 className="font-display font-bold text-sm text-ink pt-0.5">
                            Weighing confirmed for Token {p.token}
                          </h3>
                        </div>
                        <StatusBadge status="BANK_DETAILS_REQUIRED" />
                      </div>

                      <div className="p-3 bg-white/90 rounded-xl border border-amber-200/80 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-ink-faint uppercase font-bold block">
                            Final Payable Amount
                          </span>
                          <span className="text-xs text-ink-soft font-semibold">
                            {p.crop} · {p.finalQuantity} {p.quantityUnit || "Quintal"}
                          </span>
                        </div>
                        <span className="font-display font-black text-xl text-emerald-800">
                          {formatCurrency(p.finalPayableAmount || p.totalAmount)}
                        </span>
                      </div>

                      <p className="text-xs text-amber-950 font-medium">
                        Please provide your bank account details to receive your direct disbursement payment.
                      </p>

                      <button
                        type="button"
                        onClick={() => setModalPayment(p)}
                        className="btn-primary w-full !py-2.5 text-xs font-bold inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 shadow-sm text-white"
                      >
                        <Building2 size={15} />
                        <span>Add Bank Details</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* B. IN-PROGRESS / SUBMITTED */}
              {inProgressPaymentList.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 bg-sky-100/80 px-2 py-0.5 rounded inline-block">
                    In Processing ({inProgressPaymentList.length})
                  </span>

                  {inProgressPaymentList.map((p) => (
                    <div
                      key={p.id || p.bookingId}
                      className="panel bg-white border border-line p-3.5 space-y-2 animate-rise-in"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-ink">{p.token}</span>
                          <span className="text-xs text-ink-soft font-semibold">{p.crop}</span>
                        </div>
                        <StatusBadge status={p.paymentStatus} />
                      </div>

                      <div className="p-2.5 rounded-lg bg-surface-sunken border border-line flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] text-ink-faint uppercase font-bold block">Payable Amount</span>
                          <span className="font-display font-black text-emerald-800 text-sm">
                            {formatCurrency(p.finalPayableAmount || p.totalAmount)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-ink-faint uppercase font-bold block">Bank Account</span>
                          <span className="font-mono font-semibold text-ink text-xs">
                            {p.bankName ? `${p.bankName} · ` : ""}XXXX {p.bankAccountLast4 || "Bank"}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-ink-faint">
                        {p.paymentStatus === "BANK_DETAILS_SUBMITTED"
                          ? "Bank details received. Awaiting Mandi Admin disbursement processing."
                          : "Payment is currently processing for direct bank transfer."}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* C. PAID / RECENT DISBURSEMENTS */}
              {paidPaymentList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded inline-block">
                      Recent Disbursements ({paidPaymentList.length})
                    </span>
                  </div>

                  {paidPaymentList.slice(0, 2).map((p) => (
                    <div
                      key={p.id || p.bookingId}
                      className="panel bg-emerald-50/70 border border-emerald-200 p-3.5 flex items-center justify-between animate-rise-in shadow-2xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-ink">{p.token}</span>
                          <StatusBadge status="PAID" />
                        </div>
                        <p className="text-xs text-ink font-semibold">
                          {p.crop} · <span className="font-black text-emerald-900">{formatCurrency(p.finalPayableAmount || p.totalAmount)}</span>
                        </p>
                        <p className="text-[10px] text-ink-faint font-mono">
                          Txn: {p.transactionReference || p.transactionId || "Verified"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setReceiptPayment(p)}
                        className="btn-secondary !py-1.5 !px-3 text-xs font-bold inline-flex items-center gap-1 text-emerald-900 bg-white border-emerald-300 hover:bg-emerald-100 shadow-2xs"
                      >
                        <Receipt size={13} className="text-emerald-700" />
                        <span>Receipt</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* NO PAYMENTS YET */}
              {!hasAnyPayments && (
                <div className="p-3.5 rounded-xl bg-surface-sunken border border-line text-center text-xs text-ink-faint">
                  Completed procurement payments and receipts will appear here automatically.
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* BANK DETAILS SUBMISSION MODAL */}
      {modalPayment && (
        <FarmerBankDetailsModal
          payment={modalPayment}
          onClose={() => setModalPayment(null)}
          onSuccess={() => {
            setModalPayment(null);
            loadData(false);
          }}
        />
      )}

      {/* OFFICIAL RECEIPT MODAL */}
      {receiptPayment && (
        <PaymentReceiptModal
          payment={receiptPayment}
          onClose={() => setReceiptPayment(null)}
        />
      )}

      {/* Bottom Navigation */}
      <FarmerNav />
    </main>
  );
}
