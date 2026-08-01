// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CredentialVault
 * @notice Issuance, holder consent, revocation and public verification of academic
 *         and professional credentials.
 *
 * @dev Design notes:
 *
 *      - `documentHash` is keccak256 of the credential file's raw bytes. Hashing the
 *        actual document (rather than a few descriptive strings) means the hash is
 *        high-entropy, cannot be guessed, and lets a verifier prove a file they hold
 *        is byte-identical to the one that was issued.
 *
 *      - `metadataURI` points at an encrypted JSON blob on IPFS. The chain is the
 *        source of truth for *validity*; IPFS carries the *content*. Nothing here
 *        depends on any server, so verification works as long as the chain does.
 *
 *      - Credentials start `Pending` and only become `Active` once the holder
 *        accepts. Without this, any authorised issuer could write arbitrary records
 *        against any address unprompted.
 *
 *      - Issuers are registered with a human-readable identity. A verifier seeing
 *        only `0x8cb784…` has no way to judge whether that address is a real
 *        accredited institution.
 */
contract CredentialVault is AccessControlEnumerable, Pausable {
    // --- Roles ---

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    /// @notice Upper bound on a single batch, so a call cannot exceed the block gas limit.
    uint256 public constant MAX_BATCH = 100;

    // --- Types ---

    /// @notice Lifecycle of a single credential.
    /// None -> Pending -> Active   (holder accepts)
    ///                 -> Rejected (holder declines; issuer may re-issue)
    /// Pending/Active  -> Revoked  (issuing institution withdraws it)
    /// Revoked         -> Active   (issuer reinstates a mistaken revocation)
    enum Status {
        None,
        Pending,
        Active,
        Rejected,
        Revoked
    }

    struct Credential {
        address issuer;
        uint48 issuedAt;
        uint48 expiresAt; // 0 = never expires
        Status status;
        string metadataURI;
    }

    /// @notice Public identity of an issuing institution.
    struct Issuer {
        string name;
        string accreditationId;
        string website;
    }

    /// @notice Flattened view returned to verifiers.
    struct CredentialView {
        bool isValid;
        bool isExpired;
        Status status;
        address issuer;
        string issuerName;
        uint48 issuedAt;
        uint48 expiresAt;
        string metadataURI;
    }

    // --- Storage ---

    mapping(address holder => mapping(bytes32 documentHash => Credential)) public credentials;
    mapping(address issuer => Issuer) public issuerInfo;

    // --- Errors ---

    error ZeroAddress();
    error EmptyDocumentHash();
    error EmptyMetadataURI();
    error ExpiryInPast();
    error CredentialAlreadyExists();
    error CredentialNotFound();
    error NotIssuingInstitution();
    error CredentialNotPending();
    error CredentialNotRevocable();
    error CredentialNotRevoked();
    error IssuerNameRequired();
    error EmptyBatch();
    error BatchTooLarge();
    error BatchLengthMismatch();

    // --- Events ---

    event CredentialIssued(
        address indexed holder,
        address indexed issuer,
        bytes32 indexed documentHash,
        string metadataURI,
        uint48 issuedAt,
        uint48 expiresAt
    );
    event CredentialAccepted(address indexed holder, bytes32 indexed documentHash, uint48 timestamp);
    event CredentialRejected(address indexed holder, bytes32 indexed documentHash, uint48 timestamp);
    event CredentialRevoked(
        address indexed holder, address indexed issuer, bytes32 indexed documentHash, uint48 timestamp
    );
    event CredentialReinstated(
        address indexed holder, address indexed issuer, bytes32 indexed documentHash, uint48 timestamp
    );
    event CredentialAdminRevoked(
        address indexed holder, address indexed admin, bytes32 indexed documentHash, uint48 timestamp
    );
    event IssuerRegistered(address indexed issuer, string name, string accreditationId, string website);
    event IssuerDeregistered(address indexed issuer);

    // --- Constructor ---

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _setRoleAdmin(ISSUER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    // --- Issuer registry ---

    /**
     * @notice Authorise an institution and record its public identity in one step.
     * @dev Registering and granting together keeps the two from drifting apart —
     *      an address with ISSUER_ROLE always has a name attached.
     */
    function registerIssuer(
        address issuer,
        string calldata name,
        string calldata accreditationId,
        string calldata website
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (issuer == address(0)) revert ZeroAddress();
        if (bytes(name).length == 0) revert IssuerNameRequired();

        issuerInfo[issuer] = Issuer({name: name, accreditationId: accreditationId, website: website});
        _grantRole(ISSUER_ROLE, issuer);

        emit IssuerRegistered(issuer, name, accreditationId, website);
    }

    /**
     * @notice Withdraw an institution's authority to issue.
     * @dev Credentials it already issued stay valid — a university closing down does
     *      not invalidate the degrees it awarded. Use revokeCredential for that.
     */
    function deregisterIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ISSUER_ROLE, issuer);
        delete issuerInfo[issuer];
        emit IssuerDeregistered(issuer);
    }

    /// @notice Every currently authorised institution.
    function getIssuers() external view returns (address[] memory) {
        uint256 count = getRoleMemberCount(ISSUER_ROLE);
        address[] memory list = new address[](count);
        for (uint256 i = 0; i < count; ++i) {
            list[i] = getRoleMember(ISSUER_ROLE, i);
        }
        return list;
    }

    // --- Issuance ---

    /**
     * @notice Issue a credential to `holder`. Starts as `Pending` until accepted.
     * @param holder       Wallet the credential belongs to.
     * @param documentHash keccak256 of the credential file's bytes.
     * @param metadataURI  IPFS URI of the encrypted metadata blob.
     * @param expiresAt    Unix seconds after which the credential is no longer valid; 0 = never.
     */
    function issueCredential(address holder, bytes32 documentHash, string calldata metadataURI, uint48 expiresAt)
        external
        onlyRole(ISSUER_ROLE)
        whenNotPaused
    {
        _issue(holder, documentHash, metadataURI, expiresAt);
    }

    /**
     * @notice Issue up to MAX_BATCH credentials in one transaction.
     * @dev A university awarding thousands of degrees cannot realistically confirm
     *      one wallet prompt per student. Arrays are parallel and must be equal length.
     */
    function issueBatch(
        address[] calldata holders,
        bytes32[] calldata documentHashes,
        string[] calldata metadataUris,
        uint48[] calldata expiries
    ) external onlyRole(ISSUER_ROLE) whenNotPaused {
        uint256 length = holders.length;
        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH) revert BatchTooLarge();
        if (documentHashes.length != length || metadataUris.length != length || expiries.length != length) {
            revert BatchLengthMismatch();
        }

        for (uint256 i = 0; i < length; ++i) {
            _issue(holders[i], documentHashes[i], metadataUris[i], expiries[i]);
        }
    }

    function _issue(address holder, bytes32 documentHash, string calldata metadataURI, uint48 expiresAt) private {
        if (holder == address(0)) revert ZeroAddress();
        if (documentHash == bytes32(0)) revert EmptyDocumentHash();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert ExpiryInPast();

        // A rejected credential may be re-issued (e.g. the institution corrected a
        // mistake). Anything else already occupies this slot.
        Status current = credentials[holder][documentHash].status;
        if (current != Status.None && current != Status.Rejected) revert CredentialAlreadyExists();

        credentials[holder][documentHash] = Credential({
            issuer: msg.sender,
            issuedAt: uint48(block.timestamp),
            expiresAt: expiresAt,
            status: Status.Pending,
            metadataURI: metadataURI
        });

        emit CredentialIssued(holder, msg.sender, documentHash, metadataURI, uint48(block.timestamp), expiresAt);
    }

    // --- Emergency controls ---

    /// @notice Halt new issuance. Verification, consent and revocation stay available.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --- Holder consent ---

    /// @notice Accept a credential issued to the caller.
    function acceptCredential(bytes32 documentHash) external {
        Credential storage credential = _pendingFor(msg.sender, documentHash);
        credential.status = Status.Active;
        emit CredentialAccepted(msg.sender, documentHash, uint48(block.timestamp));
    }

    /// @notice Decline a credential issued to the caller.
    function rejectCredential(bytes32 documentHash) external {
        Credential storage credential = _pendingFor(msg.sender, documentHash);
        credential.status = Status.Rejected;
        emit CredentialRejected(msg.sender, documentHash, uint48(block.timestamp));
    }

    function _pendingFor(address holder, bytes32 documentHash) private view returns (Credential storage) {
        Credential storage credential = credentials[holder][documentHash];
        if (credential.issuer == address(0)) revert CredentialNotFound();
        if (credential.status != Status.Pending) revert CredentialNotPending();
        return credential;
    }

    // --- Revocation ---

    /**
     * @notice Withdraw a credential. Only the institution that issued it may do so —
     *         without this check any authorised issuer could revoke a competitor's
     *         credentials.
     */
    function revokeCredential(address holder, bytes32 documentHash) external {
        Credential storage credential = credentials[holder][documentHash];

        if (credential.issuer == address(0)) revert CredentialNotFound();
        if (credential.issuer != msg.sender) revert NotIssuingInstitution();
        if (credential.status != Status.Pending && credential.status != Status.Active) {
            revert CredentialNotRevocable();
        }

        credential.status = Status.Revoked;
        emit CredentialRevoked(holder, msg.sender, documentHash, uint48(block.timestamp));
    }

    /**
     * @notice Administrative revocation, bypassing the issuer check.
     * @dev Deliberate centralisation trade-off. An institution can lose its keys or
     *      its accreditation, and deregistering it only stops *future* issuance —
     *      fraudulent credentials it already signed would otherwise stand forever.
     *      Emitted as a distinct event so this power is auditable on-chain.
     */
    function adminRevoke(address holder, bytes32 documentHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Credential storage credential = credentials[holder][documentHash];

        if (credential.issuer == address(0)) revert CredentialNotFound();
        if (credential.status != Status.Pending && credential.status != Status.Active) {
            revert CredentialNotRevocable();
        }

        credential.status = Status.Revoked;
        emit CredentialAdminRevoked(holder, msg.sender, documentHash, uint48(block.timestamp));
    }

    /// @notice Undo a revocation. Restores the credential to `Active`.
    function reinstateCredential(address holder, bytes32 documentHash) external {
        Credential storage credential = credentials[holder][documentHash];

        if (credential.issuer == address(0)) revert CredentialNotFound();
        if (credential.issuer != msg.sender) revert NotIssuingInstitution();
        if (credential.status != Status.Revoked) revert CredentialNotRevoked();

        credential.status = Status.Active;
        emit CredentialReinstated(holder, msg.sender, documentHash, uint48(block.timestamp));
    }

    // --- Verification ---

    /// @notice Full public verification. Returns a zeroed view when no record exists.
    function verifyCredential(address holder, bytes32 documentHash) external view returns (CredentialView memory) {
        Credential memory credential = credentials[holder][documentHash];

        if (credential.issuer == address(0)) {
            return CredentialView({
                isValid: false,
                isExpired: false,
                status: Status.None,
                issuer: address(0),
                issuerName: "",
                issuedAt: 0,
                expiresAt: 0,
                metadataURI: ""
            });
        }

        bool expired = credential.expiresAt != 0 && block.timestamp >= credential.expiresAt;

        return CredentialView({
            isValid: credential.status == Status.Active && !expired,
            isExpired: expired,
            status: credential.status,
            issuer: credential.issuer,
            issuerName: issuerInfo[credential.issuer].name,
            issuedAt: credential.issuedAt,
            expiresAt: credential.expiresAt,
            metadataURI: credential.metadataURI
        });
    }

    /// @notice Convenience check used by the institution login flow.
    function isIssuer(address account) external view returns (bool) {
        return hasRole(ISSUER_ROLE, account);
    }
}
