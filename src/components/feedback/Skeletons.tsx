import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders that match the final layout rather than a generic spinner.
 * Reading credentials means scanning event logs from the deployment block, which
 * is genuinely slow on a cold RPC — the wait should look deliberate.
 */
export function CredentialCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="h-[3px] w-full bg-muted" />
      <div className="flex aspect-[1.5] flex-col">
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>

          <div className="rule-engraved my-4" />

          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-3 w-20" />

          <div className="mt-auto grid grid-cols-3 gap-3 pt-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-border bg-muted/60 px-5 py-2.5">
          <Skeleton className="h-2.5 w-full" />
        </div>
      </div>
    </div>
  );
}

export function CredentialCardSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CredentialCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TableRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
