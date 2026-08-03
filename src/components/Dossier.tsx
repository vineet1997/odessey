import { useState } from "react";
import { ChevronDown, ListOrdered, Map } from "lucide-react";
import type { DossierEntry } from "../lib/buildRecommendation";
import type { Origin } from "./helm/types";
import type { RecommendationResult } from "../types/recommendation";
import { MapExplorer } from "./MapExplorer";

interface DossierProps {
  result: RecommendationResult;
  dossier: DossierEntry[];
  origin: Origin;
}

/**
 * The trust layer below the card — "here's the working, verify it
 * yourself." The map makes the breadth of research tangible; the full
 * ranked ledger is there for people who want to audit the recommendation.
 *
 * Voice rule throughout: opinions in serif (italic for verdicts), evidence
 * in mono (uppercase, tracking-widest) — same as ResultCard.
 */
export function Dossier({ result, dossier, origin }: DossierProps) {
  const [researchOpen, setResearchOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Value comparison — Worth Every Rupee only, when it fires. */}
      {result.valueComparison && <ValueComparisonBlock valueComparison={result.valueComparison} />}

      <section aria-labelledby="evidence-heading">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-gold-bright">04 / Evidence</p>
        <h2 id="evidence-heading" className="mt-3 font-body text-[1.75rem] font-semibold leading-tight text-ink sm:text-[2rem]">What we checked</h2>
        <p className="mt-3 max-w-[42rem] font-body text-[1rem] leading-[1.55] text-ink-muted">
          {result.provenance.venuesChecked} venues and {result.provenance.plansScored} complete plans, with live and estimated facts clearly separated.
        </p>

        <EvidenceReceipt result={result} />

        <button
          type="button"
          onClick={() => setMapOpen((open) => !open)}
          aria-expanded={mapOpen}
          aria-controls="candidate-map"
          className="group mt-4 flex min-h-[5rem] w-full cursor-pointer items-center justify-between rounded-sm border border-border bg-[var(--result-panel-soft)] px-4 py-3 text-left transition-colors duration-150 hover:border-ink/25 hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright sm:px-5"
        >
          <span className="flex min-w-0 items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-bg-raised text-sea-bright"><Map size={17} strokeWidth={1.7} aria-hidden="true" /></span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-body text-[1.05rem] font-semibold text-ink">{mapOpen ? "Close the venue map" : `Explore the ${result.provenance.venuesChecked} venues considered`}</span>
              <span className="font-body text-[13px] leading-snug text-ink-muted">See every cinema included in this comparison</span>
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
        className="group flex min-h-[5rem] w-full cursor-pointer items-center justify-between rounded-sm border border-border bg-[var(--result-panel-soft)] px-4 py-3 text-left transition-colors duration-150 hover:border-ink/25 hover:bg-ink/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright sm:px-5"
      >
        <span className="flex min-w-0 items-center gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-bg-raised text-gold-bright"><ListOrdered size={17} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="font-body text-[1.05rem] font-semibold text-ink">{researchOpen ? "Hide the ranked plans" : `View all ${result.provenance.plansScored} ranked plans`}</span>
            <span className="font-body text-[13px] leading-snug text-ink-muted">Compare the complete nights, best to worst</span>
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
    <div className="mt-6 overflow-hidden rounded-sm border border-border">
      <dl className="grid gap-px bg-border sm:grid-cols-2">
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
    <div className="bg-bg-raised px-4 py-4 sm:px-5 sm:py-5">
      <dt className="font-mono text-[9.5px] font-medium uppercase tracking-[0.08em] text-ink-muted">{label}</dt>
      <dd className="mt-2 font-body text-[15px] font-semibold leading-snug text-ink">{value}</dd>
    </div>
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
