import { ethers } from "ethers";
import { CREDENTIAL_VAULT_ABI } from "./credentialVaultAbi";

export { CREDENTIAL_VAULT_ABI } from "./credentialVaultAbi";

// Block at which the contract was deployed — used as the floor for event-log scans.
export const DEPLOYMENT_BLOCK = 11398037;

// Fall back to hardcoded constants so the app works without a .env.local on other machines
export const CONTRACT_ADDRESS: string =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ??
  "0x26Eb4c3f71ab6735e6c4b5a04D88fa902c46C8B3";

export const CHAIN_ID: number =
  Number((import.meta.env.VITE_CHAIN_ID as string | undefined) ?? 11155111);

// Public Sepolia RPCs — no API key required. VITE_RPC_URL is tried first when set.
//
// The dashboards rebuild their credential list from event logs reaching back to
// DEPLOYMENT_BLOCK, so an endpoint is only usable here if it serves historical
// logs. Most free endpoints don't: publicnode (the previous default) rejects any
// eth_getLogs older than ~128 blocks with "Archive requests require a personal
// token", which is what broke credential loading entirely. Verified against the
// live contract: Tenderly and OnFinality both serve the full span in one call;
// drpc has the history but caps each request at 10k blocks, so it needs chunking.
// Ordered fastest-first — later entries are only reached when earlier ones fail.
export const RPC_URLS: string[] = [
  import.meta.env.VITE_RPC_URL as string | undefined,
  "https://sepolia.gateway.tenderly.co",
  "https://eth-sepolia.api.onfinality.io/public",
  "https://sepolia.drpc.org",
].filter((url): url is string => Boolean(url));

export const RPC_URL: string = RPC_URLS[0];

// Block span per eth_getLogs request when a provider rejects the full range.
const LOG_CHUNK_SIZE = 9_000;

// Per-request ceiling. Free endpoints tend to hang rather than refuse, and the
// dashboard blocks on these calls, so cap the wait and move to the next RPC.
const RPC_TIMEOUT_MS = 15_000;

/** Builds a Sepolia provider with a bounded request timeout. */
function createProvider(url: string): ethers.JsonRpcProvider {
  const request = new ethers.FetchRequest(url);
  request.timeout = RPC_TIMEOUT_MS;
  return new ethers.JsonRpcProvider(request, CHAIN_ID, { staticNetwork: true });
}

/** Returns a contract instance connected to the given provider or signer. */
export function getContract(providerOrSigner: ethers.ContractRunner) {
  return new ethers.Contract(CONTRACT_ADDRESS, CREDENTIAL_VAULT_ABI, providerOrSigner);
}

/**
 * Returns a read-only provider pointing at Sepolia.
 * Used for view calls that don't require a connected wallet.
 */
export function getReadOnlyProvider(): ethers.JsonRpcProvider {
  return createProvider(RPC_URL);
}

/** Scans DEPLOYMENT_BLOCK → head in LOG_CHUNK_SIZE windows, for range-capped RPCs. */
async function queryFilterChunked(
  contract: ethers.Contract,
  filter: ethers.DeferredTopicFilter,
  head: number,
): Promise<(ethers.EventLog | ethers.Log)[]> {
  const logs: (ethers.EventLog | ethers.Log)[] = [];
  for (let from = DEPLOYMENT_BLOCK; from <= head; from += LOG_CHUNK_SIZE) {
    const to = Math.min(from + LOG_CHUNK_SIZE - 1, head);
    logs.push(...(await contract.queryFilter(filter, from, to)));
  }
  return logs;
}

/**
 * Runs event-log queries from DEPLOYMENT_BLOCK to head, trying each RPC in
 * RPC_URLS until one succeeds. All filters resolve against the same provider,
 * so a partial view can't mix results from nodes at different heights.
 *
 * Providers that reject the full span are retried in chunks before moving on —
 * that covers range-capped endpoints without penalising ones that accept it
 * in a single call. Throws the last error if every provider fails.
 */
export async function queryEventsFromDeployment(
  buildFilters: (contract: ethers.Contract) => ethers.DeferredTopicFilter[],
): Promise<(ethers.EventLog | ethers.Log)[][]> {
  let lastError: unknown = new Error("No Sepolia RPC endpoints configured.");

  for (const url of RPC_URLS) {
    const provider = createProvider(url);
    const contract = getContract(provider);
    const filters = buildFilters(contract);
    try {
      try {
        return await Promise.all(filters.map((f) => contract.queryFilter(f, DEPLOYMENT_BLOCK)));
      } catch (err) {
        lastError = err;
        const head = await provider.getBlockNumber();
        return await Promise.all(filters.map((f) => queryFilterChunked(contract, f, head)));
      }
    } catch (err) {
      lastError = err;
      console.warn(`Log query failed against ${url}, trying next RPC:`, err);
    } finally {
      provider.destroy();
    }
  }

  throw lastError;
}

/** The EIP-1193 provider MetaMask injects, when one is present. */
export function getInjectedProvider(): ethers.Eip1193Provider | undefined {
  return (window as Window & { ethereum?: ethers.Eip1193Provider }).ethereum;
}

/**
 * Ensures MetaMask is on Sepolia. Prompts a network switch; if Sepolia isn't
 * added to the wallet yet, falls back to wallet_addEthereumChain.
 * Throws if the user cancels or MetaMask isn't installed.
 */
export async function ensureSepolia(): Promise<void> {
  const ethereum = getInjectedProvider();
  if (!ethereum) throw new Error("MetaMask is not installed.");
  const hexChainId = `0x${CHAIN_ID.toString(16)}`; // "0xaa36a7"
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
  } catch (err) {
    // 4902 = chain not yet added to the wallet
    if ((err as { code?: number })?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: hexChainId,
          chainName: "Sepolia Testnet",
          nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        }],
      });
    } else {
      throw err;
    }
  }
}
