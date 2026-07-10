import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import './Login.css';
import logo from '@/assets/logo.png';
import { Link2 } from 'lucide-react';
import { getContract } from '@/lib/contract';

const InstitutionLogin = () => {
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [error, setError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setError("");
    setIsConnecting(true);

    try {
      if (!window.ethereum) {
        setError("MetaMask is not installed. Please install it to continue.");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      setWalletAddress(address);

      // Gate: only wallets with ISSUER_ROLE may proceed
      const contract = getContract(provider);
      const authorized = await contract.isIssuer(address);

      if (!authorized) {
        setError("This wallet is not authorized as an issuer. Contact the platform admin to be granted access.");
        return;
      }

      localStorage.setItem("walletAddress", address);
      navigate('/institution-dashboard');
    } catch (err) {
      console.error("MetaMask connection error:", err);
      setError("Failed to connect MetaMask. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const xPercent = (e.clientX - rect.left) / rect.width;
    const yPercent = (e.clientY - rect.top) / rect.height;
    card.style.transform = `perspective(1000px) rotateX(${(yPercent - 0.5) * 16}deg) rotateY(${(xPercent - 0.5) * -16}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  };

  return (
    <div className="login-container">
      <div
        className="login-box"
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <h1 className="portal-title">Institution Portal</h1>

        <div className="logo-connection">
          <div className="logo-wrapper">
            <img src={logo} alt="CredVault Logo" className="credvault-logo" />
            <span className="logo-label">CredVault</span>
          </div>

          <div className="connection-icon">
            <Link2 className="chain-icon" />
          </div>

          <div className="logo-wrapper">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
              alt="MetaMask Logo"
              className="metamask-logo"
            />
            <span className="logo-label">MetaMask</span>
          </div>
        </div>

        <button onClick={handleConnect} className="connect-btn" disabled={isConnecting}>
          {isConnecting
            ? "Connecting..."
            : walletAddress
            ? `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
            : "Connect to your MetaMask wallet"}
        </button>

        {error && (
          <p style={{ color: '#ef4444', marginTop: '1rem', fontSize: '0.875rem', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default InstitutionLogin;
