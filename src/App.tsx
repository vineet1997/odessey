import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Prologue } from "./components/Prologue";
import { Helm } from "./components/Helm";
import { Crossing } from "./components/Crossing";
import { ResultExperience } from "./components/ResultExperience";
import type { IntentId } from "./scoring/score";
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
      { x: 0, opacity: 1, duration: 0.4, ease: "expo.out", clearProps: "transform" }
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
      <div ref={resultRef} className="w-full">
        <ResultExperience
          result={result}
          dossier={dossier}
          origin={answers.origin}
          activeIntent={answers.intentId}
          onSwitchIntent={switchIntent}
          onStartOver={startOver}
        />
      </div>
    );
  }

  // Shouldn't be reachable (every stage above returns), but keeps the
  // component total rather than silently rendering nothing.
  return <Helm onComplete={(helmAnswers) => { setAnswers(helmAnswers); setStage("crossing"); }} />;
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
