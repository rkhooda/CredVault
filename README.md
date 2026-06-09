# 🛡️ CredVault

### **Secure, Decentralized Credential Management on the Blockchain**

[![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-blue?style=flat-square)](https://lovable.dev)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Solidity](https://img.shields.io/badge/Solidity-%23363636.svg?style=flat-square&logo=solidity&logoColor=white)](https://docs.soliditylang.org/)
[![Foundry](https://img.shields.io/badge/Foundry-f0f0f0?style=flat-square&logo=rust&logoColor=black)](https://book.getfoundry.sh/)

---

## 🌟 Overview

**CredVault** is a next-generation blockchain-powered platform designed for the secure issuance, storage, and verification of academic and professional credentials. By leveraging the **Polygon** network, CredVault ensures that every credential is immutable, transparent, and instantly verifiable from anywhere in the world.

> "Own your education. Verify globally."

---

## ✨ Key Features

-   🔒 **Blockchain-Powered Security**: Immutable storage on the Polygon network ensures credentials can never be forged or altered.
-   🌍 **Instant Global Verification**: Verify credentials in seconds using document hashes or QR codes.
-   🏛️ **Institution Dashboard**: A dedicated portal for authorized educational institutions to issue and manage digital credentials.
-   🎓 **Student Personal Vault**: A secure space for students to access, manage, and share their verified accomplishments.
-   🕵️ **Public Verifier Portal**: Easy-to-use interface for employers and third parties to validate the authenticity of credentials.
-   🔑 **Smart Contract Governance**: Robust role-based access control (RBAC) managing issuers and administrators.

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
- **Network**: [Polygon](https://polygon.technology/) (Compatible with any EVM chain)

---

## 📁 Project Structure

```text
CredVault/
├── Backend-Contracts/      # Solidity smart contracts & Foundry setup
│   ├── src/                # Smart contract source code
│   ├── test/               # Contract test suites
│   └── script/             # Deployment scripts
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/              # Main application pages
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Utility functions & configurations
├── public/                 # Static assets
└── tailwind.config.js      # Styling configuration
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

### **3. Smart Contract Setup (Foundry)**
```bash
cd Backend-Contracts

# Build contracts
forge build

# Run tests
forge test
```

---

## 🛡️ Security & Verification

CredVault uses a cryptographic hashing mechanism. When an institution issues a credential, a unique hash of the document is stored on-chain. Verification involves re-hashing the provided document and comparing it with the on-chain record, ensuring 100% integrity.

---

## 🌐 Deployment

### **Frontend**
The frontend is configured for deployment via [GitHub Pages](https://pages.github.com/).
```bash
npm run deploy
```

### **Smart Contracts**
Contracts can be deployed to the Polygon network (or any EVM-compatible chain) using the deployment scripts in `Backend-Contracts/script/`.

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
