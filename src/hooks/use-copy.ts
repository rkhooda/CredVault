import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard with a short "copied" acknowledgement.
 *
 * The confirmation is local to the control that was clicked rather than a toast:
 * copying a hash is a low-stakes action that happens often, and a toast for each
 * one would be noise.
 */
export function useCopy(resetAfterMs = 1600) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // Older browsers and non-secure contexts have no async clipboard.
        const field = document.createElement("textarea");
        field.value = value;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      }
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetAfterMs);
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
