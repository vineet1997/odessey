import { Star } from "lucide-react";

interface ConstellationProps {
  /** How many of the 3 screens have been answered (0-3). */
  filled: number;
}

/**
 * DESIGN.md §"The Helm": "Progress is a constellation: stars, filling
 * as you answer." Three small stars (one per Helm screen — locality, when,
 * intent), muted until answered, gold once completed.
 */
export function Constellation({ filled }: ConstellationProps) {
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={filled}>
      {[0, 1, 2].map((i) => {
        const isFilled = i < filled;
        return (
          <Star
            key={i}
            size={14}
            strokeWidth={1.5}
            className="transition-colors duration-300"
            style={{ color: isFilled ? "var(--gold)" : "var(--ink-muted)" }}
            fill={isFilled ? "var(--gold)" : "none"}
          />
        );
      })}
    </div>
  );
}
