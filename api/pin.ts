/**
 * Serverless pinning proxy.
 *
 * Holds the Pinata credential server-side. Putting the JWT in the frontend
 * bundle would publish it to anyone who opens devtools, letting them write to
 * the account at will.
 *
 * Deploy target: Vercel (or any handler taking a Fetch Request and returning a
 * Response — Cloudflare Workers and Netlify Edge use the same shape). Point the
 * frontend at it with VITE_PIN_ENDPOINT.
 *
 * Required environment variable:
 *   PINATA_JWT   Pinata API key with pinJSONToIPFS permission
 *
 * Optional:
 *   ALLOWED_ORIGIN   CORS origin to allow (defaults to "*", tighten in production)
 */

export const config = { runtime: "edge" };

const PINATA_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

/** Refuse oversized bodies before spending an upstream call. */
const MAX_BODY_BYTES = 15 * 1024 * 1024;

interface PinRequest {
  kind?: string;
  name?: string;
  payload?: unknown;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return json({ error: "Pinning is not configured: PINATA_JWT is unset." }, 500);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: "Payload too large." }, 413);
  }

  let body: PinRequest;
  try {
    body = (await request.json()) as PinRequest;
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  if (body.payload === undefined || body.payload === null) {
    return json({ error: "Missing payload." }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(PINATA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        pinataContent: body.payload,
        // Metadata is visible in the Pinata dashboard, so the client is expected
        // to send an opaque label rather than anything about the credential.
        pinataMetadata: { name: (body.name ?? "credvault-payload").slice(0, 120) },
      }),
    });
  } catch (err) {
    return json({ error: `Could not reach Pinata: ${err instanceof Error ? err.message : "unknown error"}` }, 502);
  }

  if (!upstream.ok) {
    // Pass the status through but not the body — it can echo account details.
    return json({ error: `Pinata rejected the upload (${upstream.status}).` }, 502);
  }

  const result = (await upstream.json()) as { IpfsHash?: string };
  if (!result.IpfsHash) {
    return json({ error: "Pinata returned no CID." }, 502);
  }

  return json({ cid: result.IpfsHash });
}
