import type { ScoreResult } from "../scoring/score";

/**
 * Shared shape ResultCard.tsx renders. Originally declared inline in
 * src/fixtures/sampleResult.ts; promoted here once src/lib/buildRecommendation.ts
 * needed to produce the same shape from real data instead of a fixture.
 */

export type ReturnStatus = "good" | "stranded";

export interface JourneyLeg {
  lineLabel: string;
  lineColorHex: string;
  durationMinutes: number;
  costRupees: number;
}

export interface ReturnLeg extends JourneyLeg {
  status: ReturnStatus;
  /** e.g. "THE 11:32 PM LAST TRAIN FROM MALVIYA NAGAR GETS YOU HOME" */
  headline: string;
  /** Only present when status === "stranded" — the cab fallback range. */
  cabFallbackLabel?: string;
}

export interface RunnerUp {
  venueName: string;
  locality: string;
  formatChip: string;
  priceLabel: string;
  showtime: string;
  score: ScoreResult;
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
  whyLine: string;
  /** Absent when there's only one valid candidate venue for this request —
   * ResultCard renders no runner-up row in that case rather than fabricate one. */
  runnerUp?: RunnerUp;
  score: ScoreResult;
  /** The winning venue's real district.in page — where "Book on District" actually goes. */
  districtUrl: string;
  /** "Worth Every Rupee" only — present when the winning venue also fielded a
   * meaningfully different-experience format (>=15pt gap) at a different
   * price. Not rendered yet — a later pass builds the UI for this. */
  valueComparison?: {
    premium: { format: string; priceLabel: string; experienceScore: number; showtime: string };
    budget: { format: string; priceLabel: string; experienceScore: number; showtime: string };
    priceDiffRupees: number;
  };
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
  };
}
