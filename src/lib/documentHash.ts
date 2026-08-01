/**
 * Document hashing.
 *
 * `documentHash` is keccak256 over the credential file's raw bytes. This is what
 * ties an on-chain record to a real document: a verifier holding the PDF can
 * recompute the hash and prove it is byte-identical to the one that was issued.
 *
 * The v1 scheme hashed keccak256(abi.encodePacked(address, title, type)) instead.
 * That was broken three ways: packed encoding of two dynamic strings collides
 * ("AB"+"C" and "A"+"BC" produce the same hash), the inputs were low-entropy
 * enough to brute-force from an address alone, and two credentials with the same
 * title could never coexist.
 */
import { keccak256 } from "ethers";

/** Largest file we will hash and pin. Keeps a stray upload from blowing the pin quota. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export class DocumentTooLargeError extends Error {
  constructor(size: number) {
    super(`Document is ${(size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.`);
    this.name = "DocumentTooLargeError";
  }
}

/** keccak256 of a file's bytes, as a 0x-prefixed 32-byte hex string. */
export async function hashFile(file: File | Blob): Promise<string> {
  if (file.size > MAX_DOCUMENT_BYTES) throw new DocumentTooLargeError(file.size);
  return hashBytes(new Uint8Array(await file.arrayBuffer()));
}

export function hashBytes(bytes: Uint8Array): string {
  return keccak256(bytes);
}

/** True when `file` is byte-identical to the document recorded on-chain. */
export async function fileMatchesHash(file: File | Blob, documentHash: string): Promise<boolean> {
  return (await hashFile(file)).toLowerCase() === documentHash.toLowerCase();
}
