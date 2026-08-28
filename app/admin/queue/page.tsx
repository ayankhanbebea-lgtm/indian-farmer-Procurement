"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { ADMIN_LINKS } from "@/lib/nav";
import { CardSkeleton } from "@/components/Skeleton";
import StatusBadge from "@/components/StatusBadge";
import LoadIndicator from "@/components/LoadIndicator";
import { ListOrdered, Calendar, Phone, RefreshCw } from "lucide-react";

interface QueueEntry {
  id: string;
  token: string;
  status: string;
  farmerName: string;
  farmerPhone: string;
  position: number;
  calledAt: string | null;
  cropName: string;
}

interface CentreQueueData {
  id: string;
  name: string;
  code: string;
  queue: QueueEntry[];
  serving: string | null;
  load: {
    totalCapacity: number;
    bookedCount: number;
    availableCapacity: number;
    waiting: number;
    load: "LOW_LOAD" | "NORMAL" | "BUSY" | "HIGH_LOAD";
    estimatedWaitMins: number;
  };
}

export default function AdminQueuePage() {
  const [data, setData] = useState<{ centres: CentreQueueData[]; date: string } | null>(null);
  const [me, setMe] = useState<any>(null);
  const [lang, setLang] = useState("en");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  async function load(d = selectedDate) {
    setLoading(true);
    try {
      const meRes = await fetch("/api/auth/me").then((r) => r.json());
      setMe(meRes.user);
      if (meRes.user?.language) setLang(meRes.user.language);

      const res = await fetch(`/api/admin/queue?date=${d}`);
      if (res.ok) {
        const queueData = await res.json();
        setData(queueData);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(selectedDate);
    const interval = setInterval(() => load(selectedDate), 5000);
    return () => clearInterval(interval);
  }, [selectedDate]);

  return (
    <DashboardShell
      role="Admin"
      name={me?.name || ""}
      links={ADMIN_LINKS}
      language={lang}
      onLanguageChange={setLang}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Live Queue Network</h1>
          <p className="text-sm text-ink-faint mt-0.5">Real-time token advancement and congestion monitor across all procurement centres</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            className="input !py-1.5 text-sm"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button
            onClick={() => load(selectedDate)}
            className="btn-secondary !p-2"
            title="Refresh Live Data"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {!data ? (
        <CardSkeleton />
      ) : (
        <div className="space-y-6">
          {data.centres.map((centre) => {
            const waitingCount = centre.queue.filter((q) => q.status === "BOOKED").length;
            const inProgressCount = centre.queue.filter((q) =>
              ["ARRIVED", "VERIFIED", "WEIGHING", "PROCUREMENT_IN_PROGRESS"].includes(q.status)
            ).length;
            const completedCount = centre.queue.filter((q) =>
              ["PROCUREMENT_COMPLETED", "PAYMENT_PROCESSING", "PAYMENT_COMPLETED"].includes(q.status)
            ).length;

            return (
              <div key={centre.id} className="panel p-5">
                {/* CENTRE HEADER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-line">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-bold text-ink">{centre.name}</h2>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-navy-50 text-navy font-bold">
                        {centre.code}
                      </span>
                    </div>
                    <div className="mt-2 max-w-sm">
                      <LoadIndicator load={centre.load.load} waiting={centre.load.waiting} />
                    </div>
                  </div>

                  {/* CURRENTLY SERVING HERO */}
                  <div className="flex items-center gap-4 bg-surface-sunken p-3 rounded-xl border border-line">
                    <div>
                      <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">Now Serving</p>
                      <p className="font-display text-xl font-extrabold text-brand-700 tnum">
                        {centre.serving || "None"}
                      </p>
                    </div>
                    <div className="h-8 w-px bg-line" />
                    <div className="text-xs space-y-0.5">
                      <div>
                        <span className="text-ink-faint">Est. Wait:</span>{" "}
                        <span className="font-bold text-ink tnum">{centre.load.estimatedWaitMins} min</span>
                      </div>
                      <div>
                        <span className="text-ink-faint">Cap:</span>{" "}
                        <span className="font-bold text-ink tnum">
                          {centre.load.bookedCount}/{centre.load.totalCapacity} qtl
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MINI QUEUE STATS */}
                <div className="grid grid-cols-3 gap-2 my-3 text-center text-xs">
                  <div className="bg-amber-50 text-amber-900 border border-amber-200 py-1.5 rounded-lg font-medium">
                    Waiting: <span className="font-bold tnum">{waitingCount}</span>
                  </div>
                  <div className="bg-sky-50 text-sky-900 border border-sky-200 py-1.5 rounded-lg font-medium">
                    Processing: <span className="font-bold tnum">{inProgressCount}</span>
                  </div>
                  <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 py-1.5 rounded-lg font-medium">
                    Completed: <span className="font-bold tnum">{completedCount}</span>
                  </div>
                </div>

                {/* QUEUE TABLE */}
                {centre.queue.length === 0 ? (
                  <p className="text-xs text-ink-faint text-center py-4">No bookings in queue for this date.</p>
                ) : (
                  <div className="overflow-x-auto border border-line rounded-lg mt-2">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-sunken border-b border-line text-ink-soft font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Pos</th>
                          <th className="py-2.5 px-3">Token</th>
                          <th className="py-2.5 px-3">Farmer</th>
                          <th className="py-2.5 px-3">Crop</th>
                          <th className="py-2.5 px-3">Called At</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {centre.queue.map((entry) => (
                          <tr
                            key={entry.id}
                            className={entry.token === centre.serving ? "bg-amber-50/50 font-medium" : "hover:bg-surface/50"}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold text-ink-soft">#{entry.position}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-ink">{entry.token}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-ink">{entry.farmerName}</div>
                              <div className="text-[10px] text-ink-faint font-mono">+91 {entry.farmerPhone}</div>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-ink">{entry.cropName}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-ink-faint">
                              {entry.calledAt
                                ? new Date(entry.calledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                                : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <StatusBadge status={entry.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
