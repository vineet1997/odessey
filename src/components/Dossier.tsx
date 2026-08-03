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
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Value comparison — Worth Every Rupee only, when it fires. */}
      {result.valueComparison && <ValueComparisonBlock valueComparison={result.valueComparison} />}

      <section aria-labelledby="evidence-heading">
        <p id="evidence-heading" className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted"><span className="mr-3 text-gold-bright">04</span>Data &amp; certainty</p>
        <p className="mt-3 max-w-[48rem] font-body text-[1rem] leading-relaxed text-ink">
          What was observed, what was estimated, and how broad the comparison was.
        </p>

        <EvidenceReceipt result={result} />

        <button
          type="button"
          onClick={() => setMapOpen((open) => !open)}
          aria-expanded={mapOpen}
          aria-controls="candidate-map"
          className="group mt-6 flex min-h-[5.25rem] w-full cursor-pointer items-center justify-between border-y border-border px-0 text-left transition-colors duration-150 hover:bg-ink/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright"
        >
          <span className="flex flex-col gap-1">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink">{mapOpen ? "Close candidate map" : "Open candidate map"}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
              {result.provenance.plansScored} plans across {result.provenance.venuesChecked} venues
            </span>
          </span>
          <ChevronDown
            size={16}
            strokeWidth={1.5}
            className={`shrink-0 text-ink-muted transition-transform duration-150 group-hover:translate-y-1 group-hover:text-ink ${mapOpen ? "rotate-180" : ""}`}
          />
        </button>

        {mapOpen && (
          <div id="candidate-map" className="mt-6">
            <MapExplorer origin={origin} venues={dossier} />
          </div>
        )}
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

function EvidenceReceipt({ result }: { result: RecommendationResult }) {
  const routeSource = result.evidence.outbound.source === "live"
    ? `Live · ${result.evidence.outbound.durationMinutes} min outbound`
    : `Estimated · ≈${result.evidence.outbound.durationMinutes} min outbound`;
  const returnSource = result.evidence.return.status === "live"
    ? "First scheduled transit step found"
    : result.evidence.return.status === "no-route"
      ? "No transit route found · cab estimated"
      : "Transit unverified · cab estimated";

  return (
    <div className="mt-6 border-y border-border">
      <p className="py-4 font-mono text-[11px] uppercase tracking-[0.12em] text-ink">Data &amp; certainty</p>
      <dl className="grid gap-px border-t border-border bg-border sm:grid-cols-2">
        <EvidenceFact label="Showtimes" value={`${result.evidence.showtimes.source} · ${result.evidence.showtimes.refreshedAtLabel}`} />
        <EvidenceFact label="Outbound" value={routeSource} />
        <EvidenceFact label="Return" value={returnSource} />
        <EvidenceFact label="Comparison" value={`${result.provenance.plansScored} plans · ${result.provenance.venuesChecked} venues`} />
      </dl>
    </div>
  );
}

function EvidenceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg px-4 py-4">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">{label}</dt>
      <dd className="mt-2 font-mono text-[11.5px] uppercase leading-relaxed tracking-[0.045em] text-ink">{value}</dd>
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
  if (evidence === "live") return "FIRST TRANSIT STEP FOUND";
  if (evidence === "no-route") return "NO TRANSIT ROUTE · CAB EST.";
  return "TRANSIT UNVERIFIED · CAB EST.";
}

export default Dossier;
