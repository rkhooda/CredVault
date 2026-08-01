/**
 * Local store for credential decryption keys.
 *
 * This is the one thing that legitimately belongs in localStorage: keys, never
 * credential data. Everything a credential *says* lives encrypted on IPFS and
 * is reachable from any device; only the key to read it is held locally.
 *
 * Losing this store is recoverable two ways: restore a passphrase-protected
 * backup (see crypto.ts), or ask the issuing institution to re-derive the key,
 * which it can always do by re-signing.
 */
import type { KeyBackup } from "./crypto";

const STORAGE_PREFIX = "credvault_key_";

function storageKey(documentHash: string): string {
  return `${STORAGE_PREFIX}${documentHash.toLowerCase()}`;
}

export function saveKey(documentHash: string, exportedKey: string): void {
  try {
    localStorage.setItem(storageKey(documentHash), exportedKey);
  } catch (err) {
    // Private browsing and full quotas both throw here. The credential itself is
    // unaffected — only local convenience is lost.
    console.warn("Could not persist credential key:", err);
  }
}

export function loadKey(documentHash: string): string | null {
  return localStorage.getItem(storageKey(documentHash));
}

export function removeKey(documentHash: string): void {
  localStorage.removeItem(storageKey(documentHash));
}

/** Every stored key, keyed by document hash — the shape used for backups. */
export function allKeys(): KeyBackup {
  const keys: KeyBackup = {};
  for (let i = 0; i < localStorage.length; i++) {
    const name = localStorage.key(i);
    if (name?.startsWith(STORAGE_PREFIX)) {
      const value = localStorage.getItem(name);
      if (value) keys[name.slice(STORAGE_PREFIX.length)] = value;
    }
  }
  return keys;
}

/** Merges a restored backup into local storage. Returns how many keys were added. */
export function mergeKeys(keys: KeyBackup): number {
  let added = 0;
  for (const [documentHash, exportedKey] of Object.entries(keys)) {
    if (!loadKey(documentHash)) added++;
    saveKey(documentHash, exportedKey);
  }
  return added;
}
