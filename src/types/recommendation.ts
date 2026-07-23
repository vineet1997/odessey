import type { ScoreResult } from "../scoring/score";
import type { RecommendationNarrative, NarrativeValueComparison } from "../lib/recommendationNarrative";

/**
 * Shared shape ResultCard.tsx renders. Originally declared inline in
 * src/fixtures/sampleResult.ts; promoted here once src/lib/buildRecommendation.ts
 * needed to produce the same shape from real data instead of a fixture.
 */

export type ReturnStatus = "good" | "stranded" | "unverified";
export type ReturnEvidenceStatus = "live" | "no-route" | "unverified";
export type ReturnFallbackReason = "no-metro-route" | "metro-too-late" | "lookup-unavailable";
export type ProofStatus = "confirmed" | "unavailable" | "unverified";

/** Equipment proof for the exact selected presentation. Unknown evidence
 * remains `unverified`; it must never be rendered as a negative claim. */
export interface ScreenProof {
  imax: ProofStatus;
  laser: ProofStatus;
  seventyMm: ProofStatus;
}

/** A clock event in the user-facing, complete-evening itinerary. `dayOffset`
 * prevents a 12:20 AM arrival from looking as though it happens before a
 * 10:00 PM screening. */
export interface EveningMoment {
  label: string;
  time: string;
  isoTime: string;
  dayOffset: number;
}

/** The decision view is an evening, not just a screening: each fixed point is
 * derived from the exact showtime and route durations used by the scorer. */
export interface EveningTimeline {
  timezone: "Asia/Kolkata";
  theatreExitBufferMinutes: number;
  leaveHome: EveningMoment;
  arriveAtTheatre: EveningMoment;
  filmStarts: EveningMoment;
  filmEnds: EveningMoment;
  theatreExit: EveningMoment;
  /** Present only when Google returned a scheduled transit departure. */
  returnDeparture?: EveningMoment;
  /** Present only when the return is scheduled, not inferred from a cab
   * fallback. */
  homeArrival?: EveningMoment;
}

/** Source-level facts for the selected plan. These deliberately distinguish a
 * confirmed lack of transit from a failed/unavailable lookup. */
export interface RecommendationEvidence {
  showtimes: {
    source: "district";
    refreshedAtLabel: string;
    targetDates: string[];
  };
  outbound: {
    mode: "drive";
    source: "live" | "estimated";
    durationMinutes: number;
    checkedAtLabel: string;
  };
  return: {
    mode: "transit" | "cab-fallback";
    status: ReturnEvidenceStatus;
    selectedPlanChecked: boolean;
    departureBasis: "film-end + 15 min theatre exit";
    scheduledForLabel?: string;
  };
}

export type CounterfactualId = "picture-first" | "price-first" | "earliest-home";

/** An intentionally different optimisation over the same viable show plans.
 * It may be the current recommendation too; that is useful proof when the
 * user's requested trade-off also wins under a simpler lens. */
export interface CounterfactualAlternative {
  id: CounterfactualId;
  label: string;
  question: string;
  venueName: string;
  locality: string;
  formatChip: string;
  showtime: string;
  dateLabel: string;
  priceLabel: string;
  totalCostRupees: number;
  returnEvidence: ReturnEvidenceStatus;
  metric: { label: string; value: string };
  isCurrentRecommendation: boolean;
}

export interface JourneyLeg {
  lineLabel: string;
  lineColorHex: string;
  durationMinutes: number;
  costRupees: number;
  costIsEstimate?: boolean;
  /** A defensive display guard: a broken upstream route must never turn into
   * an empty or invented cab price. */
  cabEstimateAvailable?: boolean;
}

export interface ReturnLeg extends JourneyLeg {
  status: ReturnStatus;
  /** e.g. "THE 11:32 PM LAST TRAIN FROM MALVIYA NAGAR GETS YOU HOME" */
  headline: string;
  /** Only present when status === "stranded" — the cab fallback range. */
  cabFallbackLabel?: string;
  evidenceLabel?: string;
  /** Structured facts for the first scheduled transit step returned by
   * Google. These do not describe a complete multi-leg itinerary. */
  departureTime?: string;
  departureStop?: string;
  vehicleType?: string;
  /** Why cab replaced metro, when the route is not a confirmed metro plan. */
  fallbackReason?: ReturnFallbackReason;
}

export interface RunnerUp {
  venueName: string;
  locality: string;
  formatChip: string;
  priceLabel: string;
  showtime: string;
  score: ScoreResult;
  /** Curated/raw format score, kept separate from the weighted recommendation score. */
  screenScore: number;
  totalCostRupees: number;
  returnEvidence: ReturnEvidenceStatus;
}

export interface RecommendationResult {
  intentLabel: string; // "WORTH EVERY RUPEE"
  freshnessLabel: string; // "AS OF 18:42"
  venueName: string;
  formatChip: string;
  verdict: string; // serif italic one-liner
  showtime: string; // "4:50 PM"
  dateLabel: string; // "MON JUL 20"
  seatClass: string; // "CLASSIC"
  priceLabel: string; // "₹1,100"
  journey: {
    outbound: JourneyLeg;
    return: ReturnLeg;
    totalCostRupees: number;
  };
  /** The complete evening derived from this exact plan. */
  evening: EveningTimeline;
  /** What was observed, estimated, or conclusively unavailable for this
   * selected plan. Designed for progressive evidence disclosure. */
  evidence: RecommendationEvidence;
  /** Evidence-bounded format and outcome language. `verdict`/`whyLine` are
   * retained for existing consumers, but new surfaces render these fields. */
  narrative: RecommendationNarrative;
  whyLine: string;
  /** Absent when there's only one valid candidate venue for this request —
   * ResultCard renders no runner-up row in that case rather than fabricate one. */
  runnerUp?: RunnerUp;
  score: ScoreResult;
  /** The selected format's curated screen score. Never infer this from score dimensions. */
  screenScore: number;
  /** Source-bounded format/equipment status for the exact selected show. */
  screenProof: ScreenProof;
  /** Three alternative answers to deliberately narrower questions, selected
   * only from the same viable, scored show plans. */
  counterfactuals: CounterfactualAlternative[];
  /** The winning venue's real district.in page — where "Book on District" actually goes. */
  districtUrl: string;
  /** "Worth Every Rupee" only — present when the winning venue also fielded a
   * meaningfully different-experience format (>=15pt gap) at a different
   * price. Not rendered yet — a later pass builds the UI for this. */
  valueComparison?: NarrativeValueComparison;
  /** e.g. "132 OF 381 SEATS LEFT · FILLING FAST" — present only when the
   * winning show carries live seat counts. Not rendered yet. */
  seatsLine?: string;
  /** Google Maps deep link, origin -> winning venue. What the Directions
   * button actually opens. */
  directionsUrl: string;
  /** The dossier's honesty numbers — how much of the real candidate set this
   * recommendation was drawn from. */
  provenance: {
    /** Unique venues that produced at least one scored candidate. */
    venuesChecked: number;
    /** Total showtimes on the target dates across all venues, before any
     * selection/filtering was applied. */
    showsConsidered: number;
    /** Complete venue × format × show plans that survived routing and were
     * passed through the scoring engine. */
    plansScored: number;
    /** `estimated` in plain Vite development (and whenever Google's live
     * route call falls back); `live` only when every scored venue used a
     * measured Google Routes response. */
    routeSource: "live" | "estimated";
    transitPlansChecked: number;
    returnEvidence: "live" | "no-route" | "unverified";
  };
}
