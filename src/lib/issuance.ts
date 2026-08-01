/**
 * The full issuance flow: hash the document, encrypt it and its metadata,
 * pin both to IPFS, then record the hash and CID on-chain.
 *
 * Ordering matters. Pinning happens before the transaction so a confirmed
 * on-chain record always points at content that exists. A failed pin costs
 * nothing; a confirmed credential pointing at a dead CID would be permanent.
 */
import { ethers } from "ethers";
import { getContract } from "./contract";
import { encryptBytes, encryptMetadata, deriveCredentialKey, exportKey, type CredentialMetadata } from "./crypto";
import { hashFile } from "./documentHash";
import { pinEncrypted } from "./ipfs";
import { encodeSharePayload } from "./credentials";

export interface IssueRequest {
  holder: string;
  title: string;
  type: string;
  description?: string;
  holderName?: string;
  /** The credential document. Optional, but without one there is nothing to prove later. */
  file?: File | null;
  expiresAt?: Date | null;
}

export interface IssueResult {
  documentHash: string;
  metadataURI: string;
  exportedKey: string;
  transactionHash: string;
  /** Payload for the claim QR handed to the student — carries the decryption key. */
  claimPayload: string;
}

export type IssueStage =
  | "hashing"
  | "deriving-key"
  | "encrypting-document"
  | "pinning-document"
  | "pinning-metadata"
  | "awaiting-signature"
  | "confirming";

const STAGE_MESSAGES: Record<IssueStage, string> = {
  hashing: "Hashing document…",
  "deriving-key": "Sign to derive the encryption key…",
  "encrypting-document": "Encrypting document…",
  "pinning-document": "Uploading document to IPFS…",
  "pinning-metadata": "Uploading encrypted metadata…",
  "awaiting-signature": "Confirm the transaction in your wallet…",
  confirming: "Waiting for confirmation…",
};

export function stageMessage(stage: IssueStage): string {
  return STAGE_MESSAGES[stage];
}

export class IssuanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IssuanceError";
  }
}

/**
 * @param issuerName Display name of the institution, read from the on-chain registry.
 * @param onStage    Progress callback, so the UI can explain a multi-step flow.
 */
export async function issueCredential(
  signer: ethers.Signer,
  issuerName: string,
  request: IssueRequest,
  onStage: (stage: IssueStage) => void = () => {},
): Promise<IssueResult> {
  const holder = ethers.getAddress(request.holder.trim());

  // Without a document there is nothing to bind to, so fall back to a random
  // 32-byte identifier. Still unguessable and collision-free; it simply cannot
  // support the "prove this file is the issued one" check later.
  onStage("hashing");
  const documentHash = request.file
    ? await hashFile(request.file)
    : ethers.hexlify(ethers.randomBytes(32));

  onStage("deriving-key");
  const key = await deriveCredentialKey(signer, holder, documentHash);
  const exportedKey = await exportKey(key);

  let documentCid: string | undefined;
  if (request.file) {
    onStage("encrypting-document");
    const encryptedFile = await encryptBytes(new Uint8Array(await request.file.arrayBuffer()), key);
    onStage("pinning-document");
    documentCid = await pinEncrypted(encryptedFile, `credvault-doc-${documentHash.slice(2, 12)}`);
  }

  const metadata: CredentialMetadata = {
    title: request.title.trim(),
    type: request.type,
    description: request.description?.trim() || undefined,
    holderName: request.holderName?.trim() || undefined,
    issuerName,
    issuedAt: new Date().toISOString(),
    documentHash,
    documentName: request.file?.name,
    documentCid,
  };

  onStage("pinning-metadata");
  const metadataURI = await pinEncrypted(
    await encryptMetadata(metadata, key),
    `credvault-meta-${documentHash.slice(2, 12)}`,
  );

  const expiresAt = request.expiresAt ? Math.floor(request.expiresAt.getTime() / 1000) : 0;
  if (expiresAt !== 0 && expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new IssuanceError("Expiry date must be in the future.");
  }

  onStage("awaiting-signature");
  const contract = getContract(signer);
  const tx = await contract.issueCredential(holder, documentHash, metadataURI, expiresAt);

  onStage("confirming");
  const receipt = await tx.wait();

  return {
    documentHash,
    metadataURI,
    exportedKey,
    transactionHash: receipt.hash,
    claimPayload: encodeSharePayload({ holder, documentHash, k: exportedKey }),
  };
}

/** Maps wallet and contract errors to something a user can act on. */
export function describeError(err: unknown): string {
  const e = err as { code?: unknown; reason?: string; shortMessage?: string; message?: string; info?: { error?: { code?: number } } };

  if (e?.code === 4001 || e?.code === "ACTION_REJECTED" || e?.info?.error?.code === 4001) {
    return "Rejected in wallet.";
  }
  const named: Record<string, string> = {
    CredentialAlreadyExists: "This exact document has already been issued to this holder.",
    EmptyDocumentHash: "The document hash is empty.",
    EmptyMetadataURI: "Metadata was not uploaded.",
    ExpiryInPast: "Expiry date must be in the future.",
    NotIssuingInstitution: "Only the institution that issued this credential can change it.",
    CredentialNotFound: "No such credential on-chain.",
    CredentialNotRevocable: "This credential cannot be revoked in its current state.",
    CredentialNotPending: "This credential is no longer awaiting a decision.",
    EnforcedPause: "Issuance is paused by the platform admin.",
    ZeroAddress: "The holder address is invalid.",
  };
  const raw = e?.reason ?? e?.shortMessage ?? e?.message ?? "Transaction failed.";
  for (const [name, friendly] of Object.entries(named)) {
    if (raw.includes(name)) return friendly;
  }
  return raw.length > 140 ? `${raw.slice(0, 140)}…` : raw;
}
