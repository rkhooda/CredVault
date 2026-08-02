import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  FileCheck2,
  FileSignature,
  Loader2,
  Lock,
  Search,
  Wallet,
} from "lucide-react";
import { CredentialCard } from "@/components/credential/CredentialCard";
import { StatusBadge } from "@/components/credential/StatusBadge";
import { displayStatus } from "@/components/credential/status";
import { HashDisplay } from "@/components/data/HashDisplay";
import { CredentialCardSkeleton } from "@/components/feedback/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useChainFacts } from "@/hooks/use-chain-facts";
import { CHAIN_ID, CONTRACT_ADDRESS, DEPLOYMENT_BLOCK } from "@/lib/contract";
import { verifyCredential, type CredentialRecord } from "@/lib/credentials";
import { contractUrl, explorerBlockUrl, formatDate } from "@/utils/format";

/* -------------------------------------------------------------------------- */

function Hero({ record, loading }: { record: CredentialRecord | null; loading: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="grid-paper pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_minmax(0,0.95fr)] lg:gap-16 lg:px-8 lg:py-28">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.03] tracking-tight sm:text-5xl lg:text-[3.75rem]">
            Credentials anyone
            <br className="hidden sm:block" /> can <span className="text-primary">verify</span>.
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            The chain proves it. A hash binds it to the document. The student holds the only key that reads it.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="hero">
              <Link to="/verify">
                <Search className="h-4 w-4" aria-hidden="true" />
                Verify a credential
              </Link>
            </Button>
            <Button asChild variant="outline" size="hero">
              <Link to="/student-portal">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Open your wallet of credentials
              </Link>
            </Button>
          </div>
        </div>

        {/*
          A specimen, not a mock: this is the most recent credential actually
          issued on the contract, fetched without a key. That it reads
          "Encrypted credential" is the product working, not a placeholder.
        */}
        <div className="lg:pl-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            Latest credential on this contract
          </div>

          {loading || !record ? (
            <CredentialCardSkeleton />
          ) : (
            <div className="animate-reveal">
              <CredentialCard record={record} />
            </div>
          )}

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Read live from Sepolia with no key supplied — exactly what any passer-by sees. The issuer, dates and
            document hash are public; the title and holder are not.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

const FLOW = [
  {
    icon: FileSignature,
    party: "Institution",
    title: "Issues and signs",
    body: "The registrar hashes the document with keccak256 and writes that hash to the contract. Metadata is encrypted under a key derived from the issuer's own signature.",
    artefacts: ["keccak256(file) → documentHash", "AES-256-GCM(metadata) → ipfs://CID"],
  },
  {
    icon: Lock,
    party: "Student",
    title: "Accepts and holds",
    body: "Nothing lands in a student's name without their consent — acceptance is a transaction they sign. From then on they hold the key that makes the record readable.",
    artefacts: ["acceptCredential(documentHash)", "K stays on the holder's device"],
  },
  {
    icon: FileCheck2,
    party: "Verifier",
    title: "Checks, without asking",
    body: "Anyone reads the record straight from Sepolia. Given the key, they see what it says; given the file, they can prove it is byte-for-byte the document that was issued.",
    artefacts: ["verifyCredential(holder, hash)", "keccak256(their file) == documentHash"],
  },
];

function FlowSection() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Three parties, one record</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The chain proves validity. IPFS holds content, encrypted. The key travels only in what the student chooses to
          share.
        </p>

        <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
          {FLOW.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.party} className="flex flex-col bg-background p-6">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-md border border-border bg-muted">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {String(index + 1).padStart(2, "0")} · {step.party}
                  </span>
                </div>

                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

                <div className="mt-5 space-y-1.5 border-t border-border pt-4">
                  {step.artefacts.map((artefact) => (
                    <code key={artefact} className="block break-all font-mono text-[11px] text-muted-foreground">
                      {artefact}
                    </code>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function LiveDemo({ sample }: { sample: { holder: string; documentHash: string } | null }) {
  const [holder, setHolder] = useState("");
  const [hash, setHash] = useState("");
  const [record, setRecord] = useState<CredentialRecord | null>(null);
  const [state, setState] = useState<"idle" | "checking" | "missing" | "failed" | "done">("idle");

  const run = async () => {
    if (!holder.trim() || !hash.trim()) return;
    setState("checking");
    setRecord(null);
    try {
      const result = await verifyCredential(holder.trim(), hash.trim());
      if (!result) {
        setState("missing");
        return;
      }
      setRecord(result);
      setState("done");
    } catch {
      setState("failed");
    }
  };

  return (
    <section className="border-b border-border bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ask the chain yourself</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This queries the live contract from your browser over a public RPC. There is no server in the path, no
              account, and nothing to sign — which is exactly the claim being made.
            </p>
            {sample && (
              <Button
                variant="outline"
                size="sm"
                className="mt-5"
                onClick={() => {
                  setHolder(sample.holder);
                  setHash(sample.documentHash);
                  setState("idle");
                  setRecord(null);
                }}
              >
                Fill in a real credential from this contract
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="space-y-3">
              <div>
                <label htmlFor="demo-holder" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Holder address
                </label>
                <Input
                  id="demo-holder"
                  value={holder}
                  onChange={(event) => setHolder(event.target.value)}
                  placeholder="0x…"
                  className="mt-1.5 font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor="demo-hash" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Document hash
                </label>
                <Input
                  id="demo-hash"
                  value={hash}
                  onChange={(event) => setHash(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && run()}
                  placeholder="0x… (64 hex characters)"
                  className="mt-1.5 font-mono text-xs"
                />
              </div>
              <Button className="w-full" onClick={run} disabled={state === "checking" || !holder.trim() || !hash.trim()}>
                {state === "checking" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Reading Sepolia…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Read the record
                  </>
                )}
              </Button>
            </div>

            {state !== "idle" && state !== "checking" && (
              <div className="animate-reveal mt-4 rounded-md border border-border bg-muted/60 p-4">
                {state === "done" && record ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <StatusBadge status={displayStatus(record)} size="sm" />
                      <span className="text-xs text-muted-foreground">Issued {formatDate(record.issuedAt)}</span>
                    </div>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-muted-foreground">Issuer</dt>
                        <dd className="font-medium">{record.issuerName}</dd>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2">
                        <dt className="text-muted-foreground">Contents</dt>
                        <dd className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          Encrypted — no key supplied
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                      Validity is public. What the credential says is not — that needs the holder's key.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {state === "missing"
                      ? "No record exists on-chain for that holder and document hash."
                      : "No Sepolia endpoint responded. Public RPCs rate-limit; try again in a moment."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

const COMPARISON = [
  {
    question: "Proving the document was not altered",
    centralised: "A digital signature already does this, and does it well.",
    credvault: "The same guarantee, from a hash on a public ledger.",
    conceded: true,
  },
  {
    question: "Knowing it is still valid today",
    centralised: "Needs the operator's revocation list or API to be online, reachable and willing.",
    credvault: "A public read. Revocation is a transaction, attributable to the issuer who made it.",
  },
  {
    question: "Who can gate access to the record",
    centralised: "The operator — by policy, outage, account suspension or shutdown.",
    credvault: "Nobody. The record is readable by anyone for as long as the chain exists.",
  },
  {
    question: "What a verifier must have",
    centralised: "An account, an API key, or standing in the right jurisdiction's PKI.",
    credvault: "A public RPC endpoint.",
  },
];

function Comparison() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Why not a central registry</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Lockers like DigiLocker already issue signed documents, and a signature detects tampering perfectly well. That
          is not the difference. The difference is what has to still exist, still be online, and still be willing, at
          the moment someone checks.
        </p>

        <div className="mt-10 overflow-hidden rounded-lg border border-border">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-px bg-border md:grid">
            <div className="bg-muted px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Question
            </div>
            <div className="bg-muted px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Centralised locker
            </div>
            <div className="bg-muted px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-foreground">
              CredVault
            </div>
          </div>

          <div className="grid gap-px bg-border">
            {COMPARISON.map((row) => (
              <div
                key={row.question}
                className="grid gap-px bg-border md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
              >
                <div className="bg-background px-5 py-4 text-sm font-medium">
                  {row.question}
                  {/* Marked openly: overstating a draw would undermine the rest. */}
                  {row.conceded && (
                    <span className="mt-1 block text-[11px] font-normal uppercase tracking-wider text-muted-foreground">
                      No advantage
                    </span>
                  )}
                </div>
                <div className="bg-background px-5 py-4 text-sm text-muted-foreground">
                  <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground md:hidden">
                    Centralised locker
                  </span>
                  {row.centralised}
                </div>
                <div className={`bg-background px-5 py-4 text-sm ${row.conceded ? "text-muted-foreground" : ""}`}>
                  <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground md:hidden">
                    CredVault
                  </span>
                  {row.credvault}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What this design does not fix. Stated here rather than left to be found. */}
        <div className="mt-6 rounded-lg border border-border bg-background p-5">
          <h3 className="text-sm font-semibold">What this does not solve</h3>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <li>
              The on-chain record is permanent, but the encrypted contents live on IPFS and stay retrievable only while
              someone pins them. Today that is a pinning service — a centralised dependency for content, though not for
              proof.
            </li>
            <li>
              Keys are derived from the issuer's signature, deterministically. Contents are private from the public and
              from this platform, but never from the institution that issued them.
            </li>
            <li>
              Losing a wallet loses the ability to accept new credentials. There is no operator who can restore it for
              you — which is the trade being made, not an oversight.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-background p-5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

function OnChainFacts({ facts, loading, error, retry }: ReturnType<typeof useChainFacts>) {
  const counted = (value: number | undefined) => {
    if (loading) return <Skeleton className="h-5 w-12" />;
    if (error || value === undefined)
      return (
        <button type="button" onClick={retry} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
          unavailable — retry
        </button>
      );
    return <span className="text-lg font-semibold tabular-nums">{value}</span>;
  };

  return (
    <section className="border-b border-border bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What is actually deployed</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every figure here is read from the contract when this page loads. Nothing on this site is illustrative.
        </p>

        <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Contract">
            <HashDisplay value={CONTRACT_ADDRESS} href={contractUrl()} label="contract address" lead={8} tail={6} />
          </Fact>
          <Fact label="Network">
            <span className="inline-flex items-center gap-2">
              Sepolia
              <code className="font-mono text-xs text-muted-foreground">chainId {CHAIN_ID}</code>
            </span>
          </Fact>
          <Fact label="Deployed at block">
            <a
              href={explorerBlockUrl(DEPLOYMENT_BLOCK)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm tabular-nums underline-offset-2 hover:underline"
            >
              {DEPLOYMENT_BLOCK.toLocaleString()}
            </a>
          </Fact>
          <Fact label="Last issuance at block">
            {loading ? (
              <Skeleton className="h-5 w-20" />
            ) : facts?.latestBlock ? (
              <a
                href={explorerBlockUrl(facts.latestBlock)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm tabular-nums underline-offset-2 hover:underline"
              >
                {facts.latestBlock.toLocaleString()}
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </Fact>
          <Fact label="Credentials issued">{counted(facts?.credentials)}</Fact>
          <Fact label="Institutions issuing">{counted(facts?.issuers)}</Fact>
          <Fact label="Document binding">
            <code className="font-mono text-xs">keccak256</code>
          </Fact>
          <Fact label="Metadata at rest">
            <code className="font-mono text-xs">AES-256-GCM</code>
          </Fact>
        </div>

        {error && (
          <p className="mt-4 text-xs text-muted-foreground">
            Counts are rebuilt from event logs back to the deployment block. Free endpoints rate-limit that scan, so it
            occasionally needs a second attempt.
          </p>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

export default function Landing() {
  // One scan for the whole page: the demo prefill and the fact panel read the
  // same event history, and it is the most expensive call on the site.
  const chainFacts = useChainFacts();

  return (
    <div>
      <Hero record={chainFacts.facts?.sampleRecord ?? null} loading={chainFacts.loading} />
      <FlowSection />
      <LiveDemo sample={chainFacts.facts?.sample ?? null} />
      <Comparison />
      <OnChainFacts {...chainFacts} />

      <section>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Issue or hold a credential</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Students connect the wallet their credentials were issued to. Institutions need a wallet holding ISSUER_ROLE
            on the contract.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="hero">
              <Link to="/institution-portal">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Institution portal
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="hero">
              <Link to="/student-portal">
                <Wallet className="h-4 w-4" aria-hidden="true" />
                Student portal
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
