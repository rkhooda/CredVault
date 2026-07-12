import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Search,
  ExternalLink,
  CheckCircle,
  Clock,
  Users,
  Award,
  Building,
  Upload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getContract, getReadOnlyProvider, computeDocumentHash, ensureSepolia, DEPLOYMENT_BLOCK } from "@/lib/contract";

interface IssuedCredential {
  id: string;
  studentName: string;
  studentWallet: string;     // display value (may be truncated)
  holderAddress?: string;    // full address for contract calls
  documentHash?: string;     // bytes32 — required for revocation
  credentialTitle: string;
  credentialType?: string;
  dateIssued: string;
  status: "issued" | "pending" | "revoked";
  transactionHash?: string;
}

function extractErrorMsg(err: any): string {
  if (err?.code === 4001 || err?.code === "ACTION_REJECTED" || err?.info?.error?.code === 4001) {
    return "Transaction rejected in wallet.";
  }
  const msg = err?.reason ?? err?.shortMessage ?? err?.message ?? "Transaction failed.";
  return msg.length > 120 ? msg.slice(0, 120) + "…" : msg;
}

export default function InstitutionDashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [issuanceForm, setIssuanceForm] = useState({
    studentWallet: "",
    credentialTitle: "",
    description: "",
    credentialType: "certificate"
  });

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<IssuedCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueStatus, setIssueStatus] = useState("");
  const [issueError, setIssueError] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    const address = localStorage.getItem("credvault_institution_wallet");
    if (address) setWalletAddress(address);
  }, []);

  const fetchCredentials = useCallback(async (issuer: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const provider = getReadOnlyProvider();
      const contract = getContract(provider);

      // Filter by issuer (second indexed param); null = any holder
      const [issuedEvents, revokedEvents] = await Promise.all([
        contract.queryFilter(contract.filters.CredentialIssued(null, issuer), DEPLOYMENT_BLOCK),
        contract.queryFilter(contract.filters.CredentialRevoked(null, issuer), DEPLOYMENT_BLOCK),
      ]);

      const revokedHashes = new Set(revokedEvents.map((e) => (e as any).args.documentHash));

      const list: IssuedCredential[] = issuedEvents.map((e) => {
        const { holder, documentHash, timestamp } = (e as any).args;

        const meta = localStorage.getItem(`credvault_meta_${documentHash}`);
        const parsed = meta ? JSON.parse(meta) : null;

        return {
          id: e.transactionHash,
          studentName: parsed?.holderAddress
            ? `${parsed.holderAddress.slice(0, 6)}...${parsed.holderAddress.slice(-4)}`
            : `${holder.slice(0, 6)}...${holder.slice(-4)}`,
          studentWallet: `${holder.slice(0, 6)}...${holder.slice(-4)}`,
          holderAddress: holder,
          documentHash,
          credentialTitle: parsed?.title ?? "Verified Credential",
          credentialType: parsed?.type ?? "credential",
          dateIssued: parsed?.issuedAt
            ? parsed.issuedAt.split("T")[0]
            : new Date(Number(timestamp) * 1000).toISOString().split("T")[0],
          status: revokedHashes.has(documentHash) ? "revoked" : "issued",
          transactionHash: e.transactionHash,
        };
      });

      setCredentials(list);
    } catch (err) {
      console.error("Failed to fetch credentials:", err);
      setFetchError("Could not load credentials from chain. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (walletAddress) fetchCredentials(walletAddress);
  }, [walletAddress, fetchCredentials]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "issued":
        return <Badge className="status-verified"><CheckCircle className="w-3 h-3 mr-1" />Issued</Badge>;
      case "pending":
        return <Badge className="status-pending"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "revoked":
        return <Badge className="status-revoked">Revoked</Badge>;
      default:
        return null;
    }
  };

  const filteredCredentials = credentials.filter(cred => {
    const matchesSearch = cred.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cred.credentialTitle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "all" || cred.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleIssueCredential = async () => {
    setIssueError("");
    const holder = issuanceForm.studentWallet.trim();
    const title = issuanceForm.credentialTitle.trim();

    if (!holder || !title) {
      toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (!ethers.isAddress(holder)) {
      setIssueError("Invalid wallet address.");
      return;
    }

    setIssuing(true);
    setIssueStatus("Switching to Sepolia...");
    try {
      await ensureSepolia();

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      // Re-verify issuer role in case wallet changed since login
      const authorized = await contract.isIssuer(signer.address);
      if (!authorized) {
        setIssueError("Connected wallet is not an authorized issuer.");
        return;
      }

      const docHash = computeDocumentHash(holder, title, issuanceForm.credentialType);

      setIssueStatus("Confirm in wallet...");
      const tx = await contract.issueCredential(holder, docHash);

      setIssueStatus("Transaction pending...");
      const receipt = await tx.wait();

      // Store human-readable metadata locally so dashboards can show readable info.
      // NOTE: interim solution — browser-local only, lost on clearing localStorage.
      localStorage.setItem(`credvault_meta_${docHash}`, JSON.stringify({
        title,
        type: issuanceForm.credentialType,
        description: issuanceForm.description.trim(),
        holderAddress: holder,
        issuedAt: new Date().toISOString(),
        issuer: signer.address,
      }));

      toast({ title: "✅ Credential Issued", description: `Tx: ${receipt.hash.slice(0, 10)}...` });
      setIssuanceForm({ studentWallet: "", credentialTitle: "", description: "", credentialType: "certificate" });
      if (walletAddress) fetchCredentials(walletAddress);
    } catch (err: any) {
      console.error("Issue credential error:", err);
      const msg = extractErrorMsg(err);
      setIssueError(msg);
      toast({ title: "Issue Failed", description: msg, variant: "destructive" });
    } finally {
      setIssuing(false);
      setIssueStatus("");
    }
  };

  const handleRevoke = async (credential: IssuedCredential) => {
    if (!credential.documentHash || !credential.holderAddress) {
      toast({
        title: "Cannot Revoke",
        description: "This is placeholder data without an on-chain hash. Revoke only credentials issued through this dashboard.",
        variant: "destructive"
      });
      return;
    }
    if (credential.status === "revoked") return;

    setRevokingId(credential.id);
    try {
      await ensureSepolia();

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const contract = getContract(signer);

      toast({ title: "Confirm in wallet", description: "Please approve the revocation in MetaMask." });
      const tx = await contract.revokeCredential(credential.holderAddress, credential.documentHash);
      await tx.wait();

      setCredentials(prev =>
        prev.map(c => c.id === credential.id ? { ...c, status: "revoked" as const } : c)
      );
      toast({ title: "✅ Credential Revoked", description: `${credential.credentialTitle} has been revoked on-chain.` });
    } catch (err: any) {
      console.error("Revoke credential error:", err);
      const msg = extractErrorMsg(err);
      toast({ title: "Revoke Failed", description: msg, variant: "destructive" });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Institution Dashboard</h1>
          <p className="text-muted-foreground">Issue and manage blockchain credentials for your students</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Issued</p>
                <p className="text-2xl font-bold">{credentials.length}</p>
              </div>
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <Award className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Students</p>
                <p className="text-2xl font-bold text-success">127</p>
              </div>
              <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-success" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold text-accent">23</p>
              </div>
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-accent" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Institution</p>
                <p className="text-sm font-semibold">Stanford University</p>
              </div>
              <div className="w-12 h-12 bg-primary-glow/20 rounded-full flex items-center justify-center">
                <Building className="w-6 h-6 text-primary-glow" />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Issue Credential Form */}
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
                    onChange={(e) => setIssuanceForm(prev => ({ ...prev, studentWallet: e.target.value }))}
                    className="font-mono"
                    disabled={issuing}
                  />
                </div>

                <div>
                  <Label htmlFor="credentialTitle">Credential Title *</Label>
                  <Input
                    id="credentialTitle"
                    placeholder="e.g., Bachelor of Computer Science"
                    value={issuanceForm.credentialTitle}
                    onChange={(e) => setIssuanceForm(prev => ({ ...prev, credentialTitle: e.target.value }))}
                    disabled={issuing}
                  />
                </div>

                <div>
                  <Label htmlFor="credentialType">Credential Type</Label>
                  <select
                    id="credentialType"
                    value={issuanceForm.credentialType}
                    onChange={(e) => setIssuanceForm(prev => ({ ...prev, credentialType: e.target.value }))}
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
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Additional details about the credential..."
                    value={issuanceForm.description}
                    onChange={(e) => setIssuanceForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    disabled={issuing}
                  />
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleIssueCredential}
                    variant="hero"
                    className="w-full"
                    disabled={issuing}
                  >
                    {issuing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                        {issueStatus || "Processing..."}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Issue Credential
                      </>
                    )}
                  </Button>

                  {issueError && (
                    <p className="text-sm text-destructive">{issueError}</p>
                  )}

                  <Button variant="outline" className="w-full" disabled={issuing}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Credential File
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Issued Credentials List */}
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
                    <option value="issued">Issued</option>
                    <option value="pending">Pending</option>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => walletAddress && fetchCredentials(walletAddress)}
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {!loading && !fetchError && filteredCredentials.map((credential) => (
                  <div
                    key={credential.id}
                    className="bg-muted/30 border border-border/50 rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">{credential.credentialTitle}</h3>
                        <p className="text-sm text-muted-foreground">Student: {credential.studentName}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1">{credential.studentWallet}</p>
                      </div>
                      {getStatusBadge(credential.status)}
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Issued: {new Date(credential.dateIssued).toLocaleDateString()}
                      </div>

                      <div className="flex gap-2">
                        {credential.transactionHash && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://sepolia.etherscan.io/tx/${credential.transactionHash}`, "_blank")}
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
                          disabled={revokingId === credential.id || credential.status === "revoked"}
                        >
                          {revokingId === credential.id ? (
                            <>
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                              Revoking...
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
    </div>
  );
}
