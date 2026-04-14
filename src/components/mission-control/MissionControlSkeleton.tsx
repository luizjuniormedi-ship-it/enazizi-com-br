import { Skeleton } from "@/components/ui/skeleton";

export default function MissionControlSkeleton() {
  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* Hero skeleton */}
      <div className="rounded-lg border border-border/50 p-5 sm:p-7 space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-12 w-12" />
        </div>
      </div>

      {/* Justification skeleton */}
      <Skeleton className="h-20 rounded-lg" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-44 rounded-lg" />
        <Skeleton className="h-44 rounded-lg" />
      </div>

      {/* Quick actions skeleton */}
      <Skeleton className="h-20 rounded-lg" />
    </div>
  );
}
