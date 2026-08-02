import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import {
  Ban,
  Check,
  Download,
  ExternalLink,
  FileSearch,
  Info,
  KeyRound,
  Loader2,
  QrCode,
  Search,
  Wallet,
} from "lucide-react";
import { CredentialCard } from "@/components/credential/CredentialCard";
import { STATUS_FILTERS, displayStatus, type DisplayStatus } from "@/components/credential/status";
import { AddressChip } from "@/components/data/AddressChip";
import { HashDisplay } from "@/components/data/HashDisplay";
import { CiphertextProof, ProofPanel, ProofRow } from "@/components/data/ProofPanel";
import { CredentialCardSkeletonGrid } from "@/components/feedback/Skeletons";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { ClaimKeyDialog } from "@/components/student/ClaimKeyDialog";
import { KeyBackupDialog } from "@/components/student/KeyBackupDialog";
import { ShareDialog } from "@/components/student/ShareDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/use-wallet";
import { ensureSepolia, getContract, getInjectedProvider } from "@/lib/contract";
import { CredentialStatus, fetchCredentialsForHolder, type CredentialRecord } from "@/lib/credentials";
import { decryptBytes, importKey, type EncryptedPayload } from "@/lib/crypto";
import { fetchJson } from "@/lib/ipfs";
import { describeError } from "@/lib/issuance";
import { loadKey } from "@/lib/keyVault";
import { contractUrl, explorerTxUrl, formatDate, ipfsUrl } from "@/utils/format";

export default function StudentDashboard() {
  const { toast } = useToast();
  const { address } = useWallet("student");

  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busyHash, setBusyHash] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DisplayStatus | "all">("all");

  const [sharing, setSharing] = useState<CredentialRecord | null>(null);
  const [details, setDetails] = useState<CredentialRecord | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  const load = useCallback(async (holder: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      setCredentials(await fetchCredentialsForHolder(holder));
    } catch (err) {
      console.error("Failed to fetch credentials:", err);
      setFetchError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address) load(address);
    else setLoading(false);
  }, [address, load]);

  const refresh = useCallback(() => {
    if (address) load(address);
  }, [address, load]);

  const awaiting = useMemo(
    () => credentials.filter((c) => c.status === CredentialStatus.Pending),
    [credentials],
  );

  const settled = useMemo(
    () => credentials.filter((c) => c.status !== CredentialStatus.Pending),
    [credentials],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return settled.filter((credential) => {
      const haystack = `${credential.metadata?.title ?? ""} ${credential.issuerName} ${
        credential.metadata?.type ?? ""
      } ${credential.documentHash}`.toLowerCase();
      const matchesSearch = needle === "" || haystack.includes(needle);
      const matchesFilter = filter === "all" || displayStatus(credential) === filter;
      return matchesSearch && matchesFilter;
    });
  }, [settled, search, filter]);

  /* ------------------------------------------------------------- consent */

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
        description: "Your decision is recorded on-chain.",
      });
      refresh();
    } catch (err) {
      console.error("Consent action failed:", err);
      toast({ title: "Action failed", description: describeError(err), variant: "destructive" });
    } finally {
      setBusyHash(null);
    }
  };

  /* ------------------------------------------------------------ document */

  const download = async (credential: CredentialRecord) => {
    const cid = credential.metadata?.documentCid;
    const key = loadKey(credential.documentHash);
    if (!cid || !key) {
      toast({
        title: "No document available",
        description: "This credential has no attached file, or its key is not on this device.",
        variant: "destructive",
      });
      return;
    }

    setBusyHash(credential.documentHash);
    try {
      const encrypted = await fetchJson<EncryptedPayload>(cid);
      const bytes = await decryptBytes(encrypted, await importKey(key));
      const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
      const link = window.document.createElement("a");
      link.href = url;
      link.download = credential.metadata?.documentName ?? "credential";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      toast({
        title: "Download failed",
        description: "Could not fetch the file from IPFS or decrypt it.",
        variant: "destructive",
      });
    } finally {
      setBusyHash(null);
    }
  };

  /* -------------------------------------------------------------- render */

  if (!address) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <EmptyState
          icon={Wallet}
          title="No wallet connected"
          description="Connect the wallet your credentials were issued to. Everything issued to that address appears here, whether or not you have accepted it yet."
          action={
            <Button asChild>
              <Link to="/student-portal">Go to the student portal</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const cardActions = (credential: CredentialRecord) => {
    const busy = busyHash === credential.documentHash;
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setSharing(credential)}>
          <QrCode className="h-4 w-4" aria-hidden="true" />
          Share
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || !credential.metadata?.documentCid}
          onClick={() => download(credential)}
          title={credential.metadata?.documentCid ? "Download the original document" : "No document attached"}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          Document
        </Button>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDetails(credential)}>
          <Info className="h-4 w-4" aria-hidden="true" />
          Details
        </Button>
      </>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Your credentials</h1>
          <div className="mt-1.5">
            <AddressChip address={address} size="sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setClaimOpen(true)}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Claim a key
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBackupOpen(true)}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Back up keys
          </Button>
        </div>
      </header>

      {/* The consent moment: only the holder can accept, and it needs deciding. */}
      {!loading && awaiting.length > 0 && (
        <section className="mt-8" aria-labelledby="awaiting-heading">
          <div className="flex items-center gap-2">
            <h2 id="awaiting-heading" className="text-sm font-semibold">
              Awaiting your decision
            </h2>
            <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
              {awaiting.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            An institution has issued these to you. Nothing is recorded in your name until you accept — and declining is
            equally final, so read them first.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {awaiting.map((credential) => {
              const busy = busyHash === credential.documentHash;
              return (
                <CredentialCard
                  key={credential.documentHash}
                  record={credential}
                  highlight
                  actions={
                    <>
                      <Button size="sm" disabled={busy} onClick={() => respond(credential, true)}>
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        )}
                        Accept
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => respond(credential, false)}>
                        <Ban className="h-4 w-4" aria-hidden="true" />
                        Decline
                      </Button>
                      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDetails(credential)}>
                        <Info className="h-4 w-4" aria-hidden="true" />
                        Details
                      </Button>
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8" aria-labelledby="wallet-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <h2 id="wallet-heading" className="sr-only">
            Your credential wallet
          </h2>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, issuer or hash…"
              className="pl-9"
              aria-label="Search credentials"
            />
          </div>
          <Select value={filter} onValueChange={(value) => setFilter(value as DisplayStatus | "all")}>
            <SelectTrigger className="sm:w-52" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-5">
          {loading ? (
            <CredentialCardSkeletonGrid count={3} />
          ) : fetchError ? (
            <ErrorState message={fetchError} onRetry={refresh} showRpcNote />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={settled.length === 0 ? FileSearch : Search}
              title={settled.length === 0 ? "Nothing here yet" : "No credentials match"}
              description={
                settled.length === 0
                  ? "Credentials issued to this wallet appear here. If an institution has given you a claim code, saving its key is what makes a credential readable."
                  : "Try a different search term or clear the status filter."
              }
              action={
                settled.length === 0 ? (
                  <Button variant="outline" onClick={() => setClaimOpen(true)}>
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Claim a key
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((credential) => (
                <CredentialCard
                  key={credential.documentHash}
                  record={credential}
                  actions={cardActions(credential)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <ShareDialog record={sharing} onClose={() => setSharing(null)} />
      <ClaimKeyDialog open={claimOpen} onOpenChange={setClaimOpen} onClaimed={refresh} />
      <KeyBackupDialog open={backupOpen} onOpenChange={setBackupOpen} onRestored={refresh} />

      {/* Per-credential evidence */}
      <Dialog open={Boolean(details)} onOpenChange={(open) => !open && setDetails(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{details?.metadata?.title ?? "Encrypted credential"}</DialogTitle>
            <DialogDescription>
              {details?.metadata?.description ??
                "Everything below is read from Sepolia and IPFS. Nothing is cached by a server."}
            </DialogDescription>
          </DialogHeader>

          {details && (
            <div className="space-y-4">
              <div className="space-y-3">
                <ProofRow label="Issuer">
                  <div className="flex flex-col gap-1">
                    <span>{details.issuerName}</span>
                    <AddressChip address={details.issuer} size="sm" />
                  </div>
                </ProofRow>
                <ProofRow label="Holder">
                  <AddressChip address={details.holder} name={details.metadata?.holderName} size="sm" />
                </ProofRow>
                <ProofRow label="Issued">{formatDate(details.issuedAt)}</ProofRow>
                <ProofRow label="Expires">
                  {details.expiresAt ? formatDate(details.expiresAt) : "Never"}
                </ProofRow>
              </div>

              <ProofPanel title="Technical details" description="hashes, CIDs and the contract" defaultOpen>
                <ProofRow label="Document hash">
                  <HashDisplay value={details.documentHash} variant="block" />
                </ProofRow>
                {details.metadataURI && (
                  <ProofRow label="Metadata CID">
                    <HashDisplay value={details.metadataURI} href={ipfsUrl(details.metadataURI)} variant="block" />
                  </ProofRow>
                )}
                {details.transactionHash && (
                  <ProofRow label="Issued in tx">
                    <HashDisplay
                      value={details.transactionHash}
                      href={explorerTxUrl(details.transactionHash)}
                      variant="block"
                    />
                  </ProofRow>
                )}
                <ProofRow label="Contract">
                  <a
                    href={contractUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
                  >
                    View on Sepolia Etherscan
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </ProofRow>
              </ProofPanel>

              {details.metadataURI && (
                <ProofPanel title="What is actually stored" description="ciphertext vs. decrypted">
                  <CiphertextProof metadataURI={details.metadataURI} decrypted={details.metadata} />
                </ProofPanel>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
