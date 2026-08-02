import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

/**
 * The CredVault mark. A full-colour raster rather than a tinted glyph, so it
 * renders identically in both themes — the artwork already carries its own
 * contrast against light and dark surfaces.
 */
export function LogoMark({ className }: { className?: string }) {
  return <img src={logo} alt="" aria-hidden="true" className={cn("h-6 w-6 object-contain", className)} />;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">CredVault</span>
    </span>
  );
}
