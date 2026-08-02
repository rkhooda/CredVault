import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import {
  Award,
  Building2,
  ExternalLink,
  FilePlus2,
  Loader2,
  RotateCcw,
  Search,
  Send,
  ShieldOff,
  Wallet,
} from "lucide-react";
import { StatusBadge } from "@/components/credential/StatusBadge";
import { STATUS_FILTERS, displayStatus, type DisplayStatus } from "@/components/credential/status";
import { AddressChip } from "@/components/data/AddressChip";
import { HashDisplay } from "@/components/data/HashDisplay";
import { EmptyState, ErrorState } from "@/components/feedback/States";
import { TableRowSkeleton } from "@/components/feedback/Skeletons";
import { ClaimHandoff } from "@/components/issuance/ClaimHandoff";
import { FileDropzone, type DroppedDocument } from "@/components/issuance/FileDropzone";
import { IssuanceStepper } from "@/components/issuance/IssuanceStepper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/use-wallet";
import { ensureSepolia, getContract, getInjectedProvider, getReadOnlyProvider } from "@/lib/contract";
import { CredentialStatus, fetchCredentialsForIssuer, type CredentialRecord } from "@/lib/credentials";
import { describeError, issueCredential, type IssueResult, type IssueStage } from "@/lib/issuance";
import { explorerTxUrl, formatDate } from "@/utils/format";

const CREDENTIAL_TYPES = ["certificate", "degree", "diploma", "award"];

const EMPTY_FORM = {
  holder: "",
  holderName: "",
  title: "",
  description: "",
  type: "certificate",
  expiresAt: "",
};

/** A pending on-chain state change, awaiting confirmation in the dialog. */
type PendingAction = { record: CredentialRecord; kind: "revoke" | "reinstate" } | null;

export default function InstitutionDashboard() {
  const { toast } = useToast();
  const { address } = useWallet("institution");

  const [issuer, setIssuer] = useState<{ name: string; accreditationId: string; website: string } | null>(null);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [document, setDocument] = useState<DroppedDocument | null>(null);
  const [stage, setStage] = useState<IssueStage | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [result, setResult] = useState<IssueResult | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<DisplayStatus | "all">("all");
  const [pending, setPending] = useState<PendingAction>(null);
  const [busyHash, setBusyHash] = useState<string | null>(null);

  // The institution's display name comes from the on-chain registry, never a
  // hardcoded string.
  useEffect(() => {
    if (!address) return;
    getContract(getReadOnlyProvider())
      .issuerInfo(address)
      .then((info: [string, string, string]) =>
        setIssuer({ name: info[0] || "", accreditationId: info[1] || "", website: info[2] || "" }),
      )
      .catch((err) => console.warn("Could not read issuer identity:", err));
  }, [address]);

  const load = useCallback(async (issuerAddress: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      setCredentials(await fetchCredentialsForIssuer(issuerAddress));
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

  const stats = useMemo(
    () => ({
      total: credentials.length,
      active: credentials.filter((c) => c.status === CredentialStatus.Active && !c.isExpired).length,
      pending: credentials.filter((c) => c.status === CredentialStatus.Pending).length,
    }),
    [credentials],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return credentials.filter((credential) => {
      const haystack = `${credential.metadata?.title ?? ""} ${credential.metadata?.holderName ?? ""} ${
        credential.holder
      } ${credential.documentHash}`.toLowerCase();
      const matchesSearch = needle === "" || haystack.includes(needle);
      const matchesFilter = filter === "all" || displayStatus(credential) === filter;
      return matchesSearch && matchesFilter;
    });
  }, [credentials, search, filter]);

  /* ---------------------------------------------------------------- issuing */

  const canIssue = ethers.isAddress(form.holder.trim()) && form.title.trim() !== "" && !issuing;

  const handleIssue = async () => {
    setIssueError(null);

    if (!ethers.isAddress(form.holder.trim())) {
      setIssueError("That is not a valid Ethereum address.");
      return;
    }

    setIssuing(true);
    try {
      await ensureSepolia();
      const provider = new ethers.BrowserProvider(getInjectedProvider()!);
      const signer = await provider.getSigner();

      // Re-check the role: the wallet may have changed since login.
      if (!(await getContract(signer).isIssuer(signer.address))) {
        setIssueError("This wallet is not an authorised issuer.");
        return;
      }

      const issued = await issueCredential(
        signer,
        issuer?.name || signer.address,
        {
          holder: form.holder.trim(),
          title: form.title.trim(),
          type: form.type,
          description: form.description,
          holderName: form.holderName,
          file: document?.file ?? null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt) : null,
        },
        setStage,
      );

      setResult(issued);
      toast({ title: "Credential issued", description: "Hand the claim code to the student." });

      setForm(EMPTY_FORM);
      setDocument(null);
      if (address) load(address);
    } catch (err) {
      console.error("Issue credential error:", err);
      const message = describeError(err);
      setIssueError(message);
      toast({ title: "Issuance failed", description: message, variant: "destructive" });
    } finally {
      setIssuing(false);
      setStage(null);
    }
  };

  /* ------------------------------------------------------ revoke / reinstate */

  const runAction = async () => {
    if (!pending) return;
    const { record, kind } = pending;
    setPending(null);
    setBusyHash(record.documentHash);

    try {
      await ensureSepolia();
      const provider = new ethers.BrowserProvider(getInjectedProvider()!);
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      toast({ title: "Confirm in wallet", description: `Approve the ${kind} in MetaMask.` });
      const tx =
        kind === "revoke"
          ? await contract.revokeCredential(record.holder, record.documentHash)
          : await contract.reinstateCredential(record.holder, record.documentHash);
      await tx.wait();

      setCredentials((prev) =>
        prev.map((c) =>
          c.documentHash === record.documentHash
            ? {
                ...c,
                status: kind === "revoke" ? CredentialStatus.Revoked : CredentialStatus.Active,
                isValid: kind !== "revoke" && !c.isExpired,
              }
            : c,
        ),
      );
      toast({
        title: kind === "revoke" ? "Credential revoked" : "Credential reinstated",
        description: "The change is recorded on-chain.",
      });
    } catch (err) {
      console.error(`${kind} failed:`, err);
      toast({ title: `Could not ${kind}`, description: describeError(err), variant: "destructive" });
    } finally {
      setBusyHash(null);
    }
  };

  /* ----------------------------------------------------------------- render */

  if (!address) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <EmptyState
          icon={Wallet}
          title="No issuer wallet connected"
          description="Connect the wallet registered as an issuer to see what it has issued and to write new credentials."
          action={
            <Button asChild>
              <Link to="/institution-portal">Go to the institution portal</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Issuer identity, read from the contract's registry */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border bg-muted">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {issuer?.name || "Institution dashboard"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <AddressChip address={address} size="sm" />
              {issuer?.accreditationId && <span>Accreditation {issuer.accreditationId}</span>}
              {issuer?.website && (
                <a
                  href={issuer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
                >
                  {issuer.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>

        <dl className="flex gap-6">
          {[
            { label: "Issued", value: stats.total },
            { label: "Valid", value: stats.active },
            { label: "Awaiting", value: stats.pending },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</dt>
              <dd className="mt-0.5 text-xl font-semibold tabular-nums">{loading ? "—" : stat.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <Tabs defaultValue="issue" className="mt-8">
        <TabsList>
          <TabsTrigger value="issue">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            Issue
          </TabsTrigger>
          <TabsTrigger value="issued">
            <Award className="h-4 w-4" aria-hidden="true" />
            Issued credentials
            {!loading && <span className="ml-1 tabular-nums text-muted-foreground">{credentials.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------------- Issue */}
        <TabsContent value="issue" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
              <h2 className="text-base font-semibold">New credential</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Everything except the holder address and the document hash is encrypted before it leaves this browser.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="holder">Holder wallet address</Label>
                  <Input
                    id="holder"
                    value={form.holder}
                    onChange={(e) => setForm((f) => ({ ...f, holder: e.target.value }))}
                    placeholder="0x…"
                    className="mt-1.5 font-mono text-xs"
                    disabled={issuing}
                    aria-describedby="holder-help"
                  />
                  <p id="holder-help" className="mt-1 text-xs text-muted-foreground">
                    Public on-chain. This is the only party who can accept the credential.
                  </p>
                </div>

                <div>
                  <Label htmlFor="holderName">Holder name</Label>
                  <Input
                    id="holderName"
                    value={form.holderName}
                    onChange={(e) => setForm((f) => ({ ...f, holderName: e.target.value }))}
                    placeholder="e.g. Alice Kumar"
                    className="mt-1.5"
                    disabled={issuing}
                  />
                </div>

                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(value) => setForm((f) => ({ ...f, type: value }))}
                    disabled={issuing}
                  >
                    <SelectTrigger id="type" className="mt-1.5 capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREDENTIAL_TYPES.map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Bachelor of Computer Science"
                    className="mt-1.5"
                    disabled={issuing}
                  />
                </div>

                <div>
                  <Label htmlFor="expiresAt">Expires on</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                    className="mt-1.5"
                    disabled={issuing}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Leave blank to never expire.</p>
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    placeholder="Optional detail shown to whoever holds the key."
                    className="mt-1.5"
                    disabled={issuing}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block">Document</Label>
                  <FileDropzone value={document} onChange={setDocument} disabled={issuing} />
                </div>
              </div>

              {issueError && (
                <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {issueError}
                </p>
              )}

              <Button className="mt-6 w-full sm:w-auto" size="lg" onClick={handleIssue} disabled={!canIssue}>
                {issuing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Issuing…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Issue credential
                  </>
                )}
              </Button>
            </div>

            {/* The pipeline, visible before it runs so the flow is legible up front */}
            <aside className="rounded-lg border border-border bg-muted/30 p-5">
              <h2 className="text-sm font-semibold">What issuing does</h2>
              <p className="mb-5 mt-1 text-xs leading-relaxed text-muted-foreground">
                Two wallet prompts: one signature to derive the key, one transaction to record the credential.
              </p>
              <IssuanceStepper
                current={stage}
                hasFile={Boolean(document)}
                artefacts={{ documentHash: document?.documentHash }}
              />
            </aside>
          </div>
        </TabsContent>

        {/* --------------------------------------------------------- Issued */}
        <TabsContent value="issued" className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, holder or hash…"
                className="pl-9"
                aria-label="Search issued credentials"
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

          <div className="mt-4">
            {loading ? (
              <div className="rounded-lg border border-border">
                <TableRowSkeleton count={4} />
              </div>
            ) : fetchError ? (
              <ErrorState message={fetchError} onRetry={() => load(address)} showRpcNote />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={Award}
                title={credentials.length === 0 ? "Nothing issued yet" : "No credentials match"}
                description={
                  credentials.length === 0
                    ? "Credentials you issue from this wallet appear here, with their live on-chain status."
                    : "Try a different search term or clear the status filter."
                }
                action={
                  credentials.length > 0 ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch("");
                        setFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {visible.map((credential) => {
                  const status = displayStatus(credential);
                  const busy = busyHash === credential.documentHash;
                  const revocable = status === "active" || status === "expired" || status === "pending";

                  return (
                    <li key={credential.documentHash} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-medium">
                            {credential.metadata?.title ?? "Encrypted credential"}
                          </h3>
                          <StatusBadge status={status} size="sm" />
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <AddressChip
                            address={credential.holder}
                            name={credential.metadata?.holderName}
                            size="sm"
                            showCopy={false}
                          />
                          <span>Issued {formatDate(credential.issuedAt)}</span>
                          {credential.expiresAt && <span>Expires {formatDate(credential.expiresAt)}</span>}
                        </div>

                        <div className="mt-1.5">
                          <HashDisplay value={credential.documentHash} lead={10} tail={8} />
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {credential.transactionHash && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={explorerTxUrl(credential.transactionHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only sm:not-sr-only">Tx</span>
                            </a>
                          </Button>
                        )}

                        {status === "revoked" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => setPending({ record: credential, kind: "reinstate" })}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            )}
                            Reinstate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={busy || !revocable}
                            onClick={() => setPending({ record: credential, kind: "revoke" })}
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <ShieldOff className="h-4 w-4" aria-hidden="true" />
                            )}
                            Revoke
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <ClaimHandoff result={result} onClose={() => setResult(null)} />

      <AlertDialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "revoke" ? "Revoke this credential?" : "Reinstate this credential?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "revoke"
                ? "It stops being valid immediately and anyone verifying it will see it was revoked. The record and its history stay on-chain — this is visible, not a deletion. You can reinstate it later."
                : "It becomes valid again from the next block. The revocation remains part of the record's history."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={runAction}
              className={pending?.kind === "revoke" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {pending?.kind === "revoke" ? "Revoke" : "Reinstate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
