# CredVault Budget Assumptions

**Planning date:** 14 October 2026  
**Total request:** ₹80,000 INR  
**Status:** Planning estimates; not vendor quotations.

## Arithmetic

| Item | INR |
|---|---:|
| Production engineering | 16,000 |
| Independent security assessment | 14,000 |
| Mainnet deployment and initial ETH reserve | 20,000 |
| Infrastructure for six months | 6,000 |
| IPFS pinning and redundancy for six months | 5,000 |
| Testing and pilot | 9,000 |
| Legal/privacy/institutional documentation | 4,000 |
| Six-month pilot maintenance | 3,000 |
| Contingency | 3,000 |
| **Total** | **80,000** |

The roadmap allocations are ₹8,000 + ₹15,000 + ₹18,000 + ₹13,000 + ₹16,000 + ₹10,000 = **₹80,000**. They are an allocation view of the same funds, not a second budget.

## Cost assumptions

### Production engineering — ₹16,000 one-time

Planning basis: approximately 80 hours at a blended ₹200/hour for release hardening and deployment work. This is not a rebuild. It covers production configuration, issuer/admin controls, pin endpoint origin and rate controls, error/transaction handling, gas and batch measurements, release automation/runbooks, and remediations arising from the scoped review. Already-completed prototype work is not charged again.

### Independent security assessment — ₹14,000 one-time

This is an allowance for a scoped independent review of Solidity permissions/lifecycle logic, Web Crypto/key handling, browser storage and QR sharing, dependency/configuration posture, and the serverless pin endpoint, plus a limited remediation allowance. It is not a guaranteed price for a full formal audit or certification. Quotes must be obtained before engagement; a full audit or major cryptographic redesign may require additional funding.

### Mainnet deployment and ETH reserve — ₹20,000 initial/variable

This is not a fixed service fee. It is a capped INR reserve used to buy ETH at the actual exchange rate and pay the selected network's actual transaction fees. It may cover contract deployment, issuer registration, pilot issuance/acceptance, and a small allowance for revocation/reinstatement/emergency administration.

Use:

`INR = gas units × gas price (gwei) × 10^-9 × ETH/INR`

Illustrative scenarios for a 3,600,000-gas deployment and ₹250,000/ETH:

| Gas price | Approximate deployment cost |
|---:|---:|
| 12 gwei | ₹10,800 |
| 20 gwei | ₹18,000 |
| 30 gwei | ₹27,000 |

These are examples, not current quotes. The checked-in Sepolia broadcast recorded about 3.54 million gas for the contract-creation receipt; mainnet gas and prices may differ. Before commitment, verify current gas, ETH/INR conversion, bytecode gas estimate, and whether the selected network is Ethereum L1 or an approved lower-cost L2. If the reserve is insufficient, the launch gate must pause or reduce scope rather than conceal the variance.

### Infrastructure — ₹6,000 for six months

Planning allocation: ₹1,000/month for a domain/hosting/RPC/monitoring mix. Existing free tiers may cover some or all early usage. The allowance is for production controls and reliability, not a claim that Vercel or any provider necessarily charges this exact amount. Confirm plan limits, function execution, logs, build minutes, domain pricing, RPC requests, and monitoring quotas.

### IPFS pinning and redundancy — ₹5,000 for six months

Planning allocation: approximately ₹833/month. It covers encrypted payload storage, a paid Pinata allowance where free quota is insufficient, a second pin/recovery path, and retention/re-pin testing. It does not assume unbounded file size, bandwidth, or indefinite retention. Confirm Pinata pricing, maximum payloads, gateway performance, and the secondary provider before using real credentials.

### Testing and pilot — ₹9,000 one-time

Covers test fixtures, browser/device checks, wallet failure tests, end-to-end transaction verification, pilot onboarding material, and bounded support for a proposed 1–2 institution/department pilot. No institution, customer, or commitment is assumed to exist today.

### Legal/privacy/institutional documentation — ₹4,000 one-time

Allowance for review and drafting of privacy notice, terms, consent wording, issuer authorization checklist, dispute handling, key-loss guidance, and credential/revocation policy. This is not a legal opinion or regulatory certification. Actual professional quotes may exceed it.

### Pilot maintenance — ₹3,000 for six months

Bounded allowance for dependency updates, minor bug fixes, incident triage, documentation updates, and support during the pilot. It is not full-time engineering or 24/7 support.

### Contingency — ₹3,000 reserve

Approximately 3.75% of the request. It is intended for fee spikes, provider quota, small launch fixes, or minor document revisions. It is not a substitute for a security audit, legal advice, a new backend, or unlimited gas.

## Estimated post-funding monthly operating cost

Fixed planning estimate: **₹2,500/month**, excluding variable Ethereum transaction fees and taxes.

| Monthly item | INR/month | Assumption |
|---|---:|---|
| Hosting/edge/API | 400 | Free tier may reduce this at low usage |
| RPC provider | 700 | Reliability allowance for historical reads and rate limits |
| IPFS pinning/redundancy | 800 | Depends on payload size, retention and redundancy |
| Monitoring/domain reserve | 200 | Annualized domain plus basic uptime/alerts |
| Maintenance/support | 400 | Bounded part-time allowance |
| **Total** | **2,500** | Planning estimate |

Variable monthly gas must be calculated from actual pilot activity. Report separately: deployment gas, issuer registration, issuance (single and batch), acceptance, revocation, reinstatement, and admin actions. Taxes, payment processor charges, ETH/INR exchange spread, and vendor price changes are excluded and must be confirmed before spending.

## Items requiring external quotation or verification

1. Current Ethereum/L2 gas estimate and ETH/INR conversion at deployment.
2. Independent security reviewer scope and fee.
3. Vercel/hosting, RPC, monitoring, domain, Pinata, and secondary pinning plans and quotas.
4. Legal/privacy professional fee and applicable tax.
5. Any institutional onboarding or support cost beyond the controlled pilot.

