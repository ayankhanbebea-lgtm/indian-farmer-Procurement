"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { ADMIN_LINKS } from "@/lib/nav";
import { CardSkeleton } from "@/components/Skeleton";
import StatusBadge from "@/components/StatusBadge";
import { UserCheck, Search, Phone, ChevronRight, X, Calendar, MapPin, Wheat } from "lucide-react";

interface FarmerSummary {
  id: string;
  name: string;
  phone: string;
  active: number;
  district: string;
  state: string;
  farmerCode: string | null;
  totalBookings: number;
  completedBookings: number;
  createdAt: string;
}

interface FarmerDetail {
  id: string;
  name: string;
  phone: string;
  active: number;
  district: string;
  state: string;
  farmerCode: string | null;
  address: string | null;
  createdAt: string;
}

interface BookingRecord {
  id: string;
  token: string;
  status: string;
  quantityQuintal: number;
  actualQuantity: number | null;
  cropName: string;
  centreName: string;
  date: string;
  startTime: string;
  paymentStatus: string | null;
  paymentAmount: number | null;
}

export default function AdminFarmersPage() {
  const [farmers, setFarmers] = useState<FarmerSummary[] | null>(null);
  const [me, setMe] = useState<any>(null);
  const [lang, setLang] = useState("en");
  const [search, setSearch] = useState("");
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);
  const [farmerDetail, setFarmerDetail] = useState<{ farmer: FarmerDetail; bookings: BookingRecord[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load(q = "") {
    const meRes = await fetch("/api/auth/me").then((r) => r.json());
    setMe(meRes.user);
    if (meRes.user?.language) setLang(meRes.user.language);

    const res = await fetch(`/api/admin/farmers?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      setFarmers(data.farmers);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openFarmerDetail(id: string) {
    setSelectedFarmerId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/farmers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setFarmerDetail(data);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(search);
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
          <h1 className="font-display text-2xl font-extrabold text-ink">Farmer Management</h1>
          <p className="text-sm text-ink-faint mt-0.5">Search farmer profiles, view historical bookings, and track procurement status</p>
        </div>
      </div>

      {/* SEARCH BAR */}
      <form onSubmit={handleSearchSubmit} className="mb-6">
        <div className="flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              placeholder="Search by farmer name or phone..."
              className="input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                load("");
              }}
              className="btn-secondary"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {!farmers ? (
        <CardSkeleton />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-sunken border-b border-line text-ink-soft font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Farmer Name & Code</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">District, State</th>
                  <th className="py-3 px-4">Total Bookings</th>
                  <th className="py-3 px-4">Completed</th>
                  <th className="py-3 px-4 text-right">View History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {farmers.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => openFarmerDetail(f.id)}
                    className="hover:bg-surface/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-ink">{f.name}</div>
                      <div className="text-xs text-ink-faint font-mono">{f.farmerCode || "—"}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-ink-soft">
                      <span className="flex items-center gap-1.5">
                        <Phone size={13} className="text-ink-faint" />
                        +91 {f.phone}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-ink-soft text-xs">
                      {f.district}, {f.state}
                    </td>
                    <td className="py-3.5 px-4 tnum font-semibold text-ink">{f.totalBookings}</td>
                    <td className="py-3.5 px-4">
                      <span className="badge font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full text-xs tnum">
                        {f.completedBookings}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-ink-faint hover:text-brand-600">
                      <ChevronRight size={18} className="inline-block" />
                    </td>
                  </tr>
                ))}
                {farmers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-ink-faint text-sm">
                      No farmers found matching &quot;{search}&quot;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL / DRAWER */}
      {selectedFarmerId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="panel max-w-2xl w-full p-6 animate-rise-in my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <h2 className="font-display text-lg font-bold text-ink">Farmer Profile & Procurement History</h2>
              <button onClick={() => setSelectedFarmerId(null)} className="text-ink-faint hover:text-ink">
                <X size={18} />
              </button>
            </div>

            {detailLoading || !farmerDetail ? (
              <CardSkeleton />
            ) : (
              <div className="space-y-5 overflow-y-auto pr-1">
                {/* Farmer Info Card */}
                <div className="p-4 bg-surface-sunken rounded-xl space-y-2 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-base text-ink">{farmerDetail.farmer.name}</h3>
                      <p className="text-xs font-mono text-ink-soft">Code: {farmerDetail.farmer.farmerCode || "—"}</p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-full">
                      +91 {farmerDetail.farmer.phone}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-ink-soft pt-2 border-t border-line/60">
                    <div>
                      <span className="text-ink-faint">District:</span> {farmerDetail.farmer.district}
                    </div>
                    <div>
                      <span className="text-ink-faint">State:</span> {farmerDetail.farmer.state}
                    </div>
                    {farmerDetail.farmer.address && (
                      <div className="col-span-2">
                        <span className="text-ink-faint">Address:</span> {farmerDetail.farmer.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* History Table */}
                <div>
                  <h4 className="font-display font-semibold text-sm text-ink mb-2">Bookings & Procurements</h4>
                  {farmerDetail.bookings.length === 0 ? (
                    <p className="text-xs text-ink-faint py-4 text-center">No booking records found for this farmer.</p>
                  ) : (
                    <div className="border border-line rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface border-b border-line text-ink-soft font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Token</th>
                            <th className="py-2.5 px-3">Crop / Qty</th>
                            <th className="py-2.5 px-3">Centre & Date</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {farmerDetail.bookings.map((b) => (
                            <tr key={b.id}>
                              <td className="py-2.5 px-3 font-mono font-bold text-ink">{b.token}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium text-ink">{b.cropName}</div>
                                <div className="text-[11px] text-ink-faint tnum">
                                  {b.actualQuantity ? `${b.actualQuantity} qtl (act)` : `${b.quantityQuintal} qtl`}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="text-ink truncate max-w-[120px]">{b.centreName}</div>
                                <div className="text-[11px] text-ink-faint">{b.date}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <StatusBadge status={b.status} />
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium">
                                {b.paymentAmount ? (
                                  <span className="text-emerald-700 tnum font-semibold">₹{b.paymentAmount.toLocaleString("en-IN")}</span>
                                ) : (
                                  <span className="text-ink-faint">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
