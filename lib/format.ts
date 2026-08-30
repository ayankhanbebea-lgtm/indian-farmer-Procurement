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
  ON_HOLD: "On Hold",
};

export const STATUS_COLORS: Record<string, string> = {
  BOOKED: "bg-brand-50 text-brand-700",
  ARRIVED: "bg-amber-50 text-amber-800",
  VERIFIED: "bg-sky-50 text-sky-800",
  WEIGHING: "bg-indigo-50 text-indigo-800",
  PROCUREMENT_IN_PROGRESS: "bg-amber-50 text-amber-800",
  PROCUREMENT_COMPLETED: "bg-emerald-100 text-emerald-800",
  PAYMENT_PROCESSING: "bg-sky-100 text-sky-800",
  PAYMENT_COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-600",
  NO_SHOW: "bg-rose-100 text-rose-800",
  PENDING: "bg-amber-50 text-amber-800",
  PROCESSING: "bg-sky-100 text-sky-800",
  PAID: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
  ON_HOLD: "bg-orange-100 text-orange-800",
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

export function getTodayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function normalizeDateToYMD(dateStr?: string | null): string {
  if (!dateStr) return getTodayIST();
  const trimmed = dateStr.trim();
  
  // If already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // If in DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // If in ISO timestamp or parseable Date
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    }
  } catch {}

  return trimmed;
}

export function formatCurrency(amount?: number | null) {
  if (amount == null || isNaN(Number(amount))) return "₹0";
  try {
    return `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  } catch {
    return `₹${amount}`;
  }
}

export function amountToWords(num?: number | null): string {
  if (!num || isNaN(Number(num))) return "Zero Rupees Only";
  const n = Math.round(Number(num));
  if (n === 0) return "Zero Rupees Only";

  const single = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwoDigits(v: number): string {
    if (v < 10) return single[v];
    if (v < 20) return teens[v - 10];
    const unit = v % 10;
    return `${tens[Math.floor(v / 10)]}${unit ? " " + single[unit] : ""}`;
  }

  function convertThreeDigits(v: number): string {
    const hundred = Math.floor(v / 100);
    const rest = v % 100;
    let res = "";
    if (hundred > 0) res += `${single[hundred]} Hundred`;
    if (rest > 0) {
      if (res) res += " and ";
      res += convertTwoDigits(rest);
    }
    return res;
  }

  let words = "";
  const crore = Math.floor(n / 10000000);
  let remainder = n % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  const thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;

  if (crore > 0) words += `${convertTwoDigits(crore)} Crore `;
  if (lakh > 0) words += `${convertTwoDigits(lakh)} Lakh `;
  if (thousand > 0) words += `${convertTwoDigits(thousand)} Thousand `;
  if (remainder > 0) words += `${convertThreeDigits(remainder)} `;

  return `Rupees ${words.trim()} Only`;
}

