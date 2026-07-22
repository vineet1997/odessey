import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { toPng } from "html-to-image";
import { AlertTriangle, ChevronDown, CircleHelp, Loader2, MapPin, Share2, Ticket, TrainFront } from "lucide-react";
import type { RecommendationResult } from "../types/recommendation";

/** DESIGN.md: "share button renders it to a 1080x1350 PNG with the wordmark
 * baked in" — the card is already a 4:5 object, so this is just a pixelRatio
 * scaled up from whatever the card's actual on-screen width happens to be. */
const EXPORT_WIDTH_PX = 1080;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function shareCard(cardEl: HTMLElement, venueName: string): Promise<void> {
  const pixelRatio = EXPORT_WIDTH_PX / cardEl.offsetWidth;
  const dataUrl = await withTimeout(
    toPng(cardEl, {
      pixelRatio,
      backgroundColor:
        getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0a0e14",
      // Fonts are already loaded and rendering live on the page (Google Fonts
      // @import in index.css) — html-to-image's font-embedding step otherwise
      // tries to re-fetch and inline that stylesheet's CSS for a "portable"
      // SVG, which throws on the cross-origin fonts.googleapis.com stylesheet
      // (a documented CORS pitfall with this library). Skipping it: the
      // exported PNG still renders the already-applied fonts correctly,
      // since capture reflects the live DOM, not a rebuilt one.
      skipFonts: true,
    }),
    // Defensive cap — html-to-image's internal image-decode step waits on a
    // requestAnimationFrame callback to resolve, which some environments
    // (e.g. a backgrounded/inactive browser tab) can suspend indefinitely.
    // A real user's focused tab resolves this in well under a second; this
    // timeout only exists so the button can never get stuck spinning forever.
    8000,
    "Timed out generating the image."
  );

  const filename = `ithaka-${venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  // Prefer the native share sheet (mobile) so the image can go straight into
  // WhatsApp/Instagram, per DESIGN.md's whole point of the card being a
  // screenshot object. Falls back to a plain download when unsupported
  // (most desktop browsers) rather than failing silently.
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Ithaka",
      text: `Where to watch The Odyssey: ${venueName}`,
    });
    return;
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

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
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  async function handleShare() {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    setShareError(false);
    try {
      await shareCard(cardRef.current, result.venueName);
    } catch (err) {
      // AbortError fires when the user just closes the native share sheet —
      // not a real failure, don't flag it as one.
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Share failed:", err);
      setShareError(true);
      window.setTimeout(() => setShareError(false), 2500);
    } finally {
      setSharing(false);
    }
  }

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
  const returnIsUnverified = journey.return.status === "unverified";

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
        {result.seatsLine && (
          <div
            className={`mt-1 font-mono text-[11px] uppercase tracking-widest ${
              result.seatsLine.includes("FILLING") || result.seatsLine.includes("ALMOST")
                ? "text-gold-bright"
                : "text-ink-muted"
            }`}
          >
            {result.seatsLine}
          </div>
        )}
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
          <span className="text-ink">
            {journey.outbound.costIsEstimate ? "≈" : ""}₹{journey.outbound.costRupees}
          </span>
        </div>

        {/* Return — the signature element */}
        <div
          className="flex flex-col gap-1 rounded-md px-3 py-2.5"
          style={{
            backgroundColor: returnIsGood
              ? "var(--gold)"
              : returnIsUnverified
                ? "var(--sea)"
                : "var(--wine)",
            color: returnIsGood ? "var(--bg)" : "var(--ink)",
          }}
        >
          <span className="flex items-center gap-2 text-[11px] font-medium leading-snug tracking-wide">
            {returnIsGood ? (
              <TrainFront size={14} strokeWidth={1.75} />
            ) : returnIsUnverified ? (
              <CircleHelp size={14} strokeWidth={1.75} />
            ) : (
              <AlertTriangle size={14} strokeWidth={1.75} />
            )}
            {journey.return.headline}
          </span>
          {journey.return.evidenceLabel && (
            <span className="text-[10px] font-medium opacity-80">{journey.return.evidenceLabel}</span>
          )}
          {!returnIsGood && journey.return.cabFallbackLabel && (
            <span className="text-[11px] font-medium">{journey.return.cabFallbackLabel}</span>
          )}
          <span className="text-[10px] opacity-80">
            RETURN · {journey.return.durationMinutes} MIN · {journey.return.costIsEstimate ? "≈" : ""}₹
            {journey.return.costRupees}
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

      {/* 7. Runner-up — collapsed row, expandable. Absent when only one venue
          matched this request (e.g. a narrow time band) — no row rendered
          rather than fabricate a second option that doesn't exist. */}
      {result.runnerUp && (
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
      )}

      {/* 8. Actions */}
      <div className="mt-auto flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => window.open(result.districtUrl, "_blank", "noopener,noreferrer")}
          className="flex min-h-[48px] flex-[2] cursor-pointer items-center justify-center gap-2 rounded-md bg-gold font-mono text-[12px] font-medium uppercase tracking-widest text-bg transition-transform duration-150 active:scale-[0.97]"
        >
          <Ticket size={16} strokeWidth={1.75} />
          Book on District
        </button>
        <button
          type="button"
          onClick={() => window.open(result.directionsUrl, "_blank", "noopener,noreferrer")}
          className="flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border font-mono text-[12px] uppercase tracking-widest text-gold-bright transition-transform duration-150 active:scale-[0.97]"
          aria-label="Directions"
        >
          <MapPin size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          className={`flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border font-mono text-[12px] uppercase tracking-widest transition-transform duration-150 active:scale-[0.97] disabled:cursor-wait ${
            shareError ? "border-wine text-wine-bright" : "border-border text-gold-bright"
          }`}
          aria-label={shareError ? "Share failed, try again" : "Share"}
        >
          {sharing ? (
            <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
          ) : (
            <Share2 size={16} strokeWidth={1.75} />
          )}
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
