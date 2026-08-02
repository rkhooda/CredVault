import { useCallback, useEffect, useState } from "react";
import type { ethers } from "ethers";
import { queryEventsFromDeployment } from "@/lib/contract";
import { verifyCredential, type CredentialRecord } from "@/lib/credentials";

export interface ChainFacts {
  /** Distinct credentials ever issued on this contract. */
  credentials: number;
  /** Distinct institutions that have issued at least one. */
  issuers: number;
  /** Height of the most recent issuance, for a "last activity" reading. */
  latestBlock: number | null;
  /**
   * The most recently issued credential, offered as a prefill for the live
   * demo. Only its holder and document hash — both already public on-chain.
   * The contents stay encrypted, which is the point being demonstrated.
   */
  sample: { holder: string; documentHash: string } | null;
  /**
   * The same credential resolved to a full record, for display as a specimen.
   * Fetched without a key, so its metadata is null — which is precisely what a
   * passer-by sees, and the reason the specimen is safe to show at all.
   */
  sampleRecord: CredentialRecord | null;
}

interface State {
  facts: ChainFacts | null;
  loading: boolean;
  error: string | null;
}

/**
 * Reads the contract's real issuance history.
 *
 * This exists so the landing page can state actual numbers. The previous
 * version shipped "50K+ Verified Credentials" and "200+ Partner Institutions",
 * which were invented; anything that cannot be read from the chain should be
 * absent rather than imagined.
 *
 * The scan walks event logs back to the deployment block and is genuinely slow
 * on a cold public RPC, so callers must render a loading state.
 */
export function useChainFacts(): State & { retry: () => void } {
  const [state, setState] = useState<State>({ facts: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setState({ facts: null, loading: true, error: null });

    queryEventsFromDeployment((contract) => [contract.filters.CredentialIssued()])
      .then(([events]) => {
        if (!alive) return;

        const seen = new Set<string>();
        const issuers = new Set<string>();
        let latest: ethers.EventLog | null = null;

        for (const event of events) {
          const log = event as ethers.EventLog;
          if (!log.args) continue;
          seen.add(`${log.args.holder}-${log.args.documentHash}`.toLowerCase());
          issuers.add(String(log.args.issuer).toLowerCase());
          if (!latest || log.blockNumber > latest.blockNumber) latest = log;
        }

        const sample = latest
          ? { holder: String(latest.args.holder), documentHash: String(latest.args.documentHash) }
          : null;

        setState({
          loading: false,
          error: null,
          facts: {
            credentials: seen.size,
            issuers: issuers.size,
            latestBlock: latest?.blockNumber ?? null,
            sample,
            sampleRecord: null,
          },
        });

        // Resolve the specimen separately so the counts are not held up by it.
        if (sample) {
          verifyCredential(sample.holder, sample.documentHash)
            .then((sampleRecord) => {
              if (alive && sampleRecord) {
                setState((prev) => (prev.facts ? { ...prev, facts: { ...prev.facts, sampleRecord } } : prev));
              }
            })
            .catch(() => {
              /* The specimen is a nicety; the page is complete without it. */
            });
        }
      })
      .catch((err) => {
        if (!alive) return;
        console.warn("Could not read chain facts:", err);
        setState({ facts: null, loading: false, error: "No Sepolia endpoint responded." });
      });

    return () => {
      alive = false;
    };
  }, [attempt]);

  return { ...state, retry };
}
