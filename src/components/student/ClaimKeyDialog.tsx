import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { decodeSharePayload } from "@/lib/credentials";
import { saveKey } from "@/lib/keyVault";

interface ClaimKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClaimed: () => void;
}

/**
 * Accepts the claim code an institution hands over at issuance. Saving the key
 * is what turns an "Encrypted credential" in the list into a readable one.
 */
export function ClaimKeyDialog({ open, onOpenChange, onClaimed }: ClaimKeyDialogProps) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const payload = decodeSharePayload(value.trim());

    if (!payload) {
      setError("That is not a CredVault claim code. Paste the whole thing, including the braces.");
      return;
    }
    if (!payload.k) {
      setError("This code identifies a credential but carries no key, so it cannot unlock anything.");
      return;
    }

    saveKey(payload.documentHash, payload.k);
    setValue("");
    setError(null);
    onOpenChange(false);
    toast({ title: "Key saved", description: "This credential is now readable on this device." });
    onClaimed();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
            Claim a credential key
          </DialogTitle>
          <DialogDescription>
            Paste the claim code your institution gave you, or scan their QR and paste what it contains. It is stored
            only in this browser.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="claim-code">Claim code</Label>
          <Textarea
            id="claim-code"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            rows={4}
            placeholder='{"holder":"0x…","documentHash":"0x…","k":"…"}'
            className="mt-1.5 font-mono text-xs"
            aria-invalid={Boolean(error)}
          />
          {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
        </div>

        <Button className="w-full" onClick={submit} disabled={value.trim() === ""}>
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Save key
        </Button>
      </DialogContent>
    </Dialog>
  );
}
