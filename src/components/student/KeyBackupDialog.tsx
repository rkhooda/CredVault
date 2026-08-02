import { useRef, useState } from "react";
import { Download, KeyRound, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { exportKeyBackup, importKeyBackup } from "@/lib/crypto";
import { allKeys, mergeKeys } from "@/lib/keyVault";

interface KeyBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Re-read credentials after a restore, since new keys may decrypt more of them. */
  onRestored: () => void;
}

/**
 * Export and restore the local key store.
 *
 * This was a pair of buttons behind window.prompt(). It matters enough to
 * explain: the keys live only in this browser, and the consequence of losing
 * them is specific — the credential stays valid, but unreadable until the
 * issuer re-derives the key.
 */
export function KeyBackupDialog({ open, onOpenChange, onRestored }: KeyBackupDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const keyCount = Object.keys(allKeys()).length;
  const mismatch = confirmation !== "" && passphrase !== confirmation;

  const reset = () => {
    setPassphrase("");
    setConfirmation("");
    setRestorePassphrase("");
    setRestoreFile(null);
  };

  const handleExport = async () => {
    const keys = allKeys();
    if (Object.keys(keys).length === 0) {
      toast({ title: "Nothing to back up", description: "No credential keys are stored yet.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const blob = new Blob([await exportKeyBackup(keys, passphrase)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "credvault-keys.json";
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: "Backup downloaded", description: "Keep it somewhere you control." });
      reset();
      onOpenChange(false);
    } catch {
      toast({ title: "Could not create backup", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setBusy(true);
    try {
      const added = mergeKeys(await importKeyBackup(await restoreFile.text(), restorePassphrase));
      toast({
        title: "Backup restored",
        description: `${added} new key${added === 1 ? "" : "s"} added to this browser.`,
      });
      reset();
      onOpenChange(false);
      onRestored();
    } catch {
      toast({
        title: "Could not restore",
        description: "Wrong passphrase, or the file is not a CredVault backup.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
            Your credential keys
          </DialogTitle>
          <DialogDescription>
            Your credentials are stored encrypted. The keys that open them live only in this browser —{" "}
            {keyCount === 0 ? "none are stored yet" : `${keyCount} key${keyCount === 1 ? "" : "s"} right now`}. Clearing
            site data removes them. The credentials stay valid on-chain either way; you would just need the issuing
            institution to re-derive a key before you could read one again.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export">
          <TabsList className="w-full">
            <TabsTrigger value="export" className="flex-1">
              Back up
            </TabsTrigger>
            <TabsTrigger value="restore" className="flex-1">
              Restore
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="backup-passphrase">Passphrase</Label>
              <Input
                id="backup-passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Something you will remember"
                className="mt-1.5"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="backup-confirm">Confirm passphrase</Label>
              <Input
                id="backup-confirm"
                type="password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="mt-1.5"
                autoComplete="new-password"
                aria-invalid={mismatch}
              />
              {mismatch && <p className="mt-1.5 text-xs text-destructive">The two passphrases do not match.</p>}
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              The file is encrypted with this passphrase before it is written. There is no way to recover it — if you
              forget it, the backup is as unreadable to you as it is to anyone else.
            </p>

            <Button
              className="w-full"
              onClick={handleExport}
              disabled={busy || passphrase.length === 0 || mismatch || keyCount === 0}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              Download encrypted backup
            </Button>
          </TabsContent>

          <TabsContent value="restore" className="mt-4 space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(e) => {
                setRestoreFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {restoreFile ? restoreFile.name : "Choose a backup file"}
            </Button>

            <div>
              <Label htmlFor="restore-passphrase">Passphrase</Label>
              <Input
                id="restore-passphrase"
                type="password"
                value={restorePassphrase}
                onChange={(e) => setRestorePassphrase(e.target.value)}
                className="mt-1.5"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === "Enter" && restoreFile && handleRestore()}
              />
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Restoring merges keys into this browser. Existing keys are kept.
            </p>

            <Button className="w-full" onClick={handleRestore} disabled={busy || !restoreFile || !restorePassphrase}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="h-4 w-4" aria-hidden="true" />
              )}
              Restore keys
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
