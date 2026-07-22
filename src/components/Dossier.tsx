import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { INTENTS } from "../scoring/score";
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
 * yourself." The decision evidence and a few distinct alternatives are
 * immediate; the full map and every scored show plan are progressively
 * disclosed for people who want to audit the recommendation.
 *
 * Voice rule throughout: opinions in serif (italic for verdicts), evidence
 * in mono (uppercase, tracking-widest) — same as ResultCard.
 */
export function Dossier({ result, dossier, origin }: DossierProps) {
  const [researchOpen, setResearchOpen] = useState(false);
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const weights = INTENTS[result.score.intent];
  const dimensionRows: { label: string; value: number; weight: number }[] = [
    { label: "EXPERIENCE", value: result.score.dimensions.experience, weight: weights.experience },
    { label: "COST", value: result.score.dimensions.cost, weight: weights.cost },
    { label: "TIME", value: result.score.dimensions.time, weight: weights.time },
    { label: "WAY HOME", value: result.score.dimensions.feasibility, weight: weights.feasibility },
  ];

  const distinctAlternatives = useMemo(() => {
    const seenVenueIds = new Set<string>([result.score.venueId]);
    const alternatives: DossierEntry[] = [];
    for (const entry of dossier) {
      if (entry.warning || seenVenueIds.has(entry.venueId)) continue;
      seenVenueIds.add(entry.venueId);
      alternatives.push(entry);
      if (alternatives.length === 3) break;
    }
    return alternatives;
  }, [dossier, result.score.venueId]);

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-5">
      {/* a. Section header — the honesty numbers stay visible even when the
          deeper audit trail is collapsed. */}
      <div className="flex items-center justify-between border-t border-border pt-4 font-mono text-[12px]">
        <span className="text-ink">THE WORKING</span>
        <span className="text-ink-muted">
          {result.provenance.venuesChecked} VENUES · {result.provenance.plansScored} PLANS SCORED
        </span>
      </div>

      {/* b. Value comparison block — Worth Every Rupee only, when it fires */}
      {result.valueComparison && <ValueComparisonBlock valueComparison={result.valueComparison} />}

      {/* c. Winner dimension bars */}
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[12px] text-ink-muted">WHY {result.venueName.toUpperCase()} WON</div>
        <div className="flex flex-col gap-2">
          {dimensionRows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-[11px] text-ink-muted">{row.label}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-1 rounded-full bg-gold"
                  style={{ width: `${Math.round(row.value * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-ink-muted">×{row.weight.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* d. A concise, venue-distinct alternative set. The result card
          already owns the verdict; this is enough context to make it feel
          compared without immediately dumping every show on the page. */}
      {distinctAlternatives.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[12px] text-ink-muted">THE NEXT BEST PLANS</div>
          {distinctAlternatives.map((entry) => (
            <AlternativeRow key={entry.planId} entry={entry} />
          ))}
        </div>
      )}

      {/* e. Progressive audit trail: map + every scored show plan. */}
      <button
        type="button"
        onClick={() => setResearchOpen((open) => !open)}
        aria-expanded={researchOpen}
        aria-controls="full-research"
        className="flex min-h-[52px] w-full cursor-pointer items-center justify-between rounded-md border border-border px-4 text-left font-mono text-[11px] uppercase tracking-widest text-gold-bright transition-colors duration-150 hover:border-gold/40"
      >
        <span className="flex flex-col gap-1">
          <span>{researchOpen ? "Close full research" : "Explore full research"}</span>
          <span className="text-[10px] text-ink-muted">
            MAP · {result.provenance.plansScored} RANKED PLANS · EVERY VIABLE SHOW
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`shrink-0 transition-transform duration-150 ${researchOpen ? "rotate-180" : ""}`}
        />
      </button>

      {researchOpen && (
        <div id="full-research" className="flex flex-col gap-4">
          <p className="font-body text-[14px] leading-relaxed text-ink-muted">
            Every reachable show was scored as its own plan. The map uses each venue&rsquo;s highest-ranked
            plan; the ledger below keeps every showtime so you can audit the full comparison. Live transit
            is checked for the {result.provenance.transitPlansChecked} plans with the strongest potential;
            the rest retain the conservative cab-home fallback used in their score.
          </p>
          <MapExplorer origin={origin} venues={dossier} />
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-ink-muted">
            <span>ALL SCORED PLANS</span>
            <span>BEST TO WORST</span>
          </div>
          <div className="flex flex-col gap-2">
            {dossier.map((entry) => (
              <DossierRow key={entry.planId} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* f. Provenance strip */}
      <div className="border-t border-border pt-3 text-center font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        CHECKED {result.provenance.showsConsidered} LISTED SHOWS · SCORED {result.provenance.plansScored} VIABLE
        PLANS · {result.provenance.transitPlansChecked} TRANSIT CHECKS · DISTRICT {result.freshnessLabel} ·{" "}
        {result.provenance.routeSource === "live"
          ? "ROUTES LIVE VIA GOOGLE"
          : isLocalhost
            ? "ROUTES ESTIMATED · LOCAL DEV"
            : "ROUTES ESTIMATED · LIVE LOOKUP UNAVAILABLE"}
      </div>
    </div>
  );
}

function ValueComparisonBlock({
  valueComparison,
}: {
  valueComparison: NonNullable<RecommendationResult["valueComparison"]>;
}) {
  const { premium, budget, priceDiffRupees } = valueComparison;
  const diff = priceDiffRupees.toLocaleString("en-IN");
  const opinion =
    premium.experienceScore - budget.experienceScore >= 30
      ? `That ₹${diff} buys a genuinely different film — the frame itself is bigger.`
      : `That ₹${diff} buys comfort, not picture. The screen is the same tier.`;

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-bg-raised p-4">
      <p className="font-body text-[15px] italic text-ink">The value question.</p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-[15px] text-ink">{premium.format}</div>
            <div className="font-mono text-[11px] text-ink-muted">{premium.showtime}</div>
          </div>
          <span className="font-mono text-[13px] text-ink">{premium.priceLabel}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-[15px] text-ink">{budget.format}</div>
            <div className="font-mono text-[11px] text-ink-muted">{budget.showtime}</div>
          </div>
          <span className="font-mono text-[13px] text-gold-bright">{budget.priceLabel}</span>
        </div>
      </div>

      <div className="font-mono text-[11px] text-ink-muted">₹{diff} BETWEEN THEM</div>

      <p className="font-body text-[14px] italic text-ink">{opinion}</p>
    </div>
  );
}

function AlternativeRow({ entry }: { entry: DossierEntry }) {
  return (
    <div className={`rounded-md border px-3 py-3 ${entry.isRunnerUp ? "border-gold/40" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[15px] text-ink">{entry.venueName}</span>
            {entry.isRunnerUp && (
              <span className="font-mono text-[9px] uppercase tracking-widest text-gold-bright">RUNNER-UP</span>
            )}
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
            {entry.format} · {entry.showtime} · {entry.dateLabel} · {entry.durationMinutes} MIN AWAY ·{" "}
            {returnEvidenceLabel(entry.returnEvidence)}
          </div>
        </div>
        <span className="shrink-0 font-mono text-[12px] text-ink">
          ₹{entry.totalCostRupees.toLocaleString("en-IN")}
        </span>
      </div>
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
  if (evidence === "live") return "TRANSIT FOUND";
  if (evidence === "no-route") return "CAB HOME";
  return "TRANSIT UNVERIFIED";
}

export default Dossier;
