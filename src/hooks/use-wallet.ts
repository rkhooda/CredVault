import { useCallback, useEffect, useState } from "react";
import { CHAIN_ID, getInjectedProvider } from "@/lib/contract";

export type WalletRole = "student" | "institution";

/** Storage keys the portals already write on connect. */
export const WALLET_STORAGE_KEY: Record<WalletRole, string> = {
  student: "credvault_student_wallet",
  institution: "credvault_institution_wallet",
};

/** Minimal EIP-1193 event surface; ethers' type only models `request`. */
type EventfulProvider = {
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
};

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  11155111: "Sepolia",
  137: "Polygon",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
};

export function chainName(chainId: number | null): string {
  if (chainId === null) return "Unknown network";
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}

export interface WalletState {
  /** Address this section connected with, as stored at login. */
  address: string | null;
  chainId: number | null;
  /** False whenever the wallet has wandered off Sepolia — writes will fail. */
  onExpectedChain: boolean;
  disconnect: () => void;
}

/**
 * Reads the connected account for a section of the app and tracks the wallet's
 * current network.
 *
 * The address is the one recorded at login, not whatever MetaMask happens to be
 * showing: switching accounts in the extension should not silently re-point a
 * dashboard at someone else's credentials. A change is picked up as a
 * disconnect instead, which sends the user back through the portal.
 */
export function useWallet(role: WalletRole | null): WalletState {
  const storageKey = role ? WALLET_STORAGE_KEY[role] : null;
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);

  useEffect(() => {
    setAddress(storageKey ? localStorage.getItem(storageKey) : null);
  }, [storageKey]);

  useEffect(() => {
    const ethereum = getInjectedProvider();
    if (!ethereum) return;

    let alive = true;
    const readChain = () =>
      ethereum
        .request({ method: "eth_chainId" })
        .then((id) => alive && setChainId(Number(id)))
        .catch(() => alive && setChainId(null));

    readChain();

    const eventful = ethereum as EventfulProvider;
    const onChainChanged = (id: unknown) => setChainId(Number(id));
    const onAccountsChanged = (accounts: unknown) => {
      // Wallet disconnected entirely, or switched to an account this section
      // was not authorised with.
      const list = accounts as string[];
      if (!storageKey) return;
      const stored = localStorage.getItem(storageKey);
      if (!list?.length || (stored && list[0]?.toLowerCase() !== stored.toLowerCase())) {
        localStorage.removeItem(storageKey);
        setAddress(null);
      }
    };

    eventful.on?.("chainChanged", onChainChanged as (...args: never[]) => void);
    eventful.on?.("accountsChanged", onAccountsChanged as (...args: never[]) => void);

    return () => {
      alive = false;
      eventful.removeListener?.("chainChanged", onChainChanged as (...args: never[]) => void);
      eventful.removeListener?.("accountsChanged", onAccountsChanged as (...args: never[]) => void);
    };
  }, [storageKey]);

  const disconnect = useCallback(() => {
    if (storageKey) localStorage.removeItem(storageKey);
    setAddress(null);
  }, [storageKey]);

  return {
    address,
    chainId,
    onExpectedChain: chainId === null || chainId === CHAIN_ID,
    disconnect,
  };
}
