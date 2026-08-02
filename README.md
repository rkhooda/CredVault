# 🛡️ CredVault

### **Secure, Decentralized Credential Management on the Blockchain**

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Solidity](https://img.shields.io/badge/Solidity-%23363636.svg?style=flat-square&logo=solidity&logoColor=white)](https://docs.soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Foundry-f0f0f0?style=flat-square&logo=rust&logoColor=black)](https://book.getfoundry.sh/)

---

## 🌟 Overview

**CredVault** is a next-generation blockchain-powered platform designed for the secure issuance, storage, and verification of academic and professional credentials. By leveraging the **Ethereum** blockchain (currently deployed on **Sepolia** testnet), CredVault ensures that every credential is immutable, transparent, and instantly verifiable from anywhere in the world.

> "Own your education. Verify globally."

---

## ✨ Key Features

-   🔗 **Real Document Binding**: `documentHash` is keccak256 of the certificate's actual bytes. A verifier can upload the file and prove it is byte-for-byte the one that was issued.
-   🔐 **Encrypted, Not Public**: Credential contents are AES-256-GCM encrypted before they reach IPFS. The chain proves validity; only someone the holder shares a key with can read the details.
-   ✋ **Holder Consent**: Credentials arrive `Pending` and only become active once the student accepts on-chain. No institution can write to your identity unprompted.
-   🏛️ **On-Chain Issuer Registry**: Verifiers see "Delhi Technological University", not `0x8cb784…`, with accreditation reference and website.
-   🚫 **Correct Revocation**: Only the institution that issued a credential can revoke it — and mistaken revocations can be reinstated.
-   ⏳ **Expiry Support**: Licences and certifications can expire without needing revocation.
-   📦 **Batch Issuance**: Up to 100 credentials in a single transaction.
-   🧪 **100% Contract Coverage**: 56 Foundry tests including fuzz and invariant suites.

---

## 🆚 How this compares to DigiLocker

Worth being clear-eyed about, because they solve overlapping but different problems.

**Where CredVault is genuinely better**

-   **Verification needs no permission and no server.** An employer anywhere reads the record straight from a public chain. DigiLocker verification depends on a central service being online and granting access.
-   **Tamper-evidence is mathematical, not institutional.** The guarantee is "recompute the hash", not "trust the database".
-   **Revocation is transparent.** Every revoke is a public, timestamped, attributable event. A central database can change a record silently.
-   **It survives the issuer.** If a university shuts down, its credentials remain verifiable.

**Where DigiLocker is still ahead**

-   **Legal standing.** DigiLocker documents are legally equivalent to originals under the IT Act. A testnet record is not.
-   **Identity and recovery.** Aadhaar-linked accounts can be recovered. Lose your wallet key here and the credentials are unreachable.
-   **No wallet needed**, and no gas.

The honest positioning: this is not a DigiLocker replacement. It is an **issuer-independent verification layer** — strongest for cross-border checks, for issuers with no government feed, and wherever revocation needs to be publicly auditable.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Blockchain Interaction**: [Ethers.js](https://docs.ethers.org/v6/)

### **Backend & Blockchain**
- **Smart Contracts**: [Solidity](https://docs.soliditylang.org/)
- **Development Framework**: [Foundry](https://book.getfoundry.sh/) (Forge, Anvil, Cast)
- **Network**: [Sepolia Testnet](https://sepolia.etherscan.io/) (EVM-compatible — deployable to any EVM chain)

---

## 📁 Project Structure

```text
CredVault/
├── Backend-Contracts/      # Solidity contracts & Foundry setup (see its README)
│   ├── src/                # CredentialVault.sol
│   ├── test/               # Unit, fuzz and invariant suites
│   └── script/             # Deployment scripts
├── api/
│   └── pin.ts              # Serverless IPFS pinning proxy (holds the Pinata JWT)
├── scripts/
│   └── generate-abi.mjs    # Derives the frontend ABI from the build artifact
├── src/
│   ├── lib/
│   │   ├── contract.ts     # Addresses, RPC failover, event queries
│   │   ├── crypto.ts       # AES-GCM + HKDF key derivation
│   │   ├── documentHash.ts # keccak256 over file bytes
│   │   ├── ipfs.ts         # Pinning and gateway-resilient fetch
│   │   ├── credentials.ts  # Domain layer over the contract
│   │   ├── issuance.ts     # The full issue pipeline
│   │   └── keyVault.ts     # Local key storage (keys only, never data)
│   ├── components/         # Reusable UI components
│   └── pages/              # Main application pages
└── public/                 # Static assets
```

---

## 🚀 Getting Started

### **1. Clone the Repository**
```bash
git clone https://github.com/Rkhooda07/CredVault.git
cd CredVault
```

### **2. Frontend Setup**
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Copy `.env.example` to `.env.local` and adjust if you are pointing at your own deployment.

### **3. Smart Contracts (Foundry)**
```bash
npm run contract:build
npm run contract:test        # 56 tests
npm run contract:coverage
npm run contract:abi         # regenerate the frontend ABI after contract changes
```

### **4. Unit tests**
```bash
npm test                     # crypto layer (vitest)
```

---

## 🛡️ Security & Verification

The chain answers *"is this valid?"*; an encrypted IPFS blob answers *"what does it say?"*. The key that opens it is never on-chain and never on IPFS.

Full architecture, threat model, key-management trade-offs and known limitations are documented in [`Backend-Contracts/README.md`](Backend-Contracts/README.md).

---

## 🌐 Deployment

### **Frontend**
The frontend is configured for deployment via [GitHub Pages](https://pages.github.com/).
```bash
npm run deploy
```

Issuance also needs the pinning proxy in `api/` deployed somewhere that can hold a secret (Vercel, Cloudflare Workers), with `VITE_PIN_ENDPOINT` pointing at it.

### **Smart Contracts**
Deployable to any EVM chain — see [`Backend-Contracts/README.md`](Backend-Contracts/README.md) for the full deploy procedure.

**Current deployment:** [`0x26Eb4c3f71ab6735e6c4b5a04D88fa902c46C8B3`](https://sepolia.etherscan.io/address/0x26Eb4c3f71ab6735e6c4b5a04D88fa902c46C8B3) on Sepolia.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/Rkhooda07">Rkhooda07</a>
</p>
