/**
 * Client-side encryption for credential metadata.
 *
 * Everything pinned to IPFS is public and permanent, so nothing readable goes
 * there. Each credential gets its own AES-256-GCM key; the chain proves the
 * credential is valid, the key decides who can read what it says.
 *
 * Key derivation
 * --------------
 *   K = HKDF-SHA256( issuerSignature("CredVault-key-v1|<holder>|<documentHash>") )
 *
 * ECDSA signing is deterministic (RFC 6979), so the issuing institution can
 * regenerate K at any time by re-signing the same message. That means no key
 * database anywhere, and a student who loses their local copy can always be
 * re-issued the key by the institution that granted the credential.
 *
 * Trade-offs, stated plainly:
 *   - the issuer can always decrypt what it issued (expected for a registrar)
 *   - this leans on deterministic ECDSA; a production system would encrypt K to
 *     the holder's public key, which needs a pubkey the holder has published
 *   - holders can also export a passphrase-protected backup of their keys
 *
 * Uses only Web Crypto — no dependencies.
 */
import type { Signer } from "ethers";
import { getBytes } from "ethers";

const KEY_DERIVATION_DOMAIN = "CredVault-key-v1";
const HKDF_INFO = "credvault-metadata-key";
const PBKDF2_ITERATIONS = 310_000; // OWASP 2023 guidance for PBKDF2-HMAC-SHA256
const IV_BYTES = 12; // AES-GCM standard nonce length

/** Decrypted contents of a credential. Never leaves the browser in plaintext. */
export interface CredentialMetadata {
  title: string;
  type: string;
  description?: string;
  holderName?: string;
  issuerName: string;
  issuedAt: string;
  documentHash: string;
  documentName?: string;
  /** IPFS CID of the encrypted credential file, when one was uploaded. */
  documentCid?: string;
}

/** An AES-GCM ciphertext plus the nonce needed to open it. */
export interface EncryptedPayload {
  v: 1;
  iv: string;
  data: string;
}

// --- base64url helpers (Buffer is not available in the browser) ---

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

// --- Key derivation ---

/** The exact message an issuer signs to derive a credential's key. */
export function keyDerivationMessage(holder: string, documentHash: string): string {
  return `${KEY_DERIVATION_DOMAIN}|${holder.toLowerCase()}|${documentHash.toLowerCase()}`;
}

/**
 * Derives a credential's encryption key from the issuer's signature.
 * Deterministic: the same issuer, holder and document always yield the same key.
 */
export async function deriveCredentialKey(
  signer: Signer,
  holder: string,
  documentHash: string,
): Promise<CryptoKey> {
  const signature = await signer.signMessage(keyDerivationMessage(holder, documentHash));
  return hkdfKeyFrom(getBytes(signature), getBytes(documentHash));
}

async function hkdfKeyFrom(inputKeyMaterial: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", inputKeyMaterial as BufferSource, "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as BufferSource,
      info: new TextEncoder().encode(HKDF_INFO),
    },
    material,
    { name: "AES-GCM", length: 256 },
    true, // extractable, so the holder can share it with a verifier
    ["encrypt", "decrypt"],
  );
}

// --- Key transport ---

/** Serialises a key for a QR payload or share link. */
export async function exportKey(key: CryptoKey): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

export async function importKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromBase64Url(encoded) as BufferSource, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// --- Encryption ---

export async function encryptBytes(plaintext: Uint8Array, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext as BufferSource);
  return { v: 1, iv: toBase64Url(iv), data: toBase64Url(new Uint8Array(ciphertext)) };
}

export async function decryptBytes(payload: EncryptedPayload, key: CryptoKey): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(payload.iv) as BufferSource },
    key,
    fromBase64Url(payload.data) as BufferSource,
  );
  return new Uint8Array(plaintext);
}

export async function encryptMetadata(metadata: CredentialMetadata, key: CryptoKey): Promise<EncryptedPayload> {
  return encryptBytes(new TextEncoder().encode(JSON.stringify(metadata)), key);
}

/** @throws if the key is wrong — AES-GCM authentication fails rather than returning junk. */
export async function decryptMetadata(payload: EncryptedPayload, key: CryptoKey): Promise<CredentialMetadata> {
  const plaintext = await decryptBytes(payload, key);
  return JSON.parse(new TextDecoder().decode(plaintext)) as CredentialMetadata;
}

// --- Passphrase-protected key backup ---

/** Map of documentHash -> exported credential key. */
export type KeyBackup = Record<string, string>;

async function passphraseKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Wraps a holder's credential keys under a passphrase so they can be moved
 * between devices. Losing every copy of a key means the metadata is
 * unrecoverable except by asking the issuer to re-derive it.
 */
export async function exportKeyBackup(keys: KeyBackup, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapped = await encryptBytes(new TextEncoder().encode(JSON.stringify(keys)), await passphraseKey(passphrase, salt));
  return JSON.stringify({ v: 1, kdf: "PBKDF2", iterations: PBKDF2_ITERATIONS, salt: toBase64Url(salt), ...wrapped }, null, 2);
}

export async function importKeyBackup(backupJson: string, passphrase: string): Promise<KeyBackup> {
  const parsed = JSON.parse(backupJson) as EncryptedPayload & { salt: string };
  if (!parsed.salt || !parsed.iv || !parsed.data) throw new Error("Not a valid CredVault key backup.");

  const plaintext = await decryptBytes(parsed, await passphraseKey(passphrase, fromBase64Url(parsed.salt)));
  return JSON.parse(new TextDecoder().decode(plaintext)) as KeyBackup;
}
