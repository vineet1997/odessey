import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Constellation } from "./helm/Constellation";
import { SlideStage } from "./helm/SlideStage";
import { LocalityScreen } from "./helm/LocalityScreen";
import { WhenScreen } from "./helm/WhenScreen";
import { IntentScreen } from "./helm/IntentScreen";
import type { HelmAnswers, Origin, StepDirection, WhenChoice } from "./helm/types";
import type { IntentId } from "../scoring/score";

const STEPS = ["locality", "when", "intent"] as const;
type Step = (typeof STEPS)[number];

interface HelmProps {
  /** Fires once all three screens are answered, with the collected answers. */
  onComplete: (answers: HelmAnswers) => void;
}

/**
 * The Helm — DESIGN.md §"2 · The Helm". Three single-decision screens:
 * origin -> when -> intent. Each answer "sails the deck left"; back is
 * always reachable via the header's back button.
 */
export function Helm({ onComplete }: HelmProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<StepDirection>("forward");
  const [origin, setOrigin] = useState<Origin | undefined>();
  const [when, setWhen] = useState<WhenChoice | undefined>();

  const step: Step = STEPS[stepIndex];

  function goBack() {
    if (stepIndex === 0) return;
    setDirection("back");
    setStepIndex((i) => i - 1);
  }

  function advance() {
    setDirection("forward");
    setStepIndex((i) => i + 1);
  }

  function handleLocality(value: Origin) {
    setOrigin(value);
    advance();
  }

  function handleWhen(value: WhenChoice) {
    setWhen(value);
    advance();
  }

  function handleIntent(intentId: IntentId) {
    // Both prior answers are guaranteed set by the time this screen is
    // reachable — the flow only advances via the handlers above.
    if (!origin || !when) return;
    onComplete({ origin, when, intentId });
  }

  const filled = stepIndex; // screens completed so far (0-2 while in the Helm)

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg px-5 pt-6 pb-6">
      {/* Header: back button + constellation progress */}
      <div className="flex h-8 shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          aria-label="Back"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-ink-muted transition-colors duration-150 disabled:cursor-default disabled:opacity-0 hover:text-gold-bright"
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <Constellation filled={filled} />
      </div>

      {/* Current screen, sliding in per the deck motion */}
      <div className="mx-auto flex w-full max-w-[480px] flex-1 overflow-hidden">
        <SlideStage stepKey={step} direction={direction}>
          {step === "locality" && <LocalityScreen onSelect={handleLocality} />}
          {step === "when" && <WhenScreen onSelect={handleWhen} />}
          {step === "intent" && <IntentScreen onSelect={handleIntent} />}
        </SlideStage>
      </div>
    </div>
  );
}

export default Helm;
