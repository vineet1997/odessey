import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

interface CrossingProps {
  /** Fires automatically once the crossing's placeholder duration elapses. */
  onComplete: () => void;
}

const LOG_STEPS = ["CHECKING 14 SCREENS", "TONIGHT'S SHOWS", "LAST TRAINS", "FARES"];

// NOTE: there is no live routing/scoring call in this codebase yet (no
// scraper, no routing proxy — see BRIEF.md's "Next" steps). DESIGN.md's
// spec is for this duration to equal *actual* latency capped at 1.5s, but
// since there is nothing real to time yet, this is a fixed placeholder
// comfortably under that cap. Once a real routing proxy exists, replace
// this timer with the real request's resolve time (still capped at 1.5s).
const PLACEHOLDER_DURATION_MS = 1200;
const STEP_INTERVAL_MS = PLACEHOLDER_DURATION_MS / LOG_STEPS.length; // ~300ms/step

/**
 * The Crossing — DESIGN.md §"3 · The Crossing (computation-as-theater)".
 * A thin gold line draws across a dark, purely geometric abstract (a few
 * lines/dots suggesting a path toward a horizon — per DESIGN.md's own
 * open question, resolved toward pure geometry rather than a real map)
 * while a mono log ticks through the steps being "checked". Auto-advances
 * via onComplete once the placeholder duration elapses.
 */
export function Crossing({ onComplete }: CrossingProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);
  const [reduceMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const stepTimer = window.setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, LOG_STEPS.length - 1));
    }, STEP_INTERVAL_MS);

    const completeTimer = window.setTimeout(() => {
      onComplete();
    }, PLACEHOLDER_DURATION_MS);

    return () => {
      window.clearInterval(stepTimer);
      window.clearTimeout(completeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduceMotion) return; // plain ticking log only, no line-draw motion

    const path = pathRef.current;
    if (!path) return;

    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    const tween = gsap.to(path, {
      strokeDashoffset: 0,
      duration: PLACEHOLDER_DURATION_MS / 1000,
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
        {LOG_STEPS.map((step, i) => (
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
