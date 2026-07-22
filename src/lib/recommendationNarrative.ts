import type { IntentWeights, ScoreResult } from "../scoring/score";
import { getFormatProfile, getVenueFormatEditorial } from "./formatProfiles";

export interface NarrativePlan {
  venueId: string;
  venueName: string;
  format: string;
  experienceScore: number;
  totalCostRupees: number;
  outboundDurationMinutes: number;
  returnEvidence: "live" | "no-route" | "unverified";
  score: ScoreResult;
}

export interface SelectedFormatNarrative {
  judgment: string;
  receipt: string;
  caveat?: string;
}

export interface OutcomeNarrative {
  lead: string;
  receipt: string;
}

export interface ValueNarrative {
  lead: string;
  receipt: string;
}

export interface NarrativeValueComparison {
  premium: { format: string; priceLabel: string; experienceScore: number; showtime: string };
  budget: { format: string; priceLabel: string; experienceScore: number; showtime: string };
  priceDiffRupees: number;
  narrative: ValueNarrative;
}

export interface RecommendationNarrative {
  selectedFormat: SelectedFormatNarrative;
  outcome: OutcomeNarrative;
}

function returnReceiptLabel(evidence: NarrativePlan["returnEvidence"]): string {
  if (evidence === "live") return "scheduled transit found";
  if (evidence === "no-route") return "no public-transport route found";
  return "transit unverified";
}

function formatRupees(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

/** The scorer's dimensions are unitless; their weighted deltas are the only
 * valid way to say which trade-off moved a recommendation. */
function decisiveDimension(winner: NarrativePlan, runnerUp: NarrativePlan, intent: IntentWeights) {
  const dimensions = ["experience", "cost", "time", "feasibility"] as const;
  return dimensions
    .map((dimension) => ({
      dimension,
      delta: (winner.score.dimensions[dimension] - runnerUp.score.dimensions[dimension]) * intent[dimension],
    }))
    .sort((a, b) => b.delta - a.delta)[0];
}

export function selectedFormatNarrative(plan: NarrativePlan): SelectedFormatNarrative {
  const editorial = getVenueFormatEditorial(plan.venueId, plan.format);
  const profile = getFormatProfile(plan.format);
  const judgment = editorial?.judgment ?? profile?.safeDescription ?? `Listed as ${plan.format}.`;
  return {
    judgment,
    receipt: `Listed as ${plan.format} · screen score ${plan.experienceScore}/100.`,
    ...(editorial?.caveat ? { caveat: editorial.caveat } : profile?.caveat ? { caveat: profile.caveat } : {}),
  };
}

function comparisonReceipt(winner: NarrativePlan, runnerUp: NarrativePlan): string {
  return [
    `Screen ${winner.experienceScore}/100 vs ${runnerUp.experienceScore}/100`,
    `${formatRupees(winner.totalCostRupees)} vs ${formatRupees(runnerUp.totalCostRupees)} door to door`,
    `${winner.outboundDurationMinutes} vs ${runnerUp.outboundDurationMinutes} min outbound`,
    `return: ${returnReceiptLabel(winner.returnEvidence)} vs ${returnReceiptLabel(runnerUp.returnEvidence)}`,
  ].join(" · ");
}

export function outcomeNarrative(
  winner: NarrativePlan,
  runnerUp: NarrativePlan | undefined,
  intent: IntentWeights,
  eligibleVenueCount: number
): OutcomeNarrative {
  if (!runnerUp) {
    return {
      lead: "One non-4DX venue produced a reachable, priced show in this window.",
      receipt: `${eligibleVenueCount} eligible venue${eligibleVenueCount === 1 ? "" : "s"} · screen ${winner.experienceScore}/100 · ${formatRupees(winner.totalCostRupees)} door to door · ${winner.outboundDurationMinutes} min outbound · return: ${returnReceiptLabel(winner.returnEvidence)}.`,
    };
  }

  const decisive = decisiveDimension(winner, runnerUp, intent);
  const leadByDimension = {
    experience: `Stronger screen evidence than ${runnerUp.venueName}.`,
    cost: `Lower complete-night cost than ${runnerUp.venueName}.`,
    time: `Shorter outbound trip than ${runnerUp.venueName}.`,
    feasibility: `More reliable return evidence than ${runnerUp.venueName}.`,
  } as const;
  const lead = decisive.delta > 0.00001
    ? leadByDimension[decisive.dimension]
    : `Measured trade-offs are nearly tied with ${runnerUp.venueName}.`;
  return { lead, receipt: comparisonReceipt(winner, runnerUp) };
}

export function buildRecommendationNarrative(
  winner: NarrativePlan,
  runnerUp: NarrativePlan | undefined,
  intent: IntentWeights,
  eligibleVenueCount: number
): RecommendationNarrative {
  return {
    selectedFormat: selectedFormatNarrative(winner),
    outcome: outcomeNarrative(winner, runnerUp, intent, eligibleVenueCount),
  };
}

/** A same-venue comparison is useful only when both exact labels are known.
 * The labels can establish a picture/comfort emphasis, never a screen size or
 * equipment equivalence. */
export function buildValueComparison(
  first: NarrativePlan & { showtime: string },
  second: NarrativePlan & { showtime: string }
): NarrativeValueComparison | undefined {
  const firstProfile = getFormatProfile(first.format);
  const secondProfile = getFormatProfile(second.format);
  const experienceGap = Math.abs(first.experienceScore - second.experienceScore);
  if (experienceGap < 15) return undefined;

  const [premium, budget] = first.experienceScore >= second.experienceScore ? [first, second] : [second, first];
  const premiumProfile = getFormatProfile(premium.format);
  const budgetProfile = getFormatProfile(budget.format);
  let lead = "The listed formats differ in screen score; the labels do not establish a physical comparison.";
  if (firstProfile && secondProfile && premiumProfile && budgetProfile) {
    if (premiumProfile.emphasis === "picture" && budgetProfile.emphasis === "comfort") {
      lead = `${premium.format} is the picture-led option; ${budget.format} is the comfort-led option.`;
    } else if (premiumProfile.emphasis === "picture") {
      lead = `${premium.format} is the picture-led option in this comparison.`;
    } else if (premiumProfile.emphasis === "comfort") {
      lead = `${premium.format} is the comfort-led option in this comparison.`;
    }
  }

  return {
    premium: {
      format: premium.format,
      priceLabel: formatRupees(premium.totalCostRupees),
      experienceScore: premium.experienceScore,
      showtime: premium.showtime,
    },
    budget: {
      format: budget.format,
      priceLabel: formatRupees(budget.totalCostRupees),
      experienceScore: budget.experienceScore,
      showtime: budget.showtime,
    },
    priceDiffRupees: Math.abs(premium.totalCostRupees - budget.totalCostRupees),
    narrative: {
      lead,
      receipt: `Screen ${premium.experienceScore}/100 vs ${budget.experienceScore}/100 · ${formatRupees(premium.totalCostRupees)} vs ${formatRupees(budget.totalCostRupees)} door to door.`,
    },
  };
}
