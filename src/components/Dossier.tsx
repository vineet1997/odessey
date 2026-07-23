import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, RotateCcw } from "lucide-react";
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
 * yourself." The decision evidence and a few distinct alternatives are
 * immediate; the full map and every scored show plan are progressively
 * disclosed for people who want to audit the recommendation.
 *
 * Voice rule throughout: opinions in serif (italic for verdicts), evidence
 * in mono (uppercase, tracking-widest) — same as ResultCard.
 */
export function Dossier({ result, dossier, origin, onStartOver }: DossierProps) {
  const [researchOpen, setResearchOpen] = useState(false);
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
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
    <div className="flex w-full flex-col gap-5">
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

      {/* c. A concise, venue-distinct alternative set. The result card
          already owns the verdict; this is enough context to make it feel
          compared without immediately dumping every show on the page. */}
      {distinctAlternatives.length > 0 && (
        <section aria-labelledby="shortlist-heading" data-testid="next-best-shortlist">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold-bright">The shortlist</p>
              <p id="shortlist-heading" className="mt-2 font-body text-[1.35rem] leading-none text-ink">Next-best plans</p>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">Ranked after the pick</p>
          </div>
          <div className="divide-y divide-border border-y border-border">
          {distinctAlternatives.map((entry, index) => (
            <AlternativeLedgerRow key={entry.planId} entry={entry} rank={index + 2} />
          ))}
          </div>
        </section>
      )}

      {/* d. Progressive audit trail: map + every scored show plan. */}
      <button
        type="button"
        onClick={() => setResearchOpen((open) => !open)}
        aria-expanded={researchOpen}
        aria-controls="full-research"
        className="group flex min-h-[4.75rem] w-full cursor-pointer items-center justify-between border-y border-border px-0 text-left transition-all duration-150 hover:bg-[linear-gradient(90deg,rgba(201,162,39,0.05),transparent_70%)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright"
      >
        <span className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-bright">{researchOpen ? "Close the full ledger" : "Open the full ledger"}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted">
            MAP · {result.provenance.plansScored} RANKED PLANS · EVERY VIABLE SHOW
          </span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.5}
          className={`shrink-0 text-gold-bright transition-transform duration-150 group-hover:translate-y-1 ${researchOpen ? "rotate-180" : ""}`}
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

      {/* e. Provenance strip */}
      <ResearchReceipt result={result} isLocalhost={isLocalhost} onStartOver={onStartOver} />
    </div>
  );
}

function ResearchReceipt({
  result,
  isLocalhost,
  onStartOver,
}: {
  result: RecommendationResult;
  isLocalhost: boolean;
  onStartOver: () => void;
}) {
  const routeState =
    result.provenance.routeSource === "live"
      ? "Routes live via Google"
      : isLocalhost
        ? "Routes estimated · local dev"
        : "Routes estimated · live lookup unavailable";

  return (
    <footer className="pt-3" data-testid="research-receipt">
      <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">Research receipt</p>
      <dl className="grid grid-cols-2 border-y border-border sm:grid-cols-4">
        <ReceiptCell index={0} label="Listed shows checked" value={String(result.provenance.showsConsidered)} />
        <ReceiptCell index={1} label="Viable plans scored" value={String(result.provenance.plansScored)} />
        <ReceiptCell index={2} label="Transit checks" value={String(result.provenance.transitPlansChecked)} />
        <ReceiptCell index={3} label="District snapshot" value={result.freshnessLabel.replace("AS OF ", "")} />
      </dl>
      <a
        href="/made"
        className="group mt-6 block border border-gold/35 bg-[linear-gradient(110deg,rgba(207,165,76,0.09),rgba(14,17,22,0.2)_42%,rgba(68,113,107,0.12))] p-5 transition-colors hover:border-gold/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
        aria-label="Read how Ithaka was built"
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-bright">Builder&apos;s log · optional reading</p>
            <p className="mt-2 font-display text-xl text-ink sm:text-2xl">The system behind tonight&apos;s answer</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">How live showtimes, route evidence, visual craft, and a few wrong turns became Ithaka.</p>
          </div>
          <ArrowUpRight className="mt-1 size-5 shrink-0 text-gold-bright transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold-bright/90">Read the build note · 8 min</p>
      </a>
      <div className="mt-5 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className={`font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em] ${result.provenance.routeSource === "live" ? "text-sea-bright" : "text-ink-muted"}`}>
          {routeState} · {result.provenance.venuesChecked} venues compared
        </p>
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex min-h-10 items-center gap-2 self-start font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted transition-colors hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright"
        >
          <RotateCcw size={13} strokeWidth={1.5} />
          Start a new search
        </button>
      </div>
    </footer>
  );
}

function ReceiptCell({ index, label, value }: { index: number; label: string; value: string }) {
  const borders = ["", "border-l", "border-t sm:border-l sm:border-t-0", "border-l border-t sm:border-t-0"];
  return (
    <div className={`flex min-h-[5.8rem] flex-col border-border px-4 py-4 sm:px-3 lg:px-4 ${borders[index]}`}>
      <dt className="order-2 mt-3 max-w-[15ch] font-mono text-[8.5px] uppercase leading-[1.4] tracking-[0.08em] text-ink-muted">{label}</dt>
      <dd className="order-1 font-mono text-[1rem] leading-none tabular-nums text-ink">{value}</dd>
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

      <p className="font-body text-[14px] italic text-ink">{narrative.lead}</p>
      <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.07em] text-ink-muted">{narrative.receipt}</p>
    </div>
  );
}

function AlternativeLedgerRow({ entry, rank }: { entry: DossierEntry; rank: number }) {
  const returnState = returnEvidenceLabel(entry.returnEvidence);

  return (
    <article className={`relative grid grid-cols-[2.2rem_minmax(0,1fr)] gap-x-3 gap-y-2 py-6 transition-colors hover:bg-ink/[0.02] sm:grid-cols-[2.75rem_minmax(0,1fr)_9.5rem] sm:gap-x-4 ${entry.isRunnerUp ? "before:absolute before:inset-y-5 before:left-0 before:w-0.5 before:bg-gold" : ""}`}>
      <p className="pl-1 font-body text-[1.45rem] font-light leading-none text-ink/25">{String(rank).padStart(2, "0")}</p>
      <div className="min-w-0">
        <p className="font-body text-[1.18rem] font-semibold leading-[1.22] text-ink sm:text-[1.3rem]">{entry.venueName}</p>
        {entry.isRunnerUp && <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-gold-bright">Runner-up</p>}
        <p className={`${entry.isRunnerUp ? "mt-2" : "mt-3"} font-mono text-[9px] uppercase leading-relaxed tracking-[0.06em] text-ink-muted`}>
          {entry.format} · {entry.showtime} · {entry.dateLabel}
        </p>
        <p className="mt-1 font-mono text-[9px] uppercase leading-relaxed tracking-[0.06em] text-ink-muted">
          {entry.durationMinutes} min outbound · <span className={returnEvidenceTone(entry.returnEvidence)}>{returnState}</span>
        </p>
      </div>
      <p className="col-start-2 whitespace-nowrap font-mono text-[11px] tabular-nums tracking-[0.04em] text-ink sm:col-start-3 sm:row-start-1 sm:pt-1 sm:text-right">
        ₹{entry.totalCostRupees.toLocaleString("en-IN")} <span className="text-[8px] uppercase text-ink-muted">total</span>
      </p>
    </article>
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

function returnEvidenceTone(evidence: DossierEntry["returnEvidence"]): string {
  if (evidence === "live") return "text-sea-bright";
  if (evidence === "no-route") return "text-wine-bright";
  return "text-ink-muted";
}

export default Dossier;
