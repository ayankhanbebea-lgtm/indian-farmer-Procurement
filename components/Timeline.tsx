import { Check } from "lucide-react";

export type TimelineStep = { label: string; done: boolean; active?: boolean; sub?: string };

export default function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div>
      {steps.map((s, i) => (
        <div key={s.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                s.done
                  ? "bg-brand-600 text-white"
                  : s.active
                  ? "bg-grain text-white animate-pulse-dot"
                  : "bg-surface-sunken text-ink-faint"
              }`}
            >
              {s.done ? <Check size={13} strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
            </span>
            {i < steps.length - 1 && (
              <span className={`w-px flex-1 min-h-[22px] ${s.done ? "bg-brand-600" : "bg-line"}`} />
            )}
          </div>
          <div className={`pb-5 ${i === steps.length - 1 ? "pb-0" : ""}`}>
            <p className={`text-sm font-medium ${s.done || s.active ? "text-ink" : "text-ink-faint"}`}>{s.label}</p>
            {s.sub && <p className="text-xs text-ink-faint mt-0.5">{s.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
