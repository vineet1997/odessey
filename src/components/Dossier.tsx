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
 * yourself." Always visible (replaces the old hide/show map toggle
 * entirely): the section header's own venue/show counts are the honesty
 * numbers, so hiding the rest behind a tap would undercut the point.
 *
 * Voice rule throughout: opinions in serif (italic for verdicts), evidence
 * in mono (uppercase, tracking-widest) — same as ResultCard.
 */
export function Dossier({ result, dossier, origin }: DossierProps) {
  const weights = INTENTS[result.score.intent];
  const dimensionRows: { label: string; value: number; weight: number }[] = [
    { label: "EXPERIENCE", value: result.score.dimensions.experience, weight: weights.experience },
    { label: "COST", value: result.score.dimensions.cost, weight: weights.cost },
    { label: "TIME", value: result.score.dimensions.time, weight: weights.time },
    { label: "WAY HOME", value: result.score.dimensions.feasibility, weight: weights.feasibility },
  ];

  return (
    <div className="flex w-full max-w-[480px] flex-col gap-5">
      {/* a. Section header */}
      <div className="flex items-center justify-between border-t border-border pt-4 font-mono text-[12px]">
        <span className="text-ink">THE WORKING</span>
        <span className="text-ink-muted">
          {result.provenance.venuesChecked} VENUES · {result.provenance.showsConsidered} SHOWS
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

      {/* d. Map — always rendered, no toggle */}
      <MapExplorer origin={origin} venues={dossier} />

      {/* e. The ranked list */}
      <div className="flex flex-col gap-2">
        {dossier.map((entry) => (
          <DossierRow key={`${entry.venueId}-${entry.format}`} entry={entry} />
        ))}
      </div>

      {/* f. Provenance strip */}
      <div className="border-t border-border pt-3 text-center font-mono text-[10px] uppercase tracking-widest text-ink-muted">
        CHECKED {result.provenance.venuesChecked} VENUES · {result.provenance.showsConsidered} SHOWS · DISTRICT{" "}
        {result.freshnessLabel} · ROUTES LIVE VIA GOOGLE
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
          {entry.showtime} · {entry.dateLabel} · {entry.durationMinutes} MIN AWAY · SCORE{" "}
          {(entry.totalScore * 100).toFixed(0)}
        </span>
      </div>

      {entry.warning && <p className="mt-1 font-body text-[13px] italic text-wine-bright">{entry.warning}</p>}
    </div>
  );
}

export default Dossier;
