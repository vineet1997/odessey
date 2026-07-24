import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Analytics } from "@vercel/analytics/react";
import { Prologue } from "./components/Prologue";
import { Helm } from "./components/Helm";
import { Crossing } from "./components/Crossing";
import { ResultExperience } from "./components/ResultExperience";
import type { IntentId } from "./scoring/score";
import type { HelmAnswers } from "./components/helm/types";
import type { RecommendationResult } from "./types/recommendation";
import {
  DEFAULT_RECOMMENDATION_PREFERENCES,
  type DossierEntry,
  type RecommendationPreferences,
} from "./lib/buildRecommendation";

const MadePage = lazy(() => import("./components/MadePage").then((module) => ({ default: module.MadePage })));

type Stage = "prologue" | "helm" | "crossing" | "result" | "error";

function App() {
  if (window.location.pathname === "/made") {
    return <Suspense fallback={<div className="grid min-h-screen place-items-center bg-bg font-mono text-[10px] uppercase tracking-[0.18em] text-gold-bright">Opening the build record</div>}><MadePage /></Suspense>;
  }
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
  const [constraintReason, setConstraintReason] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<RecommendationPreferences>(DEFAULT_RECOMMENDATION_PREFERENCES);
  const [pendingPreferences, setPendingPreferences] = useState<RecommendationPreferences | null>(null);
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
    setConstraintReason(null);
    setPendingPreferences(null);
    setPreferences(DEFAULT_RECOMMENDATION_PREFERENCES);
    setStage("helm"); // ithaka_visited is already set — no need to replay the Prologue
  }

  function switchIntent(intentId: IntentId) {
    if (!answers || intentId === answers.intentId) return;
    setAnswers({ ...answers, intentId });
    setStage("crossing");
  }

  function refineRecommendation(nextPreferences: RecommendationPreferences) {
    if (!answers) return;
    setConstraintReason(null);
    setPendingPreferences(nextPreferences);
    setStage("crossing");
  }

  if (stage === "prologue") {
    return (
      <>
        <Prologue onComplete={() => setStage("helm")} />
        <Analytics />
      </>
    );
  }

  if (stage === "helm") {
    return (
      <>
        <Helm
          onComplete={(helmAnswers) => {
            setAnswers(helmAnswers);
            setStage("crossing");
          }}
        />
        <Analytics />
      </>
    );
  }

  if (stage === "crossing" && answers) {
    return (
      <>
        <Crossing
          origin={answers.origin}
          when={answers.when}
          intentId={answers.intentId}
          preferences={pendingPreferences ?? preferences}
          onComplete={(computed, dossierEntries) => {
            setResult(computed);
            setDossier(dossierEntries);
            if (pendingPreferences) setPreferences(pendingPreferences);
            setPendingPreferences(null);
            setConstraintReason(null);
            setStage("result");
          }}
          onError={(reason) => {
            if (result && pendingPreferences) {
              setPendingPreferences(null);
              setConstraintReason(reason);
              setStage("result");
              return;
            }
            setErrorReason(reason);
            setStage("error");
          }}
        />
        <Analytics />
      </>
    );
  }

  if (stage === "error") {
    return (
      <>
        <ErrorScreen reason={errorReason ?? "Something went wrong."} onRetry={startOver} />
        <Analytics />
      </>
    );
  }

  if (stage === "result" && result && answers) {
    return (
      <>
        <div ref={resultRef} className="w-full">
          <ResultExperience
            result={result}
            dossier={dossier}
            origin={answers.origin}
            activeIntent={answers.intentId}
            onSwitchIntent={switchIntent}
            preferences={preferences}
            onChangePreferences={refineRecommendation}
            constraintReason={constraintReason}
            onStartOver={startOver}
          />
        </div>
        <Analytics />
      </>
    );
  }

  // Shouldn't be reachable (every stage above returns), but keeps the
  // component total rather than silently rendering nothing.
  return (
    <>
      <Helm onComplete={(helmAnswers) => { setAnswers(helmAnswers); setStage("crossing"); }} />
      <Analytics />
    </>
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
