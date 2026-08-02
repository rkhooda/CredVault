import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * A deterministic 5×5 glyph derived from an address — the same wallet always
 * draws the same mark, so a user can recognise "their" account before reading
 * the hex.
 *
 * Deliberately monochrome. Classic blockies pick loud random hues, which would
 * fight a palette built on one accent; two alphas of the current colour carry
 * the same recognition without the noise.
 */
function patternFor(address: string): boolean[] {
  // xorshift seeded from the address, as blockies does — cheap and stable.
  const seed = [0, 0, 0, 0];
  for (let i = 0; i < address.length; i++) {
    seed[i % 4] = (seed[i % 4] << 5) - seed[i % 4] + address.charCodeAt(i);
  }

  const next = () => {
    const t = seed[0] ^ (seed[0] << 11);
    seed[0] = seed[1];
    seed[1] = seed[2];
    seed[2] = seed[3];
    seed[3] = seed[3] ^ (seed[3] >> 19) ^ t ^ (t >> 8);
    return (seed[3] >>> 0) / 4294967296;
  };

  // Build the left three columns and mirror them, so every glyph is symmetric.
  const cells: boolean[] = new Array(25).fill(false);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      const on = next() > 0.5;
      cells[y * 5 + x] = on;
      cells[y * 5 + (4 - x)] = on;
    }
  }
  return cells;
}

interface IdenticonProps {
  address: string;
  className?: string;
}

export function Identicon({ address, className }: IdenticonProps) {
  const cells = useMemo(() => patternFor(address.toLowerCase()), [address]);

  return (
    <svg
      viewBox="0 0 5 5"
      className={cn("shrink-0 rounded-[3px] bg-muted text-foreground", className)}
      aria-hidden="true"
      focusable="false"
    >
      {cells.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={i % 5}
            y={Math.floor(i / 5)}
            width="1"
            height="1"
            fill="currentColor"
            // Alternate alpha gives the glyph depth without a second hue.
            opacity={(i * 7) % 3 === 0 ? 0.45 : 0.9}
          />
        ) : null,
      )}
    </svg>
  );
}
