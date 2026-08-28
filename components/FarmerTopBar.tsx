"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, UserCircle, ChevronLeft, Globe, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { LANGUAGES } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/context";

function LangMenu() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-white/80 hover:text-white transition-colors"
        aria-label="Select language"
        title="Language"
      >
        <Globe size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-36 bg-white border border-line rounded-xl shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          {Object.entries(LANGUAGES).map(([code, { nativeName }]) => (
            <button
              key={code}
              onClick={() => {
                setLang(code);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-ink hover:bg-surface transition-colors"
            >
              <span className="font-medium">{nativeName}</span>
              {lang === code && <Check size={12} className="text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FarmerTopBar({
  name,
  title,
  backHref = "/farmer",
  backLabel,
  onBack,
}: {
  name: string;
  title?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  lang?: string;
  onLangChange?: (lang: string) => void;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/farmer";
  const { t } = useLanguage();

  const effectiveBackLabel = backLabel || t("back");

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return t("goodMorning");
    if (h < 17) return t("goodAfternoon");
    return t("goodEvening");
  }

  return (
    <header className="sticky top-0 z-30 bg-navy text-white">
      <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {!isHome && (
            onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white py-1 pr-2 -ml-1 rounded-md transition-colors shrink-0"
                aria-label={effectiveBackLabel}
              >
                <ChevronLeft size={18} />
                <span>{effectiveBackLabel}</span>
              </button>
            ) : (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white py-1 pr-2 -ml-1 rounded-md transition-colors shrink-0"
                aria-label={effectiveBackLabel}
              >
                <ChevronLeft size={18} />
                <span>{effectiveBackLabel}</span>
              </Link>
            )
          )}
          <div className="min-w-0">
            {isHome ? (
              <>
                <p className="text-[13px] text-white/60 leading-tight">{getGreeting()},</p>
                <p className="font-display font-bold leading-tight truncate">{name}</p>
              </>
            ) : (
              <p className="font-display font-bold text-base leading-tight truncate">{title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <LangMenu />
          <Link href="/farmer/notifications" aria-label="Notifications" className="text-white/80 hover:text-white">
            <Bell size={20} />
          </Link>
          <Link href="/farmer/profile" aria-label="Profile" className="text-white/80 hover:text-white">
            <UserCircle size={22} />
          </Link>
        </div>
      </div>
    </header>
  );
}
