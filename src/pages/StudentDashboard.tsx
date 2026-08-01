import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryEventsFromDeployment } from "@/lib/contract";

interface Credential {
  id: string;
  title: string;
  issuer: string;
  dateIssued: string;
  status: "verified" | "pending" | "revoked";
  type: string;
  transactionHash?: string;
  documentHash: string;
  holderAddress: string;
}

export default function StudentDashboard() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // QR dialog: null = closed, Credential = open for that credential
  const [qrCredential, setQrCredential] = useState<Credential | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    const address = localStorage.getItem("credvault_student_wallet");
    if (address) setWalletAddress(address);
  }, []);

  const fetchCredentials = useCallback(async (address: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      // Scan from deployment block so we never miss any events.
      // Both holder params are indexed, so the RPC only returns logs for this wallet.
      const [issuedEvents, revokedEvents] = await queryEventsFromDeployment((contract) => [
        contract.filters.CredentialIssued(address),
        contract.filters.CredentialRevoked(address),
      ]);

      // O(1) revocation check
      const revokedHashes = new Set(revokedEvents.map((e) => (e as any).args.documentHash));

      const list: Credential[] = issuedEvents.map((e) => {
        const { holder, issuer, documentHash, timestamp } = (e as any).args;

        // Merge localStorage metadata written by InstitutionDashboard at issuance.
        // Falls back gracefully when issuing from a different browser/device.
        const meta = localStorage.getItem(`credvault_meta_${documentHash}`);
        const parsed = meta ? JSON.parse(meta) : null;

        return {
          id: e.transactionHash,
          title: parsed?.title ?? "Verified Credential",
          // meta.issuer is the human-readable address stored at issuance time
          issuer: parsed?.issuer ?? issuer,
          // meta stores ISO timestamp; fall back to on-chain timestamp (seconds → ms)
          dateIssued: parsed?.issuedAt ?? new Date(Number(timestamp) * 1000).toISOString(),
          status: revokedHashes.has(documentHash) ? "revoked" : "verified",
          type: parsed?.type ?? "Credential",
          transactionHash: e.transactionHash,
          documentHash,
          holderAddress: holder,
        };
      });

      setCredentials(list);
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

  // Generate QR data URL whenever the dialog opens for a credential.
  // QR payload format: JSON { holder, documentHash }
  // VerifierPage scanner (Phase 5) parses this to pre-fill its two-field form.
  useEffect(() => {
    if (!qrCredential) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(
      JSON.stringify({ holder: qrCredential.holderAddress, documentHash: qrCredential.documentHash }),
      { width: 240, margin: 1 },
    )
      .then(setQrDataUrl)
      .catch(console.error);
  }, [qrCredential]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <Badge className="status-verified"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>;
      case "pending":
        return <Badge className="status-pending"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "revoked":
        return <Badge className="status-revoked"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
      default:
        return null;
    }
  };

  const filteredCredentials = credentials.filter((cred) => {
    const matchesSearch =
      searchTerm === "" ||
      cred.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cred.issuer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cred.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "all" || cred.status === filter;
    return matchesSearch && matchesFilter;
  });

  const copyQrData = (credential: Credential) => {
    const payload = JSON.stringify({
      holder: credential.holderAddress,
      documentHash: credential.documentHash,
    });
    navigator.clipboard.writeText(payload).then(
      () => toast({ title: "Copied", description: "Credential data copied to clipboard." }),
      () => toast({ title: "QR Data", description: payload }),
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Credentials</h1>
          <p className="text-muted-foreground">Manage and verify your blockchain-secured academic credentials</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Credentials</p>
                <p className="text-2xl font-bold">{credentials.length}</p>
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
                <p className="text-2xl font-bold text-success">
                  {credentials.filter((c) => c.status === "verified").length}
                </p>
              </div>
              <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
            </div>
          </Card>

          <Card className="credential-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-accent">
                  {credentials.filter((c) => c.status === "pending").length}
                </p>
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
                  {walletAddress
                    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    : "Not Connected"}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary-glow/20 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary-glow" />
              </div>
            </div>
          </Card>
        </div>

        {/* Actions Bar — Upload removed: only ISSUER_ROLE wallets issue credentials */}
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
            <div className="flex gap-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="min-w-[140px] px-4 py-2 h-11 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Loading credentials from chain…</p>
          </div>
        )}

        {/* Credentials Grid */}
        {!loading && !fetchError && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCredentials.map((credential) => (
              <Card key={credential.id} className="credential-card p-6 hover:scale-105 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{credential.title}</h3>
                    <p className="text-muted-foreground text-sm">{credential.issuer}</p>
                  </div>
                  {getStatusBadge(credential.status)}
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span>{credential.type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Issued:</span>
                    <span>{new Date(credential.dateIssued).toLocaleDateString()}</span>
                  </div>
                  {credential.transactionHash && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tx Hash:</span>
                      <span className="font-mono text-xs">
                        {`${credential.transactionHash.slice(0, 6)}…${credential.transactionHash.slice(-4)}`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-0"
                    onClick={() => setQrCredential(credential)}
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    QR Code
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 min-w-0">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  {credential.transactionHash && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="sm:flex-none"
                      onClick={() =>
                        window.open(
                          `https://sepolia.etherscan.io/tx/${credential.transactionHash}`,
                          "_blank",
                        )
                      }
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
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

      {/* QR Code Dialog */}
      <Dialog open={!!qrCredential} onOpenChange={(open) => { if (!open) setQrCredential(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{qrCredential?.title ?? "Credential QR Code"}</DialogTitle>
            <DialogDescription>
              Share this QR code so verifiers can scan it in the Verifier Portal.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Credential QR code"
                width={240}
                height={240}
                className="rounded-lg"
              />
            ) : (
              <div className="w-60 h-60 bg-muted rounded-lg flex items-center justify-center">
                <Clock className="w-8 h-8 text-muted-foreground animate-pulse" />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => qrCredential && copyQrData(qrCredential)}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy data
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
