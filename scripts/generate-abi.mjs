#!/usr/bin/env node
/**
 * Extracts the CredentialVault ABI from the Foundry build artifact into a typed
 * TypeScript module.
 *
 * The v1 ABI was maintained by hand and drifted from the contract. Regenerate
 * with `npm run contract:abi` after any change to the contract's interface.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = resolve(root, "Backend-Contracts/out/CredentialVault.sol/CredentialVault.json");
const OUTPUT = resolve(root, "src/lib/credentialVaultAbi.ts");

let artifact;
try {
  artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
} catch {
  console.error(`Could not read ${ARTIFACT}\nRun "npm run contract:build" first.`);
  process.exit(1);
}

if (!Array.isArray(artifact.abi) || artifact.abi.length === 0) {
  console.error("Artifact contains no ABI — was the contract compiled?");
  process.exit(1);
}

const banner = `// GENERATED FILE — do not edit by hand.
// Source: Backend-Contracts/src/CredentialVault.sol
// Regenerate: npm run contract:abi
`;

writeFileSync(OUTPUT, `${banner}\nexport const CREDENTIAL_VAULT_ABI = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`);

// A plain object would resolve entry.type === "constructor" to Object.prototype.
const counts = new Map();
for (const entry of artifact.abi) {
  counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
}
console.log(`Wrote ${OUTPUT}`);
for (const [type, count] of counts) console.log(`  ${count} ${type}`);
