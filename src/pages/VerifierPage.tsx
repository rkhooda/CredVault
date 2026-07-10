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
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";
import { getContract, getReadOnlyProvider } from "@/lib/contract";

interface VerificationResult {
  isValid: boolean;
  credentialTitle?: string;
  studentName?: string;   // populated with holder address
  issuerName?: string;    // populated with issuer address
  dateIssued?: string;
  transactionHash?: string;
  error?: string;
}

export default function VerifierPage() {
  const { toast } = useToast();
  const [holderAddress, setHolderAddress] = useState("");
  const [documentHash, setDocumentHash] = useState("");
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // QR scanner dialog state
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const canVerify = holderAddress.trim() !== "" && documentHash.trim() !== "" && !isVerifying;

  // Core verify logic — called both from the button and directly after a QR scan
  // so the QR path can pass parsed values without waiting for state to settle.
  const runVerify = async (holder: string, hash: string) => {
    if (!holder || !hash) {
      toast({
        title: "Missing Fields",
        description: "Please enter both a holder address and a document hash.",
        variant: "destructive",
      });
      return;
    }

    if (!ethers.isAddress(holder)) {
      toast({
        title: "Invalid Address",
        description: "The holder address is not a valid Ethereum address.",
        variant: "destructive",
      });
      return;
    }

    // Accept "0x" prefixed or bare 64-char hex for the document hash
    const normalizedHash = hash.startsWith("0x") ? hash : `0x${hash}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedHash)) {
      toast({
        title: "Invalid Hash",
        description: "The document hash must be a 32-byte hex string (64 hex chars, with or without 0x prefix).",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      const provider = getReadOnlyProvider();
      const contract = getContract(provider);

      const [isValid, issuer, timestamp] = await contract.verifyCredential(holder, normalizedHash);

      if (!isValid && issuer === ethers.ZeroAddress) {
        setVerificationResult({
          isValid: false,
          error: "Credential not found on-chain. No record exists for this holder + hash combination.",
        });
        toast({
          title: "❌ Verification Failed",
          description: "Credential not found on the blockchain.",
          variant: "destructive",
        });
      } else {
        const dateIssued = new Date(Number(timestamp) * 1000).toISOString().split("T")[0];
        setVerificationResult({
          isValid: isValid as boolean,
          credentialTitle: "On-chain Verified Credential",
          studentName: holder,
          issuerName: issuer as string,
          dateIssued,
          error: isValid ? undefined : "This credential has been revoked by the issuing institution.",
        });
        if (isValid) {
          toast({
            title: "✅ Credential Verified",
            description: "This credential is valid and active on the blockchain.",
          });
        } else {
          toast({
            title: "❌ Credential Revoked",
            description: "This credential has been revoked.",
            variant: "destructive",
          });
        }
      }
    } catch (err) {
      console.error("Verification error:", err);
      setVerificationResult({
        isValid: false,
        error: "Failed to reach the blockchain. Check your network connection and try again.",
      });
      toast({
        title: "Network Error",
        description: "Could not connect to Sepolia. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = () => runVerify(holderAddress.trim(), documentHash.trim());

  // Camera scan loop: start on dialog open, stop on close or successful decode.
  // getUserMedia requires HTTPS or localhost — works in Vite dev server and on
  // any TLS-terminated deployment. Will fail silently on plain HTTP origins.
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          tick();
        }
      } catch (err: any) {
        if (!alive) return;
        setScanError(
          err.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access in your browser settings and try again."
            : "Could not start camera. Please check your device and try again.",
        );
      }
    }

    function tick() {
      if (!alive) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // Wait until the video has actual frame data
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
        // QR found — stop scanning and process the payload
        setScanOpen(false); // triggers cleanup via this effect's return
        try {
          const parsed = JSON.parse(code.data) as { holder?: unknown; documentHash?: unknown };
          if (typeof parsed.holder !== "string" || typeof parsed.documentHash !== "string") {
            throw new Error("missing fields");
          }
          setHolderAddress(parsed.holder);
          setDocumentHash(parsed.documentHash);
          // Call runVerify directly with the fresh values — don't wait for state to settle
          runVerify(parsed.holder, parsed.documentHash);
        } catch {
          toast({
            title: "Unrecognized QR code",
            description: "This QR code is not a CredVault credential.",
            variant: "destructive",
          });
        }
        return; // stop the tick loop
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
    setVerificationResult(null);
    setHolderAddress("");
    setDocumentHash("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Credential Verifier</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Instantly verify the authenticity of any blockchain-secured credential.
            Enter the holder's wallet address and the document hash.
          </p>
        </div>

        {/* Verification Input */}
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
                    if (e.key === 'Enter' && canVerify) handleVerify();
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
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleVerify}
                variant="hero"
                size="lg"
                className="flex-1 h-12"
                disabled={!canVerify}
              >
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

              {verificationResult && (
                <Button onClick={resetVerification} variant="outline" size="lg" className="h-12">
                  New Search
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Verification Result */}
        {verificationResult && (
          <Card className={`credential-card p-8 ${
            verificationResult.isValid ? 'border-success' : 'border-destructive'
          }`}>
            <div className="text-center mb-6">
              {verificationResult.isValid ? (
                <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-success" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
              )}

              <h2 className={`text-3xl font-bold mb-2 ${
                verificationResult.isValid ? 'text-success' : 'text-destructive'
              }`}>
                {verificationResult.isValid ? '✅ Credential Verified' : '❌ Verification Failed'}
              </h2>

              <p className="text-muted-foreground">
                {verificationResult.isValid
                  ? 'This credential is authentic and verified on the Sepolia blockchain.'
                  : verificationResult.error || 'This credential could not be verified.'}
              </p>
            </div>

            {verificationResult.isValid && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Credential Title</p>
                      <p className="font-semibold">{verificationResult.credentialTitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Holder Address</p>
                      <p className="font-semibold font-mono text-sm break-all">{verificationResult.studentName}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-success/20 rounded-full flex items-center justify-center">
                      <Building className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Issuer Address</p>
                      <p className="font-semibold font-mono text-sm break-all">{verificationResult.issuerName}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-glow/20 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary-glow" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date Issued</p>
                      <p className="font-semibold">
                        {verificationResult.dateIssued &&
                          new Date(verificationResult.dateIssued).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {verificationResult.transactionHash && (
                  <div className="md:col-span-2 mt-6 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Blockchain Transaction</p>
                        <p className="font-mono text-sm break-all">{verificationResult.transactionHash}</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View on Sepolia Explorer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!verificationResult.isValid && verificationResult.error && (
              <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive mb-1">Verification Error</p>
                    <p className="text-sm text-destructive/80">{verificationResult.error}</p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Info Section */}
        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold mb-4">How Verification Works</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6 text-primary" />
              </div>
              <p className="font-medium">Scan or Enter</p>
              <p className="text-sm text-muted-foreground">Use QR code or enter holder address and document hash</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <p className="font-medium">Blockchain Check</p>
              <p className="text-sm text-muted-foreground">Verify against Sepolia network</p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <p className="font-medium">Instant Result</p>
              <p className="text-sm text-muted-foreground">Get verification status immediately</p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Scanner Dialog */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at a CredVault credential QR code to auto-fill the verification form.
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
