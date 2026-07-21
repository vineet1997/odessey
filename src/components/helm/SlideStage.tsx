import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import type { StepDirection } from "./types";

interface SlideStageProps {
  stepKey: string | number;
  direction: StepDirection;
  children: ReactNode;
}

/**
 * DESIGN.md §"The Helm": "each answer sails the deck left (translate-x with
 * a barely-there 0.5° settle, expo.out, 400ms)." Going back mirrors the
 * motion from the left. Respects prefers-reduced-motion (plain 150ms fade,
 * per MASTER.md's Motion section), same pattern ResultCard.tsx uses.
 */
export function SlideStage({ stepKey, direction, children }: SlideStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" });
      return;
    }

    const fromX = direction === "forward" ? 48 : -48;
    const fromRotate = direction === "forward" ? 0.5 : -0.5;

    const tween = gsap.fromTo(
      el,
      { x: fromX, rotate: fromRotate, opacity: 0 },
      { x: 0, rotate: 0, opacity: 1, duration: 0.4, ease: "expo.out" }
    );

    return () => {
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  return (
    <div ref={containerRef} className="flex w-full flex-1 flex-col">
      {children}
    </div>
  );
}
