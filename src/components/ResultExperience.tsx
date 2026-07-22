import { lazy, Suspense, useMemo, useState } from "react";
import { ExternalLink, MapPinned, Share2 } from "lucide-react";
import { Dossier } from "./Dossier";
import type { Origin } from "./helm/types";
import type { DossierEntry } from "../lib/buildRecommendation";
import { INTENTS, type IntentId } from "../scoring/score";
import type { RecommendationResult, ReturnStatus } from "../types/recommendation";
import { buildShareArtifactModel } from "../lib/shareArtifact";

const ShareComposer = lazy(() =>
  import("./ShareComposer").then((module) => ({ default: module.ShareComposer }))
);

type Counterfactual = {
  id?: string;
  label?: string;
  question?: string;
  title?: string;
  venueName?: string;
  locality?: string;
  format?: string;
  detail?: string;
  reason?: string;
  priceLabel?: string;
  totalCostRupees?: number;
  showtime?: string;
  dateLabel?: string;
  returnEvidence?: "live" | "no-route" | "unverified";
  metric?: { label: string; value: string };
  isCurrentRecommendation?: boolean;
};

interface ResultExperienceProps {
  result: RecommendationResult;
  dossier: DossierEntry[];
  origin: Origin;
  activeIntent: IntentId;
  onSwitchIntent: (intent: IntentId) => void;
  onStartOver: () => void;
}

/**
 * The full-screen decision surface. It deliberately separates the instant
 * answer (the anchored left rail) from the audit trail (the right column):
 * one is memorable at a glance; the other earns the user's trust on demand.
 */
export function ResultExperience({
  result,
  dossier,
  origin,
  activeIntent,
  onSwitchIntent,
  onStartOver,
}: ResultExperienceProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const timeline = makeTimeline(result);
  const counterfactuals = makeCounterfactuals(result);
  const returnTone = returnStatusTone(result.journey.return.status);
  const shareModel = useMemo(() => buildShareArtifactModel(result, origin), [result, origin]);

  return (
    <main className="min-h-screen bg-bg pb-28 text-ink lg:pb-0" data-testid="result-experience">
      <div className="mx-auto grid max-w-[1680px] lg:grid-cols-[minmax(390px,44vw)_minmax(0,1fr)]">
        <section className="relative overflow-hidden border-b border-border lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
          <picture className="absolute inset-0">
            <source media="(min-width: 1024px)" srcSet="/result-helmet-wide.jpg" />
            <img
              src="/result-helmet-tall.jpg"
              alt="A weathered bronze helmet, seen from behind"
              className="h-full min-h-[420px] w-full object-cover object-[63%_42%] lg:min-h-0 lg:object-[74%_50%]"
            />
          </picture>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,14,0.12)_0%,rgba(5,9,14,0.18)_26%,rgba(5,9,14,0.94)_100%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:radial-gradient(rgba(233,228,216,0.72)_0.55px,transparent_0.7px)] [background-size:4px_4px]" />

          <div className="relative flex min-h-[420px] flex-col justify-between p-5 sm:p-7 lg:h-full lg:min-h-0 lg:p-10 xl:p-14">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ink/75">
              <span>Ithaka / tonight&rsquo;s answer</span>
              <span>{result.freshnessLabel}</span>
            </div>

            <div className="max-w-[34rem] pt-24 lg:pt-0">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-gold-bright">{result.intentLabel}</p>
              <h1 className="max-w-[12ch] font-display text-[clamp(2rem,4vw,4.35rem)] leading-[1.06] text-ink [text-wrap:balance]">
                {result.venueName}
              </h1>
              <p className="mt-4 max-w-[32rem] font-body text-[clamp(1.08rem,1.4vw,1.34rem)] italic leading-relaxed text-ink/90">
                {result.narrative.selectedFormat.judgment}
              </p>
              <p className="mt-2 max-w-[32rem] font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em] text-ink/65">
                {result.narrative.selectedFormat.receipt}
              </p>
              {result.narrative.selectedFormat.caveat && (
                <p className="mt-2 max-w-[32rem] font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em] text-gold-bright/85">
                  {result.narrative.selectedFormat.caveat}
                </p>
              )}
            </div>

            <div className="mt-9 border-t border-ink/20 pt-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <Fact label="Screen" value={result.formatChip} />
                <Fact label="Showtime" value={result.showtime} />
                <Fact label="Ticket" value={result.priceLabel} />
                <Fact label="Home" value={timeline.homeAt} tone={returnTone} />
              </div>
            </div>
          </div>
        </section>

        <section className="relative min-w-0 bg-bg" aria-label="Recommendation details">
          <div className="mx-auto max-w-[760px] px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14 xl:px-16">
            <div className="mb-10 flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">The decisive plan</p>
                <p className="mt-2 font-body text-lg italic leading-relaxed text-ink">A good screening is only good if the entire evening works.</p>
              </div>
              <div className="hidden shrink-0 gap-2 md:flex" aria-label="Primary actions">
                <ActionLink href={result.directionsUrl} variant="quiet" label="Directions" icon={<MapPinned size={15} />} />
                <ActionButton onClick={() => setShareOpen(true)} label="Share brief" icon={<Share2 size={14} />} />
                <ActionLink href={result.districtUrl} variant="primary" label="Book" icon={<ExternalLink size={14} />} />
              </div>
            </div>

            <section aria-labelledby="evening-heading" className="border-y border-border py-6 sm:py-8" data-testid="evening-timeline">
              <div className="mb-6 flex items-baseline justify-between gap-4">
                <div>
                  <p id="evening-heading" className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-bright">Your whole evening</p>
                  <p className="mt-2 font-body text-[1.2rem] italic text-ink">Leave with a plan. Return with one too.</p>
                </div>
                <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] ${returnTone}`}>
                  {returnLabel(result.journey.return.status)}
                </span>
              </div>
              <ol className="relative grid gap-0 before:absolute before:bottom-[1.2rem] before:left-[0.3rem] before:top-[1.05rem] before:w-px before:bg-border sm:grid-cols-5 sm:before:bottom-auto sm:before:left-[10%] sm:before:right-[10%] sm:before:h-px sm:before:w-auto">
                <TimelineStop time={timeline.leaveHome} label="Leave home" />
                <TimelineStop time={timeline.arriveVenue} label="At the theatre" />
                <TimelineStop time={timeline.showStarts} label="Film starts" emphasized />
                <TimelineStop time={timeline.filmEnds} label="Film ends" />
                <TimelineStop time={timeline.homeAt} label="Home again" returnTone={returnTone} />
              </ol>
              <p className="mt-6 max-w-[48rem] border-l border-gold/60 pl-4 font-body text-[0.96rem] italic leading-relaxed text-ink/90">
                {result.journey.return.headline}
                {result.journey.return.cabFallbackLabel ? ` ${result.journey.return.cabFallbackLabel}` : ""}
              </p>
            </section>

            <section className="py-9 sm:py-12" aria-labelledby="why-heading">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <p id="why-heading" className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-bright">Why this won</p>
                  <p className="mt-2 max-w-[40rem] font-body text-[1.16rem] italic leading-relaxed text-ink">{result.narrative.outcome.lead}</p>
                  <p className="mt-3 max-w-[50rem] font-mono text-[9px] uppercase leading-relaxed tracking-[0.07em] text-ink-muted">{result.narrative.outcome.receipt}</p>
                </div>
                <span className="font-mono text-[11px] text-ink-muted">{Math.round(result.score.totalScore * 100)}/100</span>
              </div>
              <ScoreDimensions result={result} />
            </section>

            <section className="border-t border-border py-9 sm:py-12" aria-labelledby="counterfactual-heading" data-testid="decision-stress-test">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold-bright">Decision stress test</p>
                <h2 id="counterfactual-heading" className="mt-2 font-body text-[1.75rem] font-normal leading-[1.12] text-ink sm:text-[1.9rem]">
                  What would change the answer?
                </h2>
                <p className="mt-2 max-w-[46ch] font-body text-[0.95rem] leading-[1.45] text-ink-muted">
                  The same viable plans, judged three different ways.
                </p>
              </div>
              <ol className="mt-6 divide-y divide-border border-y border-border">
                {counterfactuals.map((item) => (
                  <CounterfactualEditorialRow key={item.id ?? `${item.title}-${item.venueName}`} item={item} />
                ))}
              </ol>
            </section>

            <section className="border-t border-border py-9 sm:py-12" aria-labelledby="evidence-heading">
              <p id="evidence-heading" className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold-bright">Evidence, not theatre</p>
              <div className="mt-5 grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2">
                <EvidenceCell label="Showtimes refreshed" value={result.evidence?.showtimes.refreshedAtLabel ?? result.freshnessLabel.replace("AS OF ", "")} />
                <EvidenceCell
                  label="Traffic checked"
                  value={result.evidence
                    ? `${sourceLabel(result.evidence.outbound.source)} · ${result.evidence.outbound.checkedAtLabel}`
                    : sourceLabel(result.provenance.routeSource)}
                />
                <EvidenceCell
                  label="Journey home"
                  value={result.evidence
                    ? `${evidenceReturnLabel(result.evidence.return.status)}${result.evidence.return.scheduledForLabel ? ` · ${result.evidence.return.scheduledForLabel}` : ""}`
                    : returnLabel(result.journey.return.status)}
                  tone={returnTone}
                />
                <EvidenceCell label="Theatre exit" value={result.evidence ? `${result.evening.theatreExitBufferMinutes} MINUTE BUFFER` : "15 MINUTE BUFFER"} />
              </div>
              <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.13em] text-ink-muted">
                {result.provenance.venuesChecked} venues &middot; {result.provenance.showsConsidered} listed shows &middot; {result.provenance.plansScored} viable plans &middot; {result.provenance.transitPlansChecked} return checks
              </p>
            </section>

            <section className="border-t border-border pt-9 sm:pt-12" aria-label="Research and controls">
              <IntentSwitcher active={activeIntent} onSwitch={onSwitchIntent} />
              <div className="mt-10">
                <Dossier result={result} dossier={dossier} origin={origin} onStartOver={onStartOver} />
              </div>
            </section>
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 p-3 backdrop-blur md:hidden" aria-label="Primary actions">
        <div className="mx-auto grid max-w-[560px] grid-cols-3 gap-2">
          <ActionLink href={result.directionsUrl} variant="quiet" label="Directions" icon={<MapPinned size={15} />} />
          <ActionButton onClick={() => setShareOpen(true)} label="Share" icon={<Share2 size={14} />} />
          <ActionLink href={result.districtUrl} variant="primary" label="Book on District" icon={<ExternalLink size={14} />} />
        </div>
      </div>
      {shareOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-sm" role="status">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold-bright">Preparing the share studio</p>
            </div>
          }
        >
          <ShareComposer model={shareModel} onClose={() => setShareOpen(false)} />
        </Suspense>
      )}
    </main>
  );
}

function Fact({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink/55">{label}</p>
      <p className={`mt-1 font-mono text-[11px] uppercase tracking-[0.06em] ${tone}`}>{value}</p>
    </div>
  );
}

function TimelineStop({
  time,
  label,
  emphasized = false,
  returnTone = "text-ink",
}: {
  time: string;
  label: string;
  emphasized?: boolean;
  returnTone?: string;
}) {
  return (
    <li className="relative grid grid-cols-[1.55rem_1fr] items-start gap-3 pb-4 last:pb-0 sm:block sm:pb-0 sm:text-center">
      <span className={`relative z-10 mt-1 block h-[0.65rem] w-[0.65rem] rounded-full border ${emphasized ? "border-gold bg-gold" : "border-ink-muted bg-bg"} sm:mx-auto`} />
      <div className="sm:mt-3">
        <p className={`font-mono text-[11px] uppercase tracking-[0.08em] ${label === "Home again" ? returnTone : "text-ink"}`}>{time}</p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      </div>
    </li>
  );
}

function ScoreDimensions({ result }: { result: RecommendationResult }) {
  const weights = INTENTS[result.score.intent];
  const rows = [
    { label: "Picture", value: result.score.dimensions.experience, weight: weights.experience },
    { label: "Total cost", value: result.score.dimensions.cost, weight: weights.cost },
    { label: "Time", value: result.score.dimensions.time, weight: weights.time },
    { label: "Way home", value: result.score.dimensions.feasibility, weight: weights.feasibility },
  ];

  return (
    <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
            <span>{row.label}</span>
            <span>{Math.round(row.value * 100)} <span className="text-ink-muted/60">&times; {row.weight.toFixed(2)}</span></span>
          </div>
          <div className="h-px bg-border">
            <div className="h-px bg-gold-bright" style={{ width: `${Math.max(4, Math.round(row.value * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CounterfactualEditorialRow({ item }: { item: Counterfactual }) {
  const displayMetric = item.metric ?? { label: "The trade-off", value: item.detail ?? item.reason ?? "See the alternative brief." };
  const displayReturnStatus = item.returnEvidence ? returnEvidenceLabel(item.returnEvidence) : null;
  const totalLabel = item.totalCostRupees == null ? null : `₹${item.totalCostRupees.toLocaleString("en-IN")} complete night`;

  return (
    <li className={`relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 gap-y-4 py-7 sm:grid-cols-[2.75rem_minmax(0,1fr)_9.5rem] sm:gap-x-6 sm:py-8 ${item.isCurrentRecommendation ? "before:absolute before:inset-y-7 before:left-0 before:w-0.5 before:bg-gold" : ""}`}>
      <p className="pl-1 font-body text-[1.55rem] font-light leading-none text-ink/25">{stressRank(item.id)}</p>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`font-mono text-[9px] uppercase tracking-[0.12em] ${item.isCurrentRecommendation ? "text-gold-bright" : "text-ink-muted"}`}>{stressLens(item.id, item.label)}</p>
          {item.isCurrentRecommendation && <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-gold-bright">Verdict holds</p>}
        </div>
        <p className="mt-2 max-w-[34ch] font-body text-[0.95rem] leading-[1.42] text-ink/75">{stressQuestion(item.id, item.question ?? item.label)}</p>
        <p className="mt-4 font-body text-[1.3rem] font-semibold leading-[1.2] text-ink sm:text-[1.4rem]">{item.title ?? item.venueName}</p>
        {item.locality && <p className="mt-1 font-body text-[0.95rem] leading-[1.4] text-ink-muted">{item.locality}</p>}
        <div className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border">
          <LedgerFact label="Screen" value={item.format} />
          <LedgerFact label="Starts" value={item.showtime} />
          <LedgerFact label="Ticket" value={item.priceLabel} />
        </div>
        <p className="mt-3 font-mono text-[8.5px] uppercase tracking-[0.06em] text-ink-muted">
          {[item.dateLabel, totalLabel].filter(Boolean).join(" · ")}
          {displayReturnStatus && <> <span aria-hidden="true">&middot;</span> <span className={returnEvidenceTone(item.returnEvidence)}>{displayReturnStatus}</span></>}
        </p>
      </div>
      <div className="col-start-2 border-l border-gold/50 pl-4 sm:col-start-3 sm:row-start-1 sm:min-w-[9.5rem] sm:pl-5 sm:text-right">
        <p className="font-mono text-[1.35rem] font-medium leading-none tabular-nums text-ink sm:text-[1.45rem]">{displayMetric.value}</p>
        <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.1em] text-ink-muted">{displayMetric.label}</p>
      </div>
    </li>
  );
}

function LedgerFact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-h-[3.5rem] px-2 py-2 sm:px-3">
      <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className="mt-1 font-mono text-[9px] uppercase leading-tight tracking-[0.08em] text-ink">{value ?? "—"}</p>
    </div>
  );
}

function stressRank(id?: string): string {
  if (id === "picture-first") return "01";
  if (id === "price-first") return "02";
  if (id === "earliest-home") return "03";
  return "—";
}

function stressLens(id?: string, fallback?: string): string {
  if (id === "picture-first") return "Screen above all";
  if (id === "price-first") return "Complete-night cost";
  if (id === "earliest-home") return "Earliest home";
  return fallback ?? "A different brief";
}

function stressQuestion(id?: string, fallback?: string): string {
  if (id === "picture-first") return "If picture alone decided it.";
  if (id === "price-first") return "If complete-night cost alone decided it.";
  if (id === "earliest-home") return "If arriving home earliest decided it.";
  return fallback ?? "If the brief changed.";
}

function EvidenceCell({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-h-[5.75rem] bg-bg-raised px-4 py-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className={`mt-2 font-mono text-[11px] uppercase tracking-[0.08em] ${tone}`}>{value}</p>
    </div>
  );
}

function IntentSwitcher({ active, onSwitch }: { active: IntentId; onSwitch: (intent: IntentId) => void }) {
  return (
    <div>
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-gold-bright">Try another lens</p>
      <div className="grid gap-px border border-border bg-border sm:grid-cols-3" role="group" aria-label="Recommendation lens">
        {Object.values(INTENTS).map((intent) => {
          const isActive = intent.id === active;
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => onSwitch(intent.id)}
              aria-pressed={isActive}
              className={`min-h-[4.3rem] px-3 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold-bright ${
                isActive ? "bg-gold text-bg" : "bg-bg-raised text-ink-muted hover:bg-bg hover:text-ink"
              }`}
            >
              <span className="block font-mono text-[10px] uppercase tracking-[0.09em]">{intent.label}</span>
              <span className={`mt-1 block font-body text-[0.9rem] italic ${isActive ? "text-bg/75" : "text-ink-muted"}`}>
                {intent.id === "full-epic" ? "Picture first." : intent.id === "worth-every-rupee" ? "Value first." : "Ease first."}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActionLink({ href, label, icon, variant }: { href: string; label: string; icon: React.ReactNode; variant: "primary" | "quiet" }) {
  const primary = variant === "primary";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-11 items-center justify-center gap-2 border px-4 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright ${
        primary
          ? "border-gold bg-gold text-bg hover:border-gold-bright hover:bg-gold-bright"
          : "border-border bg-bg-raised text-ink hover:border-gold/70 hover:text-gold-bright"
      }`}
    >
      {label}
      {icon}
    </a>
  );
}

function ActionButton({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center justify-center gap-2 border border-border bg-bg-raised px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-gold/70 hover:text-gold-bright focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright"
    >
      {label}
      {icon}
    </button>
  );
}

function makeTimeline(result: RecommendationResult): {
  leaveHome: string;
  arriveVenue: string;
  showStarts: string;
  filmEnds: string;
  returnStarts: string;
  homeAt: string;
} {
  const evening = result.evening;
  const showStarts = (evening?.filmStarts.time ?? result.showtime).toUpperCase();
  const filmEnds = (evening?.filmEnds.time ?? addMinutes(showStarts, 172)).toUpperCase();
  const returnStarts = (evening?.returnDeparture?.time ?? evening?.theatreExit.time ?? addMinutes(filmEnds, 15)).toUpperCase();
  const scheduledHome = evening?.homeArrival?.time;
  return {
    leaveHome: (evening?.leaveHome.time ?? addMinutes(showStarts, -result.journey.outbound.durationMinutes - 15)).toUpperCase(),
    arriveVenue: (evening?.arriveAtTheatre.time ?? addMinutes(showStarts, -15)).toUpperCase(),
    showStarts,
    filmEnds,
    returnStarts,
    homeAt: scheduledHome
      ? scheduledHome.toUpperCase()
      : `≈${addMinutes(returnStarts, result.journey.return.durationMinutes).toUpperCase()}`,
  };
}

function addMinutes(time: string, offset: number): string {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!match) return time;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  const total = ((hour * 60 + minute + offset) % 1440 + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(total % 60).padStart(2, "0")} ${h24 >= 12 ? "PM" : "AM"}`;
}

function makeCounterfactuals(result: RecommendationResult): Counterfactual[] {
  if (result.counterfactuals?.length) {
    return result.counterfactuals.slice(0, 3).map((alternative) => ({
      id: alternative.id,
      label: alternative.label,
      question: alternative.question,
      title: alternative.venueName,
      locality: alternative.locality,
      format: alternative.formatChip,
      showtime: alternative.showtime,
      dateLabel: alternative.dateLabel,
      priceLabel: alternative.priceLabel,
      totalCostRupees: alternative.totalCostRupees,
      returnEvidence: alternative.returnEvidence,
      metric: alternative.metric,
      isCurrentRecommendation: alternative.isCurrentRecommendation,
    }));
  }

  const fallback: Counterfactual[] = [];
  if (result.valueComparison) {
    fallback.push({
      label: "If price mattered most",
      title: result.valueComparison.budget.format,
      detail: `Save ₹${result.valueComparison.priceDiffRupees.toLocaleString("en-IN")} for a smaller step down in the experience.`,
      priceLabel: result.valueComparison.budget.priceLabel,
      showtime: result.valueComparison.budget.showtime,
    });
  }
  if (result.runnerUp) {
    fallback.push({
      label: "If you chose the next-best plan",
      title: result.runnerUp.venueName,
      detail: `${result.runnerUp.locality} · ${result.runnerUp.formatChip}`,
      priceLabel: result.runnerUp.priceLabel,
      showtime: result.runnerUp.showtime,
    });
  }
  if (!fallback.length) {
    fallback.push({
      label: "If the brief changed",
      title: "Try another lens below",
      detail: "The same reachable shows will be scored for picture, value, or an easy evening.",
    });
  }
  return fallback;
}

function returnStatusTone(status: ReturnStatus): string {
  if (status === "good") return "text-sea-bright";
  if (status === "stranded") return "text-wine-bright";
  return "text-ink-muted";
}

function returnLabel(status: ReturnStatus): string {
  if (status === "good") return "Return verified";
  if (status === "stranded") return "Cab home required";
  return "Return to verify";
}

function sourceLabel(source: RecommendationResult["provenance"]["routeSource"]): string {
  return source === "live" ? "LIVE GOOGLE ROUTE" : "ESTIMATED ROUTE";
}

function evidenceReturnLabel(status: "live" | "no-route" | "unverified"): string {
  if (status === "live") return "TRANSIT SCHEDULED";
  if (status === "no-route") return "NO TRANSIT · CAB FALLBACK";
  return "RETURN LOOKUP UNVERIFIED";
}

function returnEvidenceLabel(status: "live" | "no-route" | "unverified"): string {
  if (status === "live") return "Transit found";
  if (status === "no-route") return "Cab home";
  return "Transit unverified";
}

function returnEvidenceTone(status: Counterfactual["returnEvidence"]): string {
  if (status === "live") return "text-sea-bright";
  if (status === "no-route") return "text-wine-bright";
  return "text-ink-muted";
}

export default ResultExperience;
