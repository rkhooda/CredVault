import { useState } from "react";
import { ethers } from "ethers";
import {
  ClipboardPaste,
  Database,
  ExternalLink,
  FileCheck2,
  Keyboard,
  Loader2,
  Lock,
  QrCode,
  RotateCcw,
  ScanLine,
  Search,
} from "lucide-react";
import { STATUS_META, displayStatus } from "@/components/credential/status";
import { AddressChip } from "@/components/data/AddressChip";
import { HashDisplay } from "@/components/data/HashDisplay";
import { CiphertextProof, ProofPanel, ProofRow } from "@/components/data/ProofPanel";
import { ErrorState } from "@/components/feedback/States";
import { DocumentCheck } from "@/components/verify/DocumentCheck";
import { QrScanner } from "@/components/verify/QrScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CONTRACT_ADDRESS, DEPLOYMENT_BLOCK } from "@/lib/contract";
import { decodeSharePayload, verifyCredential, type CredentialRecord } from "@/lib/credentials";
import { contractUrl, explorerBlockUrl, formatDate, ipfsUrl } from "@/utils/format";

const HOW_IT_WORKS = [
  {
    icon: ScanLine,
    title: "Take the holder's code",
    body: "A share code or QR carries three things: the holder's address, the document hash, and optionally the key that decrypts the details.",
  },
  {
    icon: Database,
    title: "Read Sepolia directly",
    body: "The record is fetched from the contract over a public RPC. No account, no API key, and no request to the issuing institution.",
  },
  {
    icon: FileCheck2,
    title: "Re-hash the document",
    body: "Hashing the file you were given and comparing it to the on-chain hash proves it is byte-for-byte the one that was issued.",
  },
];

type Phase = "idle" | "verifying" | "done" | "notfound" | "failed";

export default function VerifierPage() {
  const { toast } = useToast();

  const [holder, setHolder] = useState("");
  const [hash, setHash] = useState("");
  const [pasted, setPasted] = useState("");
  const [key, setKey] = useState<string | undefined>();

  const [record, setRecord] = useState<CredentialRecord | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  /** Runs against explicit values, since the QR path cannot wait for state. */
  const run = async (holderValue: string, hashValue: string, keyValue?: string) => {
    const normalisedHash = hashValue.startsWith("0x") ? hashValue : `0x${hashValue}`;

    if (!ethers.isAddress(holderValue)) {
      toast({ title: "Invalid address", description: "That is not a valid Ethereum address.", variant: "destructive" });
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalisedHash)) {
      toast({
        title: "Invalid document hash",
        description: "A document hash is 64 hexadecimal characters.",
        variant: "destructive",
      });
      return;
    }

    setPhase("verifying");
    setRecord(null);
    setError(null);

    try {
      const result = await verifyCredential(holderValue, normalisedHash, keyValue);
      if (!result) {
        setPhase("notfound");
        return;
      }
      setRecord(result);
      setPhase("done");
    } catch (err) {
      console.error("Verification failed:", err);
      setError("No Sepolia endpoint responded. Public RPCs rate-limit; another attempt usually lands on a healthy one.");
      setPhase("failed");
    }
  };

  /** Share payloads and QR codes carry the same JSON, so both land here. */
  const acceptPayload = (raw: string) => {
    const payload = decodeSharePayload(raw.trim());
    if (!payload) {
      toast({
        title: "Not a CredVault code",
        description: "Paste the whole share code, including the braces.",
        variant: "destructive",
      });
      return;
    }
    setHolder(payload.holder);
    setHash(payload.documentHash);
    setKey(payload.k);
    run(payload.holder, payload.documentHash, payload.k);
  };

  const reset = () => {
    setHolder("");
    setHash("");
    setPasted("");
    setKey(undefined);
    setRecord(null);
    setError(null);
    setPhase("idle");
  };

  const verifying = phase === "verifying";
  const status = record ? displayStatus(record) : "none";
  const meta = STATUS_META[status];
  const VerdictIcon = meta.icon;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Verify a credential</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Reads the record straight from the contract on Sepolia. You do not need an account, a wallet, or permission
          from the institution that issued it.
        </p>
      </header>

      {/* Three ways in, given equal weight */}
      <div className="mt-8 rounded-lg border border-border bg-card p-5 sm:p-6">
        <Tabs defaultValue="paste">
          <TabsList className="w-full">
            <TabsTrigger value="paste" className="flex-1">
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Paste code</span>
              <span className="sm:hidden">Paste</span>
            </TabsTrigger>
            <TabsTrigger value="scan" className="flex-1">
              <QrCode className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Scan QR</span>
              <span className="sm:hidden">Scan</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">
              <Keyboard className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Enter manually</span>
              <span className="sm:hidden">Manual</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste" className="mt-5">
            <Label htmlFor="payload">Share code</Label>
            <Textarea
              id="payload"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={3}
              placeholder='{"holder":"0x…","documentHash":"0x…","k":"…"}'
              className="mt-1.5 font-mono text-xs"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              If the code includes a key, the credential's details are decrypted in your browser. Without one you can
              still confirm it is valid.
            </p>
            <Button className="mt-4 w-full" onClick={() => acceptPayload(pasted)} disabled={verifying || !pasted.trim()}>
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              Verify
            </Button>
          </TabsContent>

          <TabsContent value="scan" className="mt-5">
            <QrScanner onDecode={acceptPayload} />
          </TabsContent>

          <TabsContent value="manual" className="mt-5">
            <div className="space-y-4">
              <div>
                <Label htmlFor="holder">Holder wallet address</Label>
                <Input
                  id="holder"
                  value={holder}
                  onChange={(e) => setHolder(e.target.value)}
                  placeholder="0x…"
                  className="mt-1.5 font-mono text-xs"
                />
              </div>
              <div>
                <Label htmlFor="hash">Document hash</Label>
                <Input
                  id="hash"
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && run(holder.trim(), hash.trim(), key)}
                  placeholder="0x… (64 hex characters)"
                  className="mt-1.5 font-mono text-xs"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => run(holder.trim(), hash.trim(), key)}
                disabled={verifying || !holder.trim() || !hash.trim()}
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="h-4 w-4" aria-hidden="true" />
                )}
                Verify
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {verifying && (
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Reading the contract on Sepolia…
        </p>
      )}

      {phase === "failed" && error && (
        <div className="mt-6">
          <ErrorState message={error} onRetry={() => run(holder.trim(), hash.trim(), key)} />
        </div>
      )}

      {phase === "notfound" && (
        <div className="animate-reveal mt-6 rounded-lg border-2 border-border-strong bg-muted/40 p-6">
          <h2 className="text-xl font-semibold">No such credential</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Nothing has ever been issued to that address under that document hash. Either the code is wrong, or the
            credential it refers to was never recorded on this contract.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Start over
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------------ verdict */}
      {phase === "done" && record && (
        <div className="animate-reveal mt-6 space-y-5">
          <section
            className={`rounded-lg border-2 p-5 sm:p-6 ${
              meta.isGood ? "border-success/40 bg-success/5" : "border-border-strong bg-muted/40"
            }`}
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <VerdictIcon className={`mt-0.5 h-7 w-7 shrink-0 ${meta.textClass}`} aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className={`text-2xl font-semibold tracking-tight ${meta.textClass}`}>{meta.label}</h2>
                  <p className="mt-1 text-sm text-foreground/80">{meta.description}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                New check
              </Button>
            </div>

            <div className="rule-engraved my-5" />

            <dl className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Issued by</dt>
                <dd className="mt-1">
                  <div className="font-serif text-lg font-semibold">{record.issuerName}</div>
                  <div className="mt-1">
                    <AddressChip address={record.issuer} size="sm" />
                  </div>
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Credential</dt>
                <dd className="mt-1 text-sm">
                  {record.metadata ? (
                    <>
                      <span className="font-medium">{record.metadata.title}</span>
                      {record.metadata.type && (
                        <span className="ml-2 capitalize text-muted-foreground">{record.metadata.type}</span>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                      Encrypted — no key supplied
                    </span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Holder</dt>
                <dd className="mt-1">
                  <AddressChip address={record.holder} name={record.metadata?.holderName} size="sm" />
                </dd>
              </div>

              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Issued</dt>
                <dd className="mt-1 text-sm tabular-nums">{formatDate(record.issuedAt)}</dd>
              </div>

              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Expires</dt>
                <dd className={`mt-1 text-sm tabular-nums ${status === "expired" ? "font-medium text-warning" : ""}`}>
                  {record.expiresAt ? formatDate(record.expiresAt) : "Never"}
                </dd>
              </div>

              {record.metadata?.description && (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Details</dt>
                  <dd className="mt-1 text-sm leading-relaxed">{record.metadata.description}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* The strongest claim gets its own panel */}
          <DocumentCheck documentHash={record.documentHash} />

          <ProofPanel title="Proof" description="what this verdict was read from">
            <ProofRow label="Document hash">
              <HashDisplay value={record.documentHash} variant="block" />
            </ProofRow>
            {record.metadataURI && (
              <ProofRow label="Metadata CID">
                <HashDisplay value={record.metadataURI} href={ipfsUrl(record.metadataURI)} variant="block" />
              </ProofRow>
            )}
            <ProofRow label="Contract">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <HashDisplay value={CONTRACT_ADDRESS} href={contractUrl()} lead={8} tail={6} />
                <a
                  href={explorerBlockUrl(DEPLOYMENT_BLOCK)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Sepolia
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            </ProofRow>
          </ProofPanel>

          {record.metadataURI && (
            <ProofPanel title="What is actually stored" description="ciphertext vs. decrypted">
              <CiphertextProof metadataURI={record.metadataURI} decrypted={record.metadata} />
            </ProofPanel>
          )}
        </div>
      )}

      {/* --------------------------------------------------- how it works */}
      {phase === "idle" && (
        <section className="mt-12" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-sm font-semibold">
            How verification works
          </h2>

          <ol className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="bg-background p-5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-md border border-border bg-muted">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-medium">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              );
            })}
          </ol>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Steps two and three are independent. The chain tells you the credential is real and still valid; the hash
            tells you the paper in your hand is the one it was issued for. A forged document fails the second check even
            when the first passes.
          </p>
        </section>
      )}
    </div>
  );
}
