import { Check, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";
import { truncateMiddle } from "@/utils/format";
import { Identicon } from "./Identicon";

interface AddressChipProps {
  address: string;
  /** Name to lead with, when one is known on-chain. The address stays visible. */
  name?: string;
  size?: "sm" | "md";
  showCopy?: boolean;
  className?: string;
}

/**
 * A wallet address as an identity: recognisable glyph, truncated hex, copyable.
 * Used for holders, issuers and the connected account.
 */
export function AddressChip({ address, name, size = "md", showCopy = true, className }: AddressChipProps) {
  const { copied, copy } = useCopy();
  const glyph = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Identicon address={address} className={glyph} />

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 cursor-default truncate">
            {name ? (
              <span className={cn("truncate font-medium", size === "sm" ? "text-xs" : "text-sm")}>{name}</span>
            ) : (
              <code className={cn("font-mono", size === "sm" ? "text-[11px]" : "text-xs")}>
                {truncateMiddle(address, 6, 4)}
              </code>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="break-all font-mono text-xs">{address}</span>
        </TooltipContent>
      </Tooltip>

      {showCopy && (
        <button
          type="button"
          onClick={() => copy(address)}
          aria-label="Copy address"
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      )}
    </span>
  );
}
