# CredVault — Investor Funding Proposal and Production Launch Plan

**Funding request:** ₹80,000 INR  
**Purpose:** Convert an existing Sepolia prototype into a controlled production launch and institutional pilot.  
**Evidence basis:** Repository audit of the CredVault source tree, contract tests, deployment artifacts, CI configuration, documentation, and Git history.  
**Audit date:** 14 October 2026

## 1. Executive Summary

CredVault is a working prototype for verifiable academic credentials. It combines an Ethereum smart contract for credential status and revocation, browser-side document hashing, browser-side AES-GCM encryption, IPFS storage through a serverless Pinata proxy, and wallet-based institution/student workflows. The repository contains a Vite/React application, a Solidity 0.8.30 contract using OpenZeppelin v5, Foundry tests, a Sepolia deployment artifact, CI configuration, and an end-to-end testing walkthrough.

The prototype is not yet a production credential service. The documented deployment is on Sepolia, issuer administration is controlled by a single admin role, Pinata is the effective pinning dependency, wallet/key recovery is limited, the cryptographic key derivation model has a documented production trade-off, and independent security/privacy review has not been evidenced. The live application and external explorers could not be fetched by the audit environment, so live health and current on-chain activity remain validation items.

The proposed ₹80,000 grant funds a deliberately limited launch: production engineering, a scoped independent security review, mainnet deployment and an initial ETH reserve, infrastructure and storage reliability, end-to-end QA, institutional documentation, and a controlled pilot. It does not promise mass adoption, legal recognition, or unlimited scale. It buys the evidence, controls, and operational discipline needed to decide whether CredVault is ready for broader institutional use.

## 2. Project Overview and Problem Statement

Academic credential verification is often slow and dependent on an issuer responding to a request. A verifier may need to email a registrar, wait for a manual confirmation, and trust that the response reflects an untampered record. If an institution closes or loses access to its records, proving a credential becomes harder.

CredVault separates two concerns:

- **Validity:** Ethereum records the issuer, holder, document hash, status, timestamps, and metadata pointer. Anyone can inspect the status without logging in.
- **Content:** The credential document and descriptive metadata are encrypted in the browser before being pinned to IPFS. The chain stores the content pointer, not readable credential details.

The intended value is faster independent verification, publicly inspectable revocation and reinstatement history, and reduced dependence on a single institutional database. CredVault is not presented as a DigiLocker replacement, a government credential, or automatic proof that an issuer is accredited. The issuer registry and institutional onboarding process remain trust boundaries.

## 3. Current Development Status and Evidence

### 3.1 Confirmed repository facts

| Area | Evidence in repository | Status assessment |
|---|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind, React Router, Radix UI components; pages for landing, portal connection, institution, student, verifier, and not-found states | Implemented prototype application |
| Smart contract | `Backend-Contracts/src/CredentialVault.sol`; Solidity 0.8.30 build metadata; OpenZeppelin `AccessControlEnumerable` and `Pausable` | Implemented contract design with role and lifecycle controls |
| Issuance | Single and batch issuance, up to `MAX_BATCH = 100`; credentials begin `Pending` | Implemented in contract and institution UI |
| Holder consent | `acceptCredential` and `rejectCredential`; only the holder can call them | Implemented and tested in source suite |
| Lifecycle | Issuer-only revocation/reinstatement, admin revocation, expiry, pause/unpause, issuer registry/deregistration | Implemented in contract and exposed in UI where applicable |
| Document binding | Browser computes `keccak256` over the actual file bytes in `src/lib/documentHash.ts` | Implemented; production validation still needed across file sizes and browsers |
| Encryption | Web Crypto AES-256-GCM, HKDF-SHA-256 key derivation, PBKDF2-HMAC-SHA-256 key backups at 310,000 iterations | Implemented prototype; requires independent cryptographic review |
| Storage | `src/lib/ipfs.ts` reads through multiple public gateways; `api/pin.ts` proxies Pinata `pinJSONToIPFS` server-side | Implemented; availability remains dependent on pinning and gateway operations |
| Sharing | QR/share payload includes holder, document hash, and optionally the decryption key; verifier can read proof without a wallet | Implemented; key sharing is intentionally high consequence and needs user/policy testing |
| Wallets | ethers v6, injected wallet/MetaMask, Sepolia network switching, wallet-backed institution and student actions | Implemented for the testnet workflow |
| Hosting | `vercel.json` specifies Vite build, SPA rewrites, CSP, HSTS, cache headers, and one edge function pattern | Configured for Vercel; current production settings were not independently inspected |
| CI | `.github/workflows/ci.yml` runs npm install, typecheck, lint, Vitest, build, Foundry format, build, test, and coverage | Automation is configured; latest external run result not evidenced in the checkout |
| Documentation | Root README, backend threat model/limitations, HTML/PDF testing walkthrough, screenshots, deployment instructions | Strong prototype documentation; production operations and legal documents remain |

### 3.2 Contract functionality that is actually present

The contract supports:

1. Admin registration of an issuer address with name, accreditation reference, and website.
2. Issuer-authorized single and batch credential issuance.
3. Pending credentials that require holder acceptance before becoming valid.
4. Holder rejection and issuer re-issuance after rejection.
5. Issuer-only revocation and reinstatement.
6. Admin emergency revocation and issuance pause/unpause.
7. Expiry evaluation at read time without a separate expiry transaction.
8. Public verification returning validity, expiry, lifecycle status, issuer, issuer name, dates, and metadata URI.

The contract explicitly leaves the admin trusted. The repository also states that the contract is not upgradeable, that lost wallet keys have no operator recovery, and that a new deployment would be required to fix contract logic.

### 3.3 Test and build evidence

The README and backend documentation claim 56 Foundry tests and 100% line, branch, and function coverage. The test tree contains unit, fuzz, and invariant suites covering authorization, lifecycle transitions, batch constraints, expiry, issuer registry, pause behavior, and unknown credentials. The frontend contains 18 documented Vitest crypto cases in the README.

In this audit checkout, `npm test`, typecheck, lint, and build could not execute because `node_modules` is absent (`vitest`, `tsc`, `eslint`, and `vite` were not found). Foundry compiled 39 Solidity files successfully, but local `forge test` and `forge coverage` crashed in Foundry's macOS `system-configuration` dependency before producing a result. Therefore, the report treats the test counts and coverage as documented/repository evidence, not as a freshly reproduced pass. A funded phase must rerun the complete suite in clean CI and attach artifacts.

### 3.4 Sepolia deployment evidence

The repository documents:

- **Network:** Ethereum Sepolia, chain ID `11155111`.
- **Contract:** `0x26Eb4c3f71ab6735e6c4b5a04D88fa902c46C8B3`.
- **Deployment block:** `11,398,037` in `src/lib/contract.ts` and `Backend-Contracts/README.md`.
- **Source verification claim:** exact-match Sourcify and Etherscan links in the README; this was not independently fetched during the audit.
- **Deployment broadcast:** `Backend-Contracts/broadcast/DeployVault.s.sol/11155111/run-latest.json` records successful receipts at block `0xadeb95` and the documented address.

Sepolia is a test network. A successful Sepolia deployment does not establish mainnet durability, legal effect, economic sustainability, or production availability.

### 3.5 Configured services and known dependencies

- Vercel is the documented hosting target and live-demo host.
- Pinata is the documented server-side IPFS pinning provider.
- Three public Sepolia RPC endpoints are hardcoded as read fallbacks, with optional `VITE_RPC_URL` override and chunked historical log queries.
- Four public IPFS gateways are configured as read fallbacks.
- MetaMask/injected EIP-1193 wallet support is the current transaction interface.
- No conventional database is required by the initial architecture. Blockchain events and contract state are the source of truth; local browser storage holds credential keys. A small operational database may be added later for institution onboarding, support, consent records, and analytics, but it is not a prerequisite for the first controlled pilot.

### 3.6 What is incomplete or not yet proven

The production gaps are:

- Mainnet contract selection, deployment, verification, admin handover, and gas funding.
- A production-grade admin model, preferably multisig or equivalent separation of duties.
- Independent smart-contract, cryptographic, and application security review.
- A decision on whether the current deterministic issuer-signature key derivation is acceptable for the pilot. The repository itself recommends holder-public-key encryption or account-abstraction/social recovery for a production evolution.
- Pinata quota controls, authenticated/rate-limited pinning, redundant pinning, retention checks, and recovery drills.
- Observability for RPC failures, pinning failures, failed transactions, abuse, and uptime.
- Legal/privacy review, consent language, dispute handling, institution authorization, and terms/privacy documents.
- Browser/device matrix, large-file testing, wallet failure testing, end-to-end pilot evidence, and recovery runbooks.
- Current live deployment health and actual configured environment values; these were not accessible to the audit tool.

## 4. Production Requirements and Resources

The following table distinguishes the prototype from the resources required for a limited production launch. Costs are planning estimates, not vendor quotes.

| Requirement | Purpose in simple language | Existing status | What funding enables | Estimated cost |
|---|---|---|---|---:|
| Mainnet contract and deployment engineering | Deploy the reviewed contract, verify source, record addresses, and secure admin controls | Sepolia contract and deployment script exist | Mainnet deployment plan, deployment rehearsal, verification, admin handover and runbook | ₹16,000 one-time |
| Ethereum transaction reserve | Pay for deployment, issuer registration, issuance, acceptance, revocation, reinstatement and emergency actions | Testnet gas only; no real-ETH production reserve | Initial ETH reserve with transaction budget and approval controls | ₹20,000 initial reserve |
| Gas and transaction planning | Keep costs predictable and decide whether L1 or an approved L2 is viable | No production cost model in repo | Gas measurement, batch-size benchmarks, fee alerts and monthly budget | Included in engineering; variable ETH is separate |
| RPC infrastructure | Read chain state and historical events reliably | Public Sepolia RPC failover is hardcoded | Paid/provider-backed production RPC, rate limits, failover, health checks | ₹1,000/month planning allowance |
| Frontend and edge hosting | Serve the application, API route and secure environment configuration | Vercel configuration exists | Production project settings, custom domain, build protection, logs and rollback procedure | ₹2,000 setup + included in 6-month infrastructure |
| Domain and HTTPS | Give institutions and verifiers a stable, trusted URL | Vercel URL is documented | Domain registration, DNS, certificate and recovery access | ₹1,500/year planning allowance |
| IPFS pinning | Keep encrypted credential payloads available | Pinata proxy and gateway failover exist | Paid pinning quota, encrypted retention policy, alerts and secondary pinning for pilot data | ₹800/month planning allowance |
| Backend/API controls | Prevent an anonymous user from exhausting the Pinata quota | Proxy validates method, JSON, body size and JWT presence; `ALLOWED_ORIGIN` defaults to `*` | Tight origin policy, authentication/rate limiting, abuse logging and quota monitoring | Included in engineering |
| Database/operations record | Track institutions, support cases, approvals and pilot metrics | No database required by current app | Optional small managed database only if pilot operations justify it; blockchain remains credential source of truth | ₹0 initially; revisit after pilot |
| Security and privacy review | Find weaknesses before real credentials are used | Internal comments/threat model exist; no independent review evidenced | Scoped independent review, crypto/key review, dependency scan and remediation allowance | ₹14,000 one-time |
| QA and pilot operations | Confirm the whole workflow with real institutions and controlled credentials | Manual walkthrough and screenshots exist | Browser/device matrix, test fixtures, transaction failure tests, pilot onboarding and support | ₹9,000 one-time |
| Legal and institutional readiness | Make the service understandable and responsibly adopted | No legal opinion or institution agreement in repo | Privacy/terms draft, consent and dispute process, issuer authorization checklist | ₹4,000 one-time |
| Monitoring and recovery | Detect failures and restore service or re-pin content | No production monitoring evidence | Uptime checks, alerting, backups of configuration/runbooks and recovery drill | ₹1,000/month planning allowance |
| Maintenance and support | Keep the pilot usable after launch | No paid maintenance allocation is documented | Six months of bounded support, dependency updates and incident triage | ₹3,000 one-time pilot allowance |

### Blockchain, transaction, and gas assumptions

The latest checked-in deployment broadcast records approximately 3,537,198 gas for the contract creation receipt and 237,255 gas for the follow-on deployment transaction; these are useful engineering measurements, not a mainnet price guarantee. Mainnet gas varies with bytecode, compiler settings, calldata, base fee, priority fee, congestion, and the chosen network.

For planning, use:

`INR cost = gas units × gas price in gwei × 10^-9 ETH/gas × ETH/INR rate`

Example only: 3,600,000 gas at 12 gwei and ₹250,000/ETH is about ₹10,800. At 30 gwei and the same exchange rate it is about ₹27,000. The ₹20,000 reserve therefore supports a low-to-moderate fee window or an approved lower-cost EVM network; it is not a guaranteed L1 quote. Before deployment, obtain the current gas estimate from the selected network and the live ETH/INR conversion rate, then approve a capped reserve.

Issuance cost is affected by string storage and batch size. A single issuance, holder acceptance, revocation, and reinstatement each require a separate transaction when those actions occur. Batch issuance up to 100 credentials can reduce per-credential overhead but does not remove storage cost and an invalid item reverts the whole batch. The funded phase will measure gas for the actual production bytecode and pilot batch sizes. If Ethereum L1 costs exceed the reserve, launch scope must be reduced or an L2 must be approved; the grant should not be silently treated as sufficient for unlimited transactions.

### Hosting, APIs, storage, and security

The initial production architecture can remain serverless: Vercel static/edge hosting, one protected pinning endpoint, RPC providers, IPFS pinning, and the smart contract. A database is optional and should not be purchased by default. Its first justified use would be operational data that is not suitable for the chain, such as institution application status, support records, pilot analytics, and non-sensitive delivery state.

The current pin endpoint has useful safeguards, including server-side JWT use, method checks, body-size limits, and opaque Pinata names. It also exposes a production risk because `ALLOWED_ORIGIN` defaults to `*` and there is no application-level rate limit or caller authentication. These controls must be tightened before live use. Encrypted IPFS content is content-addressed, but a CID is not a hosting guarantee: if all pinning services remove the content, the chain pointer remains while the payload becomes unavailable.

The current cryptography is a strong prototype boundary, not an audited production protocol. AES-GCM protects the uploaded payload, the document hash is calculated in the browser, and passphrase backups are encrypted. However, the key is extractable for sharing, QR recipients can retain it, and the issuer can regenerate it from a deterministic signature. A security reviewer must assess whether this is acceptable for the limited pilot and whether holder-key encryption, social recovery, or account abstraction is required before broader use.

Standards compatibility should be evaluated during the pilot, especially if institutions require W3C Verifiable Credentials, Open Badges, or an existing national credential exchange. The current repository does not evidence compliance with those standards, so the launch should describe CredVault as its own verification layer and treat standards adapters as future work unless a pilot institution requires them.

## 5. Project Development History

Exact historical start dates, spending, team size, customers, and institutional commitments are not established by the repository and are not claimed here. Git history shows a concentrated build and documentation phase, followed by deployment and operational documentation work.

| Evidence-backed phase | Repository evidence | Interpretation |
|---|---|---|
| Product and application foundation | Git commits rebuilding the application shell, portal, institution dashboard, student dashboard, verifier flow, branding, and landing page | Core user workflows were implemented rather than merely described |
| Contract and security-model refinement | `CredentialVault.sol`, Foundry tests, backend README threat model and limitations | Lifecycle and trust boundaries were explicitly modeled |
| Deployment and hosting | Vercel build configuration, Sepolia address, deployment script, broadcast artifacts, ABI generation script | A testnet demonstration path exists |
| Verification and testing documentation | End-to-end HTML/PDF walkthrough and screenshots | The prototype has a reproducible manual demonstration path |
| CI and developer workflow | GitHub Actions for frontend and contracts; Git history includes CI/build fixes | Automated checks were planned and wired into the repository |
| Recent operational documentation | Git history includes instructions for authorizing another issuer wallet | Multi-issuer administration is documented, but not yet institutionally governed |

The history supports the funding thesis: the grant is for hardening, review, deployment, and validation of an existing foundation, not for rebuilding the application from zero.

## 6. Six-Month Implementation Roadmap

### Project Progress, Funding Roadmap and Milestones

The phases below cover approximately six months after approval. Phases 1 and 2 can overlap after the initial architecture review; documentation and pilot preparation can overlap with infrastructure work. Mainnet launch remains gated by security sign-off, operational controls, and sufficient ETH.

| Phase and duration | Main activities | Deliverables | Dependencies / risks | Funding allocation | Completion criteria |
|---|---|---|---|---:|---|
| 1. Technical audit and production plan — Weeks 1–3 | Re-run frontend/contract CI in clean environments; inventory secrets/config; define launch network, roles, data flows, and acceptance tests | Signed readiness backlog, network decision, test matrix, cost model, release checklist | Local test runner needs clean CI; current live state must be confirmed | ₹8,000 | All P0/P1 gaps assigned; reproducible CI artifacts attached |
| 2. Security review and remediation — Weeks 2–7 | Independent scoped review of Solidity, Web Crypto, key backup, wallet signing, pin endpoint, dependency posture, CSP, and abuse paths | Review report, threat-model update, remediation patches, admin/key-control procedure | Review may identify work beyond the grant; full formal audit is out of scope | ₹15,000 | No unresolved critical issue; high-risk findings accepted by named owner or fixed |
| 3. Mainnet preparation and infrastructure — Weeks 5–10 | Deployment rehearsal, gas measurement, wallet/multisig setup, RPC and Pinata configuration, domain, rate limits, monitoring, backups | Verified release candidate, deployment transaction plan, configured services, runbooks | ETH price/gas volatility; provider quotas; admin key security | ₹18,000 | Release candidate builds; contracts verified; rollback/recovery drill passes |
| 4. Production deployment and reliability — Weeks 9–14 | Deploy approved contract, register pilot issuer, publish app, configure domain, test transaction flows, monitor RPC/IPFS | Production URL, verified contract address, dashboards/alerts, storage redundancy evidence | Mainnet deployment must wait for security approval and funded wallet | ₹13,000 | End-to-end credential works from issue to verification; alerts tested; availability baseline recorded |
| 5. Institutional pilot — Weeks 13–20 | Onboard 1–2 pilot institutions or departments subject to actual commitments; issue controlled sample credentials; test acceptance, sharing, verification, revocation, reinstatement and expiry | Pilot onboarding pack, signed test records, support log, privacy/consent workflow | No institutional commitment is currently evidenced; targets are proposed, not guaranteed | ₹16,000 | At least 25 test credentials and 10 independent verification runs complete, with no unresolved critical failure |
| 6. Launch evaluation and maintenance — Weeks 18–26 | Measure response times, pin recovery, transaction cost, support burden and operating cost; update docs; prioritize next funding | Pilot evaluation, cost-per-credential report, incident/recovery report, next-stage roadmap | Adoption and legal feedback may require scope changes | ₹10,000 | Board-ready evidence pack; monthly operating cost documented; go/no-go decision recorded |
| **Total** |  |  |  | **₹80,000** |  |

## 7. The Funded Outcome: CredVault Production Launch

### Target user workflow

1. An authorized institution uses its approved issuer wallet to select a credential file and recipient address.
2. The browser hashes the exact file bytes with `keccak256`; credential metadata and the file are encrypted before leaving the browser.
3. The encrypted payload is pinned through the protected serverless endpoint; the resulting IPFS CID and document hash are recorded by the contract.
4. The contract creates a `Pending` credential. The student connects the recipient wallet and accepts it, moving it to `Active`.
5. The student keeps the decryption key in browser storage and can create a passphrase-protected backup.
6. The student shares a proof/key payload through the supported share code or QR mechanism. The recipient can inspect validity and, if given the key, decrypt the details in the browser.
7. The verifier reads the contract, compares the supplied document hash, fetches the encrypted payload through gateway failover, and reports issuer, dates, status, expiry, and document integrity.
8. The issuing institution can revoke or reinstate its own credential. The admin can suspend issuance or perform an auditable emergency revocation under the defined governance policy.

The current prototype already implements the core path on Sepolia, including the contract lifecycle, browser hashing/encryption, IPFS proxy, wallet transactions, verifier view, share QR, and backup dialogs. The funded phase must prove the path under production network conditions, with real failure handling, controlled issuer onboarding, independent review, storage recovery, and documented support procedures.

### Intended production architecture

```text
Student / Institution / Verifier browser
        │  React/Vite app, wallet interactions, local cryptography
        ├──────────────► Ethereum production network
        │                 CredentialVault: issuer registry, hashes, status, dates, CID
        ├──────────────► Protected edge pinning API ───► Pinata / secondary pinning
        │                 JWT stays server-side       └► encrypted IPFS payload
        ├──────────────► RPC provider A / B with health checks
        └──────────────► Monitoring, support records and optional small operations DB
```

The blockchain is the source of truth for credential status and events. IPFS stores encrypted payloads and must be pinned redundantly. The browser remains the primary cryptographic boundary. The optional database is for operations, not for replacing the verifiable on-chain record.

### Proposed measurable outcomes

These are funded-phase targets, not existing achievements or guarantees:

- One production contract deployment with source verification and a documented admin key procedure.
- Independent scoped security review completed, with no unresolved critical finding.
- A complete production issue → accept → share → verify → revoke/reinstate/expiry test path.
- Pilot with 1–2 institutions or departments, subject to actual authorization, and at least 25 controlled credentials.
- At least 10 verifier runs by independent test participants; target median verification response under 5 seconds when RPC and gateway health checks pass, measured on a defined network/browser test setup.
- Two independent pinning or recovery paths validated for pilot payloads, with a documented re-pin procedure.
- Monthly operating cost and estimated cost per credential measured from actual pilot transactions and storage use.
- Published limitations and user-facing consent/recovery guidance.

### Honest limitations

CredVault does not eliminate institutional trust, wallet key loss, storage dependence, blockchain fees, privacy obligations, or legal uncertainty. Public records expose the holder/issuer relationship and timing even when content is encrypted. A shared key can be copied and cannot currently be revoked from a recipient. A lost wallet or lost backup may make access impractical. IPFS availability depends on pinning. Mainnet fees fluctuate. Blockchain records do not automatically receive legal recognition or replace government-issued credentials.

## 8. Funding Request and Detailed Budget

The request is **₹80,000 INR**. It is a grant/investment allocation, not a vendor invoice. Vendor quotes and live network pricing must be confirmed before committing funds.

| Expense | Work or service covered | Cost (INR) | Cost type |
|---|---|---:|---|
| Production engineering | Release hardening, role/admin controls, transaction/error handling, pin endpoint origin/rate controls, deployment runbook, measured gas and batch tests; approximately 80 hours at a blended ₹200/hour planning basis | 16,000 | One-time |
| Independent security assessment | Scoped Solidity, cryptography/key handling, API, dependency and application review plus remediation allowance; not a full formal audit | 14,000 | One-time |
| Mainnet deployment and ETH reserve | Deployment/registration/initial pilot actions, with a capped reserve purchased at the then-current ETH/INR rate; actual gas is variable | 20,000 | Variable / initial reserve |
| Infrastructure | Domain, Vercel/edge hosting allowance, RPC provider, monitoring and six months of basic operational service | 6,000 | Recurring allowance for 6 months |
| IPFS pinning and redundancy | Pinata quota, encrypted retention, secondary pin/recovery allowance and six months of pilot storage | 5,000 | Recurring allowance for 6 months |
| Testing and pilot | Browser/device matrix, end-to-end transaction tests, test credentials, pilot onboarding and support materials | 9,000 | One-time |
| Legal/privacy/institutional documentation | Privacy and terms drafts, consent language, issuer authorization and dispute/recovery procedures | 4,000 | One-time |
| Pilot maintenance | Bounded post-launch maintenance, dependency updates, incident triage and documentation updates | 3,000 | Six-month allowance |
| Contingency | Defined reserve for fee spikes, provider quota or small launch fixes; not a substitute for missing estimates | 3,000 | Reserve |
| **Total funding requested** |  | **₹80,000** |  |

The timeline allocations total the same ₹80,000 and map to these budget categories; they are not additional charges. Existing repository work is credited as completed and is not billed again.

The budget contains ₹63,000 of direct one-time/initial launch work (engineering, review, initial ETH reserve, QA/pilot, and documentation), plus ₹6,000 of six-month infrastructure, ₹5,000 of six-month IPFS/storage allowance, ₹3,000 of six-month maintenance, and ₹3,000 contingency. Thus, the planned six-month operating and reserve portion is ₹17,000; it is not an additional charge beyond the ₹80,000 request.

### What this budget does not cover

The request is deliberately sized for a secure, limited pilot. It does not cover a large formal audit, nationwide institution onboarding, mass credential issuance, a dedicated support team, full wallet/account recovery, a new credential-standard implementation, a large database/backend, or unlimited Ethereum L1 gas. Those enhancements require a later funding decision based on pilot evidence.

## 9. Estimated Recurring Operating Costs

After the six-month funded period, a small pilot is expected to require approximately **₹2,500/month**, excluding variable blockchain transactions and taxes:

| Monthly item | Planning estimate | Notes |
|---|---:|---|
| Hosting/edge/API | ₹400 | Free tiers may cover early usage; upgrade only for needed logs, limits or support |
| RPC access | ₹700 | Paid plan or credits for reliable historical reads and rate limits |
| IPFS pinning/redundancy | ₹800 | Depends on encrypted payload size, retention and second pin provider |
| Monitoring/domain reserve | ₹200 | Domain annualized plus uptime/alerting allowance |
| Maintenance/support | ₹400 | Bounded engineering time, not a full-time team |
| **Estimated fixed monthly total** | **₹2,500** | Planning estimate; vendor confirmation required |

Variable cost is ETH for issuance, acceptance, revocation, reinstatement, registration and deployment. A practical monthly estimate should be recomputed as:

`monthly INR = sum(actual gas units × selected gas price × 10^-9 × current ETH/INR rate)`

Batch issuance should be used where operationally appropriate, but it must not be treated as free. The funded phase will publish measured cost per credential for the chosen network and batch size.

## 10. Risks, Assumptions, and Mitigation

| Risk or assumption | Why it matters | Mitigation / decision gate |
|---|---|---|
| Single admin role | Admin can register/deregister issuers, pause issuance, and emergency-revoke | Use multisig or separated operational roles before production; document emergency policy |
| Deterministic issuer-derived keys | Issuer can regenerate keys; share keys are copyable; holder recovery is limited | Independent crypto review; restrict pilot data; decide whether holder-key encryption/social recovery is required |
| Wallet loss and usability | Students may not understand self-custody or lose access | Clear warnings, encrypted backups, assisted pilot onboarding, recovery policy; do not promise operator recovery |
| IPFS availability | CIDs do not keep data online by themselves | Paid pinning, secondary pinning/re-pin drill, retention alerts, encrypted-only content |
| Pinning abuse | Current `ALLOWED_ORIGIN` default is `*`; anonymous calls could consume quota | Restrict origin, add rate limiting/authentication/quotas, log failures before launch |
| RPC provider failure | Public endpoints can rate-limit historical log queries | Paid primary RPC, fallback RPC, bounded chunking, health checks and user-readable errors |
| Mainnet gas/ETH volatility | Real costs can exceed an INR reserve | Pre-deployment quote, capped reserve, low-fee window, batch issuance, or approved L2 fallback |
| Contract defects | Contract is not upgradeable; defects require migration | Independent review, clean CI, deployment rehearsal, explicit migration plan and pause control |
| Privacy and legal recognition | Public timing/addresses remain visible; blockchain record is not automatically legally recognized | Privacy/legal review, minimization, consent, terms, dispute policy, no government-equivalence claim |
| Institutional adoption | No institution or revenue commitment is evidenced in the repository | Treat 1–2 institution pilot as a target contingent on written authorization |
| Audit evidence gap | Claims in README are not the same as an independent audit or current CI result | Attach fresh CI logs, review report and signed release checklist as launch gates |
| Budget insufficiency for scale | ₹80,000 cannot finance unlimited usage or a full enterprise platform | Launch a controlled pilot; price and fund later scale from measured costs |

## 11. Expected Impact and Funding Justification

If the funded gates pass, CredVault will move from a credible Sepolia demonstration to a measured production pilot with a verified contract, secured deployment authority, tested transaction flows, monitored hosting, controlled encrypted storage, documented recovery, and institution-facing operating procedures.

The tangible impact is not a promise that blockchain alone solves credential trust. It is a narrower, testable improvement: employers and other verifiers can check the chain record and document hash without depending entirely on a registrar's response; revocation and reinstatement histories are independently inspectable; encrypted credential content is shared by the holder rather than exposed publicly; and the record can remain verifiable even if the issuer's ordinary database is unavailable.

The next funding stage is necessary because the repository already contains the core application and contract, but the risk profile changes when real institutions, real credentials, real fees, and real privacy expectations are introduced. ₹80,000 purchases the missing production evidence and controls: security review, deployment, gas, resilient infrastructure, QA, documentation, and a constrained pilot. Any decision to scale beyond that pilot should be based on measured reliability, per-credential economics, institutional feedback, and the unresolved recovery/privacy trade-offs—not on the existence of a working demo alone.
