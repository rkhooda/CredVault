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
export const DEPLOYMENT_BLOCK = 9654189; // 0x934fad on Sepolia

// Fall back to hardcoded constants so the app works without a .env.local on other machines
export const CONTRACT_ADDRESS: string =
  (import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined) ??
  "0xDF9D54e61a3174F8b565147832FF20877fCfb323";

export const CHAIN_ID: number =
  Number((import.meta.env.VITE_CHAIN_ID as string | undefined) ?? 11155111);

// Public Sepolia RPCs — no API key required. Override primary with VITE_RPC_URL.
// FallbackProvider tries both concurrently (quorum=1), using whichever responds first.
export const RPC_URL: string =
  (import.meta.env.VITE_RPC_URL as string | undefined) ??
  "https://ethereum-sepolia-rpc.publicnode.com";

const FALLBACK_RPC_URL = "https://sepolia.drpc.org";

/** Returns a contract instance connected to the given provider or signer. */
export function getContract(providerOrSigner: ethers.ContractRunner) {
  return new ethers.Contract(CONTRACT_ADDRESS, CREDENTIAL_VAULT_ABI, providerOrSigner);
}

/**
 * Returns a read-only provider pointing at Sepolia.
 * Uses two public endpoints concurrently (quorum=1) for resilience.
 * Used for view calls that don't require a connected wallet.
 */
export function getReadOnlyProvider(): ethers.AbstractProvider {
  return new ethers.FallbackProvider(
    [
      new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true }),
      new ethers.JsonRpcProvider(FALLBACK_RPC_URL, CHAIN_ID, { staticNetwork: true }),
    ],
    CHAIN_ID,
    { quorum: 1 },
  );
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
