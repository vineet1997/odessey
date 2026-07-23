import { useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import type { DossierEntry } from "../lib/buildRecommendation";
import type { Origin } from "./helm/types";
import type { RecommendationResult } from "../types/recommendation";
import { MapExplorer } from "./MapExplorer";

interface DossierProps {
  result: RecommendationResult;
  dossier: DossierEntry[];
  origin: Origin;
  onStartOver: () => void;
}

/**
 * The trust layer below the card — "here's the working, verify it
 * yourself." The map makes the breadth of research tangible; the full
 * ranked ledger is there for people who want to audit the recommendation.
 *
 * Voice rule throughout: opinions in serif (italic for verdicts), evidence
 * in mono (uppercase, tracking-widest) — same as ResultCard.
 */
export function Dossier({ result, dossier, origin, onStartOver }: DossierProps) {
  const [researchOpen, setResearchOpen] = useState(false);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Value comparison — Worth Every Rupee only, when it fires. */}
      {result.valueComparison && <ValueComparisonBlock valueComparison={result.valueComparison} />}

      <section className="border-t border-border pt-8 sm:pt-10" aria-labelledby="alternatives-heading">
        <p id="alternatives-heading" className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted">Alternatives, mapped</p>
        <p className="mt-3 max-w-[48rem] font-body text-[1rem] leading-relaxed text-ink">
          Want to look past our pick? We researched {result.provenance.plansScored} possible plans across {result.provenance.venuesChecked} venues. Every one is on the map.
        </p>
        <div className="mt-6">
          <MapExplorer origin={origin} venues={dossier} />
        </div>
      </section>

      {/* The map establishes the research surface. The ledger is optional detail. */}
      <button
        type="button"
        onClick={() => setResearchOpen((open) => !open)}
        aria-expanded={researchOpen}
        aria-controls="full-research"
        className="group flex min-h-[5.25rem] w-full cursor-pointer items-center justify-between border-y border-border px-0 text-left transition-colors duration-150 hover:bg-ink/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright"
      >
        <span className="flex flex-col gap-1">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink">{researchOpen ? "Hide the full ledger" : "Inspect every plan"}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
            {researchOpen ? "Ranked best to worst" : "The complete research, ranked best to worst"}
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`shrink-0 text-ink-muted transition-transform duration-150 group-hover:translate-y-1 group-hover:text-ink ${researchOpen ? "rotate-180" : ""}`}
        />
      </button>

      {researchOpen && (
        <div id="full-research" className="flex flex-col gap-4">
          <p className="font-body text-[14px] leading-relaxed text-ink-muted">
            {result.provenance.transitPlansChecked} return routes checked. Other plans use cab estimates.
          </p>
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-ink-muted">
            <span>Every scored plan</span>
            <span>Best to worst</span>
          </div>
          <div className="flex flex-col gap-2">
            {dossier.map((entry) => (
              <DossierRow key={entry.planId} entry={entry} />
            ))}
          </div>
        </div>
      )}

      <ResearchReceipt onStartOver={onStartOver} />
    </div>
  );
}

function ResearchReceipt({ onStartOver }: { onStartOver: () => void }) {
  return (
    <footer className="pt-3" data-testid="research-receipt">
      <div className="flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex min-h-10 items-center gap-2 self-start font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright"
        >
          <RotateCcw size={13} strokeWidth={1.5} />
          Start a new search
        </button>
      </div>
      <p className="build-credit mt-10 text-center text-sm text-ink-muted">
        Built with <span className="build-credit__struck">obsessive energy</span> and coffee. <a className="build-credit__link" href="/made">Learn more ↗</a>
      </p>
    </footer>
  );
}

function ValueComparisonBlock({
  valueComparison,
}: {
  valueComparison: NonNullable<RecommendationResult["valueComparison"]>;
}) {
  const { premium, budget, priceDiffRupees, narrative } = valueComparison;
  const diff = priceDiffRupees.toLocaleString("en-IN");
  return (
    <div className="flex flex-col gap-4 border-y border-border py-5">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">The value question.</p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-body text-[17px] font-semibold text-ink">{premium.format}</div>
            <div className="mt-1 font-mono text-[11px] text-ink-muted">{premium.showtime}</div>
          </div>
          <span className="font-mono text-[13px] text-ink">{premium.priceLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-body text-[17px] font-semibold text-ink">{budget.format}</div>
            <div className="mt-1 font-mono text-[11px] text-ink-muted">{budget.showtime}</div>
          </div>
          <span className="font-mono text-[13px] text-gold-bright">{budget.priceLabel}</span>
        </div>
      </div>

      <div className="font-mono text-[11px] text-ink-muted">₹{diff} BETWEEN THEM</div>

      <p className="font-body text-[15px] leading-relaxed text-ink">{narrative.lead}</p>
      <p className="font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.055em] text-ink-muted">{narrative.receipt}</p>
    </div>
  );
}

function DossierRow({ entry }: { entry: DossierEntry }) {
  const borderClass = entry.isWinner ? "border-gold" : entry.isRunnerUp ? "border-gold/40" : "border-border";

  return (
    <div className={`rounded-md border px-3 py-2.5 ${borderClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-display text-[15px] text-ink">{entry.venueName}</span>
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
            {entry.format}
          </span>
        </span>
        <span className="font-mono text-[12px] text-ink">₹{entry.totalCostRupees.toLocaleString("en-IN")}</span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-muted">
        {entry.isWinner && <span className="text-[10px] text-gold-bright">★ THE PICK</span>}
        {entry.isRunnerUp && <span className="text-[10px] text-ink-muted">RUNNER-UP</span>}
        <span>
          {entry.showtime} · {entry.dateLabel} · {entry.durationMinutes} MIN AWAY ·{" "}
          {returnEvidenceLabel(entry.returnEvidence)} · SCORE{" "}
          {(entry.totalScore * 100).toFixed(0)}
        </span>
      </div>

      {entry.warning && <p className="mt-1 font-body text-[13px] italic text-wine-bright">{entry.warning}</p>}
    </div>
  );
}

function returnEvidenceLabel(evidence: DossierEntry["returnEvidence"]): string {
  if (evidence === "live") return "METRO ✓";
  if (evidence === "no-route") return "METRO × · CAB";
  return "METRO ? · CAB EST.";
}

export default Dossier;
