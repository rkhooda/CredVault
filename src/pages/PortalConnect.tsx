import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Check, ExternalLink, GraduationCap, Loader2, ShieldAlert } from "lucide-react";
import metaMaskLogo from "@/assets/MetaMask-logo.png";
import { LogoMark } from "@/components/Logo";
import { AddressChip } from "@/components/data/AddressChip";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { WALLET_STORAGE_KEY, chainName, useWallet, type WalletRole } from "@/hooks/use-wallet";
import { CHAIN_ID, ensureSepolia, getContract, getInjectedProvider, getReadOnlyProvider } from "@/lib/contract";
import { describeError } from "@/lib/issuance";

const METAMASK_INSTALL_URL = "https://metamask.io/download/";

const ROLES = {
  student: {
    title: "Student portal",
    lede: "Connect the wallet your credentials were issued to. It holds the keys that decrypt them and the authority to accept or decline what an institution sends you.",
    icon: GraduationCap,
    dashboard: "/student-dashboard",
    requirement: null as string | null,
  },
  institution: {
    title: "Institution portal",
    lede: "Connect the wallet registered as an issuer. Issuance is signed by this account, and only it can later revoke what it issued.",
    icon: Building2,
    dashboard: "/institution-dashboard",
    requirement: "This wallet must already hold ISSUER_ROLE on the contract. The platform admin grants it.",
  },
} as const;

type Phase = "idle" | "connecting" | "checking" | "switching";

const PHASE_LABEL: Record<Exclude<Phase, "idle">, string> = {
  connecting: "Check your wallet…",
  checking: "Verifying issuer role…",
  switching: "Confirm the network switch…",
};

interface PortalConnectProps {
  role: WalletRole;
}

/**
 * One connect screen for both portals.
 *
 * Previously these were two near-identical .jsx files styled by a separate
 * 192-line stylesheet that ignored the design system, reporting errors through
 * alert() and reading window.ethereum directly.
 */
export default function PortalConnect({ role }: PortalConnectProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const config = ROLES[role];
  const RoleIcon = config.icon;

  const { address, chainId } = useWallet(role);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(true);

  useEffect(() => setHasWallet(Boolean(getInjectedProvider())), []);

  const connect = async () => {
    setError(null);

    const ethereum = getInjectedProvider();
    if (!ethereum) {
      setHasWallet(false);
      setError("No Ethereum wallet detected in this browser.");
      return;
    }

    try {
      setPhase("connecting");

      // wallet_requestPermissions forces the account picker every time, so a
      // shared machine can switch between accounts instead of silently reusing
      // whichever one MetaMask connected last.
      await ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
      const account = accounts?.[0];
      if (!account) return; // Picker dismissed without choosing.

      // The role check runs against a read-only Sepolia provider, so it is
      // correct whatever network the wallet is currently on — and an
      // unauthorised wallet is never asked to switch networks.
      if (role === "institution") {
        setPhase("checking");
        try {
          if (!(await getContract(getReadOnlyProvider()).isIssuer(account))) {
            setError(
              "This wallet is not authorised as an issuer. Ask the platform admin to grant it ISSUER_ROLE, then try again.",
            );
            return;
          }
        } catch {
          setError("Could not reach Sepolia to check the issuer role. Check your connection and try again.");
          return;
        }
      }

      setPhase("switching");
      await ensureSepolia();

      localStorage.setItem(WALLET_STORAGE_KEY[role], account);
      navigate(config.dashboard);
    } catch (err) {
      const message = describeError(err);
      // A rejected prompt is a decision, not a failure — say so without alarm.
      if (message === "Rejected in wallet.") {
        setError("Connection cancelled. Approve the request in your wallet to continue.");
      } else {
        setError(message);
        toast({ title: "Could not connect", description: message, variant: "destructive" });
      }
    } finally {
      setPhase("idle");
    }
  };

  const busy = phase !== "idle";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-muted">
          <RoleIcon className="h-4.5 w-4.5 text-foreground" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">{config.title}</h1>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{config.lede}</p>

      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        {/* The pairing this screen is actually about. */}
        <div className="flex items-center justify-center gap-5">
          <div className="flex flex-col items-center gap-2">
            <span className="grid h-12 w-12 place-items-center rounded-lg border border-border bg-background">
              <LogoMark className="h-6 w-6" />
            </span>
            <span className="text-[11px] text-muted-foreground">CredVault</span>
          </div>

          <span className="mb-6 h-px w-10 bg-border-strong" aria-hidden="true" />

          <div className="flex flex-col items-center gap-2">
            <span className="grid h-12 w-12 place-items-center rounded-lg border border-border bg-background">
              <img src={metaMaskLogo} alt="" className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="text-[11px] text-muted-foreground">MetaMask</span>
          </div>
        </div>

        <div className="rule-engraved my-6" />

        {address ? (
          <div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-success" aria-hidden="true" />
              <span className="font-medium">Wallet connected</span>
            </div>
            <div className="mt-3 rounded-md border border-border bg-muted/60 px-3 py-2.5">
              <AddressChip address={address} size="sm" />
            </div>
            <Button className="mt-4 w-full" onClick={() => navigate(config.dashboard)}>
              Continue to dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={connect} disabled={busy}>
              Use a different wallet
            </Button>
          </div>
        ) : hasWallet ? (
          <Button className="w-full" size="lg" onClick={connect} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {PHASE_LABEL[phase as Exclude<Phase, "idle">]}
              </>
            ) : (
              <>
                <img src={metaMaskLogo} alt="" className="h-4 w-4" aria-hidden="true" />
                Connect wallet
              </>
            )}
          </Button>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">
              This portal needs a browser wallet. MetaMask is the one CredVault is tested against.
            </p>
            <Button asChild className="mt-4 w-full">
              <a href={METAMASK_INSTALL_URL} target="_blank" rel="noopener noreferrer">
                Install MetaMask
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-foreground/80">{error}</p>
          </div>
        )}

        {/* Which network is required, and which one the wallet is on right now. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>Requires</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2 py-0.5 font-medium text-foreground">
            {chainName(CHAIN_ID)}
          </span>
          {chainId !== null && chainId !== CHAIN_ID && (
            <span className="text-destructive">· wallet is on {chainName(chainId)}, it will be asked to switch</span>
          )}
        </div>
      </div>

      {config.requirement && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{config.requirement}</p>}
    </div>
  );
}
