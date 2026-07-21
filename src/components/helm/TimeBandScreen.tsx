import type { TimeBand } from "./types";

interface TimeBandScreenProps {
  onSelect: (band: TimeBand) => void;
}

const OPTIONS: { id: TimeBand; label: string; hint: string }[] = [
  { id: "matinee", label: "Matinee", hint: "Daylight showing, the softest prices." },
  { id: "evening", label: "Evening", hint: "Prime time — the fullest houses." },
  { id: "night", label: "Night", hint: "Last show. Worth checking the way home." },
];

/** Screen 3 — one decision: which time band. */
export function TimeBandScreen({ onSelect }: TimeBandScreenProps) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <h1 className="font-display text-[26px] tracking-wide text-ink">What time of day?</h1>
      <p className="mt-1 font-body text-[14px] text-ink-muted">
        This shapes the price band and the last-train verdict.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className="flex min-h-[80px] cursor-pointer flex-col justify-center gap-1 rounded-[10px] border border-border bg-bg-raised px-6 py-4 text-left transition-transform duration-150 hover:border-gold/40 active:scale-[0.97]"
          >
            <span className="font-display text-[20px] tracking-wide text-ink">{opt.label}</span>
            <span className="font-body text-[14px] text-ink-muted">{opt.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
