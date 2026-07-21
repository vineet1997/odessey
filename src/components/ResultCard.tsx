import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { AlertTriangle, ChevronDown, MapPin, Share2, Ticket, TrainFront } from "lucide-react";
import type { RecommendationResult } from "../fixtures/sampleResult";

interface ResultCardProps {
  result: RecommendationResult;
}

/**
 * The Odyssey result card — DESIGN.md §"The card — anatomy of the
 * screenshot". A 4:5 portrait object capped at ~480px, arriving via a
 * GSAP zoom (scale 0.94→1.0 + fade, expo.out, 500ms) followed by a gold
 * hairline border draw (600ms). Falls back to a plain 150ms fade under
 * prefers-reduced-motion, per MASTER.md's Motion section.
 *
 * Voice rule enforced throughout: opinions in serif (Source Serif 4,
 * italic for verdicts), evidence in mono (JetBrains Mono, uppercase,
 * tracking-widest), venue names in Cinzel.
 */
export function ResultCard({ result }: ResultCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const borderRef = useRef<SVGRectElement>(null);
  const [runnerUpOpen, setRunnerUpOpen] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    const border = borderRef.current;
    if (!card) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      gsap.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" });
      if (border) gsap.set(border, { strokeDashoffset: 0 });
      return;
    }

    if (border) gsap.set(border, { strokeDashoffset: 1 });

    const tl = gsap.timeline();
    tl.fromTo(
      card,
      { scale: 0.94, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: "expo.out" }
    );
    if (border) {
      tl.to(border, { strokeDashoffset: 0, duration: 0.6, ease: "expo.out" }, "-=0.1");
    }

    return () => {
      tl.kill();
    };
  }, []);

  const { journey } = result;
  const returnIsGood = journey.return.status === "good";

  return (
    <div
      ref={cardRef}
      className="relative mx-auto flex w-full max-w-[480px] flex-col gap-5 rounded-[10px] border border-border bg-bg-raised p-6"
      style={{ aspectRatio: "4 / 5" }}
    >
      {/* Gold hairline border draw overlay */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <rect
          ref={borderRef}
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx="10"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1"
          pathLength={1}
          strokeDasharray={1}
        />
      </svg>

      {/* 1. Header row */}
      <div className="flex items-center justify-between font-mono text-[12px] uppercase tracking-widest text-ink-muted">
        <span className="text-gold-bright">{result.intentLabel}</span>
        <span>{result.freshnessLabel}</span>
      </div>

      {/* 2. Venue */}
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-[28px] leading-tight tracking-wide text-ink">
          {result.venueName}
        </h1>
        <span className="rounded border border-gold px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-gold-bright">
          {result.formatChip}
        </span>
      </div>

      {/* 3. Verdict */}
      <p className="font-body text-[16px] italic leading-relaxed text-ink">{result.verdict}</p>

      {/* 4. The show — hero */}
      <div className="border-t border-border pt-4">
        <div className="font-mono text-[40px] leading-none tracking-tight text-ink">
          {result.showtime}
        </div>
        <div className="mt-2 font-mono text-[12px] uppercase tracking-widest text-ink-muted">
          {result.dateLabel} · {result.seatClass} · {result.priceLabel}
        </div>
      </div>

      {/* 5. Journey ledger */}
      <div className="flex flex-col gap-2 border-t border-border pt-4 font-mono text-[12px] uppercase tracking-widest">
        {/* Outbound */}
        <div className="flex items-center justify-between py-1 text-ink-muted">
          <span className="flex items-center gap-2">
            <TrainFront size={14} strokeWidth={1.5} className="text-sea-bright" />
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-bg"
              style={{ backgroundColor: journey.outbound.lineColorHex }}
            >
              {journey.outbound.lineLabel}
            </span>
            <span>OUTBOUND · {journey.outbound.durationMinutes} MIN</span>
          </span>
          <span className="text-ink">₹{journey.outbound.costRupees}</span>
        </div>

        {/* Return — the signature element */}
        <div
          className="flex flex-col gap-1 rounded-md px-3 py-2.5"
          style={{
            backgroundColor: returnIsGood ? "var(--gold)" : "var(--wine)",
            color: returnIsGood ? "var(--bg)" : "var(--ink)",
          }}
        >
          <span className="flex items-center gap-2 text-[11px] font-medium leading-snug tracking-wide">
            {returnIsGood ? (
              <TrainFront size={14} strokeWidth={1.75} />
            ) : (
              <AlertTriangle size={14} strokeWidth={1.75} />
            )}
            {journey.return.headline}
          </span>
          {!returnIsGood && journey.return.cabFallbackLabel && (
            <span className="text-[11px] font-medium">{journey.return.cabFallbackLabel}</span>
          )}
          <span className="text-[10px] opacity-80">
            RETURN · {journey.return.durationMinutes} MIN · ₹{journey.return.costRupees}
          </span>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between border-t border-border pt-2 text-ink">
          <span className="text-ink-muted">TOTAL</span>
          <span className="text-gold-bright">
            ₹{journey.totalCostRupees.toLocaleString("en-IN")} DOOR TO DOOR
          </span>
        </div>
      </div>

      {/* 6. Why line */}
      <p className="font-body text-[14px] leading-relaxed text-ink-muted">{result.whyLine}</p>

      {/* 7. Runner-up — collapsed row, expandable */}
      <button
        type="button"
        onClick={() => setRunnerUpOpen((open) => !open)}
        className="flex w-full cursor-pointer flex-col gap-1 rounded-md border border-border px-3 py-2 text-left transition-colors duration-150 hover:border-gold/40"
      >
        <span className="flex items-center justify-between">
          <span className="font-display text-[15px] text-ink">{result.runnerUp.venueName}</span>
          <span className="flex items-center gap-2 font-mono text-[12px] text-ink-muted">
            {result.runnerUp.priceLabel}
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              className={`transition-transform duration-150 ${runnerUpOpen ? "rotate-180" : ""}`}
            />
          </span>
        </span>
        {runnerUpOpen && (
          <span className="font-mono text-[11px] uppercase tracking-widest text-ink-muted">
            {result.runnerUp.locality} · {result.runnerUp.formatChip} · {result.runnerUp.showtime}
          </span>
        )}
      </button>

      {/* 8. Actions */}
      <div className="mt-auto flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => {
            /* stub — District deep link wiring is out of scope for this pass */
          }}
          className="flex min-h-[48px] flex-[2] cursor-pointer items-center justify-center gap-2 rounded-md bg-gold font-mono text-[12px] font-medium uppercase tracking-widest text-bg transition-transform duration-150 active:scale-[0.97]"
        >
          <Ticket size={16} strokeWidth={1.75} />
          Book on District
        </button>
        <button
          type="button"
          onClick={() => {
            /* stub — Google Maps deep link wiring is out of scope for this pass */
          }}
          className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border font-mono text-[12px] uppercase tracking-widest text-gold-bright transition-transform duration-150 active:scale-[0.97]"
          aria-label="Directions"
        >
          <MapPin size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => {
            /* stub — PNG share export is out of scope for this pass */
          }}
          className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border font-mono text-[12px] uppercase tracking-widest text-gold-bright transition-transform duration-150 active:scale-[0.97]"
          aria-label="Share"
        >
          <Share2 size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* 9. Footer — wordmark + the one hairline */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <GreekKeyHairline />
        <span className="font-display text-[11px] tracking-[0.3em] text-ink-muted">ITHAKA</span>
      </div>
    </div>
  );
}

/** The app's single, once-per-screen ornamental budget (DESIGN.md). */
function GreekKeyHairline() {
  return (
    <svg width="120" height="8" viewBox="0 0 120 8" aria-hidden="true" className="text-border">
      <path
        d="M0 4 H8 V0 H16 V8 H24 V0 H32 V8 H40 V0 H48 V8 H56 V0 H64 V8 H72 V0 H80 V8 H88 V0 H96 V8 H104 V0 H112 V8 H120"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

export default ResultCard;
