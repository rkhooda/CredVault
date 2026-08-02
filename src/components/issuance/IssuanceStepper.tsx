import { Check, Loader2 } from "lucide-react";
import { HashDisplay } from "@/components/data/HashDisplay";
import { cn } from "@/lib/utils";
import type { IssueStage } from "@/lib/issuance";
import { explorerTxUrl, ipfsUrl } from "@/utils/format";

interface Step {
  stage: IssueStage;
  title: string;
  detail: string;
  /** Only runs when a document was attached. */
  needsFile?: boolean;
}

const STEPS: Step[] = [
  { stage: "hashing", title: "Hash the document", detail: "keccak256 over the raw bytes" },
  { stage: "deriving-key", title: "Derive the encryption key", detail: "sign once; HKDF over the signature" },
  { stage: "encrypting-document", title: "Encrypt the document", detail: "AES-256-GCM", needsFile: true },
  { stage: "pinning-document", title: "Pin the document", detail: "encrypted, to IPFS", needsFile: true },
  { stage: "pinning-metadata", title: "Encrypt and pin metadata", detail: "title, holder and dates" },
  { stage: "awaiting-signature", title: "Sign the issuance", detail: "confirm in your wallet" },
  { stage: "confirming", title: "Wait for confirmation", detail: "one block on Sepolia" },
];

export interface IssuanceArtefacts {
  documentHash?: string;
  metadataURI?: string;
  transactionHash?: string;
}

interface IssuanceStepperProps {
  /** The stage currently running, or null once the run has finished. */
  current: IssueStage | null;
  hasFile: boolean;
  complete?: boolean;
  artefacts?: IssuanceArtefacts;
}

/**
 * Renders the real pipeline src/lib/issuance.ts emits, rather than a generic
 * spinner. Each step names what it produced, because "uploading…" tells an
 * issuer nothing about what is being trusted to whom.
 */
export function IssuanceStepper({ current, hasFile, complete = false, artefacts = {} }: IssuanceStepperProps) {
  const steps = STEPS.filter((step) => !step.needsFile || hasFile);
  const currentIndex = current ? steps.findIndex((step) => step.stage === current) : -1;

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const done = complete || (currentIndex > -1 && index < currentIndex);
        const active = !complete && index === currentIndex;
        const last = index === steps.length - 1;

        const artefact =
          step.stage === "hashing" && artefacts.documentHash ? (
            <HashDisplay value={artefacts.documentHash} label="documentHash" lead={10} tail={8} />
          ) : step.stage === "pinning-metadata" && artefacts.metadataURI ? (
            <HashDisplay
              value={artefacts.metadataURI}
              label="metadata CID"
              href={ipfsUrl(artefacts.metadataURI)}
              lead={12}
              tail={6}
            />
          ) : step.stage === "confirming" && artefacts.transactionHash ? (
            <HashDisplay
              value={artefacts.transactionHash}
              label="transaction"
              href={explorerTxUrl(artefacts.transactionHash)}
              lead={10}
              tail={8}
            />
          ) : null;

        return (
          <li key={step.stage} className="flex gap-3">
            {/* Rail: marker plus the connector down to the next step. */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-medium transition-colors",
                  done && "border-success bg-success text-success-foreground",
                  active && "border-primary bg-primary/10 text-primary",
                  !done && !active && "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              {!last && <span className={cn("w-px flex-1 transition-colors", done ? "bg-success/40" : "bg-border")} />}
            </div>

            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-5")}>
              <p
                className={cn(
                  "text-sm transition-colors",
                  active ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground">{step.detail}</p>
              {artefact && <div className="mt-1.5">{artefact}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
