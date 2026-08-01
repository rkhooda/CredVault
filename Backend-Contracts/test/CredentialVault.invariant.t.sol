// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {CredentialVault} from "../src/CredentialVault.sol";

/**
 * @notice Drives the vault through random sequences of realistic actions.
 * @dev Every credential it touches is recorded so the invariants can walk the
 *      full set afterwards.
 */
contract VaultHandler is Test {
    CredentialVault public vault;
    address public admin;

    address[] public actors;
    address[] public trackedHolders;
    bytes32[] public trackedHashes;

    constructor(CredentialVault vault_, address admin_) {
        vault = vault_;
        admin = admin_;
        for (uint160 i = 1; i <= 5; ++i) {
            actors.push(address(i * 0x1000));
        }
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function registerIssuer(uint256 seed) public {
        address issuer = _actor(seed);
        vm.prank(admin);
        vault.registerIssuer(issuer, "Handler University", "ACC", "https://example.edu");
    }

    function deregisterIssuer(uint256 seed) public {
        address issuer = _actor(seed);
        vm.prank(admin);
        vault.deregisterIssuer(issuer);
    }

    function issueAs(uint256 issuerSeed, uint256 holderSeed, uint256 hashSeed) public {
        address issuer = _actor(issuerSeed);
        address holder = _actor(holderSeed);
        bytes32 documentHash = keccak256(abi.encodePacked(hashSeed % 8));
        if (!vault.isIssuer(issuer) || holder == address(0)) return;

        vm.prank(issuer);
        try vault.issueCredential(holder, documentHash, "ipfs://bafyHandler", 0) {
            trackedHolders.push(holder);
            trackedHashes.push(documentHash);
        } catch {
            return;
        }
    }

    function accept(uint256 seed) public {
        if (trackedHolders.length == 0) return;
        uint256 i = seed % trackedHolders.length;
        vm.prank(trackedHolders[i]);
        try vault.acceptCredential(trackedHashes[i]) {} catch {}
    }

    function reject(uint256 seed) public {
        if (trackedHolders.length == 0) return;
        uint256 i = seed % trackedHolders.length;
        vm.prank(trackedHolders[i]);
        try vault.rejectCredential(trackedHashes[i]) {} catch {}
    }

    function revoke(uint256 seed, uint256 callerSeed) public {
        if (trackedHolders.length == 0) return;
        uint256 i = seed % trackedHolders.length;
        vm.prank(_actor(callerSeed));
        try vault.revokeCredential(trackedHolders[i], trackedHashes[i]) {} catch {}
    }

    function trackedCount() external view returns (uint256) {
        return trackedHolders.length;
    }
}

contract CredentialVaultInvariantTest is StdInvariant, Test {
    CredentialVault public vault;
    VaultHandler public handler;

    address public immutable ADMIN = vm.addr(0x2);

    function setUp() public {
        vault = new CredentialVault(ADMIN);
        handler = new VaultHandler(vault, ADMIN);
        targetContract(address(handler));
    }

    /// A credential is valid only while Active — no other state may verify.
    function invariant_OnlyActiveCredentialsVerify() public view {
        uint256 count = handler.trackedCount();
        for (uint256 i = 0; i < count; ++i) {
            CredentialVault.CredentialView memory view_ =
                vault.verifyCredential(handler.trackedHolders(i), handler.trackedHashes(i));
            if (view_.isValid) {
                assertEq(uint8(view_.status), uint8(CredentialVault.Status.Active), "only Active may be valid");
                assertFalse(view_.isExpired, "an expired credential must never be valid");
            }
        }
    }

    /// Any credential that exists is attributed to a real issuer.
    function invariant_ExistingCredentialsHaveAnIssuer() public view {
        uint256 count = handler.trackedCount();
        for (uint256 i = 0; i < count; ++i) {
            CredentialVault.CredentialView memory view_ =
                vault.verifyCredential(handler.trackedHolders(i), handler.trackedHashes(i));
            if (view_.status != CredentialVault.Status.None) {
                assertTrue(view_.issuer != address(0), "a credential must always name its issuer");
            }
        }
    }

    /// Registry and roles never drift: every authorised address has an identity.
    function invariant_EveryIssuerHasAName() public view {
        address[] memory issuers = vault.getIssuers();
        for (uint256 i = 0; i < issuers.length; ++i) {
            (string memory name,,) = vault.issuerInfo(issuers[i]);
            assertTrue(bytes(name).length > 0, "ISSUER_ROLE without a registered name");
        }
    }
}
