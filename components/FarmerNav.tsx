"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarPlus, ListOrdered, History, UserCircle, CreditCard } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export default function FarmerNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/farmer", label: t("home"), icon: Home },
    { href: "/farmer/book", label: t("bookSlot"), icon: CalendarPlus },
    { href: "/farmer/queue", label: t("liveQueue"), icon: ListOrdered },
    { href: "/farmer/payments", label: t("payments"), icon: CreditCard },
    { href: "/farmer/history", label: t("history"), icon: History },
    { href: "/farmer/profile", label: t("profile"), icon: UserCircle },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-line grid grid-cols-6 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] transition-colors ${
              active ? "text-brand-600 font-semibold" : "text-ink-faint"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            <span className="truncate max-w-[60px] text-center">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
