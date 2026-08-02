/**
 * Presentation helpers. Nothing here reads the chain — these only format values
 * that src/lib has already produced.
 */
import { CONTRACT_ADDRESS } from "@/lib/contract";
import { IPFS_GATEWAYS, toCid } from "@/lib/ipfs";

const EXPLORER = "https://sepolia.etherscan.io";

/**
 * Middle-out truncation, the only way cryptographic material should ever be
 * shortened: both ends stay legible, so two values can be told apart at a glance.
 */
export function truncateMiddle(value: string, lead = 6, tail = 4): string {
  if (!value) return "";
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}…${value.slice(-tail)}`;
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function explorerBlockUrl(block: number | string): string {
  return `${EXPLORER}/block/${block}`;
}

export function contractUrl(): string {
  return explorerAddressUrl(CONTRACT_ADDRESS);
}

/** First public gateway for a pinned CID — for "open the raw ciphertext" links. */
export function ipfsUrl(uri: string): string {
  return `${IPFS_GATEWAYS[0]}${toCid(uri)}`;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(date: Date | null | undefined): string {
  return date ? DATE_FORMAT.format(date) : "—";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
