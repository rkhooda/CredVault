/**
 * Domain layer over the vault contract.
 *
 * Reads combine two sources: CredentialIssued events enumerate which credentials
 * exist for an address, then a point lookup per credential gives its current
 * state. Deriving status from events alone would mean replaying five event types
 * in order; a direct read is simpler and always correct.
 *
 * Metadata is decrypted here when a key is available locally, so the UI layer
 * never touches ciphertext.
 */
import { ethers } from "ethers";
import { getContract, getReadOnlyProvider, queryEventsFromDeployment } from "./contract";
import { decryptMetadata, importKey, type CredentialMetadata, type EncryptedPayload } from "./crypto";
import { fetchJson } from "./ipfs";
import { loadKey } from "./keyVault";

/** Mirrors CredentialVault.Status. */
export enum CredentialStatus {
  None = 0,
  Pending = 1,
  Active = 2,
  Rejected = 3,
  Revoked = 4,
}

export const STATUS_LABELS: Record<CredentialStatus, string> = {
  [CredentialStatus.None]: "Not found",
  [CredentialStatus.Pending]: "Awaiting your acceptance",
  [CredentialStatus.Active]: "Verified",
  [CredentialStatus.Rejected]: "Declined",
  [CredentialStatus.Revoked]: "Revoked",
};

export interface CredentialRecord {
  documentHash: string;
  holder: string;
  issuer: string;
  issuerName: string;
  status: CredentialStatus;
  isValid: boolean;
  isExpired: boolean;
  issuedAt: Date;
  expiresAt: Date | null;
  metadataURI: string;
  /** Decrypted contents, or null when no key is held locally. */
  metadata: CredentialMetadata | null;
  transactionHash: string;
}

/** Raw shape returned by verifyCredential. */
interface ChainView {
  isValid: boolean;
  isExpired: boolean;
  status: bigint;
  issuer: string;
  issuerName: string;
  issuedAt: bigint;
  expiresAt: bigint;
  metadataURI: string;
}

function toDate(seconds: bigint): Date {
  return new Date(Number(seconds) * 1000);
}

/** Fetches and decrypts metadata, returning null when unavailable rather than throwing. */
async function loadMetadata(documentHash: string, metadataURI: string): Promise<CredentialMetadata | null> {
  const exportedKey = loadKey(documentHash);
  if (!exportedKey || !metadataURI) return null;

  try {
    const payload = await fetchJson<EncryptedPayload>(metadataURI);
    return await decryptMetadata(payload, await importKey(exportedKey));
  } catch (err) {
    console.warn(`Could not read metadata for ${documentHash}:`, err);
    return null;
  }
}

async function buildRecords(
  events: (ethers.EventLog | ethers.Log)[],
  contract: ethers.Contract,
): Promise<CredentialRecord[]> {
  // Deduplicate: re-issuing after a rejection emits a second event for the same slot.
  const latest = new Map<string, ethers.EventLog>();
  for (const event of events) {
    const log = event as ethers.EventLog;
    const key = `${log.args.holder}-${log.args.documentHash}`.toLowerCase();
    const existing = latest.get(key);
    if (!existing || log.blockNumber > existing.blockNumber) latest.set(key, log);
  }

  return Promise.all(
    [...latest.values()].map(async (log): Promise<CredentialRecord> => {
      const holder: string = log.args.holder;
      const documentHash: string = log.args.documentHash;
      const view = (await contract.verifyCredential(holder, documentHash)) as unknown as ChainView;

      return {
        documentHash,
        holder,
        issuer: view.issuer,
        issuerName: view.issuerName || view.issuer,
        status: Number(view.status) as CredentialStatus,
        isValid: view.isValid,
        isExpired: view.isExpired,
        issuedAt: toDate(view.issuedAt),
        expiresAt: view.expiresAt === 0n ? null : toDate(view.expiresAt),
        metadataURI: view.metadataURI,
        metadata: await loadMetadata(documentHash, view.metadataURI),
        transactionHash: log.transactionHash,
      };
    }),
  );
}

/** Every credential issued to `holder`, newest first. */
export async function fetchCredentialsForHolder(holder: string): Promise<CredentialRecord[]> {
  const [events] = await queryEventsFromDeployment((contract) => [contract.filters.CredentialIssued(holder)]);
  const contract = getContract(getReadOnlyProvider());
  const records = await buildRecords(events, contract);
  return records.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
}

/** Every credential issued *by* `issuer`, newest first. */
export async function fetchCredentialsForIssuer(issuer: string): Promise<CredentialRecord[]> {
  const [events] = await queryEventsFromDeployment((contract) => [contract.filters.CredentialIssued(null, issuer)]);
  const contract = getContract(getReadOnlyProvider());
  const records = await buildRecords(events, contract);
  return records.sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
}

/**
 * Single-credential lookup for the verifier, who has no wallet and supplies the
 * decryption key out of band (via QR or share link).
 */
export async function verifyCredential(
  holder: string,
  documentHash: string,
  exportedKey?: string,
): Promise<CredentialRecord | null> {
  const contract = getContract(getReadOnlyProvider());
  const view = (await contract.verifyCredential(holder, documentHash)) as unknown as ChainView;

  if (Number(view.status) === CredentialStatus.None) return null;

  let metadata: CredentialMetadata | null = null;
  if (exportedKey && view.metadataURI) {
    try {
      const payload = await fetchJson<EncryptedPayload>(view.metadataURI);
      metadata = await decryptMetadata(payload, await importKey(exportedKey));
    } catch (err) {
      console.warn("Could not decrypt shared metadata:", err);
    }
  }

  return {
    documentHash,
    holder,
    issuer: view.issuer,
    issuerName: view.issuerName || view.issuer,
    status: Number(view.status) as CredentialStatus,
    isValid: view.isValid,
    isExpired: view.isExpired,
    issuedAt: toDate(view.issuedAt),
    expiresAt: view.expiresAt === 0n ? null : toDate(view.expiresAt),
    metadataURI: view.metadataURI,
    metadata,
    transactionHash: "",
  };
}

// --- Share payloads ---

export interface SharePayload {
  holder: string;
  documentHash: string;
  /** Exported AES key. Whoever holds this can read the credential's contents. */
  k?: string;
}

export function encodeSharePayload(payload: SharePayload): string {
  return JSON.stringify(payload);
}

export function decodeSharePayload(raw: string): SharePayload | null {
  try {
    const parsed = JSON.parse(raw) as SharePayload;
    if (!ethers.isAddress(parsed.holder)) return null;
    if (!/^0x[0-9a-fA-F]{64}$/.test(parsed.documentHash)) return null;
    return parsed;
  } catch {
    return null;
  }
}
