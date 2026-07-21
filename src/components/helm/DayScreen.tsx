import type { Day } from "./types";

interface DayScreenProps {
  onSelect: (day: Day) => void;
}

const OPTIONS: { id: Day; label: string; hint: string }[] = [
  { id: "weekday", label: "Weekday", hint: "Thinner crowds, easier last trains." },
  { id: "weekend", label: "Weekend", hint: "Peak crowds, but the fullest schedule." },
];

/** Screen 2 — one decision: weekday or weekend. */
export function DayScreen({ onSelect }: DayScreenProps) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <h1 className="font-display text-[26px] tracking-wide text-ink">When are you going?</h1>
      <p className="mt-1 font-body text-[14px] text-ink-muted">Weekday or weekend.</p>

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
