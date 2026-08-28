"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { ADMIN_LINKS } from "@/lib/nav";
import MetricCard, { MetricRow } from "@/components/MetricCard";
import { CardSkeleton } from "@/components/Skeleton";
import { BarChart2, TrendingUp, IndianRupee, Users, CheckCircle2, Clock } from "lucide-react";

interface AnalyticsData {
  dailyBookings: Array<{ date: string; count: number; completed: number; cancelled: number }>;
  centreStats: Array<{ name: string; code: string; totalBookings: number; completed: number; capacity: number }>;
  paymentSummary: Array<{ status: string; count: number; totalAmount: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  avgServiceStats: Array<{ name: string; avgServiceTimeMins: number; completedCount: number }>;
  totalRevenue: number;
  totalFarmers: number;
  totalBookings: number;
  completedBookings: number;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [me, setMe] = useState<any>(null);
  const [lang, setLang] = useState("en");

  async function load() {
    const meRes = await fetch("/api/auth/me").then((r) => r.json());
    setMe(meRes.user);
    if (meRes.user?.language) setLang(meRes.user.language);

    const res = await fetch("/api/admin/analytics");
    if (res.ok) {
      const analytics = await res.json();
      setData(analytics);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return (
      <DashboardShell role="Admin" name="" links={ADMIN_LINKS} language={lang} onLanguageChange={setLang}>
        <CardSkeleton />
      </DashboardShell>
    );
  }

  const maxDailyCount = Math.max(...data.dailyBookings.map((d) => d.count), 1);

  return (
    <DashboardShell
      role="Admin"
      name={me?.name || ""}
      links={ADMIN_LINKS}
      language={lang}
      onLanguageChange={setLang}
    >
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-ink">Platform Analytics</h1>
        <p className="text-sm text-ink-faint mt-0.5">Procurement trends, centre utilization, revenue throughput, and efficiency metrics</p>
      </div>

      <MetricRow>
        <MetricCard label="Total Registered Farmers" value={data.totalFarmers} />
        <MetricCard label="Total Bookings Made" value={data.totalBookings} />
        <MetricCard label="Procurements Completed" value={data.completedBookings} tone="good" />
        <MetricCard
          label="Total Payout Disbursed"
          value={`₹${(data.totalRevenue / 100000).toFixed(2)} L`}
          tone="good"
        />
      </MetricRow>

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* DAILY BOOKINGS CHART / TABLE */}
        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-brand-600" />
            <h3 className="font-display font-bold text-ink text-base">Booking Volume (Recent Days)</h3>
          </div>
          <div className="space-y-3">
            {data.dailyBookings.map((day) => {
              const widthPct = Math.round((day.count / maxDailyCount) * 100);
              return (
                <div key={day.date} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-ink">
                    <span>{day.date}</span>
                    <span className="text-ink-soft tnum">
                      {day.count} bookings ({day.completed} completed)
                    </span>
                  </div>
                  <div className="h-3 bg-surface-sunken rounded-full overflow-hidden flex">
                    <div
                      className="bg-brand-600 rounded-full transition-all"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {data.dailyBookings.length === 0 && <p className="text-sm text-ink-faint">No daily booking data yet.</p>}
          </div>
        </div>

        {/* CENTRE UTILIZATION */}
        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={18} className="text-brand-600" />
            <h3 className="font-display font-bold text-ink text-base">Centre Throughput & Utilization</h3>
          </div>
          <div className="space-y-4">
            {data.centreStats.map((c) => {
              const utilPct = c.capacity > 0 ? Math.min(100, Math.round((c.totalBookings / c.capacity) * 100)) : 0;
              return (
                <div key={c.code} className="p-3 bg-surface-sunken rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold text-ink">
                    <span>{c.name}</span>
                    <span className="text-xs font-mono text-ink-faint">{c.code}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-ink-soft text-center">
                    <div className="bg-white p-2 rounded-lg border border-line">
                      <div className="text-[10px] text-ink-faint">Total Bookings</div>
                      <div className="font-bold text-ink tnum">{c.totalBookings}</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-line">
                      <div className="text-[10px] text-ink-faint">Completed</div>
                      <div className="font-bold text-emerald-700 tnum">{c.completed}</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-line">
                      <div className="text-[10px] text-ink-faint">Daily Cap.</div>
                      <div className="font-bold text-ink tnum">{c.capacity} qtl</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PAYMENTS SUMMARY */}
        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee size={18} className="text-brand-600" />
            <h3 className="font-display font-bold text-ink text-base">Payment Financials</h3>
          </div>
          <div className="space-y-3">
            {data.paymentSummary.map((p) => (
              <div
                key={p.status}
                className="flex items-center justify-between p-3 rounded-lg border border-line/60 bg-surface/30"
              >
                <div>
                  <p className="font-bold text-sm text-ink">{p.status}</p>
                  <p className="text-xs text-ink-faint tnum">{p.count} transactions</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-sm text-ink tnum">
                    ₹{p.totalAmount.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            ))}
            {data.paymentSummary.length === 0 && <p className="text-sm text-ink-faint">No payment records yet.</p>}
          </div>
        </div>

        {/* STATUS BREAKDOWN */}
        <div className="panel p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} className="text-brand-600" />
            <h3 className="font-display font-bold text-ink text-base">Procurement State Machine Breakdown</h3>
          </div>
          <div className="space-y-2.5">
            {data.statusBreakdown.map((s) => {
              const pct = data.totalBookings > 0 ? Math.round((s.count / data.totalBookings) * 100) : 0;
              return (
                <div key={s.status} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-ink">
                    <span>{s.status.replaceAll("_", " ")}</span>
                    <span className="text-ink-faint tnum">
                      {s.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-surface-sunken rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        s.status === "PAYMENT_COMPLETED"
                          ? "bg-emerald-600"
                          : s.status === "CANCELLED"
                          ? "bg-rose-500"
                          : "bg-brand-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
