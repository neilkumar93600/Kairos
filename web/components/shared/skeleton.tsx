import { cn } from "@/lib/utils";

/** Bone placeholder. The pulse is loading feedback, not ambient motion, and stops under reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-input bg-sunk motion-reduce:animate-none", className)} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-card" />
      ))}
    </div>
  );
}
