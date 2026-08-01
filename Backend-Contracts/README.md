# CredVault — Backend

Smart contracts and the off-chain storage layer behind CredVault.

- **Contract:** [`0x26Eb4c3f71ab6735e6c4b5a04D88fa902c46C8B3`](https://sepolia.etherscan.io/address/0x26Eb4c3f71ab6735e6c4b5a04D88fa902c46C8B3) (Sepolia, deployed at block `11398037`)
- **Tests:** 56 Foundry tests — unit, fuzz and invariant — at 100% line, branch and function coverage
- **Stack:** Solidity 0.8.30 · OpenZeppelin v5 · Foundry · Web Crypto · IPFS

---

## The idea

A credential system has to answer two separate questions, and they want different homes:

| Question | Answered by | Why there |
|---|---|---|
| *Is this credential real and still valid?* | Ethereum | Public, permanent, no server to trust or take down |
| *What does it actually say?* | Encrypted blob on IPFS | Content-addressed and durable, but must not be world-readable |

The chain holds a hash and a pointer. The pointer resolves to ciphertext. The key
that opens it never touches either.

```
Institution                        Chain (Sepolia)                Student / Verifier
-----------                        ---------------                ------------------
PDF ──keccak256──► documentHash ──► credentials[holder][hash]
 │                                    { issuer, status,
 │                                      issuedAt, expiresAt,
 │                                      metadataURI }
 ├─ K = HKDF(issuerSig(holder|hash))
 └─ AES-GCM(metadata, K) ─► /api/pin ─► IPFS ─► ipfs://CID ───┘

QR / share link carries { holder, documentHash, K }
Verifier: read chain → fetch CID → decrypt with K → re-hash the PDF
```

---

## Credential lifecycle

```
                 issueCredential()
                        │
                        ▼
   None ───────────► Pending ──── acceptCredential() ──► Active
     ▲                  │                                  │
     │                  └──── rejectCredential() ──► Rejected
     │                                                  │  │
     │                          re-issue ───────────────┘  │
     │                                                     │
     └── (slot reusable)          revokeCredential() ◄─────┤
                                        │                  │
                                        ▼                  │
                                     Revoked ── reinstateCredential() ──► Active
```

Expiry is orthogonal: a credential past `expiresAt` reports `isValid == false`
while keeping its `Active` status, because expiring is a fact about time rather
than a decision by the issuer.

### Functions

| Function | Who | Notes |
|---|---|---|
| `issueCredential(holder, hash, uri, expiresAt)` | issuer | Creates as `Pending`; `expiresAt = 0` never expires |
| `issueBatch(holders[], hashes[], uris[], expiries[])` | issuer | Up to `MAX_BATCH` (100); any bad entry reverts the whole batch |
| `acceptCredential(hash)` / `rejectCredential(hash)` | holder | Consent lives with the holder alone |
| `revokeCredential(holder, hash)` | **issuing** institution | Not merely any issuer — see below |
| `reinstateCredential(holder, hash)` | issuing institution | Undoes a mistaken revocation |
| `adminRevoke(holder, hash)` | admin | Distinct event so the power is auditable |
| `registerIssuer(addr, name, accreditation, site)` | admin | Grants role and identity together |
| `deregisterIssuer(addr)` | admin | Stops future issuance; past credentials stay valid |
| `pause()` / `unpause()` | admin | Halts issuance only |
| `verifyCredential(holder, hash)` | anyone | Returns validity, status, issuer name, expiry and URI |

---

## Threat model

**What the chain proves.** That a specific address, at a specific time, asserted a
credential identified by `documentHash` to a specific holder, and whether that
assertion still stands. Anyone can check this without permission.

**What it does not prove.** That the issuing address is who it claims to be. That
trust comes from the registry, and the registry is only as good as the admin who
curates it. This is the honest limit of the design: trust moves from "call the
registrar and hope they answer" to "trust one curated list, publicly auditable" —
not to zero.

| Concern | Mitigation | Residual risk |
|---|---|---|
| One institution revoking another's credentials | `revokeCredential` checks `credential.issuer == msg.sender` | — |
| Unsolicited credentials spamming an address | Credentials start `Pending`; only the holder can activate | An issuer can still create pending noise |
| Credential contents public forever | AES-256-GCM before pinning; key never on-chain or on IPFS | Issuance timing and the holder/issuer pair are public |
| Guessing a credential from an address | `documentHash` is keccak256 of the file bytes | — |
| Forged or altered certificate | Verifier re-hashes the file against the chain | — |
| Compromised or defunct institution | `deregisterIssuer` plus auditable `adminRevoke` | Admin is a trusted party |
| Lost decryption key | Passphrase-protected backup; issuer can re-derive by re-signing | Losing both means the metadata is unreadable |
| Lost wallet key | **None** | Credentials are unreachable. See Limitations |

### What v1 got wrong

Three real defects this design replaces, kept here because they are the reason
for the choices above:

1. **`documentHash` hashed nothing.** It was
   `keccak256(abi.encodePacked(address, title, type))`. Packed encoding of two
   dynamic strings collides — `("AB","C")` and `("A","BC")` produce an identical
   hash — and the inputs were low-entropy enough to brute-force from an address
   alone. Two credentials with the same title could also never coexist.
2. **Any issuer could revoke any credential.** `revokeCredential` was gated on
   `ISSUER_ROLE` but never checked which institution issued the record.
3. **Credentials had no content.** Titles lived in the issuing browser's
   `localStorage`, so a student on another device saw a blank placeholder.

---

## Key management

```
K = HKDF-SHA256( issuerSignature("CredVault-key-v1|<holder>|<documentHash>") )
```

ECDSA signing is deterministic (RFC 6979), so the issuing institution can
regenerate any key by re-signing the same message. There is no key database
anywhere, and a student who loses their copy can always be re-issued it.

**Trade-offs, stated plainly:**

- The issuer can always decrypt what it issued. For a registrar this is expected,
  but it does mean the holder is not the sole reader.
- This relies on deterministic ECDSA. A production system would encrypt K to the
  holder's public key instead, which needs a pubkey the holder has published —
  MetaMask removed the API that exposed one.
- Whoever receives a share QR can read that credential forever. There is no
  revocation of a shared key.

---

## Setup

```bash
forge install                 # from Backend-Contracts/
npm run contract:build        # from the repo root
npm run contract:test
npm run contract:coverage
```

### Deploying

`.env` in `Backend-Contracts/` (gitignored):

```bash
PRIVATE_KEY=0x...             # must be 0x-prefixed
SEPOLIA_RPC_URL=https://...
```

Optional overrides — all default sensibly:

```bash
ADMIN_ADDRESS=0x...                  # default: deployer
INITIAL_ISSUER=0x...                 # default: deployer
INITIAL_ISSUER_NAME="Your University"
INITIAL_ISSUER_ACCREDITATION=...
INITIAL_ISSUER_WEBSITE=https://...
```

```bash
npm run contract:deploy
```

Then take the real deployment block from
`broadcast/DeployVault.s.sol/11155111/run-latest.json` (**not** the script's log
— during a broadcast `block.number` is the simulation block) and update
`DEPLOYMENT_BLOCK` and `CONTRACT_ADDRESS` in `src/lib/contract.ts`, then run
`npm run contract:abi` to regenerate the frontend ABI.

### Pinning

`api/pin.ts` is a serverless function holding `PINATA_JWT`. Deploy it anywhere
that accepts a Fetch handler (Vercel, Cloudflare Workers, Netlify Edge) and point
the frontend at it with `VITE_PIN_ENDPOINT`. The JWT must never become a `VITE_`
variable — those are compiled into the public bundle.

---

## Limitations

Known and deliberate, rather than overlooked:

- **No wallet recovery.** Lose the private key and the credentials are
  unreachable. A production system needs social recovery or an account-abstraction
  wallet; this is the single biggest gap versus a custodial system like DigiLocker.
- **Admin is a trusted role.** It curates the registry and can force-revoke. A
  multisig or DAO would be the next step.
- **Not upgradeable.** Fixing the contract means deploying a new one and
  migrating. A proxy was left out to keep the trust story simple.
- **Sepolia only.** A testnet offers no durability guarantee. Production belongs
  on an L2 (Base, Arbitrum) where issuance costs a fraction of a cent.
- **Metadata timing is public.** Encryption hides *what* a credential says, not
  that a given issuer credentialled a given address at a given time.
- **Pinning is centralised on Pinata.** The CID is portable and anyone can re-pin,
  but if nobody does, the content can disappear even though the chain record stays.
