"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import DashboardShell from "@/components/DashboardShell";
import StatusBadge from "@/components/StatusBadge";
import MetricCard, { MetricRow } from "@/components/MetricCard";
import { CardSkeleton } from "@/components/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/context";
import {
  LayoutGrid,
  AlertTriangle,
  Search,
  ChevronDown,
  RefreshCw,
  Scale,
  Wallet,
  Calendar,
  CheckCircle2,
  CalendarCheck,
  Building2,
} from "lucide-react";

export default function StaffDashboard() {
  const { lang, setLang, t } = useLanguage();
  const [data, setData] = useState<any>(undefined);
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [weighModal, setWeighModal] = useState<any>(null);
  const [actualQty, setActualQty] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payModal, setPayModal] = useState<any>(null);
  const [noShowConfirm, setNoShowConfirm] = useState<any>(null);
  const [skipConfirm, setSkipConfirm] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const eventSourceRef = useRef<EventSource | null>(null);

  const load = useCallback(
    async (isInitial = false, dateOverride?: string) => {
      if (isInitial) setLoading(true);
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const meData = await meRes.json();
          setMe(meData.user);
          if (meData.user?.language && !localStorage.getItem("sp_language")) {
            setLang(meData.user.language);
          }
        }

        const activeDate = dateOverride !== undefined ? dateOverride : selectedDate;
        const targetUrl = activeDate ? `/api/staff/queue?date=${activeDate}` : "/api/staff/queue";
        const res = await fetch(targetUrl);
        const d = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setError("Please login with a Staff account (e.g. 9100000002 for Centre 02).");
          } else {
            setError(d.error || "Unable to load centre queue data.");
          }
          return;
        }
        setData(d);
        if (!selectedDate && d.date && d.date !== "all") {
          setSelectedDate(d.date);
        }
        // If today is empty on initial load but upcoming dates have bookings, auto-switch
        if (isInitial && !selectedDate && d.rows.length === 0 && d.upcomingSummary?.length > 0) {
          const firstActiveDate = d.upcomingSummary[0].date;
          setSelectedDate(firstActiveDate);
          load(false, firstActiveDate);
          return;
        }
        setError("");
      } catch (err: any) {
        console.error("[StaffQueue Error]", err);
        if (isInitial) {
          setError(err.message || "Failed to load queue.");
        }
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [selectedDate, setLang]
  );

  useEffect(() => {
    load(true);

    // Setup Real-time SSE Connection
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
      eventSourceRef.current = es;
    } catch {}

    const interval = setInterval(() => {
      load(false);
    }, 6000);

    return () => {
      clearInterval(interval);
      if (es) es.close();
    };
  }, [load]);

  function handleDateChange(newDate: string) {
    setSelectedDate(newDate);
    load(false, newDate);
  }

  async function callNext() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CALL_NEXT" }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Failed to call next farmer.");
        return;
      }
      load(false);
    } catch {
      setError("Network error calling next farmer.");
    } finally {
      setBusy(false);
    }
  }

  async function doAction(bookingId: string, action: string, extra: any = {}) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/staff/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Action failed.");
        return;
      }
      setWeighModal(null);
      setPayModal(null);
      setNoShowConfirm(null);
      setSkipConfirm(null);
      load(false);
    } catch {
      setError("Network error performing action.");
    } finally {
      setBusy(false);
    }
  }

  const links = [{ href: "/staff", label: t("liveQueueTitle"), icon: LayoutGrid }];

  if (loading && !data) {
    return (
      <DashboardShell role="Staff" name="" links={links}>
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </DashboardShell>
    );
  }

  const centre = data?.centre || { name: "Procurement Centre", code: "" };
  const rows = data?.rows || [];
  const summary = data?.summary || { total: 0, waiting: 0, inProgress: 0, completed: 0, paymentPending: 0 };
  const upcomingSummary = data?.upcomingSummary || [];
  const serving = data?.serving || null;
  const todayIST = data?.todayIST || new Date().toISOString().slice(0, 10);
  const activeDate = selectedDate || data?.date || todayIST;

  const servingRow = rows.find((r: any) => r.token === serving);
  const nextUp = rows.filter((r: any) => r.status === "BOOKED").slice(0, 5);

  const completedRows = rows.filter((r: any) =>
    ["COMPLETED", "PROCUREMENT_COMPLETED", "PAYMENT_PROCESSING", "PAYMENT_COMPLETED"].includes(r.status)
  );

  const activeRows = rows.filter(
    (r: any) =>
      !["COMPLETED", "PROCUREMENT_COMPLETED", "PAYMENT_PROCESSING", "PAYMENT_COMPLETED", "CANCELLED", "NO_SHOW"].includes(
        r.status
      )
  );

  const filteredActiveRows = activeRows.filter(
    (r: any) =>
      (r.farmerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.token || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.farmerPhone || "").includes(searchQuery)
  );

  const otherUpcoming = upcomingSummary.filter((u: any) => u.date !== activeDate);

  return (
    <DashboardShell
      role="Staff"
      name={me?.name || "Staff Member"}
      subtitle={`${centre.name} (${centre.code || "Centre"})`}
      links={links}
    >
      <div className="space-y-6">
        {/* Top Operational Bar: Live Indicator, Assigned Centre & Date Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-line shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <Building2 size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display font-bold text-ink text-sm">{centre.name}</p>
                <span className="text-[10px] font-mono font-bold bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded">
                  {centre.code}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  REAL-TIME SYNC ACTIVE
                </span>
                <span className="text-xs text-ink-faint">· Direct Database Pipeline</span>
              </div>
            </div>
          </div>

          {/* Date Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 bg-surface p-1 rounded-lg border border-line text-xs font-semibold">
              <button
                onClick={() => handleDateChange(todayIST)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDate === todayIST ? "bg-white text-ink shadow-sm font-bold" : "text-ink-faint hover:text-ink"
                }`}
              >
                {t("today")}
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
                  handleDateChange(tomorrow);
                }}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDate !== todayIST && activeDate !== "all" ? "bg-white text-ink shadow-sm font-bold" : "text-ink-faint hover:text-ink"
                }`}
              >
                {t("tomorrowOrDate")}
              </button>
              <button
                onClick={() => handleDateChange("all")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  activeDate === "all" ? "bg-white text-ink shadow-sm font-bold" : "text-ink-faint hover:text-ink"
                }`}
              >
                {t("allDates")}
              </button>
              <input
                type="date"
                value={activeDate === "all" ? "" : activeDate}
                onChange={(e) => e.target.value && handleDateChange(e.target.value)}
                className="bg-transparent text-xs text-ink font-semibold px-2 py-1 rounded focus:outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => load(false)}
              className="btn-ghost !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1 text-ink-soft"
              title={t("sync")}
            >
              <RefreshCw size={13} className={busy ? "animate-spin" : ""} /> {t("sync")}
            </button>
          </div>
        </div>

        {/* Notice for bookings on other dates if current view is 0 */}
        {rows.length === 0 && otherUpcoming.length > 0 && (
          <div className="panel bg-amber-50/80 border-amber-200 p-3.5 flex items-center justify-between gap-3 text-xs text-amber-900 animate-rise-in">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="text-amber-700 shrink-0" />
              <span>
                You have <strong>{otherUpcoming.reduce((acc: number, u: any) => acc + u.count, 0)}</strong> booking(s)
                scheduled for upcoming dates at {centre.name}:
                {otherUpcoming.map((u: any) => (
                  <button
                    key={u.date}
                    onClick={() => handleDateChange(u.date)}
                    className="ml-2 font-bold underline text-amber-800 hover:text-amber-950 inline-block"
                  >
                    {formatDate(u.date)} ({u.count})
                  </button>
                ))}
              </span>
            </div>
          </div>
        )}

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

        {/* METRICS ROW */}
        <MetricRow>
          <MetricCard
            label={t("todaysTotal")}
            value={summary.total}
            tone="default"
          />
          <MetricCard
            label={t("waitingQueue")}
            value={summary.waiting}
            tone={summary.waiting > 0 ? "warn" : "default"}
          />
          <MetricCard
            label={t("inProgress")}
            value={summary.inProgress}
            tone={summary.inProgress > 0 ? "good" : "default"}
          />
          <MetricCard
            label={t("completed")}
            value={summary.completed}
            tone={summary.completed > 0 ? "good" : "default"}
          />
          <MetricCard
            label={t("paymentPending")}
            value={summary.paymentPending}
            tone={summary.paymentPending > 0 ? "warn" : "default"}
          />
        </MetricRow>

        {/* OPERATIONS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* NOW SERVING CONTROL BOX */}
          <div className="panel p-5 bg-gradient-to-br from-white to-surface/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-600 animate-ping" /> {t("currentlyServing")}
                </span>
                {servingRow && <StatusBadge status={servingRow.status} />}
              </div>

              {servingRow ? (
                <div className="mt-3 space-y-2.5">
                  <p className="font-display font-black text-4xl text-ink font-mono tracking-tight">{servingRow.token}</p>
                  <div>
                    <p className="font-bold text-ink text-base">{servingRow.farmerName}</p>
                    <p className="text-xs text-ink-faint font-mono">+91 {servingRow.farmerPhone}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface-sunken/70 text-xs space-y-1 text-ink-soft">
                    <p>
                      <strong>{t("crop")}:</strong> {servingRow.cropName}
                    </p>
                    <p>
                      <strong>{t("bookedQuantity")}:</strong> {servingRow.quantityQuintal} Quintal
                    </p>
                    <p>
                      <strong>{t("slot")}:</strong> {servingRow.startTime}–{servingRow.endTime}
                    </p>
                    {servingRow.actualQuantity != null && (
                      <p className="text-brand-700 font-semibold">
                        <strong>{t("scaleWeight")}:</strong> {servingRow.actualQuantity} Q
                      </p>
                    )}
                  </div>

                  {/* Contextual Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {servingRow.status === "BOOKED" && (
                      <button
                        disabled={busy}
                        onClick={() => doAction(servingRow.id, "MARK_ARRIVED")}
                        className="btn-primary flex-1 text-xs !py-2.5 font-bold"
                      >
                        {t("markArrived")}
                      </button>
                    )}

                    {(servingRow.status === "ARRIVED" || servingRow.status === "VERIFIED") && (
                      <button
                        disabled={busy}
                        onClick={() => doAction(servingRow.id, "START_WEIGHING")}
                        className="btn-primary flex-1 text-xs !py-2.5 font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <Scale size={14} /> {t("startWeighing")}
                      </button>
                    )}

                    {servingRow.status === "WEIGHING" && (
                      <button
                        onClick={() => {
                          setWeighModal(servingRow);
                          setActualQty(String(servingRow.quantityQuintal));
                        }}
                        className="btn-primary flex-1 text-xs !py-2.5 font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <Scale size={14} /> {t("recordWeightAndComplete")}
                      </button>
                    )}

                    {(servingRow.status === "COMPLETED" || servingRow.status === "PROCUREMENT_COMPLETED") && (
                      <button
                        onClick={() => {
                          setPayModal(servingRow);
                          setPayAmount(String(Math.round((servingRow.actualQuantity || servingRow.quantityQuintal) * 5450)));
                        }}
                        className="btn-primary flex-1 text-xs !py-2.5 font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <Wallet size={14} /> {t("initiatePayment")}
                      </button>
                    )}

                    {servingRow.status === "PAYMENT_PROCESSING" && (
                      <button
                        disabled={busy}
                        onClick={() => doAction(servingRow.id, "COMPLETE_PAYMENT")}
                        className="btn-primary flex-1 text-xs !py-2.5 font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 size={14} /> {t("markPaid")}
                      </button>
                    )}

                    <button
                      disabled={busy}
                      onClick={() => setNoShowConfirm(servingRow)}
                      className="btn-secondary text-xs text-rose-600 hover:text-rose-700 !py-2.5 !px-3"
                      title={t("noShow")}
                    >
                      {t("noShow")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-ink-faint">
                  <p className="text-sm font-medium">{t("noFarmersWaiting")}</p>
                  <p className="text-xs mt-1">{t("clickCallNext")}</p>
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-line">
              <button
                onClick={callNext}
                className="btn-primary w-full !py-3 font-bold shadow-sm inline-flex items-center justify-center gap-2 text-sm"
                disabled={busy}
              >
                {t("callNextFarmer")}
              </button>

              {nextUp.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-1.5">{t("nextInLine")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {nextUp.map((r: any) => (
                      <span
                        key={r.id}
                        className="tnum text-xs font-semibold bg-surface-sunken text-ink-soft rounded-md px-2 py-0.5 font-mono"
                      >
                        {r.token}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE QUEUE TABLE */}
          <div className="lg:col-span-2 panel overflow-hidden flex flex-col">
            <div className="p-4 border-b border-line space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-ink uppercase tracking-wider">
                  {t("activeQueue")} ({filteredActiveRows.length}) · {formatDate(activeDate)}
                </p>
                <span className="text-xs text-ink-faint">{centre.name}</span>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-line bg-surface/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-600"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-sm min-w-[540px]">
                <thead className="sticky top-0 bg-surface-card shadow-sm text-xs">
                  <tr className="text-left text-ink-faint border-b border-line">
                    <th className="py-2.5 px-4 font-semibold">{t("token")}</th>
                    <th className="py-2.5 px-3 font-semibold">{t("name")}</th>
                    <th className="py-2.5 px-3 font-semibold">{t("crop")} & {t("quantity")}</th>
                    <th className="py-2.5 px-3 font-semibold">{t("status")}</th>
                    <th className="py-2.5 px-4 text-right font-semibold">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filteredActiveRows.map((r: any) => (
                    <tr key={r.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 px-4 font-bold font-mono text-ink text-xs">{r.token}</td>
                      <td className="py-3 px-3">
                        <p className="text-ink font-semibold text-xs">{r.farmerName}</p>
                        <p className="text-[10px] text-ink-faint font-mono">+91 {r.farmerPhone}</p>
                      </td>
                      <td className="py-3 px-3 text-xs text-ink-soft">
                        <span className="font-medium text-ink">
                          {r.cropName} ({r.startTime}–{r.endTime})
                        </span>
                        <span className="block text-[11px] text-ink-faint tnum">
                          {r.actualQuantity != null ? `Actual: ${r.actualQuantity} Q` : `Booked: ${r.quantityQuintal} Q`}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {r.status === "BOOKED" && (
                          <button
                            disabled={busy}
                            onClick={() => doAction(r.id, "MARK_ARRIVED")}
                            className="btn-primary !py-1 !px-2.5 text-xs font-semibold"
                          >
                            {t("markArrived")}
                          </button>
                        )}
                        {(r.status === "ARRIVED" || r.status === "VERIFIED") && (
                          <button
                            disabled={busy}
                            onClick={() => doAction(r.id, "START_WEIGHING")}
                            className="btn-primary !py-1 !px-2.5 text-xs font-semibold"
                          >
                            {t("startWeighing")}
                          </button>
                        )}
                        {r.status === "WEIGHING" && (
                          <button
                            onClick={() => {
                              setWeighModal(r);
                              setActualQty(String(r.quantityQuintal));
                            }}
                            className="btn-primary !py-1 !px-2.5 text-xs font-semibold"
                          >
                            {t("recordWeight")}
                          </button>
                        )}
                        {(r.status === "COMPLETED" || r.status === "PROCUREMENT_COMPLETED") && (
                          <button
                            onClick={() => {
                              setPayModal(r);
                              setPayAmount(String(Math.round((r.actualQuantity || r.quantityQuintal) * 5450)));
                            }}
                            className="btn-primary !py-1 !px-2.5 text-xs font-semibold"
                          >
                            {t("startPayment")}
                          </button>
                        )}
                        {r.status === "PAYMENT_PROCESSING" && (
                          <button
                            disabled={busy}
                            onClick={() => doAction(r.id, "COMPLETE_PAYMENT")}
                            className="btn-primary !py-1 !px-2.5 text-xs font-semibold"
                          >
                            {t("markPaid")}
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => setSkipConfirm(r)}
                          className="btn-secondary !py-1 !px-2 text-xs text-amber-700 hover:text-amber-800"
                          title={t("skipFarmer")}
                        >
                          {t("skipFarmer")}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setNoShowConfirm(r)}
                          className="btn-secondary !py-1 !px-2 text-xs text-rose-600 hover:text-rose-700"
                          title={t("noShow")}
                        >
                          {t("noShow")}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredActiveRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-xs text-ink-faint">
                        <p className="font-semibold text-sm text-ink-soft">
                          {t("noQueueToday")}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* COMPLETED TODAY ACCORDION */}
        <div className="panel overflow-hidden">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-surface/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <p className="font-bold text-sm text-ink">
                {t("todayCompleted")} ({completedRows.length})
              </p>
            </div>
            <ChevronDown size={16} className={`text-ink-faint transition-transform ${showCompleted ? "rotate-180" : ""}`} />
          </button>

          {showCompleted && (
            <div className="border-t border-line overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface text-ink-faint sticky top-0">
                  <tr className="text-left border-b border-line">
                    <th className="py-2.5 px-4">{t("token")}</th>
                    <th className="py-2.5 px-3">{t("name")}</th>
                    <th className="py-2.5 px-3">{t("scaleWeight")}</th>
                    <th className="py-2.5 px-3">{t("status")}</th>
                    <th className="py-2.5 px-4 text-right">{t("paymentCompleted")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {completedRows.map((r: any) => (
                    <tr key={r.id} className="hover:bg-surface/50">
                      <td className="py-2.5 px-4 font-mono font-bold text-ink">{r.token}</td>
                      <td className="py-2.5 px-3 font-semibold text-ink">{r.farmerName}</td>
                      <td className="py-2.5 px-3 text-ink-soft">
                        {r.cropName} · {r.actualQuantity || r.quantityQuintal} Q
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                        {r.paymentAmount ? formatCurrency(r.paymentAmount) : "—"}
                      </td>
                    </tr>
                  ))}
                  {completedRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-ink-faint">
                        {t("noCompletedProcurements")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* WEIGH MODAL */}
      {weighModal && (
        <Modal title={`${t("recordWeight")} — ${weighModal.token}`} onClose={() => setWeighModal(null)}>
          <div className="space-y-3">
            <div className="bg-surface-sunken p-3 rounded-lg text-xs space-y-1">
              <p>
                <strong>{t("name")}:</strong> {weighModal.farmerName}
              </p>
              <p>
                <strong>{t("crop")}:</strong> {weighModal.cropName}
              </p>
              <p>
                <strong>{t("bookedQuantity")}:</strong> {weighModal.quantityQuintal} Quintal
              </p>
            </div>
            <div>
              <label className="label text-xs font-bold">{t("scaleWeight")} (Quintal) *</label>
              <input
                className="input tnum text-base font-bold"
                type="number"
                step="0.01"
                min="0.1"
                value={actualQty}
                onChange={(e) => setActualQty(e.target.value)}
                placeholder="e.g. 45.2"
                autoFocus
              />
            </div>
            <button
              className="btn-primary w-full mt-4 font-bold !py-2.5 text-xs"
              disabled={busy || !actualQty || Number(actualQty) <= 0}
              onClick={() =>
                doAction(weighModal.id, "COMPLETE_PROCUREMENT", {
                  actualQuantity: Number(actualQty),
                  qualityGrade: "GRADE_A",
                })
              }
            >
              {t("confirmWeightAndComplete")}
            </button>
          </div>
        </Modal>
      )}

      {/* PAY MODAL */}
      {payModal && (
        <Modal title={`${t("initiatePayment")} — ${payModal.token}`} onClose={() => setPayModal(null)}>
          <div className="space-y-3">
            <div className="bg-surface-sunken p-3 rounded-lg text-xs space-y-1">
              <p>
                <strong>{t("name")}:</strong> {payModal.farmerName}
              </p>
              <p>
                <strong>{t("scaleWeight")}:</strong> {payModal.actualQuantity || payModal.quantityQuintal} Quintal
              </p>
            </div>
            <div>
              <label className="label text-xs font-bold">{t("paymentPending")} (₹) *</label>
              <input
                className="input tnum text-base font-bold"
                type="number"
                min="1"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                autoFocus
              />
            </div>
            <button
              className="btn-primary w-full mt-4 font-bold !py-2.5 text-xs"
              disabled={busy || !payAmount || Number(payAmount) <= 0}
              onClick={() => doAction(payModal.id, "START_PAYMENT", { amount: Number(payAmount) })}
            >
              {t("authorizePayment")} ({formatCurrency(Number(payAmount))})
            </button>
          </div>
        </Modal>
      )}

      {/* SKIP MODAL */}
      {skipConfirm && (
        <Modal title={t("skipFarmer")} onClose={() => setSkipConfirm(null)}>
          <p className="text-xs text-ink-soft leading-relaxed">
            {t("skipFarmer")}: {skipConfirm.token} ({skipConfirm.farmerName})
          </p>
          <div className="flex gap-2.5 pt-3">
            <button type="button" onClick={() => setSkipConfirm(null)} className="btn-ghost flex-1 text-xs !py-2">
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => doAction(skipConfirm.id, "SKIP")}
              className="btn-secondary flex-1 text-xs !py-2 font-bold text-amber-700"
              disabled={busy}
            >
              {t("yesSkip")}
            </button>
          </div>
        </Modal>
      )}

      {/* NO SHOW MODAL */}
      {noShowConfirm && (
        <Modal title={t("noShow")} onClose={() => setNoShowConfirm(null)}>
          <p className="text-xs text-ink-soft leading-relaxed">
            {t("noShow")}: {noShowConfirm.token} ({noShowConfirm.farmerName})
          </p>
          <div className="flex gap-2.5 pt-3">
            <button type="button" onClick={() => setNoShowConfirm(null)} className="btn-ghost flex-1 text-xs !py-2">
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => doAction(noShowConfirm.id, "MARK_NO_SHOW")}
              className="btn-danger flex-1 text-xs !py-2 font-bold"
              disabled={busy}
            >
              {t("confirmNoShow")}
            </button>
          </div>
        </Modal>
      )}
    </DashboardShell>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50 animate-rise-in">
      <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-raised space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <h3 className="font-bold text-sm text-ink">{title}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink text-xs font-bold px-1.5 py-0.5 rounded">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
