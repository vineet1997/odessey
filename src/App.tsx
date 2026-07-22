import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { RotateCcw } from "lucide-react";
import { Prologue } from "./components/Prologue";
import { Helm } from "./components/Helm";
import { Crossing } from "./components/Crossing";
import { ResultCard } from "./components/ResultCard";
import { Dossier } from "./components/Dossier";
import { INTENTS, type IntentId } from "./scoring/score";
import type { HelmAnswers } from "./components/helm/types";
import type { RecommendationResult } from "./types/recommendation";
import type { DossierEntry } from "./lib/buildRecommendation";

type Stage = "prologue" | "helm" | "crossing" | "result" | "error";

function App() {
  const [stage, setStage] = useState<Stage>(() =>
    // sessionStorage, not localStorage: clears per browser tab/session, so a
    // fresh visit later replays the Prologue instead of skipping it forever
    // for anyone who's ever clicked Begin once on that browser (a real bug —
    // see the commit that introduced this fix for the full diagnosis).
    sessionStorage.getItem("ithaka_visited") ? "helm" : "prologue"
  );
  const [answers, setAnswers] = useState<HelmAnswers | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [dossier, setDossier] = useState<DossierEntry[]>([]);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (stage !== "result") return;
    const el = resultRef.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" });
      return;
    }

    // The Helm's last screen "sails left"; Ithaka arrives from the right,
    // per DESIGN.md's "each answer sails the deck left" deck motion.
    const tween = gsap.fromTo(
      el,
      { x: 48, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.4, ease: "expo.out" }
    );
    return () => {
      tween.kill();
    };
  }, [stage]);

  function startOver() {
    setAnswers(null);
    setResult(null);
    setErrorReason(null);
    setStage("helm"); // ithaka_visited is already set — no need to replay the Prologue
  }

  function switchIntent(intentId: IntentId) {
    if (!answers || intentId === answers.intentId) return;
    setAnswers({ ...answers, intentId });
    setStage("crossing");
  }

  if (stage === "prologue") {
    return <Prologue onComplete={() => setStage("helm")} />;
  }

  if (stage === "helm") {
    return (
      <Helm
        onComplete={(helmAnswers) => {
          setAnswers(helmAnswers);
          setStage("crossing");
        }}
      />
    );
  }

  if (stage === "crossing" && answers) {
    return (
      <Crossing
        origin={answers.origin}
        when={answers.when}
        intentId={answers.intentId}
        onComplete={(computed, dossierEntries) => {
          setResult(computed);
          setDossier(dossierEntries);
          setStage("result");
        }}
        onError={(reason) => {
          setErrorReason(reason);
          setStage("error");
        }}
      />
    );
  }

  if (stage === "error") {
    return <ErrorScreen reason={errorReason ?? "Something went wrong."} onRetry={startOver} />;
  }

  if (stage === "result" && result && answers) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center gap-5 bg-bg px-4 py-10">
        <div ref={resultRef} className="w-full">
          <ResultCard result={result} />
        </div>

        {/* Navigation, deliberately OUTSIDE the card — ResultCard is a
            screenshot object (DESIGN.md), so reconsidering shouldn't add
            chrome to the thing people actually share. */}
        <div className="flex w-full max-w-[480px] flex-col items-center gap-4">
          <IntentSwitcher active={answers.intentId} onSwitch={switchIntent} />

          <Dossier result={result} dossier={dossier} origin={answers.origin} />

          <button
            type="button"
            onClick={startOver}
            className="flex cursor-pointer items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-ink-muted transition-colors duration-150 hover:text-gold-bright"
          >
            <RotateCcw size={13} strokeWidth={1.75} />
            Start over
          </button>
        </div>
      </div>
    );
  }

  // Shouldn't be reachable (every stage above returns), but keeps the
  // component total rather than silently rendering nothing.
  return <Helm onComplete={(helmAnswers) => { setAnswers(helmAnswers); setStage("crossing"); }} />;
}

/** Re-run the same origin/when under a different intent, without
 * re-entering the Helm — DESIGN.md's "intents switchable in place... without
 * re-entering the flow" (originally scoped for tabs on the card itself; built
 * here as a control just below it instead, to keep the card clean). */
function IntentSwitcher({ active, onSwitch }: { active: IntentId; onSwitch: (id: IntentId) => void }) {
  return (
    <div className="flex w-full gap-2">
      {Object.values(INTENTS).map((intent) => {
        const isActive = intent.id === active;
        return (
          <button
            key={intent.id}
            type="button"
            onClick={() => onSwitch(intent.id)}
            className={`flex-1 cursor-pointer rounded-md border px-3 py-2 font-mono text-[11px] uppercase tracking-widest transition-colors duration-150 ${
              isActive
                ? "border-gold text-gold-bright"
                : "border-border text-ink-muted hover:border-gold/40 hover:text-gold-bright"
            }`}
          >
            {intent.label}
          </button>
        );
      })}
    </div>
  );
}

function ErrorScreen({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <p className="font-display text-[24px] text-ink">Couldn&rsquo;t find your screen tonight.</p>
      <p className="max-w-[360px] font-body text-[15px] leading-relaxed text-ink-muted">{reason}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[48px] cursor-pointer rounded-md border border-gold px-8 font-mono text-[12px] uppercase tracking-widest text-gold-bright transition-transform duration-150 active:scale-[0.97]"
      >
        Try again
      </button>
    </div>
  );
}

export default App;
