// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {CredentialVault} from "../src/CredentialVault.sol";

/**
 * @notice Deploys CredentialVault and registers the first institution.
 *
 * @dev Configured entirely through the environment so the same script works for a
 *      local anvil run, a testnet demo and a real deployment:
 *
 *        PRIVATE_KEY                   deployer key (required)
 *        ADMIN_ADDRESS                 DEFAULT_ADMIN_ROLE holder    (default: deployer)
 *        INITIAL_ISSUER                first authorised institution (default: deployer)
 *        INITIAL_ISSUER_NAME           display name shown to verifiers
 *        INITIAL_ISSUER_ACCREDITATION  accreditation reference
 *        INITIAL_ISSUER_WEBSITE        institution homepage
 */
contract DeployVault is Script {
    function run() external returns (CredentialVault vault) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address initialIssuer = vm.envOr("INITIAL_ISSUER", deployer);
        string memory issuerName = vm.envOr("INITIAL_ISSUER_NAME", string("CredVault Demo University"));
        string memory accreditation = vm.envOr("INITIAL_ISSUER_ACCREDITATION", string("DEMO-ACCREDITATION"));
        string memory website = vm.envOr("INITIAL_ISSUER_WEBSITE", string("https://credvault.example"));

        vm.startBroadcast(deployerKey);

        vault = new CredentialVault(admin);

        // registerIssuer is admin-only. When deploying on behalf of a different
        // admin, that admin registers institutions themselves afterwards.
        if (admin == deployer) {
            vault.registerIssuer(initialIssuer, issuerName, accreditation, website);
        }

        vm.stopBroadcast();

        console.log("CredentialVault deployed at:", address(vault));
        console.log("Deployment block:          ", block.number);
        console.log("Admin:                     ", admin);
        if (admin == deployer) {
            console.log("Initial issuer:            ", initialIssuer);
            console.log("Initial issuer name:       ", issuerName);
        } else {
            console.log("Admin differs from deployer - register issuers manually.");
        }
    }
}
