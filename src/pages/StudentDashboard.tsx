import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import QRCode from "qrcode";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Download,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  QrCode,
  Wallet,
  Copy,
  KeyRound,
  Check,
  Ban,
  Upload,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getContract, ensureSepolia, getInjectedProvider } from "@/lib/contract";
import {
  fetchCredentialsForHolder,
  CredentialStatus,
  encodeSharePayload,
  decodeSharePayload,
  type CredentialRecord,
} from "@/lib/credentials";
import { describeError } from "@/lib/issuance";
import { saveKey, loadKey, allKeys, mergeKeys } from "@/lib/keyVault";
import { exportKeyBackup, importKeyBackup, importKey, decryptBytes, type EncryptedPayload } from "@/lib/crypto";
import { fetchJson } from "@/lib/ipfs";

export default function StudentDashboard() {
  const { toast } = useToast();
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busyHash, setBusyHash] = useState<string | null>(null);

  const [qrCredential, setQrCredential] = useState<CredentialRecord | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const [claimInput, setClaimInput] = useState("");
  const [claimOpen, setClaimOpen] = useState(false);

  useEffect(() => {
    const address = localStorage.getItem("credvault_student_wallet");
    if (address) setWalletAddress(address);
  }, []);

  const fetchCredentials = useCallback(async (address: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      setCredentials(await fetchCredentialsForHolder(address));
    } catch (err) {
      console.error("Failed to fetch credentials:", err);
      setFetchError("Could not load credentials from chain. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (walletAddress) fetchCredentials(walletAddress);
  }, [walletAddress, fetchCredentials]);

  // The share QR carries the decryption key, so a verifier can read the
  // credential without the contents ever being public.
  useEffect(() => {
    if (!qrCredential) {
      setQrDataUrl("");
      return;
    }
    const payload = encodeSharePayload({
      holder: qrCredential.holder,
      documentHash: qrCredential.documentHash,
      k: loadKey(qrCredential.documentHash) ?? undefined,
    });
    QRCode.toDataURL(payload, { width: 240, margin: 1 }).then(setQrDataUrl).catch(console.error);
  }, [qrCredential]);

  const stats = useMemo(
    () => ({
      total: credentials.length,
      active: credentials.filter((c) => c.isValid).length,
      pending: credentials.filter((c) => c.status === CredentialStatus.Pending).length,
    }),
    [credentials],
  );

  const getStatusBadge = (record: CredentialRecord) => {
    if (record.isExpired && record.status === CredentialStatus.Active) {
      return <Badge className="status-pending"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
    }
    switch (record.status) {
      case CredentialStatus.Active:
        return <Badge className="status-verified"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case CredentialStatus.Pending:
        return <Badge className="status-pending"><Clock className="w-3 h-3 mr-1" />Awaiting you</Badge>;
      case CredentialStatus.Rejected:
        return <Badge className="status-revoked"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      case CredentialStatus.Revoked:
        return <Badge className="status-revoked"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return null;
    }
  };

  const filteredCredentials = credentials.filter((credential) => {
    const haystack = `${credential.metadata?.title ?? ""} ${credential.issuerName} ${credential.metadata?.type ?? ""}`
      .toLowerCase();
    const matchesSearch = searchTerm === "" || haystack.includes(searchTerm.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "verified" && credential.isValid) ||
      (filter === "pending" && credential.status === CredentialStatus.Pending) ||
      (filter === "revoked" && credential.status === CredentialStatus.Revoked);

    return matchesSearch && matchesFilter;
  });

  // --- On-chain consent ---

  const respond = async (credential: CredentialRecord, accept: boolean) => {
    setBusyHash(credential.documentHash);
    try {
      await ensureSepolia();
      const provider = new ethers.BrowserProvider(getInjectedProvider()!);
      const signer = await provider.getSigner();

      if (signer.address.toLowerCase() !== credential.holder.toLowerCase()) {
        throw new Error("Connect the wallet this credential was issued to.");
      }

      const contract = getContract(signer);
      const tx = accept
        ? await contract.acceptCredential(credential.documentHash)
        : await contract.rejectCredential(credential.documentHash);
      await tx.wait();

      toast({
        title: accept ? "Credential accepted" : "Credential declined",
        description: "Recorded on-chain.",
      });
      if (walletAddress) fetchCredentials(walletAddress);
    } catch (err) {
      console.error("Consent action failed:", err);
      toast({ title: "Action failed", description: describeError(err), variant: "destructive" });
    } finally {
      setBusyHash(null);
    }
  };

  // --- Claiming the decryption key ---

  const handleClaim = async () => {
    const payload = decodeSharePayload(claimInput.trim());
    if (!payload?.k) {
      toast({
        title: "Invalid claim code",
        description: "Paste the full code your institution gave you.",
        variant: "destructive",
      });
      return;
    }
    saveKey(payload.documentHash, payload.k);
    setClaimInput("");
    setClaimOpen(false);
    toast({ title: "Key saved", description: "Your credential is now readable on this device." });
    if (walletAddress) fetchCredentials(walletAddress);
  };

  // --- Key backup ---

  const handleExportBackup = async () => {
    const keys = allKeys();
    if (Object.keys(keys).length === 0) {
      toast({ title: "Nothing to back up", description: "No credential keys stored yet.", variant: "destructive" });
      return;
    }
    const passphrase = window.prompt("Choose a passphrase to protect the backup:");
    if (!passphrase) return;

    const blob = new Blob([await exportKeyBackup(keys, passphrase)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "credvault-keys.json";
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Backup downloaded", description: "Keep it somewhere safe." });
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const passphrase = window.prompt("Passphrase for this backup:");
    if (!passphrase) return;

    try {
      const added = mergeKeys(await importKeyBackup(await file.text(), passphrase));
      toast({ title: "Backup restored", description: `${added} new key${added === 1 ? "" : "s"} added.` });
      if (walletAddress) fetchCredentials(walletAddress);
    } catch {
      toast({ title: "Could not restore", description: "Wrong passphrase or corrupted file.", variant: "destructive" });
    }
  };

  // --- Document download ---

  const handleDownload = async (credential: CredentialRecord) => {
    const cid = credential.metadata?.documentCid;
    const exportedKey = loadKey(credential.documentHash);
    if (!cid || !exportedKey) {
      toast({
        title: "No document available",
        description: "This credential has no attached file, or its key is missing.",
        variant: "destructive",
      });
      return;
    }

    setBusyHash(credential.documentHash);
    try {
      const encrypted = await fetchJson<EncryptedPayload>(cid);
      const bytes = await decryptBytes(encrypted, await importKey(exportedKey));
      const blob = new Blob([bytes as BlobPart]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = credential.metadata?.documentName ?? "credential";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      toast({ title: "Download failed", description: "Could not fetch or decrypt the document.", variant: "destructive" });
    } finally {
      setBusyHash(null);
    }
  };

  const copyShare = (credential: CredentialRecord) => {
    const payload = encodeSharePayload({
      holder: credential.holder,
      documentHash: credential.documentHash,
      k: loadKey(credential.documentHash) ?? undefined,
    });
    navigator.clipboard.writeText(payload).then(
      () => toast({ title: "Copied", description: "Share this with a verifier." }),
      () => toast({ title: "Share data", description: payload }),
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Credentials</h1>
          <p className="text-muted-foreground">Manage and verify your blockchain-secured academic credentials</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Credentials</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Verified</p>
                <p className="text-2xl font-bold text-success">{stats.active}</p>
              </div>
              <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Awaiting You</p>
                <p className="text-2xl font-bold text-accent">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-accent" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Wallet</p>
                <p className="text-sm font-mono">
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "Not Connected"}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary-glow/20 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary-glow" />
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search credentials by title or issuer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="flex gap-4 flex-wrap">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="min-w-[140px] px-4 py-2 h-11 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="verified">Verified</option>
                <option value="pending">Awaiting you</option>
                <option value="revoked">Revoked</option>
              </select>

              <Button variant="outline" className="h-11" onClick={() => setClaimOpen(true)}>
                <KeyRound className="w-4 h-4 mr-2" />
                Claim key
              </Button>

              <input
                ref={backupInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportBackup}
              />
              <Button variant="outline" className="h-11" onClick={handleExportBackup}>
                <Download className="w-4 h-4 mr-2" />
                Back up keys
              </Button>
              <Button variant="outline" className="h-11" onClick={() => backupInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Restore
              </Button>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Loading credentials from chain…</p>
          </div>
        )}

        {!loading && !fetchError && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCredentials.map((credential) => {
              const busy = busyHash === credential.documentHash;
              const locked = credential.metadata === null;

              return (
                <Card
                  key={credential.documentHash}
                  className="credential-card p-6 hover:scale-105 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1">
                        {credential.metadata?.title ?? "Locked credential"}
                      </h3>
                      <p className="text-muted-foreground text-sm truncate">{credential.issuerName}</p>
                    </div>
                    {getStatusBadge(credential)}
                  </div>

                  {locked && (
                    <p className="text-xs text-muted-foreground mb-4">
                      Encrypted. Use “Claim key” with the code from your institution to read it.
                    </p>
                  )}

                  <div className="space-y-2 mb-6">
                    {credential.metadata?.type && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Type:</span>
                        <span>{credential.metadata.type}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Issued:</span>
                      <span>{credential.issuedAt.toLocaleDateString()}</span>
                    </div>
                    {credential.expiresAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expires:</span>
                        <span>{credential.expiresAt.toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {credential.status === CredentialStatus.Pending ? (
                    <div className="flex gap-2">
                      <Button
                        variant="hero"
                        size="sm"
                        className="flex-1"
                        disabled={busy}
                        onClick={() => respond(credential, true)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        {busy ? "Working…" : "Accept"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        disabled={busy}
                        onClick={() => respond(credential, false)}
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-0"
                        onClick={() => setQrCredential(credential)}
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-0"
                        disabled={busy || !credential.metadata?.documentCid}
                        onClick={() => handleDownload(credential)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      {credential.transactionHash && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="sm:flex-none"
                          onClick={() =>
                            window.open(`https://sepolia.etherscan.io/tx/${credential.transactionHash}`, "_blank")
                          }
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {!loading && fetchError && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Failed to load credentials</h3>
            <p className="text-muted-foreground mb-4">{fetchError}</p>
            <Button variant="outline" onClick={() => walletAddress && fetchCredentials(walletAddress)}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !fetchError && filteredCredentials.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No credentials found</h3>
            <p className="text-muted-foreground">
              {searchTerm || filter !== "all"
                ? "Try adjusting your search or filters."
                : "No credentials have been issued to this wallet yet."}
            </p>
          </div>
        )}
      </div>

      {/* Share dialog */}
      <Dialog open={Boolean(qrCredential)} onOpenChange={(open) => !open && setQrCredential(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{qrCredential?.metadata?.title ?? "Share credential"}</DialogTitle>
            <DialogDescription>
              {loadKey(qrCredential?.documentHash ?? "")
                ? "This code lets a verifier read the credential's details. Only share it with people you want to see them."
                : "You do not hold the key for this credential, so the verifier will see it is valid but not what it says."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Credential QR code" width={240} height={240} className="rounded-lg" />
            ) : (
              <div className="w-60 h-60 bg-muted rounded-lg flex items-center justify-center">
                <Clock className="w-8 h-8 text-muted-foreground animate-pulse" />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => qrCredential && copyShare(qrCredential)}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy share code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Claim key dialog */}
      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Claim a credential key</DialogTitle>
            <DialogDescription>
              Paste the claim code your institution gave you. It unlocks the encrypted contents on this device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder='{"holder":"0x…","documentHash":"0x…","k":"…"}'
              value={claimInput}
              onChange={(e) => setClaimInput(e.target.value)}
              className="font-mono text-xs"
            />
            <Button variant="hero" className="w-full" onClick={handleClaim}>
              <KeyRound className="w-4 h-4 mr-2" />
              Save key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
