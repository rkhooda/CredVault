import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, ExternalLink, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/hooks/use-copy";
import type { IssueResult } from "@/lib/issuance";
import { explorerTxUrl, truncateMiddle } from "@/utils/format";

interface ClaimHandoffProps {
  result: IssueResult | null;
  onClose: () => void;
}

/**
 * The hand-off after issuance.
 *
 * This payload carries the decryption key, and the key is nowhere else: not
 * on-chain, not on IPFS, not on any server. The dialog is deliberately a single
 * moment with the QR, the code and both ways of taking it away, because an
 * issuer who closes it without copying has to re-issue to produce it again.
 */
export function ClaimHandoff({ result, onClose }: ClaimHandoffProps) {
  const { copied, copy } = useCopy();
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!result) {
      setQr("");
      return;
    }
    let alive = true;
    QRCode.toDataURL(result.claimPayload, { width: 480, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => alive && setQr(url))
      .catch(console.error);
    return () => {
      alive = false;
    };
  }, [result]);

  return (
    <Dialog open={Boolean(result)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
            Hand this to the student
          </DialogTitle>
          <DialogDescription>
            Scanning this, or pasting the code below, gives the student the key that decrypts their credential. Without
            it the record stays unreadable — including to us.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center">
          {qr ? (
            <img
              src={qr}
              alt="Claim code QR"
              width={220}
              height={220}
              className="rounded-md border border-border bg-white p-2"
            />
          ) : (
            <Skeleton className="h-[220px] w-[220px] rounded-md" />
          )}
        </div>

        {result && (
          <div className="rounded-md border border-border bg-muted/60 p-2.5">
            <code className="block max-h-24 overflow-auto break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
              {result.claimPayload}
            </code>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => result && copy(result.claimPayload)}>
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
            <a href={qr} download={`credvault-claim-${result?.documentHash.slice(2, 10) ?? "code"}.png`}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Save QR
            </a>
          </Button>
        </div>

        {result?.transactionHash && (
          <a
            href={explorerTxUrl(result.transactionHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Transaction {truncateMiddle(result.transactionHash, 8, 6)}
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
