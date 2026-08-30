"use client";

import { useEffect, useState, useCallback } from "react";
import DashboardShell from "@/components/DashboardShell";
import StatusBadge from "@/components/StatusBadge";
import MetricCard, { MetricRow } from "@/components/MetricCard";
import { CardSkeleton } from "@/components/Skeleton";
import { formatCurrency, formatDate, maskAccountNumber } from "@/lib/format";
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
  Eye,
  Lock,
  User,
  X,
  Phone,
} from "lucide-react";

export default function AdminPaymentsPage() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalRecords: 0,
    totalDisbursed: 0,
    pendingDisbursement: 0,
    pendingCount: 0,
    bankDetailsRequiredCount: 0,
    bankDetailsSubmittedCount: 0,
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

  // Detailed View & Process Modal
  const [activePayment, setActivePayment] = useState<any | null>(null);

  // Sub-actions in modal
  const [showMarkPaidForm, setShowMarkPaidForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");
  const [transactionReference, setTransactionReference] = useState("");
  const [paidDateTime, setPaidDateTime] = useState("");

  const [showHoldForm, setShowHoldForm] = useState(false);
  const [holdReason, setHoldReason] = useState("");

  const [showFailForm, setShowFailForm] = useState(false);
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
    }, 5000);

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
        throw new Error(data.error || "Action could not be completed.");
      }

      // Close modal forms and reload
      setShowMarkPaidForm(false);
      setShowHoldForm(false);
      setShowFailForm(false);
      setActivePayment(null);
      await loadData(false);
    } catch (err: any) {
      setError(err.message || "Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const links = getAdminLinks(t);

  return (
    <DashboardShell role="Admin" name={me?.name || "Admin"} links={links}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="text-brand-600" size={24} />
              <h1 className="font-display font-bold text-2xl text-ink">
                Procurement Payment Management
              </h1>
            </div>
            <p className="text-xs text-ink-faint mt-1">
              Process direct farmer disbursements, review bank account details, and disburse MSP payments in real time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(true)}
              className="btn-secondary !py-2 !px-3 text-xs inline-flex items-center gap-1.5 font-semibold"
              disabled={loading || busy}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>{t("refresh")}</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="panel border-rose-200 bg-rose-50 p-4 text-rose-900 text-xs flex items-center justify-between animate-rise-in">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError("")} className="text-rose-700 font-bold hover:text-rose-900">
              Dismiss
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
            label="Ready to Process"
            value={`${stats.bankDetailsSubmittedCount} requests`}
            tone={stats.bankDetailsSubmittedCount > 0 ? "warn" : "default"}
          />
          <MetricCard
            label={t("processing")}
            value={`${stats.processingCount} in bank`}
            tone={stats.processingCount > 0 ? "warn" : "default"}
          />
          <MetricCard
            label="Awaiting Bank Info"
            value={`${stats.bankDetailsRequiredCount} farmers`}
            tone="default"
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
              { id: "ALL", label: "All Records", count: stats.totalRecords },
              { id: "BANK_DETAILS_SUBMITTED", label: "Bank Details Submitted", count: stats.bankDetailsSubmittedCount },
              { id: "PROCESSING", label: "Processing", count: stats.processingCount },
              { id: "PAID", label: "Paid", count: stats.paidCount },
              { id: "BANK_DETAILS_REQUIRED", label: "Bank Details Required", count: stats.bankDetailsRequiredCount },
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
              <table className="w-full text-xs min-w-[950px]">
                <thead className="bg-surface text-ink-faint border-b border-line sticky top-0">
                  <tr className="text-left font-semibold">
                    <th className="py-3 px-4">Farmer Details</th>
                    <th className="py-3 px-3">Token & Centre</th>
                    <th className="py-3 px-3">Crop & Weighed Qty</th>
                    <th className="py-3 px-3">Rate & Deductions</th>
                    <th className="py-3 px-3">Payable Amount</th>
                    <th className="py-3 px-3">Payment Status</th>
                    <th className="py-3 px-3">Bank Account (Masked)</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {payments.map((p) => {
                    const payable = p.finalPayableAmount || p.totalAmount || 0;
                    const deductions = p.deductions || 0;

                    return (
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

                        {/* Rate & Deductions */}
                        <td className="py-3.5 px-3">
                          <span className="font-mono font-semibold text-ink-soft block">
                            {formatCurrency(p.ratePerUnit)} / Q
                          </span>
                          {deductions > 0 && (
                            <span className="text-[10px] font-mono text-rose-700 block">
                              -{formatCurrency(deductions)}
                            </span>
                          )}
                        </td>

                        {/* Total Payable */}
                        <td className="py-3.5 px-3">
                          <span className="font-display font-black text-ink text-sm block">
                            {formatCurrency(payable)}
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

                        {/* Masked Bank Account */}
                        <td className="py-3.5 px-3 text-[11px]">
                          {p.bankAccountLast4 ? (
                            <div>
                              <span className="font-mono font-semibold text-ink block">
                                {p.bankName ? `${p.bankName} · ` : ""}XXXX XXXX {p.bankAccountLast4}
                              </span>
                              {p.ifscCode && (
                                <span className="text-[10px] font-mono text-ink-faint block">{p.ifscCode}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-ink-faint italic text-[10px]">Awaiting Bank Details</span>
                          )}
                        </td>

                        {/* Action: View & Process */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setActivePayment(p);
                              setShowMarkPaidForm(false);
                              setShowHoldForm(false);
                              setShowFailForm(false);
                              setPaymentMethod("Bank Transfer");
                              setTransactionReference(`TXN-${p.token}-${Date.now().toString().slice(-4)}`);
                              setPaidDateTime(new Date().toISOString().slice(0, 16));
                            }}
                            className="btn-primary !py-1.5 !px-3 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs"
                          >
                            <Eye size={13} />
                            <span>View & Process</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

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

      {/* SECURE VIEW & PROCESS MODAL */}
      {activePayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-rise-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-line overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-brand-900 text-white border-b border-brand-800">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-400" />
                <div>
                  <h3 className="font-display font-bold text-sm">
                    Payment Request Verification & Processing
                  </h3>
                  <p className="text-[11px] text-white/70 font-mono">Token: {activePayment.token}</p>
                </div>
              </div>
              <button
                onClick={() => setActivePayment(null)}
                className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs text-ink max-h-[80vh] overflow-y-auto">
              {/* SECTION 1: PROCUREMENT & PAYMENT SUMMARY */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint flex items-center justify-between">
                  <span>Payment Summary</span>
                  <StatusBadge status={activePayment.paymentStatus} />
                </h4>
                <div className="p-3.5 rounded-xl bg-surface-sunken border border-line grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-ink-faint block uppercase font-bold">Farmer Name</span>
                    <span className="font-bold text-ink text-sm block">{activePayment.farmerName}</span>
                    <span className="text-[10px] text-ink-faint font-mono block">+91 {activePayment.farmerPhone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-faint block uppercase font-bold">Procurement Centre</span>
                    <span className="font-semibold text-ink text-xs block">{activePayment.centreName}</span>
                    <span className="text-[10px] text-brand-700 font-mono block">{activePayment.centreCode}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-faint block uppercase font-bold">Crop & Quantity</span>
                    <span className="font-semibold text-ink text-xs block">
                      {activePayment.crop} · {activePayment.finalQuantity} {activePayment.quantityUnit || "Quintal"}
                    </span>
                    <span className="text-[10px] text-ink-faint block">Grade: {activePayment.qualityGrade || "FAQ"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-ink-faint block uppercase font-bold">MSP Rate & Deductions</span>
                    <span className="font-mono font-semibold text-ink block">{formatCurrency(activePayment.ratePerUnit)} / Q</span>
                    {activePayment.deductions > 0 && (
                      <span className="text-[10px] font-mono text-rose-700 block">
                        Less Deductions: -{formatCurrency(activePayment.deductions)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between">
                  <span className="font-bold text-emerald-950 uppercase text-xs tracking-wide">
                    Total Payable Amount to Farmer:
                  </span>
                  <span className="font-display font-black text-emerald-900 text-xl">
                    {formatCurrency(activePayment.finalPayableAmount || activePayment.totalAmount)}
                  </span>
                </div>
              </div>

              {/* SECTION 2: FARMER BANK DETAILS (SECURE AUTHORIZED VIEW) */}
              <div className="space-y-2 pt-2 border-t border-line">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
                    <Lock size={13} className="text-emerald-700" />
                    <span>Farmer Verified Bank Account Details</span>
                  </h4>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Authorized Admin Access
                  </span>
                </div>

                {activePayment.accountNumber ? (
                  <div className="p-3.5 rounded-xl bg-surface-sunken border border-line space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-ink-faint block">Account Holder Name:</span>
                        <span className="font-bold text-ink text-sm block">
                          {activePayment.accountHolderName || activePayment.farmerName}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-faint block">Bank Name:</span>
                        <span className="font-semibold text-ink block">{activePayment.bankName || "—"}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line/60">
                      <div>
                        <span className="text-[10px] text-ink-faint block">Full Bank Account Number:</span>
                        <span className="font-mono font-bold text-emerald-900 text-sm bg-white px-2 py-1 rounded border border-emerald-300 inline-block">
                          {activePayment.accountNumber}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-ink-faint block">IFSC Code:</span>
                        <span className="font-mono font-bold text-ink text-sm bg-white px-2 py-1 rounded border border-line inline-block">
                          {activePayment.ifscCode || "—"}
                        </span>
                      </div>
                    </div>

                    {activePayment.upiId && (
                      <div className="pt-1 border-t border-line/60">
                        <span className="text-[10px] text-ink-faint block">UPI ID:</span>
                        <span className="font-mono font-semibold text-ink">{activePayment.upiId}</span>
                      </div>
                    )}

                    {activePayment.submittedAt && (
                      <div className="text-[10px] text-ink-faint pt-1">
                        Submitted by Farmer: {formatDate(activePayment.submittedAt)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs">
                    <p className="font-semibold">Bank details have not been submitted by the farmer yet.</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      The farmer has received a notification on their dashboard to enter their verified bank account details.
                    </p>
                  </div>
                )}
              </div>

              {/* SECTION 3: ADMIN ACTION CONTROLS */}
              <div className="space-y-3 pt-2 border-t border-line">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                  Administrative Disbursement Workflow
                </h4>

                {/* Sub-form: MARK PAID */}
                {showMarkPaidForm && (
                  <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-300 space-y-3 animate-rise-in">
                    <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                      <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-emerald-700" />
                        Disburse Payment & Record Transaction
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowMarkPaidForm(false)}
                        className="text-xs text-ink-faint hover:text-ink font-semibold"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-[11px] font-bold">Payment Method *</label>
                        <select
                          className="input text-xs font-semibold bg-white"
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                          <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                          <option value="DBT">Direct Benefit Transfer (DBT)</option>
                          <option value="PFMS">PFMS Mandi Portal</option>
                          <option value="UPI">UPI Transfer</option>
                          <option value="Other">Other Bank Gateway</option>
                        </select>
                      </div>

                      <div>
                        <label className="label text-[11px] font-bold">Transaction / UTR Reference ID *</label>
                        <input
                          type="text"
                          required
                          className="input text-xs font-mono font-bold bg-white"
                          placeholder="e.g. UTR1234567890"
                          value={transactionReference}
                          onChange={(e) => setTransactionReference(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="label text-[11px] font-bold">Disbursement Timestamp *</label>
                      <input
                        type="datetime-local"
                        className="input text-xs font-semibold bg-white"
                        value={paidDateTime}
                        onChange={(e) => setPaidDateTime(e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={busy || !transactionReference.trim()}
                      onClick={() =>
                        executeAction({
                          paymentId: activePayment.id,
                          action: "MARK_PAID",
                          paymentMethod,
                          transactionReference: transactionReference.trim(),
                          transactionId: transactionReference.trim(),
                          paidAt: paidDateTime ? new Date(paidDateTime).toISOString() : new Date().toISOString(),
                        })
                      }
                      className="btn-primary w-full !py-2.5 text-xs font-bold inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 shadow-sm"
                    >
                      <CheckCircle2 size={15} />
                      <span>{busy ? "Confirming..." : "Confirm External Payment & Mark PAID"}</span>
                    </button>
                  </div>
                )}

                {/* Sub-form: PUT ON HOLD */}
                {showHoldForm && (
                  <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-300 space-y-2 animate-rise-in">
                    <span className="font-bold text-orange-950 text-xs block">Put Payment On Hold</span>
                    <input
                      type="text"
                      className="input text-xs bg-white"
                      placeholder="Specify reason (e.g. IFSC code verification required with bank)"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowHoldForm(false)}
                        className="btn-ghost !py-1 !px-3 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          executeAction({
                            paymentId: activePayment.id,
                            action: "PUT_ON_HOLD",
                            holdReason: holdReason || "Under administrative verification.",
                          })
                        }
                        className="btn-primary !py-1 !px-3 text-xs font-bold bg-orange-600 hover:bg-orange-700"
                      >
                        Confirm Hold
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-form: MARK FAILED */}
                {showFailForm && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 space-y-2 animate-rise-in">
                    <span className="font-bold text-rose-950 text-xs block">Mark Payment Failed</span>
                    <input
                      type="text"
                      className="input text-xs bg-white"
                      placeholder="Specify failure reason (e.g. Account number rejected by destination bank)"
                      value={failReason}
                      onChange={(e) => setFailReason(e.target.value)}
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowFailForm(false)}
                        className="btn-ghost !py-1 !px-3 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          executeAction({
                            paymentId: activePayment.id,
                            action: "MARK_FAILED",
                            failureReason: failReason || "Bank transfer failed.",
                          })
                        }
                        className="btn-danger !py-1 !px-3 text-xs font-bold"
                      >
                        Confirm Failed
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons Bar */}
                {!showMarkPaidForm && !showHoldForm && !showFailForm && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* START PROCESSING */}
                    {(activePayment.paymentStatus === "BANK_DETAILS_SUBMITTED" ||
                      activePayment.paymentStatus === "PENDING") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          executeAction({
                            paymentId: activePayment.id,
                            action: "START_PROCESSING",
                          })
                        }
                        className="btn-primary !py-2 !px-4 text-xs font-bold inline-flex items-center gap-2 shadow-xs"
                      >
                        <Clock size={14} />
                        <span>Start Processing</span>
                        <ArrowRight size={13} />
                      </button>
                    )}

                    {/* MARK PAID TRIGGER */}
                    {activePayment.paymentStatus === "PROCESSING" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setShowMarkPaidForm(true)}
                        className="btn-primary !py-2 !px-4 text-xs font-bold inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 shadow-xs"
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark as Paid (Disbursed)</span>
                      </button>
                    )}

                    {/* PUT ON HOLD */}
                    {activePayment.paymentStatus !== "PAID" && activePayment.paymentStatus !== "ON_HOLD" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setShowHoldForm(true)}
                        className="btn-secondary !py-2 !px-3 text-xs font-semibold text-orange-700 hover:text-orange-800 inline-flex items-center gap-1.5"
                      >
                        <PauseCircle size={14} />
                        <span>Put On Hold</span>
                      </button>
                    )}

                    {/* MARK FAILED */}
                    {activePayment.paymentStatus === "PROCESSING" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setShowFailForm(true)}
                        className="btn-secondary !py-2 !px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5"
                      >
                        <XCircle size={14} />
                        <span>Mark Failed</span>
                      </button>
                    )}

                    {/* RESUME */}
                    {(activePayment.paymentStatus === "ON_HOLD" || activePayment.paymentStatus === "FAILED") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          executeAction({
                            paymentId: activePayment.id,
                            action: "RESUME_PAYMENT",
                          })
                        }
                        className="btn-secondary !py-2 !px-4 text-xs font-bold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1.5"
                      >
                        <RefreshCw size={14} />
                        <span>Resume Payment Processing</span>
                      </button>
                    )}

                    {/* ALREADY PAID */}
                    {activePayment.paymentStatus === "PAID" && (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs w-full space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 size={15} className="text-emerald-700" />
                          <span>Disbursement Completed & Verified</span>
                        </div>
                        <p className="text-[11px] text-emerald-900 font-mono">
                          Method: {activePayment.paymentMethod || "Bank Transfer"} · Txn Ref: {activePayment.transactionReference || activePayment.transactionId}
                        </p>
                        <p className="text-[10px] text-emerald-800">
                          Disbursed At: {activePayment.paidAt ? formatDate(activePayment.paidAt) : formatDate(activePayment.updatedAt)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-surface border-t border-line flex items-center justify-end">
              <button
                type="button"
                onClick={() => setActivePayment(null)}
                className="btn-ghost !py-1.5 !px-4 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
