// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CredentialVault} from "../src/CredentialVault.sol";

/// @notice Property tests over arbitrary inputs, complementing the example-based suite.
contract CredentialVaultFuzzTest is Test {
    CredentialVault public vault;

    address public immutable ADMIN = vm.addr(0x2);
    address public immutable COLLEGE = vm.addr(0x3);

    string public constant URI = "ipfs://bafyFuzzCid";

    function setUp() public {
        vault = new CredentialVault(ADMIN);
        vm.prank(ADMIN);
        vault.registerIssuer(COLLEGE, "Fuzz University", "ACC-1", "https://example.edu");
        vm.warp(1_700_000_000);
    }

    /// Any well-formed issuance lands as Pending and is attributed to the caller.
    function testFuzz_IssueAlwaysStartsPending(address holder, bytes32 documentHash) public {
        vm.assume(holder != address(0));
        vm.assume(documentHash != bytes32(0));

        vm.prank(COLLEGE);
        vault.issueCredential(holder, documentHash, URI, 0);

        CredentialVault.CredentialView memory view_ = vault.verifyCredential(holder, documentHash);
        assertEq(uint8(view_.status), uint8(CredentialVault.Status.Pending));
        assertEq(view_.issuer, COLLEGE);
        assertFalse(view_.isValid, "must never be valid before the holder accepts");
    }

    /// Only ISSUER_ROLE holders can ever create a record.
    function testFuzz_NonIssuerCanNeverIssue(address caller, address holder, bytes32 documentHash) public {
        vm.assume(caller != COLLEGE);
        vm.assume(holder != address(0));
        vm.assume(documentHash != bytes32(0));

        vm.prank(caller);
        vm.expectRevert();
        vault.issueCredential(holder, documentHash, URI, 0);

        assertEq(uint8(vault.verifyCredential(holder, documentHash).status), uint8(CredentialVault.Status.None));
    }

    /// Consent belongs to the holder alone.
    function testFuzz_OnlyHolderCanAccept(address holder, address stranger, bytes32 documentHash) public {
        vm.assume(holder != address(0) && stranger != address(0));
        vm.assume(holder != stranger);
        vm.assume(documentHash != bytes32(0));

        vm.prank(COLLEGE);
        vault.issueCredential(holder, documentHash, URI, 0);

        vm.prank(stranger);
        vm.expectRevert(CredentialVault.CredentialNotFound.selector);
        vault.acceptCredential(documentHash);

        assertFalse(vault.verifyCredential(holder, documentHash).isValid);
    }

    /// A credential is valid only strictly before its expiry.
    function testFuzz_ExpiryBoundaryIsExclusive(uint48 lifetime) public {
        lifetime = uint48(bound(lifetime, 1, type(uint40).max));
        uint48 expiry = uint48(block.timestamp) + lifetime;
        bytes32 documentHash = keccak256("expiring.pdf");

        vm.prank(COLLEGE);
        vault.issueCredential(address(0xBEEF), documentHash, URI, expiry);
        vm.prank(address(0xBEEF));
        vault.acceptCredential(documentHash);

        vm.warp(expiry - 1);
        assertTrue(vault.verifyCredential(address(0xBEEF), documentHash).isValid, "valid one second before expiry");

        vm.warp(expiry);
        assertFalse(vault.verifyCredential(address(0xBEEF), documentHash).isValid, "invalid at expiry");
    }

    /// No non-issuing account can revoke, regardless of who it is.
    function testFuzz_OnlyIssuingInstitutionCanRevoke(address caller, bytes32 documentHash) public {
        vm.assume(caller != COLLEGE);
        vm.assume(documentHash != bytes32(0));
        address holder = address(0xBEEF);

        vm.prank(COLLEGE);
        vault.issueCredential(holder, documentHash, URI, 0);
        vm.prank(holder);
        vault.acceptCredential(documentHash);

        vm.prank(caller);
        vm.expectRevert();
        vault.revokeCredential(holder, documentHash);

        assertTrue(vault.verifyCredential(holder, documentHash).isValid, "credential survives every foreign revoke");
    }
}
