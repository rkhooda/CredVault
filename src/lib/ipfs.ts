/**
 * IPFS storage for encrypted credential payloads.
 *
 * Pinning needs a Pinata credential. That credential never reaches the browser —
 * uploads go through a serverless proxy (see api/pin.ts) which holds the JWT
 * server-side. Set VITE_PIN_ENDPOINT to wherever that function is deployed.
 *
 * Reads need no credential at all: any public gateway can serve a CID, so
 * fetching falls over between gateways the same way RPC calls do in contract.ts.
 */
import type { EncryptedPayload } from "./crypto";

export const PIN_ENDPOINT: string = (import.meta.env.VITE_PIN_ENDPOINT as string | undefined) ?? "/api/pin";

/**
 * Public read gateways, tried in order. Free gateways rate-limit and go down
 * fairly often, so a single hardcoded one would make credentials look broken.
 */
export const IPFS_GATEWAYS: string[] = [
  (import.meta.env.VITE_IPFS_GATEWAY as string | undefined) ?? "",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
].filter(Boolean);

const FETCH_TIMEOUT_MS = 12_000;

export class PinningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PinningError";
  }
}

/** Strips an ipfs:// prefix, leaving a bare CID (plus any path). */
export function toCid(uri: string): string {
  return uri.replace(/^ipfs:\/\//, "").replace(/^\/ipfs\//, "");
}

export function toGatewayUrl(uri: string, gateway = IPFS_GATEWAYS[0]): string {
  return `${gateway}${toCid(uri)}`;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pins a JSON object and returns its ipfs:// URI.
 * @param name Human-readable label shown in the Pinata dashboard — not secret,
 *             so it must never contain plaintext credential details.
 */
export async function pinJson(payload: unknown, name: string): Promise<string> {
  let response: Response;
  try {
    response = await fetchWithTimeout(PIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "json", name, payload }),
    });
  } catch (err) {
    throw new PinningError(
      `Could not reach the pinning service at ${PIN_ENDPOINT}. ${err instanceof Error ? err.message : ""}`.trim(),
    );
  }

  if (!response.ok) {
    throw new PinningError(`Pinning failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }

  const { cid } = (await response.json()) as { cid?: string };
  if (!cid) throw new PinningError("Pinning service returned no CID.");
  return `ipfs://${cid}`;
}

/** Pins an already-encrypted blob. Convenience wrapper with a clearer name. */
export async function pinEncrypted(payload: EncryptedPayload, name: string): Promise<string> {
  return pinJson(payload, name);
}

/**
 * Fetches a pinned JSON object, trying each gateway until one responds.
 * @throws when every gateway fails.
 */
export async function fetchJson<T>(uri: string): Promise<T> {
  const cid = toCid(uri);
  let lastError: unknown = new Error("No IPFS gateways configured.");

  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await fetchWithTimeout(`${gateway}${cid}`);
      if (!response.ok) {
        lastError = new Error(`${gateway} returned ${response.status}`);
        continue;
      }
      return (await response.json()) as T;
    } catch (err) {
      lastError = err;
      console.warn(`IPFS gateway ${gateway} failed, trying next:`, err);
    }
  }

  throw new Error(
    `Could not load ${cid} from any IPFS gateway. ${lastError instanceof Error ? lastError.message : ""}`.trim(),
  );
}
