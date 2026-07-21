import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Prologue } from "./components/Prologue";
import { Helm } from "./components/Helm";
import { Crossing } from "./components/Crossing";
import { ResultCard } from "./components/ResultCard";
import { sampleResult } from "./fixtures/sampleResult";
import type { HelmAnswers } from "./components/helm/types";

type Stage = "prologue" | "helm" | "crossing" | "result";

function App() {
  const [stage, setStage] = useState<Stage>(() =>
    localStorage.getItem("ithaka_visited") ? "helm" : "prologue"
  );
  const [answers, setAnswers] = useState<HelmAnswers | null>(null);
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

  if (stage === "crossing") {
    return <Crossing onComplete={() => setStage("result")} />;
  }

  // NOTE: `answers` holds the user's real picks from the Helm, but
  // ResultCard still renders the static `sampleResult` fixture — there is
  // no live venue/showtime/routing pipeline yet (see BRIEF.md "Next" steps
  // and the task brief for this pass). Wiring the user's actual locality/
  // day/time-band/intent into a real scored result is future work once
  // that data pipeline exists; this pass only proves the click-through
  // flow feels complete end to end.
  void answers;
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div ref={resultRef} className="w-full">
        <ResultCard result={sampleResult} />
      </div>
    </div>
  );
}

export default App;
