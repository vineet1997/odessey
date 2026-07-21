import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PrologueField, type PrologueFieldHandle } from "./PrologueField";

gsap.registerPlugin(ScrollTrigger);

interface PrologueProps {
  /** Fires when the user clicks "Begin" — parent moves on to the Helm. */
  onComplete: () => void;
}

interface Statement {
  line: string;
  sub: string;
}

const STATEMENTS: Statement[] = [
  { line: "172 minutes.", sub: "NO INTERMISSION" },
  { line: "Nolan built it for the largest screens on Earth.", sub: "SHOT ON IMAX 70MM" },
  { line: "Some voyages deserve the full ocean.", sub: "THE 1.43:1 FRAME" },
  { line: "India never got that screen.", sub: "NO IMAX 70MM IN THE COUNTRY" },
  { line: "What reaches the shore depends on where you land.", sub: "₹350–₹2,500 · THE SAME FILM" },
];

/**
 * Text beat positions on the normalized (0..1) scrubbed timeline — five
 * statements + the release, one per mural scene (Horse, Warrior, Trireme,
 * Storm, Helmet, Dawn), each fade fully sequential: an out always
 * COMPLETES before the next in begins, so two statements can never
 * coexist. The mural drifts linearly underneath; scene centers pass
 * through mid-viewport at roughly 0.03/0.17/0.39/0.61/0.83/0.96.
 */
const FADE = 0.04;
const BEATS = {
  out0: 0.1,
  in1: 0.13,
  out1: 0.24,
  in2: 0.34,
  out2: 0.45,
  in3: 0.55,
  out3: 0.66,
  in4: 0.76,
  out4: 0.87,
  inRelease: 0.91,
};

/**
 * The Prologue — DESIGN.md §"1 · Prologue", still the app's ONLY pinned
 * section. One ScrollTrigger-scrubbed timeline is the single scroll
 * authority: it drives the statements AND pushes its own smoothed
 * progress into PrologueField every update. The mural pans linearly
 * beneath, one scene per beat (Horse, Warrior, Trireme, Storm, Helmet,
 * Dawn), so each statement surfaces roughly as its scene drifts through.
 *
 * Layering (all positive z — the canvas must NOT live inside the pinned
 * element, because GSAP pins via transform, and a transformed ancestor
 * hijacks position:fixed): canvas z-0 → veil z-[1] → pinned text z-10.
 */
export function Prologue({ onComplete }: PrologueProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<PrologueFieldHandle>(null);
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
    if (!release || statements.length !== STATEMENTS.length) return;

    gsap.set(statements.slice(1), { opacity: 0, y: 40 });
    gsap.set(release, { opacity: 0, y: 40 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=350%",
        scrub: 0.5,
        pin: true,
      },
    });

    // The single scroll authority: a full-length proxy tween whose smoothed
    // progress drives the canvas. Because it lives INSIDE the scrubbed
    // timeline, text and image can never drift apart — they share one clock.
    const proxy = { p: 0 };
    tl.to(
      proxy,
      {
        p: 1,
        duration: 1,
        ease: "none",
        onUpdate: () => fieldRef.current?.setProgress(proxy.p),
      },
      0
    );

    // Sequential statement beats (absolute positions, no crossfade).
    tl.to(statements[0], { opacity: 0, y: -40, duration: FADE, ease: "none" }, BEATS.out0);
    tl.fromTo(
      statements[1],
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: FADE, ease: "none" },
      BEATS.in1
    );
    tl.to(statements[1], { opacity: 0, y: -40, duration: FADE, ease: "none" }, BEATS.out1);
    tl.fromTo(
      statements[2],
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: FADE, ease: "none" },
      BEATS.in2
    );
    tl.to(statements[2], { opacity: 0, y: -40, duration: FADE, ease: "none" }, BEATS.out2);
    tl.fromTo(
      statements[3],
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: FADE, ease: "none" },
      BEATS.in3
    );
    tl.to(statements[3], { opacity: 0, y: -40, duration: FADE, ease: "none" }, BEATS.out3);
    tl.fromTo(
      statements[4],
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: FADE, ease: "none" },
      BEATS.in4
    );
    tl.to(statements[4], { opacity: 0, y: -40, duration: FADE, ease: "none" }, BEATS.out4);
    tl.fromTo(
      release,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: FADE + 0.01, ease: "none" },
      BEATS.inRelease
    );

    // Cinzel's font-swap can shift metrics after the pin/scroll distances
    // are computed — refresh once fonts are actually ready.
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
    sessionStorage.setItem("ithaka_visited", "1");
    onComplete();
  }

  if (reduceMotion) {
    return <ReducedMotionPrologue onBegin={handleBegin} />;
  }

  return (
    <>
      <PrologueField ref={fieldRef} />
      <ReadingVeil />
      <div ref={sectionRef} className="relative z-10 h-screen w-full overflow-hidden">
        {STATEMENTS.map((statement, i) => (
          <div
            key={statement.line}
            ref={(el) => {
              statementRefs.current[i] = el;
            }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
          >
            <p
              className="font-display leading-[1.12] text-ink"
              style={{ fontSize: "clamp(32px, 8.5vw, 60px)", maxWidth: "18ch", textWrap: "balance" }}
            >
              {statement.line}
            </p>
            <p className="font-mono uppercase tracking-[0.25em] text-gold-bright" style={{ fontSize: "clamp(10px, 2.8vw, 13px)" }}>
              {statement.sub}
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
    </>
  );
}

/** Fixed radial dim behind the text so statements stay legible over the art. */
function ReadingVeil() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{
        background:
          "radial-gradient(60% 50% at 50% 50%, rgba(10,14,20,0.72) 0%, rgba(10,14,20,0.42) 45%, rgba(10,14,20,0.12) 75%, rgba(10,14,20,0) 100%)",
      }}
    />
  );
}

/** prefers-reduced-motion fallback: four stacked static blocks, one fade-in.
 * PrologueField renders its base image statically (no physics, no listeners)
 * behind the stacked text. */
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
    <>
      <PrologueField />
      <ReadingVeil />
      <div
        ref={rootRef}
        className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center gap-16 px-6 py-20 text-center"
      >
        {STATEMENTS.map((statement) => (
          <div key={statement.line} className="flex flex-col items-center gap-4">
            <p
              className="font-display leading-[1.1] text-ink"
              style={{ fontSize: "clamp(32px, 8vw, 56px)", maxWidth: "18ch", textWrap: "balance" }}
            >
              {statement.line}
            </p>
            <p className="font-mono uppercase tracking-[0.25em] text-gold-bright" style={{ fontSize: "clamp(10px, 2.8vw, 13px)" }}>
              {statement.sub}
            </p>
          </div>
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
    </>
  );
}

export default Prologue;
