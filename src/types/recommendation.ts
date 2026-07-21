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
}
