import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/hooks/use-copy";
import { encodeSharePayload, type CredentialRecord } from "@/lib/credentials";
import { loadKey } from "@/lib/keyVault";

interface ShareDialogProps {
  record: CredentialRecord | null;
  onClose: () => void;
}

/**
 * One action, two ways to hand it over: scan the QR or copy the code.
 *
 * The payload optionally carries the decryption key, so the dialog is explicit
 * about which of the two things is being shared — proof that the credential is
 * valid, or that plus the ability to read what it says.
 */
export function ShareDialog({ record, onClose }: ShareDialogProps) {
  const { copied, copy } = useCopy();
  const [qr, setQr] = useState("");
  const [showPayload, setShowPayload] = useState(false);

  const key = record ? loadKey(record.documentHash) : null;
  const payload = record
    ? encodeSharePayload({ holder: record.holder, documentHash: record.documentHash, k: key ?? undefined })
    : "";

  useEffect(() => {
    if (!record) {
      setQr("");
      setShowPayload(false);
      return;
    }
    let alive = true;
    QRCode.toDataURL(payload, { width: 480, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => alive && setQr(url))
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, [record, payload]);

  return (
    <Dialog open={Boolean(record)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{record?.metadata?.title ?? "Share this credential"}</DialogTitle>
          <DialogDescription>
            {key
              ? "This carries the key that decrypts your credential. Whoever receives it can read the title, your name and any details — so share it only with someone you want to see them."
              : "You do not hold the key for this credential on this device, so a verifier will be able to confirm it is valid but not read what it says."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center">
          {qr ? (
            <img
              src={qr}
              alt="Credential share QR code"
              width={220}
              height={220}
              className="rounded-md border border-border bg-white p-2"
            />
          ) : (
            <Skeleton className="h-[220px] w-[220px] rounded-md" />
          )}
        </div>

        {!key && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            Validity only — no key attached
          </p>
        )}

        <div className="rounded-md border border-border bg-muted/60 p-2.5">
          {showPayload ? (
            <code className="block max-h-24 overflow-auto break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
              {payload}
            </code>
          ) : (
            <button
              type="button"
              onClick={() => setShowPayload(true)}
              className="flex w-full items-center justify-center gap-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Show the share code
            </button>
          )}
          {showPayload && (
            <button
              type="button"
              onClick={() => setShowPayload(false)}
              className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              Hide
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => copy(payload)}>
            {copied ? (
              <>
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copy code
              </>
            )}
          </Button>
          <Button variant="outline" asChild disabled={!qr}>
            <a href={qr} download={`credvault-${record?.documentHash.slice(2, 10) ?? "share"}.png`}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Save QR
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
