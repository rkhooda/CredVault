import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Copy, ExternalLink, LogOut, Menu } from "lucide-react";
import metaMaskLogo from "@/assets/MetaMask-logo.png";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Identicon } from "@/components/data/Identicon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useCopy } from "@/hooks/use-copy";
import { chainName, useWallet, type WalletRole } from "@/hooks/use-wallet";
import { CHAIN_ID, ensureSepolia } from "@/lib/contract";
import { cn } from "@/lib/utils";
import { explorerAddressUrl, truncateMiddle } from "@/utils/format";

const NAV_ITEMS = [
  { path: "/", label: "Home", match: (p: string) => p === "/" },
  { path: "/verify", label: "Verify", match: (p: string) => p === "/verify" },
  { path: "/student-portal", label: "Students", match: (p: string) => p.startsWith("/student") },
  { path: "/institution-portal", label: "Institutions", match: (p: string) => p.startsWith("/institution") },
];

/** Which section of the app the current route belongs to, if any. */
function roleForPath(pathname: string): WalletRole | null {
  if (pathname.startsWith("/institution")) return "institution";
  if (pathname.startsWith("/student")) return "student";
  return null;
}

function NetworkPill({
  chainId,
  onSwitch,
  className,
}: {
  chainId: number | null;
  onSwitch: () => void;
  className?: string;
}) {
  const base = "items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";

  // No injected wallet, or its chain is not readable yet: say nothing rather
  // than accuse the user of being on the wrong network.
  if (chainId === null) return null;

  if (chainId === CHAIN_ID) {
    return (
      <span className={cn(base, "inline-flex border-border bg-muted text-muted-foreground", className)}>
        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
        {chainName(chainId)}
      </span>
    );
  }

  // Off Sepolia every write reverts, so this is an action, not a label.
  return (
    <button
      type="button"
      onClick={onSwitch}
      className={cn(
        base,
        "inline-flex border-destructive/40 bg-destructive/10 font-medium text-destructive transition-colors hover:bg-destructive/15",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
      {chainName(chainId)} — switch
    </button>
  );
}

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { copied, copy } = useCopy();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = roleForPath(location.pathname);
  const { address, chainId, disconnect } = useWallet(role);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const handleSwitchNetwork = async () => {
    try {
      await ensureSepolia();
    } catch {
      toast({
        title: "Could not switch network",
        description: "Approve the network switch in your wallet, or select Sepolia manually.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    navigate(role === "institution" ? "/institution-portal" : "/student-portal");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 rounded-sm text-foreground"
          aria-label="CredVault home"
        >
          <LogoMark className="h-6 w-6" />
          <span className="text-[17px] font-semibold tracking-tight">CredVault</span>
        </Link>

        {/* Always reachable, on every route — including the dashboards. */}
        <nav aria-label="Main" className="hidden md:flex md:items-center md:gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(location.pathname);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {address && (
            <NetworkPill
              chainId={chainId}
              onSwitch={handleSwitchNetwork}
              // On a correct chain this is reassurance, not information — it can
              // wait for a wider viewport. A wrong chain always shows.
              className={chainId === CHAIN_ID ? "hidden sm:inline-flex" : undefined}
            />
          )}

          {address && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  aria-label="Connected wallet"
                >
                  <Identicon address={address} className="h-5 w-5" />
                  <code className="hidden font-mono text-xs sm:inline">{truncateMiddle(address, 6, 4)}</code>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-72">
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <img src={metaMaskLogo} alt="" className="h-4 w-4" aria-hidden="true" />
                    <span className="text-xs text-muted-foreground">MetaMask</span>
                    <span className="ml-auto text-xs capitalize text-muted-foreground">{role}</span>
                  </div>
                  <code className="mt-2 block break-all rounded bg-muted px-2 py-1.5 font-mono text-[11px] leading-relaxed">
                    {address}
                  </code>
                </div>

                <DropdownMenuSeparator />

                <DropdownMenuItem onSelect={() => copy(address)}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copied ? "Copied" : "Copy address"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={explorerAddressUrl(address)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    View on Etherscan
                  </a>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onSelect={handleDisconnect} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <ThemeToggle />

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(20rem,85vw)]">
              <SheetTitle className="text-left text-sm font-medium text-muted-foreground">Navigate</SheetTitle>
              <SheetDescription className="sr-only">
                Site navigation and the connected wallet.
              </SheetDescription>
              <nav aria-label="Mobile" className="mt-4 flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const active = item.match(location.pathname);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-md px-3 py-2.5 text-sm transition-colors",
                        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              {address && (
                <div className="mt-6 border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <Identicon address={address} className="h-5 w-5" />
                    <code className="font-mono text-xs">{truncateMiddle(address, 8, 6)}</code>
                  </div>
                  <div className="mt-3">
                    <NetworkPill chainId={chainId} onSwitch={handleSwitchNetwork} />
                  </div>
                  <Button variant="outline" size="sm" className="mt-4 w-full" onClick={handleDisconnect}>
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Disconnect
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
