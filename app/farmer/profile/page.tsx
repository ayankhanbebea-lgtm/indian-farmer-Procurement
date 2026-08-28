"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import FarmerTopBar from "@/components/FarmerTopBar";
import FarmerNav from "@/components/FarmerNav";
import { CardSkeleton } from "@/components/Skeleton";
import { LogOut, User, Phone, MapPin, Globe, IdCard, AlertCircle, RefreshCw } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/farmer/profile");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Unable to load profile data.");
      }
      const data = await res.json();
      setProfile(data.profile ?? null);
    } catch (err: any) {
      console.error("[ProfilePage Error]", err);
      setError(err.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const fields = profile
    ? [
        { icon: User, label: t("name"), value: profile.name || "—" },
        { icon: Phone, label: t("phone"), value: profile.phone ? `+91 ${profile.phone}` : "—" },
        { icon: MapPin, label: t("district"), value: profile.district || "—" },
        { icon: MapPin, label: t("state"), value: profile.state || "Rajasthan" },
        { icon: IdCard, label: t("farmerCode"), value: profile.farmerCode || "Not assigned" },
        { icon: Globe, label: t("preferredLanguage"), value: profile.language === "hi" ? "हिन्दी" : "English" },
      ]
    : [];

  return (
    <main className="min-h-screen pb-24 bg-surface">
      <FarmerTopBar name={profile?.name || "Farmer"} title={t("profile")} />
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* ERROR STATE */}
        {error && (
          <div className="panel border-error/30 bg-error/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-error">
              <AlertCircle size={18} />
              <p className="font-semibold text-sm">{error}</p>
            </div>
            <button
              onClick={loadProfile}
              className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
            >
              <RefreshCw size={13} /> {t("tryAgain")}
            </button>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && <CardSkeleton />}

        {/* PROFILE CARD */}
        {!loading && !error && profile && (
          <>
            <div className="panel p-5">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full bg-brand-600 text-white flex items-center justify-center font-display font-bold text-lg">
                  {profile.name?.[0] || "F"}
                </span>
                <div>
                  <p className="font-display font-bold text-ink text-base">{profile.name}</p>
                  <p className="text-xs text-ink-faint font-mono mt-0.5">+91 {profile.phone}</p>
                </div>
              </div>
            </div>

            {/* DETAILS */}
            <div className="panel divide-y divide-line">
              <div className="p-4">
                <p className="text-xs font-bold text-ink uppercase tracking-wider">{t("personalDetails")}</p>
              </div>
              {fields.map(({ icon: Icon, label, value }) => (
                <div key={label} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className="text-brand-600 shrink-0" />
                    <span className="text-xs text-ink-soft">{label}</span>
                  </div>
                  <span className="text-xs font-semibold text-ink text-right">{value}</span>
                </div>
              ))}
            </div>

            {/* LOGOUT */}
            <button
              type="button"
              onClick={logout}
              className="btn-secondary w-full text-error border-error/30 hover:bg-error/5 font-semibold text-sm !py-3 flex items-center justify-center gap-2"
            >
              <LogOut size={16} />
              {t("clearSession")}
            </button>
          </>
        )}
      </div>
      <FarmerNav />
    </main>
  );
}
