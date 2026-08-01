import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ethers } from "ethers";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Send,
  Search,
  ExternalLink,
  CheckCircle,
  Clock,
  Users,
  Award,
  Building,
  Upload,
  FileCheck,
  Copy,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getContract, getReadOnlyProvider, ensureSepolia, getInjectedProvider } from "@/lib/contract";
import {
  fetchCredentialsForIssuer,
  CredentialStatus,
  type CredentialRecord,
} from "@/lib/credentials";
import { issueCredential, describeError, stageMessage, type IssueStage, type IssueResult } from "@/lib/issuance";
import { MAX_DOCUMENT_BYTES } from "@/lib/documentHash";

export default function InstitutionDashboard() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [issuanceForm, setIssuanceForm] = useState({
    studentWallet: "",
    studentName: "",
    credentialTitle: "",
    description: "",
    credentialType: "certificate",
    expiresAt: "",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [issuerName, setIssuerName] = useState<string>("");
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueStatus, setIssueStatus] = useState("");
  const [issueError, setIssueError] = useState("");
  const [revokingHash, setRevokingHash] = useState<string | null>(null);

  // Claim hand-off: shown once after issuance, carries the decryption key.
  const [claimResult, setClaimResult] = useState<IssueResult | null>(null);
  const [claimQr, setClaimQr] = useState("");

  useEffect(() => {
    const address = localStorage.getItem("credvault_institution_wallet");
    if (address) setWalletAddress(address);
  }, []);

  // The institution's display name comes from the on-chain registry, not a hardcoded string.
  useEffect(() => {
    if (!walletAddress) return;
    getContract(getReadOnlyProvider())
      .issuerInfo(walletAddress)
      .then((info: [string, string, string]) => setIssuerName(info[0] || ""))
      .catch((err) => console.warn("Could not read issuer identity:", err));
  }, [walletAddress]);

  const fetchCredentials = useCallback(async (issuer: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      setCredentials(await fetchCredentialsForIssuer(issuer));
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

  useEffect(() => {
    if (!claimResult) {
      setClaimQr("");
      return;
    }
    QRCode.toDataURL(claimResult.claimPayload, { width: 240, margin: 1 })
      .then(setClaimQr)
      .catch(console.error);
  }, [claimResult]);

  const stats = useMemo(
    () => ({
      total: credentials.length,
      active: credentials.filter((c) => c.status === CredentialStatus.Active).length,
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
        return <Badge className="status-verified"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case CredentialStatus.Pending:
        return <Badge className="status-pending"><Clock className="w-3 h-3 mr-1" />Awaiting acceptance</Badge>;
      case CredentialStatus.Rejected:
        return <Badge className="status-revoked"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      case CredentialStatus.Revoked:
        return <Badge className="status-revoked"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return null;
    }
  };

  const filteredCredentials = credentials.filter((credential) => {
    const title = credential.metadata?.title ?? "";
    const haystack = `${title} ${credential.holder} ${credential.metadata?.holderName ?? ""}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && credential.status === CredentialStatus.Active) ||
      (filter === "pending" && credential.status === CredentialStatus.Pending) ||
      (filter === "revoked" && credential.status === CredentialStatus.Revoked);

    return matchesSearch && matchesFilter;
  });

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > MAX_DOCUMENT_BYTES) {
      setIssueError(`Document must be under ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.`);
      event.target.value = "";
      return;
    }
    setIssueError("");
    setDocumentFile(file);
  };

  const handleIssueCredential = async () => {
    setIssueError("");
    const holder = issuanceForm.studentWallet.trim();
    const title = issuanceForm.credentialTitle.trim();

    if (!holder || !title) {
      toast({ title: "Missing Information", description: "Wallet address and title are required.", variant: "destructive" });
      return;
    }
    if (!ethers.isAddress(holder)) {
      setIssueError("Invalid wallet address.");
      return;
    }

    setIssuing(true);
    setIssueStatus("Switching to Sepolia…");
    try {
      await ensureSepolia();

      const provider = new ethers.BrowserProvider(getInjectedProvider()!);
      const signer = await provider.getSigner();

      // Re-check the role in case the wallet changed since login.
      const contract = getContract(signer);
      if (!(await contract.isIssuer(signer.address))) {
        setIssueError("Connected wallet is not an authorised issuer.");
        return;
      }

      const result = await issueCredential(
        signer,
        issuerName || signer.address,
        {
          holder,
          title,
          type: issuanceForm.credentialType,
          description: issuanceForm.description,
          holderName: issuanceForm.studentName,
          file: documentFile,
          expiresAt: issuanceForm.expiresAt ? new Date(issuanceForm.expiresAt) : null,
        },
        (stage: IssueStage) => setIssueStatus(stageMessage(stage)),
      );

      setClaimResult(result);
      toast({
        title: "Credential issued",
        description: "Share the claim code with the student so they can accept and read it.",
      });

      setIssuanceForm({
        studentWallet: "",
        studentName: "",
        credentialTitle: "",
        description: "",
        credentialType: "certificate",
        expiresAt: "",
      });
      setDocumentFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (walletAddress) fetchCredentials(walletAddress);
    } catch (err) {
      console.error("Issue credential error:", err);
      const message = describeError(err);
      setIssueError(message);
      toast({ title: "Issue Failed", description: message, variant: "destructive" });
    } finally {
      setIssuing(false);
      setIssueStatus("");
    }
  };

  const handleRevoke = async (credential: CredentialRecord) => {
    if (credential.status === CredentialStatus.Revoked) return;

    setRevokingHash(credential.documentHash);
    try {
      await ensureSepolia();
      const provider = new ethers.BrowserProvider(getInjectedProvider()!);
      const signer = await provider.getSigner();

      toast({ title: "Confirm in wallet", description: "Approve the revocation in MetaMask." });
      const tx = await getContract(signer).revokeCredential(credential.holder, credential.documentHash);
      await tx.wait();

      setCredentials((prev) =>
        prev.map((c) =>
          c.documentHash === credential.documentHash
            ? { ...c, status: CredentialStatus.Revoked, isValid: false }
            : c,
        ),
      );
      toast({ title: "Credential revoked", description: "The change is recorded on-chain." });
    } catch (err) {
      console.error("Revoke credential error:", err);
      toast({ title: "Revoke Failed", description: describeError(err), variant: "destructive" });
    } finally {
      setRevokingHash(null);
    }
  };

  const copyClaim = () => {
    if (!claimResult) return;
    navigator.clipboard.writeText(claimResult.claimPayload);
    toast({ title: "Claim code copied" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Institution Dashboard</h1>
          <p className="text-muted-foreground">Issue and manage blockchain credentials for your students</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Issued</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <Award className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-success">{stats.active}</p>
              </div>
              <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-success" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Awaiting Acceptance</p>
                <p className="text-2xl font-bold text-accent">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-accent" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Institution</p>
                <p className="text-sm font-semibold truncate" title={issuerName || walletAddress || ""}>
                  {issuerName || (walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "—")}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary-glow/20 rounded-full flex items-center justify-center shrink-0">
                <Building className="w-6 h-6 text-primary-glow" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Issue form */}
          <div className="lg:col-span-1">
            <Card className="credential-card p-6">
              <h2 className="text-2xl font-semibold mb-6 flex items-center">
                <Send className="w-6 h-6 mr-2 text-primary" />
                Issue New Credential
              </h2>

              <div className="space-y-6">
                <div>
                  <Label htmlFor="studentWallet">Student Wallet Address *</Label>
                  <Input
                    id="studentWallet"
                    placeholder="0x..."
                    value={issuanceForm.studentWallet}
                    onChange={(e) => setIssuanceForm((prev) => ({ ...prev, studentWallet: e.target.value }))}
                    className="font-mono"
                    disabled={issuing}
                  />
                </div>

                <div>
                  <Label htmlFor="studentName">Student Name</Label>
                  <Input
                    id="studentName"
                    placeholder="e.g., Alice Kumar"
                    value={issuanceForm.studentName}
                    onChange={(e) => setIssuanceForm((prev) => ({ ...prev, studentName: e.target.value }))}
                    disabled={issuing}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Encrypted before upload — never public.</p>
                </div>

                <div>
                  <Label htmlFor="credentialTitle">Credential Title *</Label>
                  <Input
                    id="credentialTitle"
                    placeholder="e.g., Bachelor of Computer Science"
                    value={issuanceForm.credentialTitle}
                    onChange={(e) => setIssuanceForm((prev) => ({ ...prev, credentialTitle: e.target.value }))}
                    disabled={issuing}
                  />
                </div>

                <div>
                  <Label htmlFor="credentialType">Credential Type</Label>
                  <select
                    id="credentialType"
                    value={issuanceForm.credentialType}
                    onChange={(e) => setIssuanceForm((prev) => ({ ...prev, credentialType: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    disabled={issuing}
                  >
                    <option value="certificate">Certificate</option>
                    <option value="degree">Degree</option>
                    <option value="diploma">Diploma</option>
                    <option value="award">Award</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="expiresAt">Expires On</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={issuanceForm.expiresAt}
                    onChange={(e) => setIssuanceForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                    disabled={issuing}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave blank for a credential that never expires.</p>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Additional details about the credential..."
                    value={issuanceForm.description}
                    onChange={(e) => setIssuanceForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    disabled={issuing}
                  />
                </div>

                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileSelected}
                    accept=".pdf,.png,.jpg,.jpeg"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={issuing}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {documentFile ? <FileCheck className="w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    {documentFile ? documentFile.name : "Attach Credential File"}
                  </Button>
                  {documentFile && (
                    <p className="text-xs text-muted-foreground">
                      Hashed on-chain and encrypted before upload, so a verifier can prove this exact file is genuine.
                    </p>
                  )}

                  <Button onClick={handleIssueCredential} variant="hero" className="w-full" disabled={issuing}>
                    {issuing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        {issueStatus || "Processing…"}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Issue Credential
                      </>
                    )}
                  </Button>

                  {issueError && <p className="text-sm text-destructive">{issueError}</p>}
                </div>
              </div>
            </Card>
          </div>

          {/* Issued list */}
          <div className="lg:col-span-2">
            <Card className="credential-card p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <h2 className="text-2xl font-semibold mb-4 sm:mb-0">Issued Credentials</h2>

                <div className="flex gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search credentials..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="pending">Awaiting</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {loading && (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm">Loading credentials from chain…</p>
                  </div>
                )}
                {!loading && fetchError && (
                  <div className="text-center py-8">
                    <p className="text-destructive text-sm mb-3">{fetchError}</p>
                    <Button variant="outline" size="sm" onClick={() => walletAddress && fetchCredentials(walletAddress)}>
                      Retry
                    </Button>
                  </div>
                )}
                {!loading &&
                  !fetchError &&
                  filteredCredentials.map((credential) => (
                    <div
                      key={credential.documentHash}
                      className="bg-muted/30 border border-border/50 rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold">
                            {credential.metadata?.title ?? "Encrypted credential"}
                          </h3>
                          {credential.metadata?.holderName && (
                            <p className="text-sm text-muted-foreground">Student: {credential.metadata.holderName}</p>
                          )}
                          <p className="text-xs font-mono text-muted-foreground mt-1">
                            {credential.holder.slice(0, 6)}…{credential.holder.slice(-4)}
                          </p>
                        </div>
                        {getStatusBadge(credential)}
                      </div>

                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="text-sm text-muted-foreground">
                          Issued: {credential.issuedAt.toLocaleDateString()}
                          {credential.expiresAt && ` · Expires: ${credential.expiresAt.toLocaleDateString()}`}
                        </div>

                        <div className="flex gap-2">
                          {credential.transactionHash && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                window.open(`https://sepolia.etherscan.io/tx/${credential.transactionHash}`, "_blank")
                              }
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              View Tx
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRevoke(credential)}
                            disabled={
                              revokingHash === credential.documentHash ||
                              credential.status === CredentialStatus.Revoked ||
                              credential.status === CredentialStatus.Rejected
                            }
                          >
                            {revokingHash === credential.documentHash ? (
                              <>
                                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                                Revoking…
                              </>
                            ) : (
                              "Revoke"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {!loading && !fetchError && filteredCredentials.length === 0 && (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold mb-2">No credentials found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || filter !== "all"
                      ? "Try adjusting your search or filters."
                      : "No credentials have been issued by this wallet yet."}
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Claim hand-off */}
      <Dialog open={Boolean(claimResult)} onOpenChange={(open) => !open && setClaimResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Give this to the student</DialogTitle>
            <DialogDescription>
              This code carries the decryption key. Without it the credential stays unreadable — including to us.
              It is not stored anywhere, but you can always regenerate it by re-issuing the same document.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4">
            {claimQr && <img src={claimQr} alt="Claim code" className="rounded-lg border border-border" />}
            <Button variant="outline" className="w-full" onClick={copyClaim}>
              <Copy className="w-4 h-4 mr-2" />
              Copy claim code
            </Button>
            {claimResult?.transactionHash && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  window.open(`https://sepolia.etherscan.io/tx/${claimResult.transactionHash}`, "_blank")
                }
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View transaction
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
