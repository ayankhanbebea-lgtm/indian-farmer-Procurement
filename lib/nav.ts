import {
  LayoutGrid,
  Building2,
  Users,
  UserCheck,
  CalendarDays,
  ListOrdered,
  BarChart2,
  ScrollText,
} from "lucide-react";
import { NavLink } from "@/components/DashboardShell";
import { TranslationKeys } from "@/lib/i18n";

export function getAdminLinks(t: (key: TranslationKeys) => string): NavLink[] {
  return [
    { href: "/admin", label: t("overview"), icon: LayoutGrid },
    { href: "/admin/centres", label: t("centres"), icon: Building2 },
    { href: "/admin/staff", label: t("staffManagement"), icon: Users },
    { href: "/admin/farmers", label: t("farmerManagement"), icon: UserCheck },
    { href: "/admin/bookings", label: t("bookings"), icon: CalendarDays },
    { href: "/admin/queue", label: t("liveQueue"), icon: ListOrdered },
    { href: "/admin/analytics", label: t("analytics"), icon: BarChart2 },
    { href: "/admin/audit", label: t("auditLogs"), icon: ScrollText },
  ];
}

export const ADMIN_LINKS: NavLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/centres", label: "Centres", icon: Building2 },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/farmers", label: "Farmers", icon: UserCheck },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/queue", label: "Live Queue", icon: ListOrdered },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/audit", label: "Audit Logs", icon: ScrollText },
];

export const STAFF_LINKS: NavLink[] = [
  { href: "/staff", label: "Dashboard", icon: LayoutGrid },
];
