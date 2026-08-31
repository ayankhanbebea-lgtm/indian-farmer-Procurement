"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LucideIcon, Globe, ChevronDown, Check } from "lucide-react";
import { Mark } from "./Logo";
import { useState, useRef, useEffect } from "react";
import { LANGUAGES } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/context";

export type NavLink = { href: string; label: string; icon: LucideIcon };

function LangDropdown() {
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

  const cur = LANGUAGES[lang] ?? LANGUAGES.en;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors mt-1"
      >
        <Globe size={12} />
        <span>{cur.nativeName}</span>
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-44 bg-navy border border-white/20 rounded-xl shadow-lg z-50 py-1 max-h-56 overflow-y-auto">
          {Object.entries(LANGUAGES).map(([code, { nativeName }]) => (
            <button
              key={code}
              onClick={() => {
                setLang(code);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-white/10 transition-colors text-white/80 hover:text-white"
            >
              <span>{nativeName}</span>
              {lang === code && <Check size={12} className="text-grain" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardShell({
  role,
  name,
  subtitle,
  links,
  children,
}: {
  role: string;
  name: string;
  subtitle?: string;
  links: NavLink[];
  children: React.ReactNode;
  language?: string;
  onLanguageChange?: (lang: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-surface md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 bg-navy text-white">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
          <Mark size={24} className="text-white" />
          <span className="font-display font-bold leading-tight text-base tracking-tight">
            KRISHIDHENU
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/admin" && l.href !== "/staff" && pathname.startsWith(l.href));
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? "bg-white/10 text-white font-semibold" : "text-white/65 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={17} />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-xs text-white/50 uppercase tracking-wide">{role}</p>
          <p className="text-sm font-medium truncate">{name}</p>
          {subtitle && <p className="text-xs text-white/50 truncate">{subtitle}</p>}
          <LangDropdown />
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white mt-3">
            <LogOut size={13} /> {t("logout")}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden bg-navy text-white sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2">
              <Mark size={20} className="text-white" />
              <span className="font-display font-bold text-sm">KRISHIDHENU</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const cur = Object.keys(LANGUAGES);
                  const idx = cur.indexOf(lang);
                  const next = cur[(idx + 1) % cur.length];
                  setLang(next);
                }}
                className="text-white/60 hover:text-white"
                title="Change language"
              >
                <Globe size={17} />
              </button>
              <button onClick={logout} className="text-white/70">
                <LogOut size={17} />
              </button>
            </div>
          </div>
          <nav className="flex overflow-x-auto gap-1 px-3 pb-2.5">
            {links.map((l) => {
              const active = pathname === l.href || (l.href !== "/admin" && l.href !== "/staff" && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${
                    active ? "bg-white text-navy" : "bg-white/10 text-white/75"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
