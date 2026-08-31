export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 22 L14 27 L26 9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.25"
      />
      <path d="M14 27 C14 20 15 14 21 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <ellipse cx="20.3" cy="8.4" rx="2.1" ry="3.2" transform="rotate(35 20.3 8.4)" fill="currentColor" />
      <ellipse cx="17.2" cy="13.6" rx="2.1" ry="3.2" transform="rotate(35 17.2 13.6)" fill="currentColor" />
      <ellipse cx="15" cy="19.4" rx="2.1" ry="3.1" transform="rotate(35 15 19.4)" fill="currentColor" />
    </svg>
  );
}

export function Logo({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold tracking-tight ${className}`}>
      <Mark size={26} className={dark ? "text-white" : "text-brand-600"} />
      <span className={dark ? "text-white" : "text-ink"}>KRISHIDHENU</span>
    </span>
  );
}
