import type { ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";
import type { CredentialRecord } from "@/lib/credentials";
import { formatDate, truncateMiddle } from "@/utils/format";
import { StatusBadge } from "./StatusBadge";
import { displayStatus, STATUS_META } from "./status";

/**
 * The issuer's seal, built from the name the contract holds for them. Fine
 * concentric rules and initials — engraved, not illustrated.
 */
function IssuerSeal({ name, muted }: { name: string; muted: boolean }) {
  const initials = name
    .replace(/^0x[0-9a-fA-F]+$/, "?")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={cn(
        "relative grid h-10 w-10 shrink-0 place-items-center rounded-full border",
        muted ? "border-border text-muted-foreground" : "border-border-strong text-foreground",
      )}
      aria-hidden="true"
    >
      <span className="absolute inset-[3px] rounded-full border border-current opacity-25" />
      <span className="font-serif text-[13px] font-semibold leading-none">{initials || "•"}</span>
    </span>
  );
}

interface CredentialCardProps {
  record: CredentialRecord;
  /** Rendered in a footer beneath the certificate face. */
  actions?: ReactNode;
  /** Draws attention to a credential that needs a decision. */
  highlight?: boolean;
  className?: string;
}

/**
 * A credential rendered as a document, not a list row.
 *
 * The face is fixed-ratio like a printed certificate, and the document hash runs
 * along the bottom edge the way a passport's machine-readable zone does. That
 * placement is honest: the hash really is what binds this record to a file.
 *
 * The five lifecycle states are variations of one object — a revoked credential
 * is overprinted VOID rather than merely carrying a red pill.
 */
export function CredentialCard({ record, actions, highlight, className }: CredentialCardProps) {
  const { copied, copy } = useCopy();
  const status = displayStatus(record);
  const meta = STATUS_META[status];

  const isVoided = status === "revoked";
  const isDimmed = status === "revoked" || status === "rejected" || status === "expired";
  const isLocked = record.metadata === null;

  const title = record.metadata?.title ?? "Encrypted credential";
  const holder = record.metadata?.holderName ?? truncateMiddle(record.holder, 10, 8);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md",
        highlight ? "border-warning/40 ring-1 ring-warning/20" : "border-border",
        className,
      )}
    >
      {/* Status edge — the card's state is legible before any text is read. */}
      <div className={cn("h-[3px] w-full", meta.edgeClass)} aria-hidden="true" />

      <div className="relative flex aspect-[1.5] flex-col">
        <div className={cn("flex flex-1 flex-col p-4 sm:p-5", isDimmed && "opacity-60")}>
          {/* Issuer */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <IssuerSeal name={record.issuerName} muted={isDimmed} />
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Issued by
                </div>
                <div className="truncate text-sm font-medium" title={record.issuerName}>
                  {record.issuerName.startsWith("0x")
                    ? truncateMiddle(record.issuerName, 6, 4)
                    : record.issuerName}
                </div>
              </div>
            </div>
            <StatusBadge status={status} size="sm" />
          </div>

          <div className="rule-engraved my-3 sm:my-4" />

          {/* The credential itself. Serif here only — a deliberate nod to a diploma. */}
          <div className="min-h-0 flex-1">
            <h3
              className={cn(
                "line-clamp-2 font-serif text-lg font-semibold leading-tight sm:text-xl",
                isLocked && "flex items-center gap-2 text-muted-foreground",
              )}
              title={title}
            >
              {isLocked && <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {title}
            </h3>
            {record.metadata?.type && (
              <p className="mt-1 text-xs capitalize text-muted-foreground">{record.metadata.type}</p>
            )}
            {isLocked && (
              <p className="mt-1 text-xs text-muted-foreground">
                Held encrypted on IPFS. Claim the key to read it on this device.
              </p>
            )}
          </div>

          {/* Parties and dates */}
          <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <div className="col-span-1 min-w-0">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Holder</dt>
              <dd className={cn("mt-0.5 truncate", !record.metadata?.holderName && "font-mono text-[11px]")} title={record.holder}>
                {holder}
              </dd>
            </div>
            <div className="col-span-1">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Issued</dt>
              <dd className="mt-0.5 tabular-nums">{formatDate(record.issuedAt)}</dd>
            </div>
            <div className="col-span-1">
              <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Expires</dt>
              <dd className={cn("mt-0.5 tabular-nums", status === "expired" && "font-medium text-warning")}>
                {record.expiresAt ? formatDate(record.expiresAt) : "Never"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Machine-readable zone: the hash that binds this record to a document. */}
        <button
          type="button"
          onClick={() => copy(record.documentHash)}
          title={record.documentHash}
          aria-label="Copy document hash"
          className={cn(
            "mrz flex w-full items-center gap-2 border-t border-border bg-muted/60 px-4 py-2 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-5",
            isDimmed && "opacity-60",
          )}
        >
          <span className="shrink-0 opacity-60">DOC</span>
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
            {record.documentHash.replace(/^0x/, "")}
          </span>
          {copied && <Check className="h-3 w-3 shrink-0 text-success" aria-hidden="true" />}
        </button>

        {/* Overprint. A revoked credential should look cancelled, like a stamped document. */}
        {isVoided && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="-rotate-[14deg] rounded border-[3px] border-destructive/45 px-5 py-1 font-mono text-2xl font-bold uppercase tracking-[0.25em] text-destructive/45 sm:text-3xl">
              Void
            </span>
          </div>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2 border-t border-border p-3 sm:px-4">{actions}</div>}
    </article>
  );
}
