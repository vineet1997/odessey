/**
 * Hand-written fixture for ONE complete recommendation scenario, grounded in
 * real facts from data/venues-curated.json and BRIEF.md. There is no live
 * scraper/routing yet (see BRIEF.md "Next" steps), so this stands in for the
 * eventual data.json — but the score itself is NOT faked: it's produced by
 * calling the real `scoreVenue()` from src/scoring/score.ts against the
 * ticket/transport numbers below, so the numbers you see on the card are
 * internally consistent with the engine that actually exists.
 *
 * Scenario: "Worth Every Rupee" for a South Delhi user (Hauz Khas-ish
 * locality on the Yellow Line). Winner is PVR Select City Walk (Saket) —
 * id `select-citywalk-saket` in venues-curated.json — over PVR Priya
 * (Vasant Vihar) — id `priya-vasant-vihar`. This is exactly the matchup
 * BRIEF.md's "Worth Every Rupee" description calls out: "often lands on
 * Saket IMAX classic seats: 90% of the experience at 40% of the price."
 *
 * Judgment call on the format chip: venues-curated.json marks Select City
 * Walk's laser status as "Reputed to match Priya's laser IMAX" at
 * confidence HIGH, not CONFIRMED (Priya alone is CONFIRMED laser). Per
 * BRIEF.md's "never oversell" rule, the chip stays the defensible `IMAX 2D`
 * and the laser comparison is pushed into the hedged, editorial verdict
 * line instead of asserted as fact in mono.
 */

import {
  scoreVenue,
  WORTH_EVERY_RUPEE,
  type ScoreResult,
  type UserContext,
  type Venue,
} from "../scoring/score";
import type { RecommendationResult } from "../types/recommendation";

// ---------------------------------------------------------------------------
// Winner: PVR Select City Walk, Saket
// ---------------------------------------------------------------------------

const winnerVenue: Venue = {
  id: "select-citywalk-saket",
  name: "PVR Select City Walk",
  // score field from venues-curated.json (tier S, 93) used as the per-format
  // experience rubric input scoreVenue() expects.
  experienceScore: 93,
};

const winnerContext: UserContext = {
  ticketPriceRupeesPerPerson: 1100, // CLASSIC seat, within BRIEF's ₹350-2,500 span
  outboundTransportCostRupees: 40, // Yellow Line single fare, walk to Malviya Nagar at the far end
  returnTransportCostRupees: 40,
  outboundDurationMinutes: 35, // door-to-door: walk + ride + short walk into the mall
  returnDurationMinutes: 35,
  returnAvailable: true, // the "good news" case — last train comfortably clears the show
};

const winnerScore: ScoreResult = scoreVenue(winnerVenue, winnerContext, WORTH_EVERY_RUPEE);

// ---------------------------------------------------------------------------
// Runner-up: PVR Priya, Vasant Vihar
// ---------------------------------------------------------------------------

const runnerUpVenue: Venue = {
  id: "priya-vasant-vihar",
  name: "PVR Priya",
  experienceScore: 96, // tier S, 96 — the best screen, per venues-curated.json
};

const runnerUpContext: UserContext = {
  ticketPriceRupeesPerPerson: 2500, // top of BRIEF's ₹350-2,500 span — Priya prices at the ceiling
  // Not metro-adjacent per venues-curated.json ("nearest stations INA/Dhaula
  // Kuan are a real auto ride away, not a walk") — modeled as an auto leg.
  outboundTransportCostRupees: 150,
  returnTransportCostRupees: 150,
  outboundDurationMinutes: 40,
  returnDurationMinutes: 40,
  returnAvailable: true,
};

const runnerUpScore: ScoreResult = scoreVenue(runnerUpVenue, runnerUpContext, WORTH_EVERY_RUPEE);

// ---------------------------------------------------------------------------
// Shape the ResultCard actually consumes — now a shared type (src/types/recommendation.ts),
// since src/lib/buildRecommendation.ts needs to produce the same shape from real data.
// Re-exported here so nothing importing from this fixture file has to change.
// ---------------------------------------------------------------------------

export type { ReturnStatus, JourneyLeg, ReturnLeg, RunnerUp, RecommendationResult } from "../types/recommendation";

export const sampleResult: RecommendationResult = {
  intentLabel: WORTH_EVERY_RUPEE.label.toUpperCase(),
  freshnessLabel: "AS OF 18:42",
  venueName: winnerVenue.name,
  formatChip: "IMAX 2D",
  verdict:
    "Reputedly the same laser IMAX as Priya, a fifteen-minute walk from the metro instead of an auto ride from nowhere.",
  showtime: "4:50 PM",
  dateLabel: "MON JUL 20",
  seatClass: "CLASSIC",
  priceLabel: "₹1,100",
  journey: {
    outbound: {
      lineLabel: "YELLOW LINE",
      lineColorHex: "#FFD200",
      durationMinutes: winnerContext.outboundDurationMinutes,
      costRupees: winnerContext.outboundTransportCostRupees,
    },
    return: {
      status: "good",
      lineLabel: "YELLOW LINE",
      lineColorHex: "#FFD200",
      durationMinutes: winnerContext.returnDurationMinutes,
      costRupees: winnerContext.returnTransportCostRupees,
      headline: "THE 11:32 PM LAST TRAIN FROM MALVIYA NAGAR GETS YOU HOME",
    },
    totalCostRupees: winnerScore.totalCostRupees,
  },
  whyLine:
    "Beats Priya on price by ₹1,620 for the same laser reputation, and swaps a forty-minute auto hunt for a walk to Malviya Nagar.",
  runnerUp: {
    venueName: runnerUpVenue.name,
    locality: "Vasant Vihar",
    formatChip: "IMAX WITH LASER",
    priceLabel: "₹2,500",
    showtime: "4:30 PM",
    score: runnerUpScore,
  },
  score: winnerScore,
  districtUrl:
    "https://www.district.in/movies/pvr-select-city-walk-saket-new-delhi-in-delhi-ncr-CD1022254",
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&origin=28.5433,77.2066&destination=28.5286,77.2192",
  provenance: {
    venuesChecked: 12,
    showsConsidered: 47,
    plansScored: 31,
    routeSource: "live",
    transitPlansChecked: 12,
    returnEvidence: "live",
  },
};
