import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  QrCode,
  CheckCircle,
  XCircle,
  ExternalLink,
  Shield,
  AlertTriangle,
  Calendar,
  Building,
  User,
  FileCheck,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS } from "@/lib/contract";
import {
  verifyCredential,
  decodeSharePayload,
  CredentialStatus,
  STATUS_LABELS,
  type CredentialRecord,
} from "@/lib/credentials";
import { fileMatchesHash } from "@/lib/documentHash";

type DocumentCheck = "idle" | "checking" | "match" | "mismatch";

export default function VerifierPage() {
  const { toast } = useToast();
  const [holderAddress, setHolderAddress] = useState("");
  const [documentHash, setDocumentHash] = useState("");
  const [decryptionKey, setDecryptionKey] = useState<string | undefined>(undefined);
  const [record, setRecord] = useState<CredentialRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [documentCheck, setDocumentCheck] = useState<DocumentCheck>("idle");
  const documentInputRef = useRef<HTMLInputElement>(null);

  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const canVerify = holderAddress.trim() !== "" && documentHash.trim() !== "" && !isVerifying;

  /**
   * Called from the button and directly from the QR path, which passes fresh
   * values rather than waiting for state to settle.
   */
  const runVerify = async (holder: string, hash: string, key?: string) => {
    if (!holder || !hash) {
      toast({
        title: "Missing Fields",
        description: "Enter both a holder address and a document hash.",
        variant: "destructive",
      });
      return;
    }
    if (!ethers.isAddress(holder)) {
      toast({ title: "Invalid Address", description: "That is not a valid Ethereum address.", variant: "destructive" });
      return;
    }

    const normalizedHash = hash.startsWith("0x") ? hash : `0x${hash}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedHash)) {
      toast({
        title: "Invalid Hash",
        description: "The document hash must be 64 hex characters.",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setRecord(null);
    setNotFound(false);
    setError(null);
    setDocumentCheck("idle");

    try {
      const result = await verifyCredential(holder, normalizedHash, key);

      if (!result) {
        setNotFound(true);
        toast({ title: "Not found", description: "No record exists for this holder and hash.", variant: "destructive" });
        return;
      }

      setRecord(result);
      if (result.isValid) {
        toast({ title: "Credential verified", description: "Valid and active on-chain." });
      } else {
        toast({
          title: STATUS_LABELS[result.status],
          description: result.isExpired ? "This credential has expired." : "This credential is not currently valid.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError("Could not reach Sepolia. Check your connection and try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = () => runVerify(holderAddress.trim(), documentHash.trim(), decryptionKey);

  /** Recomputes keccak256 over the uploaded file and compares it to the on-chain hash. */
  const handleDocumentCheck = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !record) return;

    setDocumentCheck("checking");
    try {
      setDocumentCheck((await fileMatchesHash(file, record.documentHash)) ? "match" : "mismatch");
    } catch (err) {
      console.error("Document check failed:", err);
      setDocumentCheck("mismatch");
    }
  };

  // Camera scan loop: start on dialog open, stop on close or successful decode.
  // getUserMedia requires HTTPS or localhost.
  useEffect(() => {
    if (!scanOpen) {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setScanError("");
      return;
    }

    let alive = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          tick();
        }
      } catch (err) {
        if (!alive) return;
        setScanError(
          (err as Error).name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access and try again."
            : "Could not start camera. Check your device and try again.",
        );
      }
    }

    function tick() {
      if (!alive) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        setScanOpen(false); // triggers cleanup via this effect's return
        const payload = decodeSharePayload(code.data);
        if (!payload) {
          toast({
            title: "Unrecognized QR code",
            description: "This is not a CredVault credential.",
            variant: "destructive",
          });
          return;
        }
        setHolderAddress(payload.holder);
        setDocumentHash(payload.documentHash);
        setDecryptionKey(payload.k);
        runVerify(payload.holder, payload.documentHash, payload.k);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);

  const resetVerification = () => {
    setRecord(null);
    setNotFound(false);
    setError(null);
    setHolderAddress("");
    setDocumentHash("");
    setDecryptionKey(undefined);
    setDocumentCheck("idle");
  };

  const showResult = record !== null || notFound || error !== null;
  const isValid = record?.isValid ?? false;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Credential Verifier</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Instantly verify any blockchain-secured credential. Scan the holder's QR code, or enter their wallet
            address and the document hash.
          </p>
        </div>

        <Card className="credential-card p-8 mb-8">
          <div className="space-y-6">
            <div>
              <Label htmlFor="holderAddress" className="text-lg font-semibold">
                Holder Wallet Address
              </Label>
              <div className="mt-2">
                <Input
                  id="holderAddress"
                  placeholder="0x..."
                  value={holderAddress}
                  onChange={(e) => setHolderAddress(e.target.value)}
                  className="flex-1 font-mono h-12"
                  disabled={isVerifying}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="documentHash" className="text-lg font-semibold">
                Document Hash (bytes32)
              </Label>
              <div className="mt-2 flex gap-3">
                <Input
                  id="documentHash"
                  placeholder="0x1234...abcd  (64 hex chars)"
                  value={documentHash}
                  onChange={(e) => setDocumentHash(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canVerify) handleVerify();
                  }}
                  className="flex-1 font-mono h-12"
                  disabled={isVerifying}
                />
                <Button
                  onClick={() => setScanOpen(true)}
                  variant="outline"
                  size="lg"
                  className="h-12 px-4"
                  disabled={isVerifying}
                >
                  <QrCode className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Scanning the holder's QR also carries their decryption key, which reveals the credential's details.
                Without it you can still confirm the credential is valid.
              </p>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleVerify} variant="hero" size="lg" className="flex-1 h-12" disabled={!canVerify}>
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Verifying on Sepolia...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Verify Credential
                  </>
                )}
              </Button>

              {showResult && (
                <Button onClick={resetVerification} variant="outline" size="lg" className="h-12">
                  New Search
                </Button>
              )}
            </div>
          </div>
        </Card>

        {showResult && (
          <Card className={`credential-card p-8 ${isValid ? "border-success" : "border-destructive"}`}>
            <div className="text-center mb-6">
              {isValid ? (
                <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-success" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
              )}

              <h2 className={`text-3xl font-bold mb-2 ${isValid ? "text-success" : "text-destructive"}`}>
                {isValid ? "Credential Verified" : "Not Valid"}
              </h2>

              <p className="text-muted-foreground">
                {error
                  ? error
                  : notFound
                    ? "No record exists on-chain for this holder and document hash."
                    : isValid
                      ? "This credential is authentic and active on the Sepolia blockchain."
                      : record?.isExpired
                        ? `This credential expired on ${record.expiresAt?.toLocaleDateString()}.`
                        : `Status: ${STATUS_LABELS[record?.status ?? CredentialStatus.None]}.`}
              </p>
            </div>

            {record && (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Credential</p>
                        {record.metadata ? (
                          <p className="font-semibold">{record.metadata.title}</p>
                        ) : (
                          <p className="font-semibold flex items-center gap-2 text-muted-foreground">
                            <Lock className="w-4 h-4" />
                            Encrypted — no key provided
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Holder</p>
                        <p className="font-semibold font-mono text-sm break-all">
                          {record.metadata?.holderName ?? record.holder}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center shrink-0">
                        <Building className="w-5 h-5 text-success" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Issued by</p>
                        <p className="font-semibold break-words">{record.issuerName}</p>
                        <p className="font-mono text-xs text-muted-foreground break-all">{record.issuer}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-glow/20 rounded-full flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-primary-glow" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Date Issued</p>
                        <p className="font-semibold">{record.issuedAt.toLocaleDateString()}</p>
                        {record.expiresAt && (
                          <p className="text-xs text-muted-foreground">
                            Expires {record.expiresAt.toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {record.metadata?.description && (
                  <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Details</p>
                    <p className="text-sm">{record.metadata.description}</p>
                  </div>
                )}

                {/* Document integrity — the point of hashing the file itself */}
                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold mb-1">Check a document</p>
                      <p className="text-sm text-muted-foreground">
                        Upload the certificate you were given. We recompute its hash and compare it to the one recorded
                        on-chain — proving it is byte-for-byte the document that was issued.
                      </p>
                    </div>
                    <input
                      ref={documentInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleDocumentCheck}
                      accept=".pdf,.png,.jpg,.jpeg"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => documentInputRef.current?.click()}
                      disabled={documentCheck === "checking"}
                    >
                      <FileCheck className="w-4 h-4 mr-2" />
                      {documentCheck === "checking" ? "Hashing…" : "Select file"}
                    </Button>
                  </div>

                  {documentCheck === "match" && (
                    <div className="mt-4 flex items-center gap-2 text-success">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold">Exact match — this is the issued document.</span>
                    </div>
                  )}
                  {documentCheck === "mismatch" && (
                    <div className="mt-4 flex items-center gap-2 text-destructive">
                      <XCircle className="w-5 h-5" />
                      <span className="font-semibold">
                        No match — this file differs from the one recorded on-chain.
                      </span>
                    </div>
                  )}

                  <p className="font-mono text-xs text-muted-foreground mt-3 break-all">
                    On-chain hash: {record.documentHash}
                  </p>
                </div>

                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground mb-1">Verified against contract</p>
                      <p className="font-mono text-sm break-all">{CONTRACT_ADDRESS}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`, "_blank")
                      }
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View on Etherscan
                    </Button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive mb-1">Verification Error</p>
                    <p className="text-sm text-destructive/80">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold mb-4">How Verification Works</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <p className="font-medium">Scan or Enter</p>
              <p className="text-sm text-muted-foreground">
                The holder's QR carries their address, the document hash and a decryption key
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <p className="font-medium">Blockchain Check</p>
              <p className="text-sm text-muted-foreground">
                Read the record straight from Sepolia — no server involved
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto">
                <FileCheck className="w-6 h-6 text-success" />
              </div>
              <p className="font-medium">Prove the Document</p>
              <p className="text-sm text-muted-foreground">
                Re-hash the certificate to confirm it is the exact file that was issued
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at a CredVault credential QR code to fill in the form automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {scanError ? (
              <div className="w-full p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
                <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">{scanError}</p>
              </div>
            ) : (
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              </div>
            )}
            {/* Canvas is only used for frame capture — never shown */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
