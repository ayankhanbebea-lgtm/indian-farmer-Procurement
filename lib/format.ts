export const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Booked",
  ARRIVED: "Arrived",
  VERIFIED: "Verified",
  WEIGHING: "Weighing",
  PROCUREMENT_IN_PROGRESS: "Processing",
  PROCUREMENT_COMPLETED: "Procurement completed",
  PAYMENT_PROCESSING: "Payment processing",
  PAYMENT_COMPLETED: "Payment completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
};

export const STATUS_COLORS: Record<string, string> = {
  BOOKED: "bg-brand-50 text-brand-700",
  ARRIVED: "bg-grain-soft text-grain",
  VERIFIED: "bg-grain-soft text-grain",
  WEIGHING: "bg-grain-soft text-grain",
  PROCUREMENT_IN_PROGRESS: "bg-grain-soft text-grain",
  PROCUREMENT_COMPLETED: "bg-brand-100 text-brand-700",
  PAYMENT_PROCESSING: "bg-grain-soft text-grain",
  PAYMENT_COMPLETED: "bg-brand-100 text-brand-700",
  CANCELLED: "bg-black/5 text-ink-faint",
  NO_SHOW: "bg-error/10 text-error",
  PENDING: "bg-black/5 text-ink-faint",
  PROCESSING: "bg-grain-soft text-grain",
  PAID: "bg-brand-100 text-brand-700",
  FAILED: "bg-error/10 text-error",
};

export function label(status?: string | null) {
  if (!status) return "—";
  return STATUS_LABELS[status] || String(status).replaceAll("_", " ");
}

export function colorFor(status?: string | null) {
  if (!status) return "bg-black/5 text-ink-faint";
  return STATUS_COLORS[status] || "bg-black/5 text-ink-faint";
}

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return String(dateStr);
  }
}

export function formatDateShort(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return String(dateStr);
  }
}

export function formatCurrency(amount?: number | null) {
  if (amount == null || isNaN(Number(amount))) return "₹0";
  try {
    return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  } catch {
    return `₹${amount}`;
  }
}
