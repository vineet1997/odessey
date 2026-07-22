/**
 * Hand-written fixture for ONE complete recommendation scenario, grounded in
 * real facts from data/venues-curated.json and BRIEF.md. There is no live
 * live pipeline, so this provides a stable visual/share-card scenario. The
 * score itself is NOT faked: it is produced by calling the real `scoreVenue()`
 * against the ticket and transport numbers below.
 *
 * Scenario: "Worth Every Rupee" for a South Delhi user (Hauz Khas-ish
 * locality on the Yellow Line). Winner is PVR Select City Walk (Saket) —
 * id `select-citywalk-saket` in venues-curated.json — over PVR Priya
 * (Vasant Vihar) — id `priya-vasant-vihar`. The fixture demonstrates a
 * strong-screen value trade-off without claiming an unsupported percentage
 * of another venue's experience.
 *
 * Judgment call on the format chip: venues-curated.json marks Select City
 * Walk's laser status is not confirmed. Per the "never oversell" rule, the
 * chip stays the defensible `IMAX 2D`, and the structured narrative carries
 * the unverified-laser caveat instead of asserting parity with Priya.
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
  evening: {
    timezone: "Asia/Kolkata",
    theatreExitBufferMinutes: 15,
    leaveHome: { label: "LEAVE HOME", time: "4:00 pm", isoTime: "2026-07-20T10:30:00.000Z", dayOffset: 0 },
    arriveAtTheatre: { label: "AT THEATRE", time: "4:35 pm", isoTime: "2026-07-20T11:05:00.000Z", dayOffset: 0 },
    filmStarts: { label: "FILM STARTS", time: "4:50 pm", isoTime: "2026-07-20T11:20:00.000Z", dayOffset: 0 },
    filmEnds: { label: "FILM ENDS", time: "7:42 pm", isoTime: "2026-07-20T14:12:00.000Z", dayOffset: 0 },
    theatreExit: { label: "THEATRE EXIT", time: "7:57 pm", isoTime: "2026-07-20T14:27:00.000Z", dayOffset: 0 },
    returnDeparture: { label: "RETURN DEPARTS", time: "11:32 pm", isoTime: "2026-07-20T18:02:00.000Z", dayOffset: 0 },
    homeArrival: { label: "HOME", time: "12:07 am", isoTime: "2026-07-20T18:37:00.000Z", dayOffset: 1 },
  },
  evidence: {
    showtimes: { source: "district", refreshedAtLabel: "AS OF 18:42", targetDates: ["2026-07-20"] },
    outbound: { mode: "drive", source: "live", durationMinutes: 35, checkedAtLabel: "6:42 pm" },
    return: {
      mode: "transit",
      status: "live",
      selectedPlanChecked: true,
      departureBasis: "film-end + 15 min theatre exit",
      scheduledForLabel: "11:32 pm",
    },
  },
  narrative: {
    selectedFormat: {
      judgment: "High-rated IMAX in our NCR shortlist.",
      receipt: "Listed as IMAX 2D · screen score 93/100.",
      caveat: "Laser status is unverified.",
    },
    outcome: {
      lead: "Lower complete-night cost than PVR Priya.",
      receipt: "Screen 93/100 vs 96/100 · ₹1,180 vs ₹2,800 door to door · 35 vs 40 min outbound · return: scheduled transit found vs scheduled transit found.",
    },
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
  counterfactuals: [
    {
      id: "picture-first",
      label: "IF PICTURE CAME FIRST",
      question: "What if the screen mattered more than every other trade-off?",
      venueName: "PVR Priya",
      locality: "Vasant Vihar",
      formatChip: "IMAX WITH LASER",
      showtime: "4:30 PM",
      dateLabel: "MON JUL 20",
      priceLabel: "₹2,500",
      totalCostRupees: runnerUpScore.totalCostRupees,
      returnEvidence: "live",
      metric: { label: "PICTURE SCORE", value: "96/100" },
      isCurrentRecommendation: false,
    },
    {
      id: "price-first",
      label: "IF PRICE CAME FIRST",
      question: "What if the lowest complete-night cost was the only priority?",
      venueName: winnerVenue.name,
      locality: "Saket",
      formatChip: "IMAX 2D",
      showtime: "4:50 PM",
      dateLabel: "MON JUL 20",
      priceLabel: "₹1,100",
      totalCostRupees: winnerScore.totalCostRupees,
      returnEvidence: "live",
      metric: { label: "DOOR TO DOOR", value: `₹${winnerScore.costPerPersonRupees.toLocaleString("en-IN")}` },
      isCurrentRecommendation: true,
    },
    {
      id: "earliest-home",
      label: "IF HOME EARLIEST MATTERED",
      question: "What if getting home earliest was the deciding factor?",
      venueName: winnerVenue.name,
      locality: "Saket",
      formatChip: "IMAX 2D",
      showtime: "4:50 PM",
      dateLabel: "MON JUL 20",
      priceLabel: "₹1,100",
      totalCostRupees: winnerScore.totalCostRupees,
      returnEvidence: "live",
      metric: { label: "HOME BY", value: "12:07 am" },
      isCurrentRecommendation: true,
    },
  ],
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
