"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { Bell, BellRing, CheckCircle2, Wallet, CalendarCheck, ChevronLeft } from "lucide-react";

const TYPE_ICON: Record<string, any> = {
  WELCOME: Bell,
  BOOKING_CONFIRMED: CalendarCheck,
  QUEUE_APPROACHING: BellRing,
  COMPLETE_PROCUREMENT: CheckCircle2,
  START_PAYMENT: Wallet,
  COMPLETE_PAYMENT: Wallet,
  MARK_NO_SHOW: Bell,
};

const TYPE_ACTION: Record<string, { label: string; href: string }> = {
  BOOKING_CONFIRMED: { label: "View Live Queue", href: "/farmer/queue" },
  QUEUE_APPROACHING: { label: "View Live Queue", href: "/farmer/queue" },
  COMPLETE_PROCUREMENT: { label: "View History & Receipt", href: "/farmer/history" },
  START_PAYMENT: { label: "View Payment Status", href: "/farmer/history" },
  COMPLETE_PAYMENT: { label: "View Payment History", href: "/farmer/history" },
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function groupLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[] | undefined>(undefined);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/farmer/notifications");
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(data.notifications ?? []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markAllRead() {
    await fetch("/api/farmer/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    load();
  }

  const groups: Record<string, any[]> = {};
  items?.forEach((n) => {
    const g = groupLabel(n.createdAt);
    groups[g] = groups[g] || [];
    groups[g].push(n);
  });

  return (
    <main className="min-h-screen pb-24 bg-surface">
      <FarmerTopBar name="Farmer" title="Notifications" />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {items === undefined && <CardSkeleton />}
        {items?.length === 0 && (
          <EmptyState icon={Bell} title="You're all caught up" description="Updates about your bookings and payments will appear here." />
        )}

        {items && items.length > 0 && (
          <button onClick={markAllRead} className="text-xs text-brand-600 font-semibold">
            Mark all as read
          </button>
        )}

        {Object.entries(groups).map(([g, list]) => (
          <div key={g}>
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">{g}</p>
            <div className="panel divide-y divide-line overflow-hidden">
              {list.map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => setSelectedItem(n)}
                    className="w-full text-left flex gap-3 px-4 py-3.5 hover:bg-surface-sunken/40 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink leading-snug">{n.message}</p>
                      <p className="text-xs text-ink-faint mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-grain mt-1.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50 animate-rise-in">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-raised space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors py-1 pr-2 -ml-1 rounded"
              >
                <ChevronLeft size={16} />
                <span>Back to Notifications</span>
              </button>
              <button onClick={() => setSelectedItem(null)} className="text-ink-faint hover:text-ink text-sm">
                ✕
              </button>
            </div>

            <div className="pt-1">
              <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">
                {selectedItem.type.replaceAll("_", " ")}
              </p>
              <p className="text-base font-semibold text-ink mt-1.5 leading-snug">{selectedItem.message}</p>
              <p className="text-xs text-ink-faint mt-2">Received {timeAgo(selectedItem.createdAt)}</p>
            </div>

            <div className="flex gap-2 pt-2">
              {TYPE_ACTION[selectedItem.type] && (
                <button
                  type="button"
                  onClick={() => router.push(TYPE_ACTION[selectedItem.type].href)}
                  className="btn-primary flex-1 text-xs !py-2.5"
                >
                  {TYPE_ACTION[selectedItem.type].label}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="btn-secondary flex-1 text-xs !py-2.5"
              >
                Back to Notifications
              </button>
            </div>
          </div>
        </div>
      )}

      <FarmerNav />
    </main>
  );
}
