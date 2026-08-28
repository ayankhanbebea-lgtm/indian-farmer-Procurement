const LOAD_META: Record<string, { text: string; dot: string; bar: string; pct: number }> = {
  LOW_LOAD: { text: "Low Load", dot: "bg-emerald-500", bar: "bg-emerald-500", pct: 15 },
  NORMAL: { text: "Normal", dot: "bg-brand-600", bar: "bg-brand-600", pct: 30 },
  BUSY: { text: "Busy", dot: "bg-grain", bar: "bg-grain", pct: 65 },
  HIGH_LOAD: { text: "High load", dot: "bg-error", bar: "bg-error", pct: 92 },
};

export default function LoadIndicator({ load, waiting }: { load: "LOW_LOAD" | "NORMAL" | "BUSY" | "HIGH_LOAD" | string; waiting: number }) {
  const meta = LOAD_META[load] || LOAD_META.NORMAL;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.text}
        </span>
        <span className="text-ink-faint tnum">{waiting} waiting</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
        <div className={`h-full rounded-full ${meta.bar} transition-all duration-500`} style={{ width: `${meta.pct}%` }} />
      </div>
    </div>
  );
}
