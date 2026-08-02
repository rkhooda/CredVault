import { useRef, useState } from "react";
import { CheckCircle2, FileWarning, Loader2, ShieldCheck, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_DOCUMENT_BYTES, hashFile } from "@/lib/documentHash";
import { formatBytes } from "@/utils/format";

type Outcome =
  | { kind: "idle" }
  | { kind: "hashing" }
  | { kind: "match"; file: File; hash: string }
  | { kind: "mismatch"; file: File; hash: string }
  | { kind: "error"; message: string };

interface DocumentCheckProps {
  /** The hash recorded on-chain at issuance. */
  documentHash: string;
}

/**
 * Re-hashes a file in the browser and compares it to the on-chain hash.
 *
 * This is the strongest claim the product makes — not that *a* credential
 * exists, but that *this file* is the one that was issued — so it gets its own
 * panel and two fully designed outcomes. A match should feel conclusive; a
 * mismatch should feel like an alarm, because a forged transcript is exactly
 * what it would look like.
 */
export function DocumentCheck({ documentHash }: DocumentCheckProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  const check = async (file: File | undefined) => {
    if (!file) return;

    if (file.size > MAX_DOCUMENT_BYTES) {
      setOutcome({
        kind: "error",
        message: `${formatBytes(file.size)} is over the ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB limit.`,
      });
      return;
    }

    setOutcome({ kind: "hashing" });
    try {
      const hash = await hashFile(file);
      const same = hash.toLowerCase() === documentHash.toLowerCase();
      setOutcome({ kind: same ? "match" : "mismatch", file, hash });
    } catch {
      setOutcome({ kind: "error", message: "Could not read that file." });
    }
  };

  const reset = () => setOutcome({ kind: "idle" });

  if (outcome.kind === "match") {
    return (
      <div className="animate-reveal rounded-lg border-2 border-success/40 bg-success/5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-success">Byte-for-byte match</h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              <span className="font-medium">{outcome.file.name}</span> hashes to exactly the value recorded on-chain at
              issuance. This is the document the institution issued — not a copy, not a re-export, the same bytes.
            </p>

            <div className="mt-4 rounded-md border border-border bg-background p-3">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                keccak256 — on-chain and your file
              </div>
              <code className="mt-1.5 block break-all font-mono text-xs leading-relaxed text-success">
                {outcome.hash}
              </code>
            </div>

            <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
              Check another file
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (outcome.kind === "mismatch") {
    return (
      <div className="animate-reveal rounded-lg border-2 border-destructive/50 bg-destructive/5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-destructive">This is not the issued document</h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              <span className="font-medium">{outcome.file.name}</span> does not hash to the value on-chain. The
              credential itself may well be genuine — but this particular file is not the one it was issued for. Even a
              single changed byte, including re-saving or re-exporting a PDF, produces a different hash.
            </p>

            <div className="mt-4 space-y-2">
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Recorded on-chain
                </div>
                <code className="mt-1.5 block break-all font-mono text-xs leading-relaxed">{documentHash}</code>
              </div>
              <div className="rounded-md border border-destructive/30 bg-background p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-destructive">Your file</div>
                <code className="mt-1.5 block break-all font-mono text-xs leading-relaxed text-destructive">
                  {outcome.hash}
                </code>
              </div>
            </div>

            <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
              Check another file
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">Prove the document</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Drop in the certificate you were handed. It is hashed here in your browser and compared to the hash recorded
            on-chain — the file is never uploaded anywhere.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="sr-only"
            onChange={(event) => {
              void check(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void check(event.dataTransfer.files?.[0]);
            }}
            disabled={outcome.kind === "hashing"}
            className={cn(
              "mt-4 flex w-full flex-col items-center justify-center rounded-md border border-dashed px-4 py-8 transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border-strong hover:bg-muted/60",
            )}
          >
            {outcome.kind === "hashing" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                <span className="mt-2 text-sm text-muted-foreground">Hashing locally…</span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="mt-2 text-sm font-medium">Drop the document</span>
                <span className="mt-0.5 text-xs text-muted-foreground">or click to browse</span>
              </>
            )}
          </button>

          {outcome.kind === "error" && (
            <p className="mt-3 flex items-center gap-2 text-xs text-destructive">
              <FileWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
              {outcome.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
