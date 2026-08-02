import { Check, Copy, ExternalLink } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";
import { truncateMiddle } from "@/utils/format";

interface HashDisplayProps {
  value: string;
  /** Caption shown above a block, or before an inline value. */
  label?: string;
  /** Opens the value on Etherscan or an IPFS gateway. */
  href?: string;
  /** Characters kept at each end when truncating. */
  lead?: number;
  tail?: number;
  /**
   * "inline" truncates middle-out for use inside a sentence or a table cell.
   * "block" is a bordered evidence row that shows the value in full.
   */
  variant?: "inline" | "block";
  className?: string;
}

/**
 * Every hash, address, CID, key and block number in the app renders through
 * this: monospace, truncated middle-out, copyable, with the full value one
 * hover away. Cryptographic material should look like cryptographic material.
 */
export function HashDisplay({
  value,
  label,
  href,
  lead = 6,
  tail = 4,
  variant = "inline",
  className,
}: HashDisplayProps) {
  const { copied, copy } = useCopy();

  const copyButton = (
    <button
      type="button"
      onClick={() => copy(value)}
      aria-label={`Copy ${label ?? "value"}`}
      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );

  const linkButton = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${label ?? "value"} in a new tab`}
      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  ) : null;

  if (variant === "block") {
    return (
      <div className={cn("min-w-0", className)}>
        {label && (
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        )}
        <div className="flex items-start gap-1 rounded-md border border-border bg-muted/60 px-2.5 py-2">
          <code className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-foreground">{value}</code>
          {linkButton}
          {copyButton}
        </div>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      {label && <span className="shrink-0 text-xs text-muted-foreground">{label}</span>}
      <Tooltip>
        <TooltipTrigger asChild>
          <code className="cursor-default font-mono text-xs text-foreground">{truncateMiddle(value, lead, tail)}</code>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[min(90vw,28rem)]">
          <span className="break-all font-mono text-xs">{value}</span>
        </TooltipContent>
      </Tooltip>
      {linkButton}
      {copyButton}
    </span>
  );
}
