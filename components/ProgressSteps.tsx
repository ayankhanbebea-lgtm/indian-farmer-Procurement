export default function ProgressSteps({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1;
        return (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              step === current ? "w-6 bg-brand-600" : step < current ? "w-3 bg-brand-300" : "w-3 bg-surface-sunken"
            }`}
          />
        );
      })}
    </div>
  );
}
