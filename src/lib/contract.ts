import { ethers } from "ethers";

// ABI hand-derived from Backend-Contracts/src/CredntialVault.sol + OZ AccessControl
export const CREDENTIAL_VAULT_ABI = [
  // --- Custom contract functions ---
  {
    inputs: [
      { internalType: "address", name: "_holder", type: "address" },
      { internalType: "bytes32", name: "_documentHash", type: "bytes32" },
    ],
    name: "issueCredential",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_holder", type: "address" },
      { internalType: "bytes32", name: "_documentHash", type: "bytes32" },
    ],
    name: "revokeCredential",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_holder", type: "address" },
      { internalType: "bytes32", name: "_documentHash", type: "bytes32" },
    ],
    name: "verifyCredential",
    outputs: [
      { internalType: "bool", name: "isValid", type: "bool" },
      { internalType: "address", name: "issuer", type: "address" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_addr", type: "address" }],
    name: "isIssuer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // Public mapping getter: issuedCredentials[holder][hash]
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "bytes32", name: "", type: "bytes32" },
    ],
    name: "issuedCredentials",
    outputs: [
      { internalType: "address", name: "issuer", type: "address" },
      { internalType: "uint48", name: "issueTimestamp", type: "uint48" },
      { internalType: "bool", name: "isRevoked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // Role constants
  {
    inputs: [],
    name: "ISSUER_ROLE",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DEFAULT_ADMIN_ROLE",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  // --- Inherited AccessControl functions ---
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "hasRole",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "role", type: "bytes32" }],
    name: "getRoleAdmin",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "grantRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "revokeRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "callerConfirmation", type: "address" },
    ],
    name: "renounceRole",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes4", name: "interfaceId", type: "bytes4" }],
    name: "supportsInterface",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  // --- Events ---
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "holder", type: "address" },
      { indexed: true, internalType: "address", name: "issuer", type: "address" },
      { indexed: true, internalType: "bytes32", name: "documentHash", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "CredentialIssued",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "holder", type: "address" },
      { indexed: true, internalType: "address", name: "issuer", type: "address" },
      { indexed: true, internalType: "bytes32", name: "documentHash", type: "bytes32" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "CredentialRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: true, internalType: "address", name: "sender", type: "address" },
    ],
    name: "RoleGranted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      { indexed: true, internalType: "address", name: "account", type: "address" },
      { indexed: true, internalType: "address", name: "sender", type: "address" },
    ],
    name: "RoleRevoked",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "bytes32", name: "role", type: "bytes32" },
      { indexed: true, internalType: "bytes32", name: "previousAdminRole", type: "bytes32" },
      { indexed: true, internalType: "bytes32", name: "newAdminRole", type: "bytes32" },
    ],
    name: "RoleAdminChanged",
    type: "event",
  },
] as const;

// Block at which the contract was deployed — used as the floor for event-log scans.
export const DEPLOYMENT_BLOCK = 11245046;

// Fall back to hardcoded constants so the app works without a .env.local on other machines
export const CONTRACT_ADDRESS: string =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ??
  "0xb93E8364b030877C14c47E262C2e9822A2a364f9";

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

/**
 * Computes the document hash used by the contract.
 * Matches: keccak256(abi.encodePacked(holderAddress, credentialTitle, credentialType))
 */
export function computeDocumentHash(
  holderAddress: string,
  title: string,
  credentialType: string
): string {
  return ethers.solidityPackedKeccak256(
    ["address", "string", "string"],
    [holderAddress, title, credentialType]
  );
}

/**
 * Ensures MetaMask is on Sepolia. Prompts a network switch; if Sepolia isn't
 * added to the wallet yet, falls back to wallet_addEthereumChain.
 * Throws if the user cancels or MetaMask isn't installed.
 */
export async function ensureSepolia(): Promise<void> {
  const ethereum = (window as Window & { ethereum?: any }).ethereum;
  if (!ethereum) throw new Error("MetaMask is not installed.");
  const hexChainId = `0x${CHAIN_ID.toString(16)}`; // "0xaa36a7"
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexChainId }] });
  } catch (err: any) {
    // 4902 = chain not yet added to the wallet
    if (err?.code === 4902) {
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
