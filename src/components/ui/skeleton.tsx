import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // `shimmer` (index.css) sweeps a sheen across the block. Chosen over a pulse
  // so a grid of skeletons reads as one loading surface rather than flashing.
  return <div className={cn("shimmer rounded-md bg-muted", className)} {...props} />;
}

export { Skeleton };
