import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface PrologueProps {
  /** Fires when the user clicks "Begin" — parent moves on to the Helm. */
  onComplete: () => void;
}

const STATEMENTS = ["172 minutes.", "No IMAX 70mm anywhere in India.", "₹350 to ₹2,500 — the same film."];

/**
 * The Prologue — DESIGN.md §"1 · Prologue" / MASTER.md's "Prologue scrub
 * (the app's ONLY pinned section)". A single pinned ScrollTrigger scrubs
 * through three full-viewport statements, then releases into a closing
 * line + the "Begin" CTA. Per MASTER.md's explicit rule, this is the only
 * pinned section in the app — no other component should add `pin: true`.
 *
 * First-visit gating (localStorage `ithaka_visited`) is handled by the
 * parent (App.tsx), which decides whether to mount this component at all.
 * This component only sets the flag once the user clicks "Begin".
 */
export function Prologue({ onComplete }: PrologueProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const statementRefs = useRef<Array<HTMLDivElement | null>>([]);
  const releaseRef = useRef<HTMLDivElement>(null);
  const [reduceMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useLayoutEffect(() => {
    if (reduceMotion) return; // static stacked layout below, no ScrollTrigger at all

    const section = sectionRef.current;
    if (!section) return;

    const statements = statementRefs.current.filter(Boolean) as HTMLDivElement[];
    const release = releaseRef.current;
    if (!release) return;

    // Initial state: only the first statement visible, everything else hidden.
    gsap.set(statements.slice(1), { opacity: 0, y: 40 });
    gsap.set(release, { opacity: 0, y: 40 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        // Enough scroll distance to give each of the 3 statements + the
        // release line its own comfortable scrub window.
        end: "+=350%",
        scrub: 1,
        pin: true,
      },
    });

    statements.forEach((el, i) => {
      if (i > 0) {
        // Fade out the previous statement as this one fades in.
        tl.to(statements[i - 1], { opacity: 0, y: -40, duration: 1 }, ">0.2");
        tl.fromTo(el, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }, "<");
      }
      // Hold each statement on screen for a beat before advancing.
      tl.to({}, { duration: 0.6 });
    });

    // Release the final statement and bring in the closing line + CTA.
    tl.to(statements[statements.length - 1], { opacity: 0, y: -40, duration: 1 }, ">0.2");
    tl.fromTo(release, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1 }, "<");

    // Cinzel's font-swap can shift metrics after the pin/scroll distances
    // are computed, throwing off the pin's start/end math — refresh once
    // fonts are actually ready. Fall back to a short timeout if the
    // Font Loading API promise never resolves for some reason.
    let refreshed = false;
    const refresh = () => {
      if (refreshed) return;
      refreshed = true;
      ScrollTrigger.refresh();
    };
    document.fonts?.ready?.then(refresh).catch(() => {});
    const fallback = window.setTimeout(refresh, 500);

    return () => {
      window.clearTimeout(fallback);
      tl.scrollTrigger?.kill();
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  function handleBegin() {
    localStorage.setItem("ithaka_visited", "1");
    onComplete();
  }

  if (reduceMotion) {
    // Static stacked blocks, single fade-in — same pattern as ResultCard /
    // Helm's SlideStage under prefers-reduced-motion.
    return <ReducedMotionPrologue onBegin={handleBegin} />;
  }

  return (
    <div ref={sectionRef} className="relative h-screen w-full overflow-hidden bg-bg">
      {STATEMENTS.map((line, i) => (
        <div
          key={line}
          ref={(el) => {
            statementRefs.current[i] = el;
          }}
          className="absolute inset-0 flex items-center justify-center px-6 text-center"
        >
          <p
            className="font-display leading-[1.1] text-ink"
            style={{ fontSize: "clamp(40px, 10vw, 72px)" }}
          >
            {line}
          </p>
        </div>
      ))}

      <div
        ref={releaseRef}
        className="absolute inset-0 flex flex-col items-center justify-center gap-10 px-6 text-center"
      >
        <p
          className="font-display leading-[1.15] text-ink"
          style={{ fontSize: "clamp(28px, 7vw, 48px)" }}
        >
          Where you watch it matters.
          <br />
          Let&rsquo;s find your screen.
        </p>
        <button
          type="button"
          onClick={handleBegin}
          className="min-h-[48px] cursor-pointer rounded-md bg-gold px-8 font-mono text-[12px] font-medium uppercase tracking-widest text-bg transition-transform duration-150 active:scale-[0.97]"
        >
          Begin
        </button>
      </div>
    </div>
  );
}

/** prefers-reduced-motion fallback: four stacked static blocks, one fade-in. */
function ReducedMotionPrologue({ onBegin }: { onBegin: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const tween = gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" });
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="flex min-h-screen w-full flex-col items-center justify-center gap-16 bg-bg px-6 py-20 text-center"
    >
      {STATEMENTS.map((line) => (
        <p
          key={line}
          className="font-display leading-[1.1] text-ink"
          style={{ fontSize: "clamp(32px, 8vw, 56px)" }}
        >
          {line}
        </p>
      ))}
      <div className="flex flex-col items-center gap-8">
        <p className="font-display leading-[1.15] text-ink" style={{ fontSize: "clamp(24px, 6vw, 40px)" }}>
          Where you watch it matters.
          <br />
          Let&rsquo;s find your screen.
        </p>
        <button
          type="button"
          onClick={onBegin}
          className="min-h-[48px] cursor-pointer rounded-md bg-gold px-8 font-mono text-[12px] font-medium uppercase tracking-widest text-bg transition-transform duration-150 active:scale-[0.97]"
        >
          Begin
        </button>
      </div>
    </div>
  );
}

export default Prologue;
