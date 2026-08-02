import { cn } from "@/lib/utils";

/**
 * The CredVault mark: a document with an embossed seal breaking its corner.
 * Inlined rather than loaded as an <img> so it inherits currentColor and stays
 * correct in both themes. public/favicon.svg is the standalone static twin.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("h-6 w-6", className)} aria-hidden="true" focusable="false">
      <mask id="cv-seal-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
        <rect width="32" height="32" fill="#fff" />
        <circle cx="21.5" cy="22.5" r="7.75" fill="#000" />
      </mask>
      <g mask="url(#cv-seal-gap)">
        <path
          d="M6.25 5.5A1.5 1.5 0 0 1 7.75 4h9.19a1.5 1.5 0 0 1 1.06.44l6.31 6.31a1.5 1.5 0 0 1 .44 1.06V26a1.5 1.5 0 0 1-1.5 1.5H7.75A1.5 1.5 0 0 1 6.25 26z"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M17 4.5v6.25a1.5 1.5 0 0 0 1.5 1.5h6.25" stroke="currentColor" strokeWidth="2" />
        <path d="M10.5 15.5h6M10.5 19.5h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="21.5" cy="22.5" r="5.5" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">CredVault</span>
    </span>
  );
}
