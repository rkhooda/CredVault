import { useCallback, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { HashDisplay } from "@/components/data/HashDisplay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_DOCUMENT_BYTES, hashFile } from "@/lib/documentHash";
import { formatBytes } from "@/utils/format";

export interface DroppedDocument {
  file: File;
  /** keccak256 over the file's bytes — the value that goes on-chain. */
  documentHash: string;
}

interface FileDropzoneProps {
  value: DroppedDocument | null;
  onChange: (value: DroppedDocument | null) => void;
  disabled?: boolean;
  accept?: string;
}

/**
 * The document picker, which is really the security model's front door: the
 * hash computed here is what binds the on-chain record to a file, so it is
 * shown as soon as it exists rather than hidden until issuance.
 */
export function FileDropzone({ value, onChange, disabled, accept = ".pdf,.png,.jpg,.jpeg" }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hashing, setHashing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept_ = useCallback(
    async (file: File | undefined) => {
      setError(null);
      if (!file) return;

      if (file.size > MAX_DOCUMENT_BYTES) {
        setError(`${formatBytes(file.size)} is over the ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB limit.`);
        return;
      }

      setHashing(true);
      try {
        onChange({ file, documentHash: await hashFile(file) });
      } catch {
        setError("Could not read that file. Try another.");
      } finally {
        setHashing(false);
      }
    },
    [onChange],
  );

  if (value) {
    return (
      <div className="rounded-md border border-border bg-muted/40 p-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded border border-border bg-background">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={value.file.name}>
              {value.file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(value.file.size)} · {value.file.type || "unknown type"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Remove document"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <HashDisplay value={value.documentHash} label="keccak256 — goes on-chain" variant="block" />
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Computed in this browser. A verifier holding this file recomputes the same value and proves it is the
            document you issued.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          void accept_(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void accept_(event.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-md border border-dashed px-4 py-7 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border-strong hover:bg-muted/60",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {hashing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="mt-2 text-sm text-muted-foreground">Hashing…</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="mt-2 text-sm font-medium">Drop the credential document</span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              or click to browse · PDF or image · up to {MAX_DOCUMENT_BYTES / 1024 / 1024} MB
            </span>
          </>
        )}
      </button>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Optional. Without a document the credential is still valid on-chain, but nobody can later prove a particular
        file is the one you issued.
      </p>
    </div>
  );
}
