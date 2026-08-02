import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/ipfs";
import type { CredentialMetadata, EncryptedPayload } from "@/lib/crypto";
import { ipfsUrl } from "@/utils/format";

interface ProofPanelProps {
  title?: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Collapsible evidence drawer. The claims this app makes — that a record is
 * on-chain, that a document is bound by hash, that contents are encrypted at
 * rest — are all checkable, and this is where the raw material lives. Collapsed
 * by default so it enriches rather than clutters.
 */
export function ProofPanel({
  title = "Proof",
  description,
  defaultOpen = false,
  children,
  className,
}: ProofPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("rounded-lg border border-border", className)}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/60">
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{title}</span>
        {description && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{description}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 border-t border-border p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** One labelled line of evidence. */
export function ProofRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:pt-0.5">{label}</div>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

interface CiphertextProofProps {
  /** ipfs:// URI of the encrypted metadata document. */
  metadataURI: string;
  /** The same document after decryption, when a key was available. */
  decrypted: CredentialMetadata | null;
}

/**
 * Fetches the pinned payload straight from a public IPFS gateway and shows it
 * beside the decrypted result.
 *
 * This is the privacy claim made visible: anyone can retrieve this CID, and
 * what they get is ciphertext. Only the key — which never touches the chain or
 * IPFS — turns it into a credential.
 */
export function CiphertextProof({ metadataURI, decrypted }: CiphertextProofProps) {
  const [payload, setPayload] = useState<EncryptedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchJson<EncryptedPayload>(metadataURI)
      .then((result) => alive && setPayload(result))
      .catch(() => alive && setError("No public gateway responded. The payload is still pinned; try again shortly."))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [metadataURI]);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            What IPFS serves
          </span>
          <a
            href={ipfsUrl(metadataURI)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary underline-offset-2 hover:underline"
          >
            open raw
          </a>
        </div>
        <div className="h-32 overflow-auto rounded-md border border-border bg-muted/60 p-2.5">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Fetching from gateway…
            </div>
          ) : error ? (
            <p className="text-xs text-muted-foreground">{error}</p>
          ) : (
            <code className="block break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
              {JSON.stringify(payload)}
            </code>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          AES-256-GCM ciphertext. Public, permanent, and meaningless without the key.
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            What the key reveals
          </span>
          {decrypted && (
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              className="inline-flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline"
            >
              {revealed ? <EyeOff className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />}
              {revealed ? "hide" : "reveal"}
            </button>
          )}
        </div>
        <div className="h-32 overflow-auto rounded-md border border-border bg-muted/60 p-2.5">
          {!decrypted ? (
            <p className="text-xs text-muted-foreground">
              No key held for this credential, so it stays ciphertext here too — exactly as it would for anyone else.
            </p>
          ) : revealed ? (
            <code className="block whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground">
              {JSON.stringify(decrypted, null, 2)}
            </code>
          ) : (
            <p className="text-xs text-muted-foreground">Decrypted in this browser. Reveal to inspect the plaintext.</p>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Decryption happens locally. The key is never sent anywhere.
        </p>
      </div>
    </div>
  );
}
