import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** What belongs here and why it is empty. */
  description: string;
  /** The actual next action, not a dead end. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      <div className="grid h-11 w-11 place-items-center rounded-full border border-border bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  /** The real reason, not a generic apology. */
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  /**
   * Reads from event logs back to the deployment block, which a cold public RPC
   * can be slow to serve. Saying so turns a mysterious failure into an expected one.
   */
  showRpcNote?: boolean;
  className?: string;
}

export function ErrorState({
  title = "Could not read from Sepolia",
  message,
  onRetry,
  retryLabel = "Try again",
  showRpcNote = false,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("rounded-lg border border-destructive/30 bg-destructive/5 p-5", className)}>
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-destructive">{title}</h3>
          <p className="mt-1 text-sm text-foreground/80">{message}</p>
          {showRpcNote && (
            <p className="mt-2 text-xs text-muted-foreground">
              Credentials are rebuilt from event logs going back to the deployment block. Public endpoints rate-limit
              this, so the app falls over between several of them — a retry often lands on a healthier one.
            </p>
          )}
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {retryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
