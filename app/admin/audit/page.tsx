"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { ADMIN_LINKS } from "@/lib/nav";
import { CardSkeleton } from "@/components/Skeleton";
import { ScrollText, User, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  userName: string;
  userRole: string;
  userPhone: string;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [me, setMe] = useState<any>(null);
  const [lang, setLang] = useState("en");
  const limit = 50;

  async function load(p = page) {
    const meRes = await fetch("/api/auth/me").then((r) => r.json());
    setMe(meRes.user);
    if (meRes.user?.language) setLang(meRes.user.language);

    const res = await fetch(`/api/admin/audit?page=${p}`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    }
  }

  useEffect(() => {
    load(page);
  }, [page]);

  const totalPages = Math.ceil(total / limit) || 1;

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
          <h1 className="font-display text-2xl font-extrabold text-ink">System Audit Trail</h1>
          <p className="text-sm text-ink-faint mt-0.5">Immutable activity log recording all staff and administrator actions</p>
        </div>
        <div className="text-xs text-ink-soft bg-surface-sunken px-3 py-1.5 rounded-lg border border-line">
          Total Logs: <span className="font-bold text-ink tnum">{total}</span>
        </div>
      </div>

      {!logs ? (
        <CardSkeleton />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-sunken border-b border-line text-ink-soft font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4 text-right">Entity ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="text-ink font-medium text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-[11px] text-ink-faint">{timeAgo(log.createdAt)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-ink text-xs">{log.userName}</div>
                      <div className="text-[11px] text-ink-faint">
                        <span className="font-bold text-navy">{log.userRole}</span> · +91 {log.userPhone}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-800 border border-brand-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-ink-soft capitalize">
                      {log.entity.replaceAll("_", " ")}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-ink-faint">
                      {log.entityId ? `#${log.entityId.slice(-8)}` : "—"}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-ink-faint text-sm">
                      No audit log entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-line flex items-center justify-between text-xs">
              <span className="text-ink-soft">
                Page <strong className="text-ink">{page}</strong> of <strong className="text-ink">{totalPages}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="btn-secondary !py-1 !px-2 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="btn-secondary !py-1 !px-2 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
