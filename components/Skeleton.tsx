export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skel ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="card space-y-3">
      <Skeleton className="h-4 w-2/5" />
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
