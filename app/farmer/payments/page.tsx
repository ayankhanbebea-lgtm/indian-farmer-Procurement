"use client";

import { useEffect, useState, useCallback } from "react";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import StatusBadge from "@/components/StatusBadge";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import FarmerBankDetailsModal from "@/components/FarmerBankDetailsModal";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { formatCurrency, formatDate, maskAccountNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";
import {
  CreditCard,
  Wheat,
  MapPin,
  CheckCircle2,
  Clock,
  Download,
  AlertCircle,
  RefreshCw,
  FileCheck2,
  ArrowRight,
  ShieldCheck,
  Building2,
} from "lucide-react";

export default function FarmerPaymentsPage() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalDisbursed: 0,
    pendingAmount: 0,
    inProcessingAmount: 0,
    totalCount: 0,
    paidCount: 0,
  });
  const [me, setMe] = useState<any>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [bankModalPayment, setBankModalPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me").then((r) => r.json());
      setMe(meRes.user);

      const res = await fetch("/api/farmer/payments");
      if (!res.ok) throw new Error("Failed to load payment records.");
      const data = await res.json();

      setPayments(data.payments || []);
      if (data.stats) setStats(data.stats);
      setError(null);
    } catch (err: any) {
      console.error("[FarmerPayments Error]", err);
      setError(err.message || "Failed to load payment records.");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments(true);

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/realtime/events");
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type && payload.type !== "CONNECTED") {
            loadPayments(false);
          }
        } catch {}
      };
    } catch {}

    const interval = setInterval(() => {
      loadPayments(false);
    }, 5000);

    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, [loadPayments]);

  return (
    <main className="min-h-screen pb-28 bg-surface">
      <FarmerTopBar name={me?.name || "Farmer"} title={t("payments")} />

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Real-time Status Sync Banner */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white border border-line text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-ink">Direct DBT Payment Tracker</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-bold">Real-time Connected</span>
        </div>

        {/* Error State */}
        {error && (
          <div className="panel border-rose-200 bg-rose-50 p-4 space-y-2 text-rose-900 text-xs animate-rise-in">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadPayments(true)}
              className="btn-secondary !py-1 !px-3 text-xs inline-flex items-center gap-1.5 font-bold"
            >
              <RefreshCw size={12} /> {t("tryAgain")}
            </button>
          </div>
        )}

        {/* Summary Metric Tiles */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-3.5 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wide block">
              {t("totalDisbursed")}
            </span>
            <p className="font-display font-black text-xl text-emerald-950 mt-1">
              {formatCurrency(stats.totalDisbursed)}
            </p>
            <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
              {stats.paidCount} payment(s) credited
            </span>
          </div>

          <div className="card p-3.5 bg-gradient-to-br from-amber-50 to-white border-amber-200">
            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wide block">
              {t("pendingDisbursement")}
            </span>
            <p className="font-display font-black text-xl text-amber-950 mt-1">
              {formatCurrency(stats.pendingAmount + stats.inProcessingAmount)}
            </p>
            <span className="text-[10px] text-amber-700 font-medium block mt-0.5">
              {payments.length - stats.paidCount} in verification / bank queue
            </span>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && payments.length === 0 && (
          <EmptyState
            icon={CreditCard}
            title="No Payment Records Yet"
            description="When your crop procurement is weighed and completed at the mandi, your calculated payment records will appear here automatically."
            actionLabel="Book a Procurement Slot"
            actionHref="/farmer/book"
          />
        )}

        {/* Payments List */}
        {!loading && !error && payments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center justify-between">
              <span>My Procurement Payments</span>
              <span className="text-ink-faint font-mono text-[11px]">{payments.length} Record(s)</span>
            </h2>

            {payments.map((p) => {
              const isPaid = p.paymentStatus === "PAID";
              const isProcessing = p.paymentStatus === "PROCESSING";
              const isSubmitted = p.paymentStatus === "BANK_DETAILS_SUBMITTED";
              const isRequired = p.paymentStatus === "BANK_DETAILS_REQUIRED";
              const isHold = p.paymentStatus === "ON_HOLD";
              const isFailed = p.paymentStatus === "FAILED";

              const payableAmount = p.finalPayableAmount || p.totalAmount || 0;
              const deductions = p.deductions || 0;

              return (
                <div
                  key={p.id}
                  className="panel overflow-hidden border border-line shadow-xs bg-white animate-rise-in space-y-3 p-4"
                >
                  {/* Top Bar: Token, Status & Crop */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-ink">{p.token}</span>
                        <StatusBadge status={p.paymentStatus} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-ink-soft mt-1">
                        <Wheat size={13} className="text-brand-600 shrink-0" />
                        <span className="font-semibold text-ink">{p.crop}</span>
                        <span className="text-ink-faint font-mono">
                          · {p.finalQuantity} {p.quantityUnit || "Quintal"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-ink-faint uppercase font-bold block">Payable Amount</span>
                      <span className="font-display font-black text-lg text-emerald-800 block">
                        {formatCurrency(payableAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Procurement Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-surface-sunken p-2.5 rounded-lg border border-line/60">
                    <div>
                      <span className="text-[10px] text-ink-faint block">Procurement Centre</span>
                      <span className="font-semibold text-ink truncate block">{p.centreName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-faint block">Rate & Deductions</span>
                      <span className="font-mono font-semibold text-ink">
                        {formatCurrency(p.ratePerUnit)} / Q
                        {deductions > 0 && <span className="text-rose-700 font-normal"> (-{formatCurrency(deductions)})</span>}
                      </span>
                    </div>
                  </div>

                  {/* PHASE 2 & 3: BANK DETAILS REQUIRED ACTION BOX */}
                  {isRequired && (
                    <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-xs space-y-2.5 animate-rise-in">
                      <div className="flex items-center gap-2 font-bold text-amber-950">
                        <Building2 size={16} className="text-amber-700 shrink-0" />
                        <span>Procurement Completed — Bank Details Required</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-900">
                        Your final payable amount of <strong className="font-bold text-ink">{formatCurrency(payableAmount)}</strong> has been confirmed. Please submit your bank account details to receive payment.
                      </p>
                      <button
                        type="button"
                        onClick={() => setBankModalPayment(p)}
                        className="btn-primary w-full !py-2 text-xs font-bold inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 shadow-xs"
                      >
                        <Building2 size={14} />
                        <span>Add Bank Details</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  {/* BANK DETAILS SUBMITTED (PENDING) BOX */}
                  {isSubmitted && (
                    <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-sky-950">
                        <Clock size={15} className="text-sky-700" />
                        <span>Payment Pending (Bank Details Submitted)</span>
                      </div>
                      <p className="text-[11px] text-sky-900">
                        Your bank details have been verified and submitted for processing.
                      </p>
                      <div className="text-[11px] font-mono text-sky-950 pt-1 border-t border-sky-200/60 flex items-center justify-between">
                        <span>{p.bankName || "Bank Account"}:</span>
                        <span className="font-bold">•••• {p.bankAccountLast4 || "XXXX"} ({p.ifscCode || "IFSC"})</span>
                      </div>
                    </div>
                  )}

                  {/* PROCESSING BOX */}
                  {isProcessing && (
                    <div className="p-3 rounded-lg bg-sky-50 border border-sky-300 text-xs space-y-1.5 animate-pulse">
                      <div className="flex items-center gap-1.5 font-bold text-sky-950">
                        <Clock size={15} className="text-sky-700" />
                        <span>Payment Processing</span>
                      </div>
                      <p className="text-[11px] text-sky-900">
                        Your payment is currently being processed by the Mandi Admin for direct bank disbursement.
                      </p>
                    </div>
                  )}

                  {/* PAID Details Box */}
                  {isPaid && (
                    <div className="p-3 rounded-lg bg-emerald-50/90 border border-emerald-200 text-xs space-y-2">
                      <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                        <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                          <CheckCircle2 size={15} className="text-emerald-700" />
                          <span>Payment Successful via {p.paymentMethod || "Bank Transfer"}</span>
                        </div>
                        <span className="font-display font-black text-emerald-950 text-sm">
                          {formatCurrency(payableAmount)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-900/80">
                        <div>
                          <span className="text-[10px] text-emerald-700 block">Transaction ID / Ref</span>
                          <span className="font-mono font-bold text-emerald-950 truncate block">
                            {p.transactionReference || p.transactionId || `TXN-${p.token}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-700 block">Payment Date</span>
                          <span className="font-semibold text-emerald-950">
                            {p.paidAt ? formatDate(p.paidAt) : formatDate(p.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Download Receipt Button */}
                      <button
                        onClick={() => setSelectedReceipt(p)}
                        className="btn-primary w-full !py-2 text-xs font-bold inline-flex items-center justify-center gap-2 mt-1 bg-emerald-700 hover:bg-emerald-800"
                      >
                        <Download size={14} />
                        <span>Download Official Payment Receipt</span>
                      </button>
                    </div>
                  )}

                  {/* ON HOLD or FAILED Alert */}
                  {isHold && (
                    <div className="p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-xs text-orange-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-orange-950">
                        <AlertCircle size={14} className="text-orange-700 shrink-0" />
                        <span>Payment Placed On Hold</span>
                      </div>
                      <p className="text-[11px] leading-tight text-orange-800">
                        {p.holdReason || "Under administrative verification. Mandi officers will resume shortly."}
                      </p>
                    </div>
                  )}

                  {isFailed && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-950">
                        <AlertCircle size={14} className="text-rose-600 shrink-0" />
                        <span>Disbursement Failed</span>
                      </div>
                      <p className="text-[11px] leading-tight text-rose-800">
                        {p.failureReason || "Bank transfer could not be completed. Please re-check bank details."}
                      </p>
                    </div>
                  )}

                  {/* Professional Visual Payment Timeline */}
                  <div className="pt-2 border-t border-line">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-2">
                      Payment Lifecycle Timeline
                    </p>
                    <div className="grid grid-cols-4 gap-1 relative text-center text-[10px]">
                      {/* Step 1: Procurement Completed */}
                      <div className="space-y-1">
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto text-xs font-bold shadow-xs">
                          ✓
                        </div>
                        <span className="font-bold text-emerald-800 block leading-tight">Procurement Completed</span>
                      </div>

                      {/* Step 2: Bank Details Submitted */}
                      <div className="space-y-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold transition-colors ${
                            isSubmitted || isProcessing || isPaid
                              ? "bg-emerald-600 text-white shadow-xs"
                              : isRequired
                              ? "bg-amber-500 text-white animate-pulse"
                              : "bg-surface-sunken text-ink-faint border border-line"
                          }`}
                        >
                          {isSubmitted || isProcessing || isPaid ? "✓" : "2"}
                        </div>
                        <span
                          className={`block leading-tight font-semibold ${
                            isRequired
                              ? "text-amber-800 font-bold"
                              : isSubmitted || isProcessing || isPaid
                              ? "text-emerald-800 font-bold"
                              : "text-ink-faint"
                          }`}
                        >
                          Bank Details
                        </span>
                      </div>

                      {/* Step 3: Processing */}
                      <div className="space-y-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold transition-colors ${
                            isPaid
                              ? "bg-emerald-600 text-white"
                              : isProcessing
                              ? "bg-sky-500 text-white animate-pulse"
                              : "bg-surface-sunken text-ink-faint border border-line"
                          }`}
                        >
                          {isPaid ? "✓" : "3"}
                        </div>
                        <span
                          className={`block leading-tight font-semibold ${
                            isProcessing ? "text-sky-700 font-bold" : isPaid ? "text-emerald-800" : "text-ink-faint"
                          }`}
                        >
                          Processing
                        </span>
                      </div>

                      {/* Step 4: Paid */}
                      <div className="space-y-1">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto text-xs font-bold transition-colors ${
                            isPaid
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-surface-sunken text-ink-faint border border-line"
                          }`}
                        >
                          {isPaid ? "✓" : "4"}
                        </div>
                        <span
                          className={`block leading-tight font-semibold ${
                            isPaid ? "text-emerald-800 font-black" : "text-ink-faint"
                          }`}
                        >
                          Paid
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Official Printable/Downloadable Receipt Modal */}
      {selectedReceipt && (
        <PaymentReceiptModal
          payment={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Bank Details Modal */}
      {bankModalPayment && (
        <FarmerBankDetailsModal
          payment={bankModalPayment}
          onClose={() => setBankModalPayment(null)}
          onSuccess={() => {
            setBankModalPayment(null);
            loadPayments(false);
          }}
        />
      )}

      <FarmerNav />
    </main>
  );
}
