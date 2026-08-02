import { cn } from "@/lib/utils";
import { STATUS_META, type DisplayStatus } from "./status";

interface StatusBadgeProps {
  status: DisplayStatus;
  size?: "sm" | "md";
  /** Hide the icon where the surrounding context already carries the meaning. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * The only status pill in the app. Every screen renders a status through this,
 * so "Revoked" looks identical on the student's card, the issuer's table and
 * the verifier's result.
 */
export function StatusBadge({ status, size = "md", iconOnly = false, className }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.badgeClass,
        className,
      )}
      title={meta.description}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{meta.label}</span> : meta.label}
    </span>
  );
}
