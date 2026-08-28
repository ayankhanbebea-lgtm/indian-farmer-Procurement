export default function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warn" | "error" | "good";
}) {
  const toneClass =
    tone === "warn" ? "text-grain" : tone === "error" ? "text-error" : tone === "good" ? "text-brand-600" : "text-ink";
  return (
    <div className="py-3">
      <p className={`font-display text-2xl font-bold tnum ${toneClass}`}>{value}</p>
      <p className="text-xs text-ink-faint mt-0.5">{label}</p>
    </div>
  );
}

export function MetricRow({ children }: { children: React.ReactNode }) {
  return <div className="panel divide-x divide-line grid grid-flow-col auto-cols-fr px-4 overflow-x-auto">{children}</div>;
}
