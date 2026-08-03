import { lazy, Suspense, useMemo, useState } from "react";
import { ExternalLink, MapPinned, Share2 } from "lucide-react";
import { Dossier } from "./Dossier";
import type { Origin } from "./helm/types";
import type { DossierEntry, RecommendationPreferences } from "../lib/buildRecommendation";
import type { IntentId } from "../scoring/score";
import type { ProofStatus, RecommendationResult, ReturnStatus } from "../types/recommendation";
import { buildShareArtifactModel } from "../lib/shareArtifact";
import { buildReturnCopy } from "../lib/recommendationNarrative";
import { trackEvent } from "../lib/telemetry";
import { FeedbackPrompt } from "./FeedbackPrompt";

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
  preferences: RecommendationPreferences;
  onChangePreferences: (preferences: RecommendationPreferences) => void;
  constraintReason: string | null;
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
  preferences,
  onChangePreferences,
  constraintReason,
  onStartOver,
}: ResultExperienceProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [planControlsOpen, setPlanControlsOpen] = useState(Boolean(constraintReason));
  const timeline = makeTimeline(result);
  const counterfactuals = makeCounterfactuals(result);
  const returnTone = returnStatusTone(result.journey.return.status);
  const returnCopy = buildReturnCopy(result.journey.return, result.evening.theatreExit.time);
  const totalCostLabel = formatTotalCost(result);
  const returnConfidence = returnConfidenceLabel(result);
  const shareModel = useMemo(() => buildShareArtifactModel(result, origin), [result, origin]);
  const openShare = () => {
    trackEvent("share_opened", { venue: result.venueName, format: result.formatChip });
    setShareOpen(true);
  };

  return (
    <main className="result-experience min-h-screen overflow-x-clip bg-bg pb-32 text-ink md:pb-0" data-testid="result-experience">
      <div className="mx-auto grid w-full min-w-0 max-w-[1760px] min-[1120px]:grid-cols-[minmax(470px,46%)_minmax(0,1fr)]">
        <section className="relative min-w-0 h-[44svh] min-h-[390px] max-h-[520px] overflow-hidden border-b border-border min-[1120px]:sticky min-[1120px]:top-0 min-[1120px]:h-screen min-[1120px]:max-h-none min-[1120px]:border-b-0 min-[1120px]:border-r">
          <picture className="absolute inset-0">
            <source media="(min-width: 1120px)" srcSet="/result-helmet-wide.jpg" />
            <img
              src="/result-helmet-tall.jpg"
              alt="A weathered bronze helmet, seen from behind"
              className="h-full w-full object-cover object-[63%_42%] min-[1120px]:object-[74%_50%]"
            />
          </picture>
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,9,14,0.12)_0%,rgba(5,9,14,0.18)_26%,rgba(5,9,14,0.94)_100%)]" />

          <div className="relative flex h-full flex-col justify-between p-5 sm:p-8 min-[1120px]:p-10 min-[1440px]:p-14">
            <div className="flex items-center justify-between gap-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink/75">
              <span>Ithaka / tonight&rsquo;s answer</span>
              <span>{result.freshnessLabel}</span>
            </div>

            <div className="max-w-[35rem] pt-5 min-[1120px]:pt-0">
              <p className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-gold-bright">Your answer / {result.intentLabel}</p>
              <h1 className="max-w-[14ch] font-display text-[clamp(2rem,4.2vw,4.25rem)] leading-[1.04] text-ink [text-wrap:balance]">
                {result.venueName}
              </h1>
              <p className="mt-3 max-w-[31rem] font-body text-[0.98rem] italic leading-relaxed text-ink/90 sm:text-[1.15rem]">
                {result.narrative.selectedFormat.judgment}
              </p>
              <FormatProofList format={result.formatChip} proof={result.screenProof} />
            </div>

            <div className="mt-4 border-t border-ink/20 pt-3 min-[1120px]:mt-7 min-[1120px]:pt-4">
              <div className="grid grid-cols-3 gap-x-4 sm:gap-x-8">
                <Fact label={result.dateLabel} value={result.showtime} />
                <Fact label="Door to door" value={totalCostLabel} />
                <Fact label="Return check" value={returnConfidence} tone={returnTone} />
              </div>
              <p className="mt-3 font-mono text-[11px] uppercase leading-relaxed tracking-[0.08em] text-ink/65 min-[1120px]:mt-5">
                Compared {result.provenance.plansScored} complete plans across {result.provenance.venuesChecked} venues
              </p>
            </div>
          </div>
        </section>

        <section className="relative min-w-0 bg-bg" aria-label="Recommendation details">
          <div className="mx-auto w-full max-w-[880px] px-5 py-8 sm:px-8 sm:py-10 min-[1120px]:px-10 min-[1120px]:py-12 min-[1440px]:px-14">
            <div className="mb-8 hidden items-center justify-between gap-4 border-b border-border pb-5 md:flex" aria-label="Primary actions">
              <p className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted sm:block">Recommendation ready</p>
              <div className="flex shrink-0 gap-2">
                <ActionLink href={result.directionsUrl} onOpen={() => trackEvent("directions_opened", { venue: result.venueName })} variant="quiet" label="Directions" icon={<MapPinned size={15} />} />
                <ActionButton onClick={openShare} label="Share brief" icon={<Share2 size={14} />} />
                <ActionLink href={result.districtUrl} onOpen={() => trackEvent("booking_opened", { venue: result.venueName, format: result.formatChip })} variant="primary" label={`Check ${result.showtime}`} icon={<ExternalLink size={14} />} />
              </div>
            </div>

            <section aria-labelledby="evening-heading" className="pb-9 sm:pb-11" data-testid="evening-timeline">
              <div className="mb-7 flex items-center justify-between gap-5">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="font-mono text-[10px] text-gold-bright">01</span>
                  <p id="evening-heading" className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-gold-bright">Tonight, mapped</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanControlsOpen((open) => !open)}
                  aria-expanded={planControlsOpen}
                  aria-controls="plan-constraints"
                  className="px-1 py-2 font-mono text-[10px] uppercase tracking-[0.11em] text-ink-muted transition-colors hover:text-gold-bright"
                >
                  {planControlsOpen ? "Close" : "Adjust plan"}
                </button>
              </div>
              {result.timing.notice && (
                <p className="-mt-3 mb-6 max-w-[42rem] font-body text-[14px] italic leading-relaxed text-ink-muted">
                  {result.timing.notice}
                </p>
              )}
              <ol className="relative grid gap-0 before:absolute before:bottom-[1.2rem] before:left-[0.3rem] before:top-[1.05rem] before:w-px before:bg-border sm:grid-cols-5 sm:before:bottom-auto sm:before:left-[10%] sm:before:right-[10%] sm:before:h-px sm:before:w-auto">
                <TimelineStop time={timeline.leaveHome} label="Leave home" />
                <TimelineStop time={timeline.arriveVenue} label="At the theatre" />
                <TimelineStop time={timeline.showStarts} label="Film starts" emphasized />
                <TimelineStop time={timeline.filmEnds} label="Film ends" />
                <TimelineStop time={timeline.homeAt} label="Est. home" returnTone={returnTone} />
              </ol>
              <RouteDecisionModule result={result} heading={returnCopy.heading} detail={returnCopy.detail} />
              <ProgressiveControls
                open={planControlsOpen}
                preferences={preferences}
                onChange={onChangePreferences}
                constraintReason={constraintReason}
              />
            </section>

            <section className="border-t border-border py-9 sm:py-11" aria-labelledby="why-heading">
              <div className="mb-7">
                <div className="min-w-0">
                  <p id="why-heading" className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted"><span className="mr-3 text-gold-bright">02</span>Why it won</p>
                  <p className="mt-3 font-mono text-[13px] font-medium uppercase leading-relaxed tracking-[0.06em] text-ink sm:text-[14px]">{result.narrative.outcome.lead}</p>
                </div>
              </div>
              <WinningReasons result={result} timeline={timeline} returnCopy={returnCopy.detail} />
              <details className="group mt-7 border-t border-border pt-4">
                <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.11em] text-ink-muted transition-colors hover:text-gold-bright">
                  <span className="group-open:hidden">See score balance</span>
                  <span className="hidden group-open:inline">Hide score balance</span>
                </summary>
                <div className="mt-5"><ScoreDimensions result={result} /></div>
              </details>
            </section>

            {result.fullEpicTradeoff && <FullEpicTradeoff result={result} />}

            <section className="border-t border-border py-9 sm:py-11" aria-labelledby="counterfactual-heading" data-testid="decision-stress-test">
              <div>
                <h2 id="counterfactual-heading" className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted">
                  <span className="mr-3 text-gold-bright">03</span>Stress-test the brief
                </h2>
                <p className="mt-3 max-w-[39rem] font-body text-[1rem] leading-relaxed text-ink-muted">Same candidate set, deliberately different priorities. Pick a lens to recalculate the answer.</p>
              </div>
              <ol className="mt-6 divide-y divide-border border-y border-border">
                {counterfactuals.map((item) => (
                  <CounterfactualEditorialRow
                    key={item.id ?? `${item.title}-${item.venueName}`}
                    item={item}
                    active={intentForCounterfactual(item.id) === activeIntent}
                    onSelect={() => {
                      const intent = intentForCounterfactual(item.id);
                      if (intent) onSwitchIntent(intent);
                    }}
                  />
                ))}
              </ol>
            </section>

            <section className="border-t border-border pt-9 sm:pt-11" aria-label="Research and controls">
              <Dossier result={result} dossier={dossier} origin={origin} onStartOver={onStartOver} />
            </section>
            <FeedbackPrompt context={{ venue: result.venueName, format: result.formatChip, intent: activeIntent }} />
            <footer className="build-credit border-t border-border pb-4 pt-10 text-center text-sm text-ink-muted">
              Built with <span className="build-credit__struck">obsessive energy</span> and coffee. <a className="build-credit__link" href="/made">Learn more ↗</a>
            </footer>
          </div>
        </section>
      </div>

      <div className="result-mobile-actions fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 px-3 pt-3 backdrop-blur md:hidden" aria-label="Primary actions">
        <div className="mx-auto grid max-w-[560px] grid-cols-[minmax(0,1fr)_minmax(0,.75fr)_minmax(0,1.35fr)] gap-2">
          <ActionLink href={result.directionsUrl} onOpen={() => trackEvent("directions_opened", { venue: result.venueName })} variant="quiet" label="Directions" icon={<MapPinned size={15} />} />
          <ActionButton onClick={openShare} label="Share" icon={<Share2 size={14} />} />
          <ActionLink href={result.districtUrl} onOpen={() => trackEvent("booking_opened", { venue: result.venueName, format: result.formatChip })} variant="primary" label="Check on District" icon={<ExternalLink size={14} />} />
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
          <ShareComposer model={shareModel} onClose={() => setShareOpen(false)} onShared={() => trackEvent("share_completed", { venue: result.venueName })} />
        </Suspense>
      )}
    </main>
  );
}

function FormatProofList({
  format,
  proof,
}: {
  format: string;
  proof: RecommendationResult["screenProof"];
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono uppercase min-[1120px]:mt-6">
      <p className="border border-gold/60 px-2.5 py-1 text-[10px] tracking-[0.12em] text-gold-bright">{format}</p>
      <dl>
        {proof.imax === "confirmed" && (
          <div className="flex gap-4">
            <ProofFact label="IMAX" status={proof.imax} />
            <ProofFact label="Laser" status={proof.laser} />
            <ProofFact label="70mm" status={proof.seventyMm} />
          </div>
        )}
      </dl>
    </div>
  );
}

function ProofFact({ label, status }: { label: string; status: ProofStatus }) {
  const symbol = status === "confirmed" ? "✓" : status === "unavailable" ? "×" : "?";
  const spokenStatus = status === "confirmed" ? "confirmed" : status === "unavailable" ? "not available" : "not verified";
  const tone = status === "confirmed" ? "text-gold-bright" : status === "unavailable" ? "text-ink/70" : "text-ink-muted";
  return (
    <div className="flex items-baseline gap-1.5" aria-label={`${label}: ${spokenStatus}`}>
      <dt className="text-[10px] tracking-[0.12em] text-ink/60">{label}</dt>
      <dd aria-hidden="true" className={`text-[0.85rem] font-medium leading-none ${tone}`}>{symbol}</dd>
    </div>
  );
}

function Fact({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-ink/55">{label}</p>
      <p className={`mt-1.5 break-words font-mono text-[11px] font-medium uppercase leading-snug tracking-[0.035em] sm:text-[13px] ${tone}`}>{value}</p>
    </div>
  );
}

function RouteDecisionModule({
  result,
  heading,
  detail,
}: {
  result: RecommendationResult;
  heading: string;
  detail: string;
}) {
  const status = result.journey.return.status;
  const stateClass = status === "good"
    ? "result-route--live"
    : status === "stranded"
      ? "result-route--no-route"
      : "result-route--unverified";
  const tone = returnStatusTone(status);

  return (
    <aside className={`result-route mt-7 border p-4 sm:mt-8 sm:p-5 ${stateClass}`} aria-label={`${heading}. ${detail}`}>
      <div className="flex items-center justify-between gap-4">
        <p className={`font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] ${tone}`}>{heading}</p>
        {status === "good" && (
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted" aria-hidden="true">
            <span
              className="block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: result.journey.return.lineColorHex }}
            />
            {result.journey.return.lineLabel}
          </span>
        )}
      </div>
      <p className="mt-3 font-mono text-[12px] font-medium uppercase leading-[1.65] tracking-[0.045em] text-ink sm:text-[13px]">
        {detail}
      </p>
    </aside>
  );
}

function ProgressiveControls({
  open,
  preferences,
  onChange,
  constraintReason,
}: {
  open: boolean;
  preferences: RecommendationPreferences;
  onChange: (preferences: RecommendationPreferences) => void;
  constraintReason: string | null;
}) {
  const update = (change: Partial<RecommendationPreferences>) => onChange({ ...preferences, ...change });

  if (!open && !constraintReason) return null;

  return (
    <div id="plan-constraints" className="mt-6 border-t border-border pt-6">
      {constraintReason && (
        <p role="alert" className="border-l-2 border-wine px-4 font-body text-[14px] leading-relaxed text-ink-muted">
          {constraintReason}
        </p>
      )}

      {open && (
        <div className={`${constraintReason ? "mt-6 " : ""}grid gap-px border border-border bg-border sm:grid-cols-3`}>
          <ConstraintButton
            label="Morning shows"
            value="I’m okay with them"
            active={Boolean(preferences.allowMorningShows)}
            onClick={() => update({ allowMorningShows: !preferences.allowMorningShows })}
          />
          <ConstraintButton
            label="Journey home"
            value={preferences.returnMode === "metro-only" ? "Metro only" : "Cab okay"}
            active={preferences.returnMode === "metro-only"}
            onClick={() => update({ returnMode: preferences.returnMode === "metro-only" ? "cab-ok" : "metro-only" })}
          />
          <label className="block bg-bg p-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">Need to be home by</span>
            <select
              aria-label="Need to be home by"
              value={preferences.homeBy ?? ""}
              onChange={(event) => update({ homeBy: event.target.value || undefined })}
              className="mt-4 w-full appearance-none bg-transparent font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-ink outline-none"
            >
              <option value="">No deadline</option>
              <option value="22:30">10:30 PM</option>
              <option value="23:30">11:30 PM</option>
              <option value="00:30">12:30 AM</option>
              <option value="01:30">1:30 AM</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function ConstraintButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[8.55rem] bg-bg p-5 text-left transition-colors hover:bg-[var(--result-panel-soft)] ${active ? "border-t-2 border-gold-bright" : ""}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">{label}</span>
      <span className={`mt-4 block font-body text-[1.15rem] leading-tight ${active ? "text-gold-bright" : "text-ink"}`}>{value}</span>
    </button>
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
    <li className="relative grid grid-cols-[1.55rem_1fr] items-start gap-3 pb-5 last:pb-0 sm:block sm:pb-0 sm:text-center">
      <span className={`relative z-10 mt-1 block h-[0.65rem] w-[0.65rem] rounded-full border ${emphasized ? "border-gold bg-gold" : "border-ink-muted bg-bg"} sm:mx-auto`} />
      <div className="sm:mt-3">
        <p className={`font-mono text-[13px] font-medium uppercase tracking-[0.055em] ${label.toLowerCase().includes("home") ? returnTone : "text-ink"}`}>{time}</p>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      </div>
    </li>
  );
}

function WinningReasons({
  result,
  timeline,
  returnCopy,
}: {
  result: RecommendationResult;
  timeline: { homeAt: string };
  returnCopy: string;
}) {
  const total = `${result.journey.outbound.costIsEstimate || result.journey.return.costIsEstimate ? "≈" : ""}₹${result.journey.totalCostRupees.toLocaleString("en-IN")}`;
  const returnLabel = `Est. home ${timeline.homeAt}`;
  const reasons = [
    {
      number: "01",
      label: "Screen, evidenced",
      value: result.formatChip,
      detail: formatConfidenceCopy(result),
    },
    {
      number: "02",
      label: "The evening works",
      value: `${result.journey.outbound.durationMinutes} min there · ${returnLabel}`,
      detail: returnCopy,
    },
    {
      number: "03",
      label: "Whole-night value",
      value: `${total} door to door`,
      detail: result.narrative.outcome.receipt,
    },
  ];

  return (
    <ol className="grid divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {reasons.map((reason) => (
        <li key={reason.number} className="min-h-[12rem] px-0 py-5 sm:px-5 sm:first:pl-0 sm:last:pr-0">
          <p className="font-mono text-[10px] tracking-[0.12em] text-gold-bright">{reason.number}</p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.11em] text-ink-muted">{reason.label}</p>
          <p className="mt-2 font-mono text-[12px] font-medium uppercase leading-relaxed tracking-[0.045em] text-ink">{reason.value}</p>
          <p className="mt-3 font-body text-[14px] leading-relaxed text-ink-muted">{reason.detail}</p>
        </li>
      ))}
    </ol>
  );
}

function ScoreDimensions({ result }: { result: RecommendationResult }) {
  const rows = [
    { label: "Picture", value: result.score.dimensions.experience },
    { label: "Total cost", value: result.score.dimensions.cost },
    { label: "Time", value: result.score.dimensions.time },
    { label: "Way home", value: result.score.dimensions.feasibility },
  ];

  return (
    <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-2.5 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.085em] text-ink-muted">
            <span>{row.label}</span>
            <span className="tabular-nums">{Math.round(row.value * 100)}</span>
          </div>
          <div className="h-[4px] bg-ink/15">
            <div className="h-[4px] bg-gold-bright" style={{ width: `${Math.max(6, Math.round(row.value * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FullEpicTradeoff({ result }: { result: RecommendationResult }) {
  const tradeoff = result.fullEpicTradeoff!;
  return (
    <section className="border-t border-border py-9 sm:py-11" aria-labelledby="closer-screen-heading">
      <p id="closer-screen-heading" className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-muted">
        The closer screen
      </p>
      <div className="mt-5 grid gap-5 border-y border-border py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-8">
        <div className="min-w-0">
          <p className="font-display text-[1.5rem] leading-tight text-ink sm:text-[1.8rem]">{tradeoff.venueName}</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
            {tradeoff.locality} <span aria-hidden="true">·</span> {tradeoff.formatChip} <span aria-hidden="true">·</span> {tradeoff.showtime}
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border border-x border-border text-center sm:min-w-[15.5rem]">
          <TradeoffFact label="Screen" value={`${tradeoff.screenScore}/100`} />
          <TradeoffFact label="Away" value={`${tradeoff.outboundDurationMinutes} min`} />
        </div>
      </div>
      <p className="mt-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.06em] text-ink-muted">
        Save {tradeoff.outboundMinutesSaved} min outbound. Give up {tradeoff.screenPointsGivenUp} screen points.
      </p>
    </section>
  );
}

function TradeoffFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 sm:px-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">{label}</p>
      <p className="mt-1.5 font-mono text-[1.15rem] font-medium leading-none tabular-nums text-ink">{value}</p>
    </div>
  );
}

function CounterfactualEditorialRow({
  item,
  active,
  onSelect,
}: {
  item: Counterfactual;
  active: boolean;
  onSelect: () => void;
}) {
  const rawMetric = item.metric ?? { label: "The trade-off", value: item.detail ?? item.reason ?? "See the alternative brief." };
  const displayMetric = item.id === "earliest-home"
    ? { label: "Est. home", value: rawMetric.value.startsWith("≈") ? rawMetric.value : `≈${rawMetric.value}` }
    : rawMetric;
  const displayReturnStatus = item.returnEvidence ? returnEvidenceLabel(item.returnEvidence) : null;
  const totalLabel = item.totalCostRupees == null ? null : `₹${item.totalCostRupees.toLocaleString("en-IN")} complete night`;

  return (
    <li className={active ? "relative before:absolute before:inset-y-6 before:left-0 before:z-10 before:w-0.5 before:bg-gold" : ""}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="grid w-full cursor-pointer grid-cols-[2.15rem_minmax(0,1fr)] gap-x-3 gap-y-5 px-0 py-7 text-left transition-colors hover:bg-[var(--result-panel-soft)] focus-visible:relative focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold-bright sm:grid-cols-[2.5rem_minmax(0,1fr)_10rem] sm:gap-x-6 sm:py-8"
      >
        <p className="pl-1 font-mono text-[1rem] font-medium leading-none text-ink/25">{stressRank(item.id)}</p>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={`font-mono text-[10.5px] uppercase tracking-[0.1em] ${active ? "text-gold-bright" : "text-ink-muted"}`}>{stressLens(item.id, item.label)}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">{stressLensDetail(item.id)}</p>
            </div>
            {active ? <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-gold-bright">Active</p> : item.isCurrentRecommendation ? <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">Same pick</p> : null}
          </div>
          <p className="mt-3 font-body text-[1.3rem] font-semibold leading-[1.2] text-ink sm:text-[1.4rem]">{item.title ?? item.venueName}</p>
          {item.locality && <p className="mt-1 font-body text-[0.95rem] leading-[1.4] text-ink-muted">{item.locality}</p>}
          <div className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border">
            <LedgerFact label="Screen" value={item.format} />
            <LedgerFact label="Starts" value={item.showtime} />
            <LedgerFact label="Ticket" value={item.priceLabel} />
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase leading-relaxed tracking-[0.045em] text-ink-muted">
            {[item.dateLabel, totalLabel].filter(Boolean).join(" · ")}
            {displayReturnStatus && <> <span aria-hidden="true">&middot;</span> <span className={returnEvidenceTone(item.returnEvidence)}>{displayReturnStatus}</span></>}
          </p>
        </div>
        <div className="col-start-2 border-l border-border pl-4 sm:col-start-3 sm:row-start-1 sm:min-w-[10rem] sm:pl-5 sm:text-right">
          <p className="font-mono text-[1.4rem] font-medium leading-none tabular-nums text-ink sm:text-[1.55rem]">{displayMetric.value}</p>
          <p className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.085em] text-ink-muted">{displayMetric.label}</p>
        </div>
      </button>
    </li>
  );
}

function LedgerFact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-h-[3.75rem] px-2.5 py-2.5 sm:px-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      <p className="mt-1.5 font-mono text-[10.5px] font-medium uppercase leading-tight tracking-[0.055em] text-ink">{value ?? "—"}</p>
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
  if (id === "picture-first") return "The Full Epic";
  if (id === "price-first") return "Worth Every Rupee";
  if (id === "earliest-home") return "The Easy Evening";
  return fallback ?? "Another priority";
}

function stressLensDetail(id?: string): string {
  if (id === "picture-first") return "Picture first";
  if (id === "price-first") return "Value first";
  if (id === "earliest-home") return "Ease first";
  return "";
}

function intentForCounterfactual(id?: string): IntentId | undefined {
  if (id === "picture-first") return "full-epic";
  if (id === "price-first") return "worth-every-rupee";
  if (id === "earliest-home") return "easy-evening";
  return undefined;
}

function ActionLink({ href, label, icon, variant, onOpen }: { href: string; label: string; icon: React.ReactNode; variant: "primary" | "quiet"; onOpen?: () => void }) {
  const primary = variant === "primary";
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onOpen}
      className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 border px-2 text-center font-mono text-[10px] font-medium uppercase leading-tight tracking-[0.1em] transition-colors sm:px-4 sm:text-[10.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright ${
        primary
          ? "border-gold bg-gold text-bg hover:border-gold-bright hover:bg-gold-bright"
          : "border-border bg-bg text-ink hover:border-ink/30 hover:bg-[var(--result-panel-soft)]"
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
      className="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 border border-border bg-bg px-2 text-center font-mono text-[10px] font-medium uppercase leading-tight tracking-[0.1em] text-ink transition-colors hover:border-ink/30 hover:bg-[var(--result-panel-soft)] sm:px-4 sm:text-[10.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-bright"
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
    homeAt: `≈${(scheduledHome ?? addMinutes(returnStarts, result.journey.return.durationMinutes)).toString().toUpperCase()}`,
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

function formatTotalCost(result: RecommendationResult): string {
  const estimated = result.journey.outbound.costIsEstimate || result.journey.return.costIsEstimate;
  return `${estimated ? "≈" : ""}₹${result.journey.totalCostRupees.toLocaleString("en-IN")}`;
}

function returnConfidenceLabel(result: RecommendationResult): string {
  if (result.evidence.return.status === "live") return "First transit found";
  if (result.evidence.return.status === "no-route") {
    return result.journey.return.cabEstimateAvailable === false
      ? "Cab price unavailable"
      : `Cab ≈₹${result.journey.return.costRupees.toLocaleString("en-IN")}`;
  }
  return "Return unverified";
}

function formatConfidenceCopy(result: RecommendationResult): string {
  const status = (label: string, value: ProofStatus): string => {
    if (value === "confirmed") return `${label} confirmed`;
    if (value === "unavailable") return `${label} not available`;
    return `${label} unverified`;
  };
  if (result.screenProof.imax === "confirmed") {
    return [
      "IMAX confirmed for this presentation.",
      status("Laser", result.screenProof.laser),
      status("70mm", result.screenProof.seventyMm),
    ].join(" · ");
  }
  return [
    `Listed as ${result.formatChip}.`,
    result.narrative.selectedFormat.caveat ?? "Projector details are unverified.",
  ].join(" ");
}

function returnEvidenceLabel(status: "live" | "no-route" | "unverified"): string {
  if (status === "live") return "First transit found";
  if (status === "no-route") return "Transit × · Cab";
  return "Transit ? · Cab est.";
}

function returnEvidenceTone(status: Counterfactual["returnEvidence"]): string {
  if (status === "live") return "text-sea-bright";
  if (status === "no-route") return "text-wine-bright";
  return "text-ink-muted";
}

export default ResultExperience;
