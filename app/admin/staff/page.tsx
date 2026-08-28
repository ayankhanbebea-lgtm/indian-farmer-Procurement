"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { ADMIN_LINKS } from "@/lib/nav";
import { CardSkeleton } from "@/components/Skeleton";
import { Users, UserPlus, Building2, Phone, CheckCircle2, XCircle, X } from "lucide-react";

interface StaffMember {
  id: string;
  name: string;
  phone: string;
  active: number;
  createdAt: string;
  centreId: string | null;
  centreName: string | null;
  centreCode: string | null;
}

interface CentreOption {
  id: string;
  name: string;
  code: string;
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [centres, setCentres] = useState<CentreOption[]>([]);
  const [me, setMe] = useState<any>(null);
  const [lang, setLang] = useState("en");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", centreId: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const meRes = await fetch("/api/auth/me").then((r) => r.json());
    setMe(meRes.user);
    if (meRes.user?.language) setLang(meRes.user.language);

    const [staffRes, centresRes] = await Promise.all([
      fetch("/api/admin/staff"),
      fetch("/api/admin/centres"),
    ]);

    if (staffRes.ok) {
      const data = await staffRes.json();
      setStaff(data.staff);
    }
    if (centresRes.ok) {
      const data = await centresRes.json();
      setCentres(data.centres);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create staff account");
        return;
      }
      setIsCreateOpen(false);
      setFormData({ name: "", phone: "", centreId: "" });
      await load();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReassignCentre(userId: string, centreId: string) {
    await fetch(`/api/admin/staff/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centreId }),
    });
    load();
  }

  async function toggleActive(member: StaffMember) {
    const nextActive = member.active === 1 ? 0 : 1;
    await fetch(`/api/admin/staff/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: nextActive }),
    });
    load();
  }

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
          <h1 className="font-display text-2xl font-extrabold text-ink">Staff Management</h1>
          <p className="text-sm text-ink-faint mt-0.5">Manage centre staff accounts, centre assignments, and permissions</p>
        </div>
        <button
          onClick={() => {
            setError("");
            setFormData({ name: "", phone: "", centreId: centres[0]?.id || "" });
            setIsCreateOpen(true);
          }}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <UserPlus size={16} /> Create Staff Account
        </button>
      </div>

      {!staff ? (
        <CardSkeleton />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-sunken border-b border-line text-ink-soft font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Assigned Centre</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {staff.map((s) => (
                  <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-ink">{s.name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-ink-soft">
                      <span className="flex items-center gap-1.5">
                        <Phone size={13} className="text-ink-faint" />
                        +91 {s.phone}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        className="text-xs font-medium border border-line rounded-lg py-1 px-2 bg-white text-ink focus:ring-1 focus:ring-brand-600 focus:outline-none"
                        value={s.centreId || ""}
                        onChange={(e) => handleReassignCentre(s.id, e.target.value)}
                      >
                        {centres.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4">
                      {s.active === 1 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-ink-faint">
                      {new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => toggleActive(s)}
                        className={`btn-secondary !py-1 !px-2.5 text-xs ${
                          s.active === 1 ? "text-rose-600 hover:text-rose-700" : "text-emerald-600 hover:text-emerald-700"
                        }`}
                      >
                        {s.active === 1 ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="panel max-w-md w-full p-6 animate-rise-in">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <h2 className="font-display text-lg font-bold text-ink">Create Staff Account</h2>
              <button onClick={() => setIsCreateOpen(false)} className="text-ink-faint hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {error && <p className="text-sm text-error bg-error/5 border border-error/20 rounded-lg p-3 mb-4">{error}</p>}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="e.g. Suresh Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Mobile Number *</label>
                <div className="flex rounded-lg border border-line bg-white focus-within:ring-2 focus-within:ring-brand-600/25 overflow-hidden">
                  <span className="flex items-center px-3 bg-surface-sunken border-r border-line text-xs font-semibold text-ink-soft">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    required
                    className="w-full px-3 py-2 text-sm text-ink font-semibold tnum focus:outline-none"
                    placeholder="10-digit mobile"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Assign Procurement Centre *</label>
                <select
                  required
                  className="input"
                  value={formData.centreId}
                  onChange={(e) => setFormData({ ...formData, centreId: e.target.value })}
                >
                  <option value="" disabled>Select a Centre</option>
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
