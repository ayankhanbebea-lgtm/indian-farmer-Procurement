"use client";

const MAX_DOTS = 8;

export default function QueueRail({
  servingToken,
  farmersAhead = 0,
  myToken,
  compact = false,
}: {
  servingToken: string | null;
  farmersAhead?: number;
  myToken: string;
  compact?: boolean;
}) {
  const safeAhead = typeof farmersAhead === "number" && !isNaN(farmersAhead) && farmersAhead >= 0 ? Math.floor(farmersAhead) : 0;
  const dotCount = Math.min(safeAhead, MAX_DOTS);
  const overflow = Math.max(0, safeAhead - dotCount);

  return (
    <div className={compact ? "py-2" : "py-4"}>
      <div className="flex items-center">
        {/* Now serving marker */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-brand-600/25 animate-pulse-dot" />
            <span className="relative flex items-center justify-center w-9 h-9 rounded-full bg-brand-600 text-white text-[10px] font-bold">
              NOW
            </span>
          </div>
          {!compact && <span className="mt-1.5 text-xs font-semibold text-ink tnum">{servingToken || "—"}</span>}
        </div>

        {/* Flow line with ahead-dots */}
        <div className="flex-1 flex items-center px-1.5 min-w-0">
          <div className="flex-1 h-px bg-line relative">
            <div className="absolute inset-0 flex items-center justify-evenly px-1">
              {Array.from({ length: dotCount }).map((_, i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand-300" />
              ))}
            </div>
          </div>
          {overflow > 0 && (
            <span className="shrink-0 mx-1.5 text-[11px] font-semibold text-ink-faint">+{overflow}</span>
          )}
        </div>

        {/* My token — the grain-seed marker, larger and gold */}
        <div className="flex flex-col items-center shrink-0">
          <span
            className="flex items-center justify-center w-11 h-11 rounded-full bg-grain text-white shadow-raised"
            style={{ clipPath: "ellipse(46% 50% at 50% 50%)" }}
          >
            <span className="text-[9px] font-bold leading-none px-1 text-center">YOU</span>
          </span>
          {!compact && <span className="mt-1.5 text-xs font-bold text-grain tnum">{myToken}</span>}
        </div>
      </div>

      {!compact && (
        <p className="text-center text-xs text-ink-faint mt-2">
          {farmersAhead === 0 ? "You're next in line" : `${farmersAhead} farmer${farmersAhead === 1 ? "" : "s"} ahead of you`}
        </p>
      )}
    </div>
  );
}
