import { Link, useLocation, useNavigate } from "react-router-dom";
import { Shield, User, Building, Search, Wallet, ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/logo.png";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  // Dashboard route detection
  const isStudentDashboard = location.pathname === "/student-dashboard";
  const isInstitutionDashboard = location.pathname === "/institution-dashboard";
  const isDashboard = isStudentDashboard || isInstitutionDashboard;

  const navItems = [
    { path: "/", label: "Home", icon: Shield },
    { path: "/student-portal", label: "Student", icon: User },
    { path: "/institution-portal", label: "Institution", icon: Building },
    { path: "/verify", label: "Verify", icon: Search },
  ];

  const walletKey = isInstitutionDashboard
    ? "credvault_institution_wallet"
    : "credvault_student_wallet";
  const walletAddress = localStorage.getItem(walletKey) || "";
  const metaMaskLogo = "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg";
  const accountName = "Account 1";

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
  };

  const handleLogout = () => {
    localStorage.removeItem(walletKey);
    navigate(isInstitutionDashboard ? "/institution-portal" : "/student-portal");
  };

  return (
    <nav className="glass border-b border-border/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* Logo on left */}
          <Link to="/" className="flex items-center space-x-2">
            <img src={logo} alt="CredVault Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-xl text-foreground">CredVault</span>
          </Link>

          {/* Right-side items (ml-auto) */}
          <div className="flex items-center space-x-4 ml-auto">
            {/* Show navigation portals only if NOT on dashboard */}
            {!isDashboard && navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-300 ${
                    location.pathname === item.path
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}

            {/* Wallet icon and dropdown (ONLY on dashboard routes) */}
            {isDashboard && (
              <div className="relative">
                <button
                  className="flex items-center justify-center w-14 h-10 rounded-lg bg-muted border border-border hover:bg-background transition"
                  onClick={() => setIsWalletOpen((open) => !open)}
                  aria-label="Wallet"
                >
                  <Wallet className="w-5 h-5 text-blue-500" />
                  <ChevronDown
                    className={`w-4 h-4 ml-1 transition-transform duration-200 ${isWalletOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {/* Dropdown menu */}
                {isWalletOpen && (
                  <div className="absolute right-0 mt-2 min-w-[270px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    <div className="p-4">
                      {/* MetaMask + Account Row */}
                      <div className="flex items-center gap-2 mb-2">
                        <img src={metaMaskLogo} alt="MetaMask" className="w-6 h-6" />
                        <span className="text-xs text-muted-foreground">MetaMask</span>
                        <span className="ml-auto text-xs font-semibold">{accountName}</span>
                      </div>
                      {/* Wallet address row */}
                      <div className="flex items-center gap-2 justify-between bg-muted rounded-lg p-2">
                        <span className="font-mono text-sm">{walletAddress}</span>
                        <button
                          onClick={copyAddress}
                          className="p-2 rounded-md hover:bg-background transition"
                          title="Copy address"
                        >
                          <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {isDashboard && (
              <button
                onClick={handleLogout}
                className="flex items-center justify-center px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 font-medium hover:bg-red-500/20 transition"
                title="Logout"
              >
                Logout
              </button>
            )}
            {/* Theme Toggle, always last on the right */}
            <ThemeToggle />
          </div>
        </div>
      </div>
      {/* Overlay to close dropdown when clicking outside */}
      {isWalletOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsWalletOpen(false)}
        />
      )}
    </nav>
  );
}
