import type { WhenChoice } from "./types";

interface WhenScreenProps {
  onSelect: (when: WhenChoice) => void;
}

const OPTIONS: { id: WhenChoice; label: string; hint: string }[] = [
  { id: "tonight", label: "Tonight", hint: "The next show you can still make." },
  { id: "tomorrow", label: "Tomorrow", hint: "Tomorrow's full schedule, morning to midnight." },
  { id: "weekend", label: "This weekend", hint: "The best of Saturday and Sunday." },
];

/** Screen 2 — one decision: when. Replaces the old separate day + time-band
 * screens with a single, more useful choice (see buildRecommendation.ts for
 * how each option resolves to real target dates). */
export function WhenScreen({ onSelect }: WhenScreenProps) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <h1 className="font-display text-[26px] tracking-wide text-ink">When are you going?</h1>

      <div className="mt-8 flex flex-col gap-4">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            className="flex min-h-[96px] cursor-pointer flex-col justify-center gap-1 rounded-[10px] border border-border bg-bg-raised px-6 py-5 text-left transition-transform duration-150 hover:border-gold/40 active:scale-[0.97]"
          >
            <span className="font-display text-[22px] tracking-wide text-ink">{opt.label}</span>
            <span className="font-body text-[14px] text-ink-muted">{opt.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default WhenScreen;
