import { INTENTS, type IntentId } from "../../scoring/score";

interface IntentScreenProps {
  onSelect: (intentId: IntentId) => void;
}

/**
 * Editorial description lines, one per intent, matching the flavor of
 * BRIEF.md §"The three intents" table. Not sourced from score.ts (which
 * only carries the numeric weights + label) — written fresh here since the
 * copy itself lives in the UI layer, not the scoring engine.
 */
const INTENT_COPY: Record<IntentId, string> = {
  "full-epic": "Experience dominates. Cost and distance are tiebreakers.",
  "worth-every-rupee":
    "Experience per rupee — ticket and travel, both ways. Rewards strong screens when the complete-night cost stays proportionate.",
  "easy-evening":
    "Door-to-door time and a certain way home dominate. We'll never send you to a bad screen — but a great one buys nothing extra here.",
};

/**
 * Screen 4 — one decision: what matters most. Options are sourced from
 * `INTENTS` in src/scoring/score.ts (the id/label source of truth), not
 * hardcoded, per this build's instructions.
 */
export function IntentScreen({ onSelect }: IntentScreenProps) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <h1 className="font-display text-[26px] tracking-wide text-ink">What matters most?</h1>
      <p className="mt-1 font-body text-[14px] text-ink-muted">Pick the lens for tonight.</p>

      <div className="mt-8 flex flex-col gap-4">
        {Object.values(INTENTS).map((intent) => (
          <button
            key={intent.id}
            type="button"
            onClick={() => onSelect(intent.id)}
            className="flex min-h-[88px] cursor-pointer flex-col justify-center gap-1.5 rounded-[10px] border border-border bg-bg-raised px-6 py-4 text-left transition-transform duration-150 hover:border-gold/40 active:scale-[0.97]"
          >
            <span className="font-display text-[20px] tracking-wide text-ink">{intent.label}</span>
            <span className="font-body text-[14px] leading-snug text-ink-muted">
              {INTENT_COPY[intent.id]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
