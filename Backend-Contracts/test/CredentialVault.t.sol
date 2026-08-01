// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CredentialVault} from "../src/CredentialVault.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract CredentialVaultTest is Test {
    CredentialVault public vault;

    address public immutable ALICE = vm.addr(0x1); // holder
    address public immutable ADMIN = vm.addr(0x2);
    address public immutable COLLEGE_A = vm.addr(0x3); // authorised issuer
    address public immutable RANDOM_USER = vm.addr(0x4); // no roles
    address public immutable COLLEGE_B = vm.addr(0x5); // a second authorised issuer

    // keccak256 of the credential file's bytes
    bytes32 public constant DOC_HASH = keccak256("alice-cs-degree-2025.pdf");
    string public constant URI = "ipfs://bafyTestMetadataCid";

    function setUp() public {
        vault = new CredentialVault(ADMIN);

        vm.startPrank(ADMIN);
        vault.registerIssuer(COLLEGE_A, "Indian Institute of Technology Delhi", "AICTE-1961-DEL", "https://iitd.ac.in");
        vault.registerIssuer(COLLEGE_B, "National Institute of Technology Trichy", "AICTE-1964-TRY", "https://nitt.edu");
        vm.stopPrank();

        // Timestamps start at 1 in Foundry; move forward so expiry maths is realistic.
        vm.warp(1_700_000_000);
    }

    // --- Helpers ---

    function _issue() internal {
        vm.prank(COLLEGE_A);
        vault.issueCredential(ALICE, DOC_HASH, URI, 0);
    }

    function _issueAndAccept() internal {
        _issue();
        vm.prank(ALICE);
        vault.acceptCredential(DOC_HASH);
    }

    // --- Issuance ---

    function test_IssueStartsPendingAndNotYetValid() public {
        _issue();

        CredentialVault.CredentialView memory view_ = vault.verifyCredential(ALICE, DOC_HASH);
        assertEq(uint8(view_.status), uint8(CredentialVault.Status.Pending));
        assertFalse(view_.isValid, "pending credential must not verify as valid");
        assertEq(view_.issuer, COLLEGE_A);
        assertEq(view_.metadataURI, URI);
    }

    function test_IssueStoresMetadataUriOnChain() public {
        _issue();
        CredentialVault.CredentialView memory view_ = vault.verifyCredential(ALICE, DOC_HASH);
        assertEq(view_.metadataURI, URI, "metadata URI must survive on-chain, not in localStorage");
    }

    function test_RevertWhen_UnauthorisedUserIssues() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, RANDOM_USER, vault.ISSUER_ROLE()
            )
        );
        vm.prank(RANDOM_USER);
        vault.issueCredential(ALICE, DOC_HASH, URI, 0);
    }

    function test_RevertWhen_DocumentHashIsZero() public {
        vm.expectRevert(CredentialVault.EmptyDocumentHash.selector);
        vm.prank(COLLEGE_A);
        vault.issueCredential(ALICE, bytes32(0), URI, 0);
    }

    function test_RevertWhen_MetadataUriIsEmpty() public {
        vm.expectRevert(CredentialVault.EmptyMetadataURI.selector);
        vm.prank(COLLEGE_A);
        vault.issueCredential(ALICE, DOC_HASH, "", 0);
    }

    function test_RevertWhen_HolderIsZeroAddress() public {
        vm.expectRevert(CredentialVault.ZeroAddress.selector);
        vm.prank(COLLEGE_A);
        vault.issueCredential(address(0), DOC_HASH, URI, 0);
    }

    function test_RevertWhen_ExpiryIsInThePast() public {
        vm.expectRevert(CredentialVault.ExpiryInPast.selector);
        vm.prank(COLLEGE_A);
        vault.issueCredential(ALICE, DOC_HASH, URI, uint48(block.timestamp - 1));
    }

    function test_RevertWhen_IssuingDuplicate() public {
        _issue();
        vm.expectRevert(CredentialVault.CredentialAlreadyExists.selector);
        vm.prank(COLLEGE_A);
        vault.issueCredential(ALICE, DOC_HASH, URI, 0);
    }

    // --- Batch issuance ---

    /// Builds `n` parallel arrays with distinct holders and document hashes.
    function _batchOf(uint256 n)
        internal
        pure
        returns (address[] memory holders, bytes32[] memory hashes, string[] memory uris, uint48[] memory expiries)
    {
        holders = new address[](n);
        hashes = new bytes32[](n);
        uris = new string[](n);
        expiries = new uint48[](n);
        for (uint256 i = 0; i < n; ++i) {
            // casting to 'uint160' is safe because n is bounded by MAX_BATCH + 1
            // forge-lint: disable-next-line(unsafe-typecast)
            holders[i] = address(uint160(1000 + i));
            hashes[i] = keccak256(abi.encodePacked("graduate", i));
            uris[i] = "ipfs://bafyBatchCid";
            expiries[i] = 0;
        }
    }

    function test_BatchIssuesEveryCredential() public {
        (address[] memory h, bytes32[] memory d, string[] memory u, uint48[] memory e) = _batchOf(25);

        vm.prank(COLLEGE_A);
        vault.issueBatch(h, d, u, e);

        for (uint256 i = 0; i < 25; ++i) {
            CredentialVault.CredentialView memory view_ = vault.verifyCredential(h[i], d[i]);
            assertEq(uint8(view_.status), uint8(CredentialVault.Status.Pending));
            assertEq(view_.issuer, COLLEGE_A);
        }
    }

    function test_RevertWhen_BatchArraysMismatch() public {
        (address[] memory h, bytes32[] memory d, string[] memory u,) = _batchOf(3);
        uint48[] memory shortExpiries = new uint48[](2);

        vm.expectRevert(CredentialVault.BatchLengthMismatch.selector);
        vm.prank(COLLEGE_A);
        vault.issueBatch(h, d, u, shortExpiries);
    }

    function test_RevertWhen_BatchIsEmpty() public {
        (address[] memory h, bytes32[] memory d, string[] memory u, uint48[] memory e) = _batchOf(0);
        vm.expectRevert(CredentialVault.EmptyBatch.selector);
        vm.prank(COLLEGE_A);
        vault.issueBatch(h, d, u, e);
    }

    function test_RevertWhen_BatchExceedsMaxSize() public {
        (address[] memory h, bytes32[] memory d, string[] memory u, uint48[] memory e) = _batchOf(101);
        vm.expectRevert(CredentialVault.BatchTooLarge.selector);
        vm.prank(COLLEGE_A);
        vault.issueBatch(h, d, u, e);
    }

    /// One bad entry must roll back the whole batch, not silently skip.
    function test_RevertWhen_BatchContainsInvalidEntry() public {
        (address[] memory h, bytes32[] memory d, string[] memory u, uint48[] memory e) = _batchOf(3);
        d[1] = bytes32(0);

        vm.expectRevert(CredentialVault.EmptyDocumentHash.selector);
        vm.prank(COLLEGE_A);
        vault.issueBatch(h, d, u, e);

        assertEq(uint8(vault.verifyCredential(h[0], d[0]).status), uint8(CredentialVault.Status.None));
    }

    // --- Pause ---

    function test_PauseBlocksIssuanceButNotVerificationOrRevocation() public {
        _issueAndAccept();

        vm.prank(ADMIN);
        vault.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(COLLEGE_A);
        vault.issueCredential(ALICE, keccak256("another.pdf"), URI, 0);

        // Reading and withdrawing must keep working while paused.
        assertTrue(vault.verifyCredential(ALICE, DOC_HASH).isValid);
        vm.prank(COLLEGE_A);
        vault.revokeCredential(ALICE, DOC_HASH);
        assertFalse(vault.verifyCredential(ALICE, DOC_HASH).isValid);
    }

    function test_UnpauseRestoresIssuance() public {
        vm.startPrank(ADMIN);
        vault.pause();
        vault.unpause();
        vm.stopPrank();

        _issue();
        assertEq(uint8(vault.verifyCredential(ALICE, DOC_HASH).status), uint8(CredentialVault.Status.Pending));
    }

    function test_RevertWhen_NonAdminPauses() public {
        bytes32 adminRole = vault.DEFAULT_ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, COLLEGE_A, adminRole)
        );
        vm.prank(COLLEGE_A);
        vault.pause();
    }

    // --- Holder consent ---

    function test_AcceptActivatesCredential() public {
        _issueAndAccept();

        CredentialVault.CredentialView memory view_ = vault.verifyCredential(ALICE, DOC_HASH);
        assertTrue(view_.isValid);
        assertEq(uint8(view_.status), uint8(CredentialVault.Status.Active));
    }

    function test_RejectMarksCredentialRejected() public {
        _issue();
        vm.prank(ALICE);
        vault.rejectCredential(DOC_HASH);

        CredentialVault.CredentialView memory view_ = vault.verifyCredential(ALICE, DOC_HASH);
        assertFalse(view_.isValid);
        assertEq(uint8(view_.status), uint8(CredentialVault.Status.Rejected));
    }

    /// A credential belongs to its holder — nobody else can accept on their behalf.
    function test_RevertWhen_NonHolderAccepts() public {
        _issue();
        vm.expectRevert(CredentialVault.CredentialNotFound.selector);
        vm.prank(RANDOM_USER);
        vault.acceptCredential(DOC_HASH);
    }

    function test_RevertWhen_AcceptingTwice() public {
        _issueAndAccept();
        vm.expectRevert(CredentialVault.CredentialNotPending.selector);
        vm.prank(ALICE);
        vault.acceptCredential(DOC_HASH);
    }

    function test_IssuerCanReIssueAfterRejection() public {
        _issue();
        vm.prank(ALICE);
        vault.rejectCredential(DOC_HASH);

        // The slot is not burned — the institution can correct and re-issue.
        vm.prank(COLLEGE_A);
        vault.issueCredential(ALICE, DOC_HASH, "ipfs://bafyCorrected", 0);

        CredentialVault.CredentialView memory view_ = vault.verifyCredential(ALICE, DOC_HASH);
        assertEq(uint8(view_.status), uint8(CredentialVault.Status.Pending));
        assertEq(view_.metadataURI, "ipfs://bafyCorrected");
    }

    // --- Revocation ---

    function test_IssuerCanRevoke() public {
        _issueAndAccept();

        vm.prank(COLLEGE_A);
        vault.revokeCredential(ALICE, DOC_HASH);

        CredentialVault.CredentialView memory view_ = vault.verifyCredential(ALICE, DOC_HASH);
        assertFalse(view_.isValid);
        assertEq(uint8(view_.status), uint8(CredentialVault.Status.Revoked));
    }

    /// The v1 bug: any ISSUER_ROLE holder could revoke another institution's credential.
    function test_RevertWhen_DifferentIssuerRevokes() public {
        _issueAndAccept();

        vm.expectRevert(CredentialVault.NotIssuingInstitution.selector);
        vm.prank(COLLEGE_B);
        vault.revokeCredential(ALICE, DOC_HASH);

        assertTrue(vault.verifyCredential(ALICE, DOC_HASH).isValid, "credential must survive a foreign revoke attempt");
    }

    function test_RevertWhen_RevokingTwice() public {
        _issueAndAccept();
        vm.startPrank(COLLEGE_A);
        vault.revokeCredential(ALICE, DOC_HASH);
        vm.expectRevert(CredentialVault.CredentialNotRevocable.selector);
        vault.revokeCredential(ALICE, DOC_HASH);
        vm.stopPrank();
    }

    function test_RevertWhen_RevokingUnissuedCredential() public {
        vm.expectRevert(CredentialVault.CredentialNotFound.selector);
        vm.prank(COLLEGE_A);
        vault.revokeCredential(ALICE, keccak256("never-issued"));
    }

    function test_AdminCanRevokeAnyCredential() public {
        _issueAndAccept();

        vm.prank(ADMIN);
        vault.adminRevoke(ALICE, DOC_HASH);

        assertFalse(vault.verifyCredential(ALICE, DOC_HASH).isValid);
    }

    function test_RevertWhen_NonAdminUsesAdminRevoke() public {
        _issueAndAccept();

        bytes32 adminRole = vault.DEFAULT_ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, COLLEGE_B, adminRole)
        );
        vm.prank(COLLEGE_B);
        vault.adminRevoke(ALICE, DOC_HASH);
    }

    function test_ReinstateRestoresValidity() public {
        _issueAndAccept();
        vm.startPrank(COLLEGE_A);
        vault.revokeCredential(ALICE, DOC_HASH);
        vault.reinstateCredential(ALICE, DOC_HASH);
        vm.stopPrank();

        assertTrue(vault.verifyCredential(ALICE, DOC_HASH).isValid);
    }

    function test_RevertWhen_ReinstatingActiveCredential() public {
        _issueAndAccept();
        vm.expectRevert(CredentialVault.CredentialNotRevoked.selector);
        vm.prank(COLLEGE_A);
        vault.reinstateCredential(ALICE, DOC_HASH);
    }

    function test_RevertWhen_DifferentIssuerReinstates() public {
        _issueAndAccept();
        vm.prank(COLLEGE_A);
        vault.revokeCredential(ALICE, DOC_HASH);

        vm.expectRevert(CredentialVault.NotIssuingInstitution.selector);
        vm.prank(COLLEGE_B);
        vault.reinstateCredential(ALICE, DOC_HASH);
    }

    // --- Expiry ---

    function test_ExpiredCredentialIsNotValid() public {
        uint48 expiry = uint48(block.timestamp + 30 days);
        vm.prank(COLLEGE_A);
        vault.issueCredential(ALICE, DOC_HASH, URI, expiry);
        vm.prank(ALICE);
        vault.acceptCredential(DOC_HASH);

        assertTrue(vault.verifyCredential(ALICE, DOC_HASH).isValid, "valid before expiry");

        vm.warp(expiry);
        CredentialVault.CredentialView memory view_ = vault.verifyCredential(ALICE, DOC_HASH);
        assertFalse(view_.isValid, "must be invalid at the expiry boundary");
        assertTrue(view_.isExpired);
        // Status stays Active — expiry is a fact about time, not a revocation.
        assertEq(uint8(view_.status), uint8(CredentialVault.Status.Active));
    }

    function test_ZeroExpiryNeverExpires() public {
        _issueAndAccept();
        vm.warp(block.timestamp + 3650 days);
        assertTrue(vault.verifyCredential(ALICE, DOC_HASH).isValid);
    }

    // --- Verification of unknown records ---

    function test_UnknownCredentialReturnsEmptyView() public view {
        CredentialVault.CredentialView memory view_ = vault.verifyCredential(ALICE, keccak256("nothing"));
        assertFalse(view_.isValid);
        assertEq(uint8(view_.status), uint8(CredentialVault.Status.None));
        assertEq(view_.issuer, address(0));
        assertEq(view_.metadataURI, "");
    }

    // --- Roles ---

    function test_AdminCanGrantAndRevokeIssuerRole() public {
        bytes32 issuerRole = vault.ISSUER_ROLE();

        vm.startPrank(ADMIN);
        vault.grantRole(issuerRole, RANDOM_USER);
        assertTrue(vault.isIssuer(RANDOM_USER));
        vault.revokeRole(issuerRole, RANDOM_USER);
        assertFalse(vault.isIssuer(RANDOM_USER));
        vm.stopPrank();
    }

    // --- Guard clauses ---

    function test_RevertWhen_DeployingWithZeroAdmin() public {
        vm.expectRevert(CredentialVault.ZeroAddress.selector);
        new CredentialVault(address(0));
    }

    function test_RevertWhen_RegisteringZeroAddressIssuer() public {
        vm.expectRevert(CredentialVault.ZeroAddress.selector);
        vm.prank(ADMIN);
        vault.registerIssuer(address(0), "Ghost University", "", "");
    }

    function test_RevertWhen_AdminRevokesUnknownCredential() public {
        vm.expectRevert(CredentialVault.CredentialNotFound.selector);
        vm.prank(ADMIN);
        vault.adminRevoke(ALICE, keccak256("never-issued"));
    }

    function test_RevertWhen_AdminRevokesAlreadyRevokedCredential() public {
        _issueAndAccept();
        vm.prank(COLLEGE_A);
        vault.revokeCredential(ALICE, DOC_HASH);

        vm.expectRevert(CredentialVault.CredentialNotRevocable.selector);
        vm.prank(ADMIN);
        vault.adminRevoke(ALICE, DOC_HASH);
    }

    function test_RevertWhen_ReinstatingUnknownCredential() public {
        vm.expectRevert(CredentialVault.CredentialNotFound.selector);
        vm.prank(COLLEGE_A);
        vault.reinstateCredential(ALICE, keccak256("never-issued"));
    }

    function test_RevertWhen_RejectingUnknownCredential() public {
        vm.expectRevert(CredentialVault.CredentialNotFound.selector);
        vm.prank(ALICE);
        vault.rejectCredential(keccak256("never-issued"));
    }

    // --- Issuer registry ---

    function test_RegisterIssuerGrantsRoleAndIdentity() public {
        vm.prank(ADMIN);
        vault.registerIssuer(RANDOM_USER, "Anna University", "AICTE-1978-CHN", "https://annauniv.edu");

        assertTrue(vault.isIssuer(RANDOM_USER), "registration must grant ISSUER_ROLE");
        (string memory name, string memory accreditation, string memory website) = vault.issuerInfo(RANDOM_USER);
        assertEq(name, "Anna University");
        assertEq(accreditation, "AICTE-1978-CHN");
        assertEq(website, "https://annauniv.edu");
    }

    function test_VerifyExposesIssuerName() public {
        _issueAndAccept();
        CredentialVault.CredentialView memory view_ = vault.verifyCredential(ALICE, DOC_HASH);
        assertEq(
            view_.issuerName, "Indian Institute of Technology Delhi", "verifier must see a name, not just an address"
        );
    }

    function test_RevertWhen_RegisteringIssuerWithoutName() public {
        vm.expectRevert(CredentialVault.IssuerNameRequired.selector);
        vm.prank(ADMIN);
        vault.registerIssuer(RANDOM_USER, "", "", "");
    }

    function test_RevertWhen_NonAdminRegistersIssuer() public {
        bytes32 adminRole = vault.DEFAULT_ADMIN_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, COLLEGE_A, adminRole)
        );
        vm.prank(COLLEGE_A);
        vault.registerIssuer(RANDOM_USER, "Fake University", "", "");
    }

    function test_GetIssuersListsAllRegistered() public view {
        address[] memory issuers = vault.getIssuers();
        assertEq(issuers.length, 2);
        assertEq(issuers[0], COLLEGE_A);
        assertEq(issuers[1], COLLEGE_B);
    }

    function test_DeregisterRemovesAuthorityButKeepsPastCredentialsValid() public {
        _issueAndAccept();

        vm.prank(ADMIN);
        vault.deregisterIssuer(COLLEGE_A);

        assertFalse(vault.isIssuer(COLLEGE_A), "must lose issuing authority");
        assertEq(vault.getIssuers().length, 1);
        // A closed university does not invalidate the degrees it already awarded.
        assertTrue(vault.verifyCredential(ALICE, DOC_HASH).isValid, "existing credentials stay valid");
    }

    function test_RevertWhen_DeregisteredIssuerIssues() public {
        vm.prank(ADMIN);
        vault.deregisterIssuer(COLLEGE_A);

        bytes32 issuerRole = vault.ISSUER_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, COLLEGE_A, issuerRole)
        );
        vm.prank(COLLEGE_A);
        vault.issueCredential(ALICE, DOC_HASH, URI, 0);
    }

    function test_RevertWhen_NonAdminGrantsIssuerRole() public {
        // Read the roles up front: a view call here would otherwise consume the
        // expectRevert/prank cheatcodes intended for grantRole.
        bytes32 issuerRole = vault.ISSUER_ROLE();
        bytes32 adminRole = vault.DEFAULT_ADMIN_ROLE();

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, COLLEGE_A, adminRole)
        );
        vm.prank(COLLEGE_A);
        vault.grantRole(issuerRole, RANDOM_USER);
    }
}
