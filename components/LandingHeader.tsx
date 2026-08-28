"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LogOut, LayoutDashboard, User } from "lucide-react";

type AuthUser = {
  id: string;
  name: string;
  phone: string;
  role: "FARMER" | "STAFF" | "ADMIN";
};

export default function LandingHeader() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user || null);
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const dashboardHref =
    user?.role === "STAFF" ? "/staff" : user?.role === "ADMIN" ? "/admin" : "/farmer";

  return (
    <header className="border-b border-line bg-surface-card/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          {user === undefined ? (
            // Loading placeholder to prevent layout shifts
            <div className="h-9 w-28 bg-surface-sunken animate-pulse rounded-lg" />
          ) : user ? (
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-ink-soft bg-surface-sunken px-2.5 py-1.5 rounded-lg border border-line">
                <User size={13} className="text-brand-600" />
                <span className="font-semibold text-ink">{user.name}</span>
                <span className="text-[10px] text-brand-700 bg-brand-50 font-bold px-1.5 py-0.2 rounded uppercase">
                  {user.role}
                </span>
              </div>
              <Link
                href={dashboardHref}
                className="btn-primary !px-3.5 !py-1.5 text-xs sm:text-sm inline-flex items-center gap-1.5"
              >
                <LayoutDashboard size={15} />
                <span>Dashboard</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn-secondary !px-2.5 !py-1.5 text-xs sm:text-sm text-ink-faint hover:text-error hover:border-error/30 inline-flex items-center gap-1 transition-colors"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <Link href="/login" className="btn-primary !px-4 !py-2 text-sm">
              Login with OTP
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
