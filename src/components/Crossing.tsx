import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { buildRecommendation, type DossierEntry } from "../lib/buildRecommendation";
import type { Origin, WhenChoice } from "./helm/types";
import type { IntentId } from "../scoring/score";
import type { RecommendationResult } from "../types/recommendation";

interface CrossingProps {
  origin: Origin;
  when: WhenChoice;
  intentId: IntentId;
  /** Fires once a real recommendation is computed. dossier is every scored
   * candidate (not just the winner/runner-up) — the data the explore map draws from. */
  onComplete: (result: RecommendationResult, dossier: DossierEntry[]) => void;
  /** Fires if nothing could be computed — a real, honest failure, not silently swallowed. */
  onError: (reason: string) => void;
}

const WHEN_LOG_LABEL: Record<WhenChoice, string> = {
  tonight: "TONIGHT'S SHOWS",
  tomorrow: "TOMORROW'S SHOWS",
  weekend: "WEEKEND SHOWS",
};

// The crossing now does real work (src/lib/buildRecommendation.ts — real venue/showtime
// data plus a live call to the routing proxy), per DESIGN.md's "duration = actual latency"
// intent. MIN_VISUAL_DURATION_MS is the floor (DESIGN.md: "if data comes instantly, the
// crossing is 600ms") so the screen never flashes by unreadably fast; the real computation
// can run longer than that without penalty. FETCH_TIMEOUT_MS is a safety cap distinct from
// DESIGN.md's 1.5s *display* cap — a genuinely slow network shouldn't hang the app forever.
const MIN_VISUAL_DURATION_MS = 600;
const FETCH_TIMEOUT_MS = 8000;
const LOG_STEP_INTERVAL_MS = 300;

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(onTimeout());
      }
    }, ms);
    promise.then((value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }
    });
  });
}

/**
 * The Crossing — DESIGN.md §"3 · The Crossing (computation-as-theater)".
 * A thin gold line draws across a dark, purely geometric abstract while a
 * mono log ticks through the steps actually being checked — and, since this
 * pass wires in real data, those steps now correspond to real work: reading
 * venue/showtime data and calling the live routing proxy per candidate venue.
 */
export function Crossing({ origin, when, intentId, onComplete, onError }: CrossingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);
  const [reduceMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const logSteps = ["CHECKING SCREENS", WHEN_LOG_LABEL[when], "LIVE TRAVEL TIMES", "FARES"];

  useEffect(() => {
    let cancelled = false;

    const stepTimer = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, logSteps.length - 1));
    }, LOG_STEP_INTERVAL_MS);

    const minVisualWait = new Promise<void>((resolve) => setTimeout(resolve, MIN_VISUAL_DURATION_MS));

    const computation = withTimeout(
      buildRecommendation(origin, when, intentId),
      FETCH_TIMEOUT_MS,
      () => ({ ok: false as const, reason: "Taking too long to check live travel times. Try again." })
    );

    Promise.all([computation, minVisualWait]).then(([outcome]) => {
      if (cancelled) return;
      if (outcome.ok) {
        onComplete(outcome.result, outcome.dossier);
      } else {
        onError(outcome.reason);
      }
    });

    return () => {
      cancelled = true;
      window.clearInterval(stepTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, when, intentId]);

  useEffect(() => {
    if (reduceMotion) return; // plain ticking log only, no line-draw motion

    const path = pathRef.current;
    if (!path) return;

    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    const tween = gsap.to(path, {
      strokeDashoffset: 0,
      duration: MIN_VISUAL_DURATION_MS / 1000,
      ease: "expo.out",
    });

    return () => {
      tween.kill();
    };
  }, [reduceMotion]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-10 bg-bg px-6">
      <div className="relative flex w-full max-w-[420px] items-center justify-center">
        <svg viewBox="0 0 320 180" className="h-auto w-full" aria-hidden="true">
          {/* Pure geometry: a starting point, a few waypoint dots, a
              horizon line — never a literal map, per DESIGN.md's own
              resolution of its open question toward pure geometry. */}
          <line x1="0" y1="160" x2="320" y2="160" stroke="var(--border)" strokeWidth="1" />
          <circle cx="24" cy="140" r="4" fill="var(--gold)" />
          <circle cx="296" cy="30" r="3" fill="var(--gold-bright)" />

          {/* Under reduced motion this renders fully drawn immediately —
              the effect above skips the dash animation entirely. */}
          <path
            ref={pathRef}
            d="M24,140 C90,120 140,60 180,70 S260,50 296,30"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="flex flex-col items-center gap-2 font-mono text-[12px] uppercase tracking-widest text-ink-muted">
        {logSteps.map((step, i) => (
          <span
            key={step}
            className={i <= stepIndex ? "text-gold-bright" : "text-ink-muted opacity-40"}
          >
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

export default Crossing;
