"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { ADMIN_LINKS } from "@/lib/nav";
import { CardSkeleton } from "@/components/Skeleton";
import { Building2, Plus, Edit2, CheckCircle2, XCircle, ListOrdered, X } from "lucide-react";
import Link from "next/link";

interface Centre {
  id: string;
  name: string;
  code: string;
  district: string;
  location: string | null;
  dailyCapacity: number;
  avgServiceTimeMins: number;
  highLoadThreshold: number;
  openTime: string;
  closeTime: string;
  active: number;
  staffCount: number;
}

export default function AdminCentresPage() {
  const [centres, setCentres] = useState<Centre[] | null>(null);
  const [me, setMe] = useState<any>(null);
  const [lang, setLang] = useState("en");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [currentCentre, setCurrentCentre] = useState<Centre | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    district: "Jaipur",
    location: "",
    dailyCapacity: 120,
    avgServiceTimeMins: 5,
    highLoadThreshold: 50,
    openTime: "09:00",
    closeTime: "17:00",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const meRes = await fetch("/api/auth/me").then((r) => r.json());
    setMe(meRes.user);
    if (meRes.user?.language) setLang(meRes.user.language);
    const res = await fetch("/api/admin/centres");
    if (res.ok) {
      const data = await res.json();
      setCentres(data.centres);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreateModal() {
    setError("");
    setFormData({
      name: "",
      code: "",
      district: "Jaipur",
      location: "",
      dailyCapacity: 120,
      avgServiceTimeMins: 5,
      highLoadThreshold: 50,
      openTime: "09:00",
      closeTime: "17:00",
    });
    setModalMode("create");
  }

  function openEditModal(c: Centre) {
    setError("");
    setCurrentCentre(c);
    setFormData({
      name: c.name,
      code: c.code,
      district: c.district,
      location: c.location || "",
      dailyCapacity: c.dailyCapacity,
      avgServiceTimeMins: c.avgServiceTimeMins,
      highLoadThreshold: c.highLoadThreshold,
      openTime: c.openTime,
      closeTime: c.closeTime,
    });
    setModalMode("edit");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (modalMode === "create") {
        const res = await fetch("/api/admin/centres", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to create centre");
          return;
        }
      } else if (modalMode === "edit" && currentCentre) {
        const res = await fetch(`/api/admin/centres/${currentCentre.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to update centre");
          return;
        }
      }
      setModalMode(null);
      await load();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(c: Centre) {
    const nextActive = c.active === 1 ? 0 : 1;
    await fetch(`/api/admin/centres/${c.id}`, {
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
          <h1 className="font-display text-2xl font-extrabold text-ink">Procurement Centres</h1>
          <p className="text-sm text-ink-faint mt-0.5">Manage centre locations, operational parameters, and queues</p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={16} /> Create Centre
        </button>
      </div>

      {!centres ? (
        <CardSkeleton />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-sunken border-b border-line text-ink-soft font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Centre Name & Code</th>
                  <th className="py-3 px-4">District / Location</th>
                  <th className="py-3 px-4">Daily Cap.</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Staff</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {centres.map((c) => (
                  <tr key={c.id} className="hover:bg-surface/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-ink">{c.name}</div>
                      <div className="text-xs font-mono text-ink-faint mt-0.5">{c.code}</div>
                    </td>
                    <td className="py-3.5 px-4 text-ink-soft">
                      <div className="font-medium text-ink">{c.district}</div>
                      <div className="text-xs text-ink-faint truncate max-w-xs">{c.location || "Not specified"}</div>
                    </td>
                    <td className="py-3.5 px-4 tnum font-semibold text-ink">{c.dailyCapacity} quintal</td>
                    <td className="py-3.5 px-4 text-xs text-ink-soft font-mono">
                      {c.openTime} – {c.closeTime}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="badge font-semibold bg-navy/10 text-navy-800 px-2 py-0.5 rounded-full text-xs">
                        {c.staffCount} staff
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {c.active === 1 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <XCircle size={12} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <Link
                        href={`/admin/queue`}
                        className="btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1"
                        title="View Live Queue"
                      >
                        <ListOrdered size={12} /> Queue
                      </Link>
                      <button
                        onClick={() => openEditModal(c)}
                        className="btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1"
                        title="Edit Centre"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => toggleActive(c)}
                        className={`btn-secondary !py-1 !px-2 text-xs ${
                          c.active === 1 ? "text-rose-600 hover:text-rose-700" : "text-emerald-600 hover:text-emerald-700"
                        }`}
                      >
                        {c.active === 1 ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="panel max-w-lg w-full p-6 animate-rise-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <h2 className="font-display text-lg font-bold text-ink">
                {modalMode === "create" ? "Create Procurement Centre" : "Edit Centre Details"}
              </h2>
              <button onClick={() => setModalMode(null)} className="text-ink-faint hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {error && <p className="text-sm text-error bg-error/5 border border-error/20 rounded-lg p-3 mb-4">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Centre Name *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Jaipur Mandi 01"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Centre Code *</label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === "edit"}
                    className="input font-mono uppercase disabled:bg-surface-sunken"
                    placeholder="e.g. JPR04"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">District *</label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="e.g. Jaipur"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Daily Capacity (Quintal) *</label>
                  <input
                    type="number"
                    min={10}
                    required
                    className="input tnum"
                    value={formData.dailyCapacity}
                    onChange={(e) => setFormData({ ...formData, dailyCapacity: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Address / Location</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Near Bus Stand, Sitapura Area"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Opening Time</label>
                  <input
                    type="time"
                    className="input"
                    value={formData.openTime}
                    onChange={(e) => setFormData({ ...formData, openTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Closing Time</label>
                  <input
                    type="time"
                    className="input"
                    value={formData.closeTime}
                    onChange={(e) => setFormData({ ...formData, closeTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Avg Service Time (mins)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    className="input tnum"
                    value={formData.avgServiceTimeMins}
                    onChange={(e) => setFormData({ ...formData, avgServiceTimeMins: parseInt(e.target.value) || 5 })}
                  />
                </div>
                <div>
                  <label className="label">High Load Threshold (Queue)</label>
                  <input
                    type="number"
                    min={5}
                    className="input tnum"
                    value={formData.highLoadThreshold}
                    onChange={(e) => setFormData({ ...formData, highLoadThreshold: parseInt(e.target.value) || 50 })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-line">
                <button type="button" onClick={() => setModalMode(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Saving..." : modalMode === "create" ? "Create Centre" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
