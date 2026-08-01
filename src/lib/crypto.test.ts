import { describe, it, expect } from "vitest";
import { Wallet, keccak256, toUtf8Bytes } from "ethers";
import {
  deriveCredentialKey,
  keyDerivationMessage,
  encryptMetadata,
  decryptMetadata,
  encryptBytes,
  decryptBytes,
  exportKey,
  importKey,
  exportKeyBackup,
  importKeyBackup,
  type CredentialMetadata,
} from "./crypto";

const HOLDER = "0x20fE6a8AcA4e212Cd118e45c3D675Ba58FC4b522";
const DOC_HASH = keccak256(toUtf8Bytes("alice-degree.pdf"));
const OTHER_HASH = keccak256(toUtf8Bytes("bob-degree.pdf"));

const issuer = new Wallet(`0x${"11".repeat(32)}`);
const otherIssuer = new Wallet(`0x${"22".repeat(32)}`);

const METADATA: CredentialMetadata = {
  title: "Bachelor of Technology, Computer Science",
  type: "degree",
  description: "First class with distinction",
  holderName: "Alice Kumar",
  issuerName: "CredVault Demo University",
  issuedAt: "2026-08-01T00:00:00.000Z",
  documentHash: DOC_HASH,
  documentName: "degree.pdf",
};

describe("key derivation", () => {
  it("is deterministic for the same issuer, holder and document", async () => {
    const a = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const b = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    expect(await exportKey(a)).toBe(await exportKey(b));
  });

  it("survives a fresh signer instance, so the issuer can always recover a key", async () => {
    const first = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const reconstructed = new Wallet(`0x${"11".repeat(32)}`);
    const second = await deriveCredentialKey(reconstructed, HOLDER, DOC_HASH);
    expect(await exportKey(second)).toBe(await exportKey(first));
  });

  it("differs per document", async () => {
    const a = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const b = await deriveCredentialKey(issuer, HOLDER, OTHER_HASH);
    expect(await exportKey(a)).not.toBe(await exportKey(b));
  });

  it("differs per issuer, so one institution cannot read another's credentials", async () => {
    const mine = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const theirs = await deriveCredentialKey(otherIssuer, HOLDER, DOC_HASH);
    expect(await exportKey(mine)).not.toBe(await exportKey(theirs));
  });

  it("binds the holder address into the signed message", () => {
    expect(keyDerivationMessage(HOLDER, DOC_HASH)).toBe(
      `CredVault-key-v1|${HOLDER.toLowerCase()}|${DOC_HASH.toLowerCase()}`,
    );
  });

  it("normalises address casing so a checksummed address derives the same key", async () => {
    const upper = await deriveCredentialKey(issuer, HOLDER.toUpperCase().replace("0X", "0x"), DOC_HASH);
    const lower = await deriveCredentialKey(issuer, HOLDER.toLowerCase(), DOC_HASH);
    expect(await exportKey(upper)).toBe(await exportKey(lower));
  });
});

describe("metadata encryption", () => {
  it("round-trips", async () => {
    const key = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const decrypted = await decryptMetadata(await encryptMetadata(METADATA, key), key);
    expect(decrypted).toEqual(METADATA);
  });

  it("produces no plaintext in the pinned payload", async () => {
    const key = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const serialised = JSON.stringify(await encryptMetadata(METADATA, key));
    expect(serialised).not.toContain("Alice");
    expect(serialised).not.toContain("Bachelor");
    expect(serialised).not.toContain("distinction");
  });

  it("uses a fresh nonce each time, so identical metadata does not produce identical ciphertext", async () => {
    const key = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const first = await encryptMetadata(METADATA, key);
    const second = await encryptMetadata(METADATA, key);
    expect(first.iv).not.toBe(second.iv);
    expect(first.data).not.toBe(second.data);
  });

  it("refuses to decrypt with the wrong key rather than returning junk", async () => {
    const key = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const wrongKey = await deriveCredentialKey(otherIssuer, HOLDER, DOC_HASH);
    const payload = await encryptMetadata(METADATA, key);
    await expect(decryptMetadata(payload, wrongKey)).rejects.toThrow();
  });

  it("detects tampering with the ciphertext", async () => {
    const key = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const payload = await encryptMetadata(METADATA, key);
    const flipped = { ...payload, data: `A${payload.data.slice(1)}` };
    await expect(decryptMetadata(flipped, key)).rejects.toThrow();
  });
});

describe("key transport", () => {
  it("exports and re-imports a working key", async () => {
    const key = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const payload = await encryptMetadata(METADATA, key);

    // What a verifier receives in the QR payload.
    const shared = await importKey(await exportKey(key));
    expect(await decryptMetadata(payload, shared)).toEqual(METADATA);
  });

  it("encodes keys URL-safely for share links", async () => {
    const encoded = await exportKey(await deriveCredentialKey(issuer, HOLDER, DOC_HASH));
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("binary payloads", () => {
  it("round-trips a document's bytes", async () => {
    const key = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x80]);
    expect(await decryptBytes(await encryptBytes(bytes, key), key)).toEqual(bytes);
  });
});

describe("passphrase key backup", () => {
  it("restores keys on another device", async () => {
    const key = await deriveCredentialKey(issuer, HOLDER, DOC_HASH);
    const backup = { [DOC_HASH]: await exportKey(key) };

    const restored = await importKeyBackup(await exportKeyBackup(backup, "correct horse battery staple"), "correct horse battery staple");
    expect(restored).toEqual(backup);

    // The restored key really works.
    const payload = await encryptMetadata(METADATA, key);
    expect(await decryptMetadata(payload, await importKey(restored[DOC_HASH]))).toEqual(METADATA);
  });

  it("rejects the wrong passphrase", async () => {
    const backup = { [DOC_HASH]: await exportKey(await deriveCredentialKey(issuer, HOLDER, DOC_HASH)) };
    const file = await exportKeyBackup(backup, "right passphrase");
    await expect(importKeyBackup(file, "wrong passphrase")).rejects.toThrow();
  });

  it("stores no key material in the clear", async () => {
    const exported = await exportKey(await deriveCredentialKey(issuer, HOLDER, DOC_HASH));
    const file = await exportKeyBackup({ [DOC_HASH]: exported }, "pass");
    expect(file).not.toContain(exported);
  });

  it("rejects a file that is not a backup", async () => {
    await expect(importKeyBackup(JSON.stringify({ hello: "world" }), "pass")).rejects.toThrow(
      /not a valid credvault key backup/i,
    );
  });
});
