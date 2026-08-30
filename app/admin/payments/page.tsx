"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardShell from "@/components/DashboardShell";
import StatusBadge from "@/components/StatusBadge";
import MetricCard, { MetricRow } from "@/components/MetricCard";
import { CardSkeleton } from "@/components/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAdminLinks } from "@/lib/nav";
import { useLanguage } from "@/lib/i18n/context";
import {
  CreditCard,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  PauseCircle,
  XCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

export default function AdminPaymentsPage() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalRecords: 0,
    totalDisbursed: 0,
    pendingDisbursement: 0,
    pendingCount: 0,
    processingCount: 0,
    paidCount: 0,
    failedCount: 0,
    onHoldCount: 0,
  });
  const [centres, setCentres] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [centreFilter, setCentreFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Action Modals
  const [processModal, setProcessModal] = useState<any>(null);
  const [payModal, setPayModal] = useState<any>(null);
  const [holdModal, setHoldModal] = useState<any>(null);
  const [failModal, setFailModal] = useState<any>(null);

  // Pay Modal Form Fields
  const [paymentMethod, setPaymentMethod] = useState("DBT");
  const [transactionId, setTransactionId] = useState("");
  const [bankLast4, setBankLast4] = useState("");
  const [upiId, setUpiId] = useState("");
  const [payDateTime, setPayDateTime] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [failReason, setFailReason] = useState("");

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me").then((r) => r.json());
      setMe(meRes.user);

      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (centreFilter && centreFilter !== "ALL") params.set("centreId", centreFilter);
      if (dateFilter) params.set("date", dateFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/admin/payments?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load payment records.");
      const data = await res.json();

      setPayments(data.payments || []);
      if (data.stats) setStats(data.stats);
      if (data.centres) setCentres(data.centres);
      setError("");
    } catch (err: any) {
      console.error("[AdminPayments Error]", err);
      setError(err.message || "Unable to fetch payment records.");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [statusFilter, centreFilter, dateFilter, searchQuery]);

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
    }, 8000);

    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, [loadData]);

  async function executeAction(payload: any) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/payments/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Payment action could not be completed.");
        return;
      }
      setProcessModal(null);
      setPayModal(null);
      setHoldModal(null);
      setFailModal(null);
      loadData(false);
    } catch {
      setError("Network error while processing payment action.");
    } finally {
      setBusy(false);
    }
  }

  const links = getAdminLinks(t);

  return (
    <DashboardShell role="Admin" name={me?.name || "Admin"} links={links}>
      <div className="space-y-6">
        {/* Header & Live Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-line shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <CreditCard size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-ink text-base">
                  {t("paymentsManagement")}
                </h1>
                <span className="text-[10px] font-mono font-bold bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded">
                  MANDI DBT SYSTEM
                </span>
              </div>
              <p className="text-xs text-ink-faint mt-0.5">
                Calculate, verify, and disburse official procurement payments to registered farmers in real time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE REALTIME SYNC
            </span>
            <button
              onClick={() => loadData(false)}
              className="btn-ghost !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 text-ink-soft"
              title={t("sync")}
            >
              <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> {t("sync")}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="panel border-rose-200 bg-rose-50/80 p-3.5 flex items-center justify-between gap-3 text-rose-800 text-xs animate-rise-in">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-rose-600" />
              <span className="font-semibold">{error}</span>
            </div>
            <button onClick={() => setError("")} className="text-rose-600 hover:text-rose-800 font-bold">
              {t("close")}
            </button>
          </div>
        )}

        {/* Summary Metric Cards */}
        <MetricRow>
          <MetricCard
            label={t("totalDisbursed")}
            value={formatCurrency(stats.totalDisbursed)}
            tone="good"
          />
          <MetricCard
            label={t("pendingDisbursement")}
            value={formatCurrency(stats.pendingDisbursement)}
            tone={stats.pendingCount > 0 ? "warn" : "default"}
          />
          <MetricCard
            label={t("pending")}
            value={`${stats.pendingCount} tokens`}
            tone={stats.pendingCount > 0 ? "warn" : "default"}
          />
          <MetricCard
            label={t("processing")}
            value={`${stats.processingCount} in bank`}
            tone={stats.processingCount > 0 ? "warn" : "default"}
          />
          <MetricCard
            label={t("onHold")}
            value={`${stats.onHoldCount} held`}
            tone={stats.onHoldCount > 0 ? "error" : "default"}
          />
        </MetricRow>

        {/* Filter Controls Bar */}
        <div className="panel p-4 bg-surface-card space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="text"
                placeholder="Search by farmer name, token number, mobile number, or transaction ID..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-line bg-surface/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Centre Filter */}
            <div className="flex items-center gap-2 shrink-0">
              <Building2 size={15} className="text-ink-faint shrink-0" />
              <select
                className="input text-xs !py-2 !px-3 font-semibold bg-white cursor-pointer"
                value={centreFilter}
                onChange={(e) => setCentreFilter(e.target.value)}
              >
                <option value="ALL">All Procurement Centres</option>
                {centres.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>

              {/* Date Filter */}
              <input
                type="date"
                className="input text-xs !py-2 !px-2.5 font-semibold bg-white cursor-pointer"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />

              {dateFilter && (
                <button
                  onClick={() => setDateFilter("")}
                  className="text-xs text-ink-faint hover:text-ink font-bold px-1"
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-line/60">
            {[
              { id: "ALL", label: "All Statuses", count: stats.totalRecords },
              { id: "PENDING", label: "Pending", count: stats.pendingCount },
              { id: "PROCESSING", label: "Processing", count: stats.processingCount },
              { id: "PAID", label: "Paid", count: stats.paidCount },
              { id: "ON_HOLD", label: "On Hold", count: stats.onHoldCount },
              { id: "FAILED", label: "Failed", count: stats.failedCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? "bg-brand-700 text-white shadow-sm font-bold"
                    : "bg-surface text-ink-soft hover:text-ink hover:bg-surface-sunken"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    statusFilter === tab.id ? "bg-white/20 text-white" : "bg-black/5 text-ink-faint"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Payments Table */}
        <div className="panel overflow-hidden">
          <div className="p-4 border-b border-line flex items-center justify-between">
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
              Procurement Payment Records ({payments.length})
            </h2>
            <span className="text-xs text-ink-faint">
              Direct DB Source of Truth · Total {formatCurrency(stats.totalDisbursed)} disbursed
            </span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead className="bg-surface text-ink-faint border-b border-line sticky top-0">
                  <tr className="text-left font-semibold">
                    <th className="py-3 px-4">Farmer Details</th>
                    <th className="py-3 px-3">Token & Centre</th>
                    <th className="py-3 px-3">Crop & Weighed Qty</th>
                    <th className="py-3 px-3">Applicable Rate</th>
                    <th className="py-3 px-3">Total Payable</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Payment Ref / Txn ID</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-surface/50 transition-colors">
                      {/* Farmer */}
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-ink text-xs">{p.farmerName}</p>
                        <p className="text-[10px] text-ink-faint font-mono">+91 {p.farmerPhone}</p>
                      </td>

                      {/* Token & Centre */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-ink text-xs block">{p.token}</span>
                        <span className="text-[10px] text-ink-faint truncate block max-w-[140px]" title={p.centreName}>
                          {p.centreName}
                        </span>
                      </td>

                      {/* Crop & Weighed Qty */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-ink block">{p.crop}</span>
                        <span className="text-[11px] font-mono text-brand-700 font-bold">
                          {p.finalQuantity} {p.quantityUnit || "Quintal"}
                        </span>
                      </td>

                      {/* Rate */}
                      <td className="py-3.5 px-3 font-mono font-semibold text-ink-soft">
                        {formatCurrency(p.ratePerUnit)} / Q
                      </td>

                      {/* Total Payable */}
                      <td className="py-3.5 px-3">
                        <span className="font-display font-black text-ink text-sm block">
                          {formatCurrency(p.totalAmount)}
                        </span>
                        <span className="text-[9px] text-ink-faint font-mono">
                          {formatDate(p.slotDate || p.createdAt)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <StatusBadge status={p.paymentStatus} />
                        {p.failureReason && (
                          <span className="block text-[10px] text-rose-600 mt-1 truncate max-w-[120px]" title={p.failureReason}>
                            {p.failureReason}
                          </span>
                        )}
                        {p.holdReason && (
                          <span className="block text-[10px] text-orange-700 mt-1 truncate max-w-[120px]" title={p.holdReason}>
                            {p.holdReason}
                          </span>
                        )}
                      </td>

                      {/* Payment Ref */}
                      <td className="py-3.5 px-3 text-[11px]">
                        {p.paymentStatus === "PAID" ? (
                          <div>
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 block text-[10px]">
                              {p.transactionId || p.referenceNo || "PAID"}
                            </span>
                            <span className="text-[10px] text-ink-faint mt-0.5 block">
                              {p.paymentMethod || "DBT"} · {p.paidAt ? formatDate(p.paidAt) : "Completed"}
                            </span>
                          </div>
                        ) : p.paymentStatus === "PROCESSING" ? (
                          <span className="text-sky-700 font-semibold flex items-center gap-1 text-[11px]">
                            <Clock size={12} className="animate-spin" /> In Processing
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                        {p.paymentStatus === "PENDING" && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setProcessModal(p);
                              }}
                              className="btn-primary !py-1 !px-2.5 text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <span>{t("startProcessing")}</span>
                              <ArrowRight size={12} />
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setHoldModal(p);
                                setHoldReason("");
                              }}
                              className="btn-secondary !py-1 !px-2 text-xs text-orange-700 hover:text-orange-800"
                              title={t("putOnHold")}
                            >
                              {t("putOnHold")}
                            </button>
                          </>
                        )}

                        {p.paymentStatus === "PROCESSING" && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setPayModal(p);
                                setPaymentMethod("DBT");
                                setTransactionId(`DBT-${p.token}-${Date.now().toString().slice(-4)}`);
                                setBankLast4("");
                                setUpiId("");
                                setPayDateTime(new Date().toISOString().slice(0, 16));
                              }}
                              className="btn-primary !py-1 !px-2.5 text-xs font-semibold inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800"
                            >
                              <CheckCircle2 size={13} />
                              <span>{t("markPaid")}</span>
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setFailModal(p);
                                setFailReason("");
                              }}
                              className="btn-secondary !py-1 !px-2 text-xs text-rose-600 hover:text-rose-700"
                              title={t("markFailed")}
                            >
                              {t("markFailed")}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => {
                                setHoldModal(p);
                                setHoldReason("");
                              }}
                              className="btn-secondary !py-1 !px-2 text-xs text-orange-700 hover:text-orange-800"
                              title={t("putOnHold")}
                            >
                              {t("putOnHold")}
                            </button>
                          </>
                        )}

                        {p.paymentStatus === "ON_HOLD" && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              executeAction({
                                paymentId: p.id,
                                action: "RESUME_PAYMENT",
                              })
                            }
                            className="btn-secondary !py-1 !px-2.5 text-xs font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                          >
                            <RefreshCw size={12} /> {t("resumePayment")}
                          </button>
                        )}

                        {p.paymentStatus === "FAILED" && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              executeAction({
                                paymentId: p.id,
                                action: "RESUME_PAYMENT",
                              })
                            }
                            className="btn-secondary !py-1 !px-2.5 text-xs font-semibold text-rose-700 hover:text-rose-800 inline-flex items-center gap-1"
                          >
                            <RefreshCw size={12} /> Retry Payment
                          </button>
                        )}

                        {p.paymentStatus === "PAID" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                            <ShieldCheck size={13} /> Verified Disbursed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-ink-faint">
                        <CreditCard size={28} className="mx-auto text-ink-faint/60 mb-2" />
                        <p className="font-semibold text-sm text-ink-soft">No payment records found.</p>
                        <p className="text-xs text-ink-faint mt-0.5">
                          Payment records will automatically appear here when mandi staff records weighing and completes procurement.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* START PROCESSING MODAL */}
      {processModal && (
        <PaymentModal
          title={`Start Payment Processing — ${processModal.token}`}
          onClose={() => setProcessModal(null)}
        >
          <div className="space-y-4">
            <div className="bg-surface-sunken p-3.5 rounded-lg text-xs space-y-1.5 border border-line">
              <div className="flex justify-between">
                <span className="text-ink-faint">Farmer:</span>
                <span className="font-bold text-ink">{processModal.farmerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faint">Crop & Weighed Weight:</span>
                <span className="font-semibold text-ink">
                  {processModal.crop} · {processModal.finalQuantity} {processModal.quantityUnit || "Quintal"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-faint">Calculated Total Amount:</span>
                <span className="font-display font-black text-brand-700 text-sm">
                  {formatCurrency(processModal.totalAmount)}
                </span>
              </div>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              Moving this record to <strong>PROCESSING</strong> initiates the bank transfer disbursement pipeline. The farmer will be notified in real time on their portal.
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setProcessModal(null)}
                className="btn-ghost flex-1 text-xs !py-2.5"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  executeAction({
                    paymentId: processModal.id,
                    action: "START_PROCESSING",
                  })
                }
                className="btn-primary flex-1 text-xs !py-2.5 font-bold"
              >
                Confirm & Start Processing
              </button>
            </div>
          </div>
        </PaymentModal>
      )}

      {/* MARK PAID MODAL (REQUIRES TRANSACTION ID & PAYMENT METHOD) */}
      {payModal && (
        <PaymentModal
          title={`Record Payment Disbursement — ${payModal.token}`}
          onClose={() => setPayModal(null)}
        >
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-300 p-3.5 rounded-lg text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-emerald-800">Farmer:</span>
                <span className="font-bold text-emerald-950">{payModal.farmerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800">Crop & Final Weight:</span>
                <span className="font-semibold text-emerald-950">
                  {payModal.crop} · {payModal.finalQuantity} Q @ {formatCurrency(payModal.ratePerUnit)}/Q
                </span>
              </div>
              <div className="flex justify-between border-t border-emerald-200 pt-1 mt-1">
                <span className="text-emerald-900 font-bold text-xs">Total Amount Paid:</span>
                <span className="font-display font-black text-emerald-900 text-base">
                  {formatCurrency(payModal.totalAmount)}
                </span>
              </div>
            </div>

            <div>
              <label className="label text-xs font-bold">{t("paymentMethod")} *</label>
              <select
                className="input text-xs font-semibold"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="DBT">DBT (Direct Benefit Transfer)</option>
                <option value="NEFT">NEFT (National Electronic Fund Transfer)</option>
                <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                <option value="PFMS">PFMS (Public Financial Management System)</option>
                <option value="UPI">UPI (Unified Payments Interface)</option>
                <option value="Bank Transfer">Bank Transfer (Direct Mandi Account)</option>
              </select>
            </div>

            <div>
              <label className="label text-xs font-bold">
                {t("transactionId")} / Reference No. *
              </label>
              <input
                type="text"
                className="input font-mono text-xs font-bold"
                placeholder="e.g. DBT2026083078901 / UTR99281726"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                required
                autoFocus
              />
              <p className="text-[10px] text-ink-faint mt-1">
                Mandatory reference number from the banking gateway or PFMS portal.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs font-bold">Bank Acc Last 4 (Optional)</label>
                <input
                  type="text"
                  maxLength={4}
                  className="input font-mono text-xs"
                  placeholder="e.g. 4821"
                  value={bankLast4}
                  onChange={(e) => setBankLast4(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs font-bold">UPI ID (Optional)</label>
                <input
                  type="text"
                  className="input text-xs font-mono"
                  placeholder="e.g. farmer@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label text-xs font-bold">Payment Date & Time</label>
              <input
                type="datetime-local"
                className="input text-xs font-semibold"
                value={payDateTime}
                onChange={(e) => setPayDateTime(e.target.value)}
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPayModal(null)}
                className="btn-ghost flex-1 text-xs !py-2.5"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={busy || !transactionId.trim()}
                onClick={() =>
                  executeAction({
                    paymentId: payModal.id,
                    action: "MARK_PAID",
                    paymentMethod,
                    transactionId: transactionId.trim(),
                    bankAccountLast4: bankLast4.trim() || undefined,
                    upiId: upiId.trim() || undefined,
                    paidAt: payDateTime ? new Date(payDateTime).toISOString() : undefined,
                  })
                }
                className="btn-primary flex-1 text-xs !py-2.5 font-bold bg-emerald-700 hover:bg-emerald-800 shadow-sm"
              >
                Confirm Disbursement
              </button>
            </div>
          </div>
        </PaymentModal>
      )}

      {/* HOLD MODAL */}
      {holdModal && (
        <PaymentModal
          title={`Put Payment On Hold — ${holdModal.token}`}
          onClose={() => setHoldModal(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-ink-soft">
              Specify the reason why payment disbursement for <strong>{holdModal.farmerName}</strong> is being placed on hold.
            </p>
            <div>
              <label className="label text-xs font-bold">Hold Reason *</label>
              <textarea
                className="input text-xs min-h-[80px]"
                placeholder="e.g. Bank account IFSC code mismatch, awaiting farmer verification..."
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2.5 pt-2">
              <button type="button" onClick={() => setHoldModal(null)} className="btn-ghost flex-1 text-xs !py-2.5">
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  executeAction({
                    paymentId: holdModal.id,
                    action: "PUT_ON_HOLD",
                    holdReason: holdReason.trim() || "Under administrative verification.",
                  })
                }
                className="btn-secondary flex-1 text-xs !py-2.5 font-bold text-orange-700 hover:text-orange-800"
              >
                Confirm Put On Hold
              </button>
            </div>
          </div>
        </PaymentModal>
      )}

      {/* FAIL MODAL */}
      {failModal && (
        <PaymentModal
          title={`Mark Payment Failed — ${failModal.token}`}
          onClose={() => setFailModal(null)}
        >
          <div className="space-y-4">
            <p className="text-xs text-ink-soft">
              Record failure details for <strong>{failModal.farmerName}</strong>. The farmer will be notified.
            </p>
            <div>
              <label className="label text-xs font-bold">Failure Reason *</label>
              <textarea
                className="input text-xs min-h-[80px]"
                placeholder="e.g. Bank server rejected transfer due to invalid account status..."
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2.5 pt-2">
              <button type="button" onClick={() => setFailModal(null)} className="btn-ghost flex-1 text-xs !py-2.5">
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  executeAction({
                    paymentId: failModal.id,
                    action: "MARK_FAILED",
                    failureReason: failReason.trim() || "Bank transfer failed.",
                  })
                }
                className="btn-danger flex-1 text-xs !py-2.5 font-bold"
              >
                Confirm Mark Failed
              </button>
            </div>
          </div>
        </PaymentModal>
      )}
    </DashboardShell>
  );
}

function PaymentModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center px-4 z-50 animate-rise-in">
      <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-raised space-y-4 border border-line">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="font-bold text-sm text-ink flex items-center gap-1.5">
            <CreditCard size={16} className="text-brand-700" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink text-xs font-bold px-1.5 py-0.5 rounded"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
