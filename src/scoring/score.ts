/**
 * Ithaka scoring engine.
 *
 * Pure, side-effect-free TypeScript — no React, no I/O, no fetches. Given a
 * venue + a user's specific journey context for one showtime, produces a
 * single 0-1 score under one of three named intent presets (BRIEF.md §"The
 * three intents").
 *
 * Four normalized (0-1) dimensions feed every intent:
 *   1. experience  — hard-coded per venue+format editorial/rubric score
 *   2. cost        — tickets + round-trip transport, cheaper is higher
 *   3. time        — door-to-door travel time, faster is higher
 *   4. feasibility — is there a way home; a heavy, explicit gate/penalty
 *                    applies when the last train (or equivalent) is gone
 *
 * See BRIEF.md §"The data" and §"Noted for later" for the spec this
 * implements, including the `totalCost / partySize` future-proofing.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** The hard-coded, editorially-curated facts about one venue (one screen/format). */
export interface Venue {
  id: string;
  name: string;
  /** 0-100 rubric score, per venue+format — see data/VENUE-SCORING.md. */
  experienceScore: number;
}

/**
 * Everything about *this user's* specific journey for *this* showtime:
 * locality -> venue -> home, at a specific time band. Callers (the app,
 * or tests) are responsible for resolving these from the locality/metro
 * data and the showtime the user picked; this module does no lookups.
 */
export interface UserContext {
  /** Ticket price per person, in rupees, for the seat class being scored. */
  ticketPriceRupeesPerPerson: number;
  /**
   * Total (not per-person) transport cost for the outbound leg, in rupees.
   * A shared cab is one fixed cost for the party; a metro fare is usually
   * ~linear per rider, so callers should pre-multiply metro fares by
   * partySize before passing them in here. Kept as a single "total" number
   * so this module doesn't have to know which mode was chosen.
   */
  outboundTransportCostRupees: number;
  /** Total (not per-person) transport cost for the return leg, in rupees. */
  returnTransportCostRupees: number;
  /** Door-to-door minutes, home -> venue. */
  outboundDurationMinutes: number;
  /**
   * Door-to-door minutes, venue -> home, for whichever return option was
   * actually used (last train if it exists, otherwise the cab fallback).
   */
  returnDurationMinutes: number;
  /**
   * Is there a real way home after this showtime? False means the last
   * train (or last reliable public transport) has already gone before the
   * film lets out, and the return numbers above describe a cab fallback
   * instead. This is the feasibility GATE — see scoreVenue().
   */
  returnAvailable: boolean;
  /**
   * How many people. Defaults to 1. Not exposed in the v1 UI (BRIEF.md
   * "Noted for later") — plumbed through now so a future "how many of
   * you?" input is a UI change, not a rearchitecture.
   */
  partySize?: number;
}

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------

export type IntentId = "full-epic" | "worth-every-rupee" | "easy-evening";

export interface IntentWeights {
  id: IntentId;
  label: string;
  experience: number;
  cost: number;
  time: number;
  feasibility: number;
  /**
   * "Easy Evening": experience is a floor, not a ceiling — never reward a
   * venue for having *more* experience than this cap once it clears the
   * bar. Undefined for intents where experience should scale normally.
   * Expressed on the same 0-1 scale as the normalized experience score.
   */
  experienceCap?: number;
}

/** "The Full Epic" — experience dominates; cost and distance are tiebreakers. */
export const FULL_EPIC: IntentWeights = {
  id: "full-epic",
  label: "The Full Epic",
  experience: 0.85,
  cost: 0.05,
  time: 0.05,
  feasibility: 0.05,
};

/**
 * "Worth Every Rupee" — experience-per-rupee. Cost is weighted heavily
 * alongside experience; travel cost and time are secondary. Tuned to land
 * on "90% of the experience at 40% of the price" picks (e.g. Saket classic
 * seats over Priya), not on the single cheapest venue regardless of screen.
 */
export const WORTH_EVERY_RUPEE: IntentWeights = {
  id: "worth-every-rupee",
  label: "Worth Every Rupee",
  experience: 0.4,
  cost: 0.45,
  time: 0.1,
  feasibility: 0.05,
};

/**
 * "The Easy Evening" — door-to-door time and transport certainty dominate.
 * Experience is a floor (never send you to a bad screen) rather than a
 * ceiling: once a venue clears EASY_EVENING_EXPERIENCE_FLOOR, more
 * experience buys it nothing further in this intent.
 */
export const EASY_EVENING_EXPERIENCE_FLOOR = 0.65;

export const EASY_EVENING: IntentWeights = {
  id: "easy-evening",
  label: "The Easy Evening",
  experience: 0.1,
  cost: 0.1,
  time: 0.4,
  feasibility: 0.4,
  experienceCap: EASY_EVENING_EXPERIENCE_FLOOR,
};

export const INTENTS: Record<IntentId, IntentWeights> = {
  "full-epic": FULL_EPIC,
  "worth-every-rupee": WORTH_EVERY_RUPEE,
  "easy-evening": EASY_EVENING,
};

// ---------------------------------------------------------------------------
// Normalization bounds
// ---------------------------------------------------------------------------

/**
 * Fixed normalization bounds rather than a per-call candidate-set range:
 * keeps scoreVenue() a pure function of (venue, context, intent) alone, and
 * keeps scores comparable across separate calls (e.g. across showtimes).
 * Bounds are calibrated against BRIEF.md's real numbers (₹350-2,500 tickets;
 * a 172-minute film means realistic one-way door-to-door legs land well
 * under 3 hours for every NCR venue in the shortlist).
 */
export const COST_BOUNDS = { min: 300, max: 3000 } as const; // rupees, per person
export const TIME_BOUNDS = { min: 20, max: 180 } as const; // minutes, one leg

/** The heavy, explicit penalty applied to the feasibility dimension when
 * there's no way home. Not zero: a venue that's otherwise excellent can
 * still edge out a mediocre one that happens to be reachable, but only if
 * the other three dimensions overwhelmingly justify it. Being stranded
 * always surfaces via `strandedWarning`, never silently. */
export const STRANDED_FEASIBILITY_PENALTY = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Normalize a raw value to 0-1 where LOWER raw is BETTER (cost, time). */
function normalizeInverse(value: number, bounds: { min: number; max: number }): number {
  const range = bounds.max - bounds.min;
  if (range <= 0) return 0.5; // degenerate bounds guard
  const fraction = (value - bounds.min) / range;
  return clamp01(1 - fraction);
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface ScoreDimensions {
  experience: number;
  cost: number;
  time: number;
  feasibility: number;
}

export interface ScoreResult {
  venueId: string;
  intent: IntentId;
  /** Weighted-sum total, 0-1. Higher is better. */
  totalScore: number;
  /** The four normalized (0-1) dimensions that produced totalScore. */
  dimensions: ScoreDimensions;
  /**
   * True when the feasibility gate fired: no way home after this showtime.
   * Callers MUST surface this explicitly (the wine-dark warning strip in
   * DESIGN.md) — it must never be inferred back out of a low number.
   */
  strandedWarning: boolean;
  /** Total cost for the party (tickets + round-trip transport), rupees. */
  totalCostRupees: number;
  /** totalCostRupees / partySize — the number the cost dimension is built on. */
  costPerPersonRupees: number;
}

// ---------------------------------------------------------------------------
// scoreVenue
// ---------------------------------------------------------------------------

export function scoreVenue(venue: Venue, context: UserContext, intent: IntentWeights): ScoreResult {
  const partySize = context.partySize ?? 1;

  const totalCostRupees =
    context.ticketPriceRupeesPerPerson * partySize +
    context.outboundTransportCostRupees +
    context.returnTransportCostRupees;
  const costPerPersonRupees = totalCostRupees / partySize;

  const experienceRaw = clamp01(venue.experienceScore / 100);
  const experience =
    intent.experienceCap !== undefined ? Math.min(experienceRaw, intent.experienceCap) : experienceRaw;

  const cost = normalizeInverse(costPerPersonRupees, COST_BOUNDS);

  const doorToDoorMinutes = context.outboundDurationMinutes + context.returnDurationMinutes;
  const time = normalizeInverse(doorToDoorMinutes, TIME_BOUNDS);

  const strandedWarning = !context.returnAvailable;
  const feasibility = strandedWarning ? STRANDED_FEASIBILITY_PENALTY : 1;

  const dimensions: ScoreDimensions = { experience, cost, time, feasibility };

  const totalScore =
    intent.experience * experience +
    intent.cost * cost +
    intent.time * time +
    intent.feasibility * feasibility;

  return {
    venueId: venue.id,
    intent: intent.id,
    totalScore,
    dimensions,
    strandedWarning,
    totalCostRupees,
    costPerPersonRupees,
  };
}
