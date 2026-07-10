// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {CredentialVault} from "../src/CredntialVault.sol";
import {console} from "forge-std/console.sol"; // For logging the address

// The contract responsible for deploying the CredentialVault.
contract DeployVault is Script {

    // --- Configuration Variables ---

    address public constant ADMIN_ADDRESS = 0x8cb784B156c304291cE896AF7881F627BB4633BE;

    address[] public initialIssuers;

    function setUp() public {
        initialIssuers.push(0x8cb784B156c304291cE896AF7881F627BB4633BE);
    }

    // --- Deployment Logic ---
    function run() public returns (CredentialVault) {
        
        // Start broadcasting transactions using the private key specified in the CLI
        vm.startBroadcast();

        // Deploy the contract: passes the admin and the list of initial issuers to the constructor
        CredentialVault vault = new CredentialVault(
            ADMIN_ADDRESS,
            initialIssuers
        );

        // Stop broadcasting
        vm.stopBroadcast();

        // Log the deployed address for immediate verification on Etherscan/Polygonscan
        console.log("CredentialVault deployed at:", address(vault));

        return vault;
    }
}