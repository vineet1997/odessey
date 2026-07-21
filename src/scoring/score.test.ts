import { describe, expect, it } from "vitest";
import {
  EASY_EVENING,
  FULL_EPIC,
  WORTH_EVERY_RUPEE,
  scoreVenue,
  type UserContext,
  type Venue,
} from "./score";

// Three venues standing in for a real DLF Phase 2 Gurugram-style comparison:
// - PRIYA: the best screen, but far and expensive (Full Epic's pick)
// - SAKET: almost as good a screen, much cheaper, still a real trip
//   (Worth Every Rupee's pick — "90% of the experience at 40% of the price")
// - LOCAL: a decent floor-clearing screen right around the corner
//   (Easy Evening's pick — wins on time/certainty, not on cost or experience)
const PRIYA: Venue = { id: "priya", name: "PVR Priya IMAX", experienceScore: 96 };
const SAKET: Venue = { id: "saket", name: "PVR Select Citywalk", experienceScore: 88 };
const LOCAL: Venue = { id: "local", name: "Neighbourhood Multiplex", experienceScore: 68 };

const priyaContext: UserContext = {
  ticketPriceRupeesPerPerson: 2100,
  outboundTransportCostRupees: 300,
  returnTransportCostRupees: 300,
  outboundDurationMinutes: 60,
  returnDurationMinutes: 60,
  returnAvailable: true,
};

const saketContext: UserContext = {
  ticketPriceRupeesPerPerson: 900,
  outboundTransportCostRupees: 200,
  returnTransportCostRupees: 200,
  outboundDurationMinutes: 45,
  returnDurationMinutes: 45,
  returnAvailable: true,
};

const localContext: UserContext = {
  // Priced as a real "decent local multiplex" ticket, not a discount venue —
  // LOCAL wins on proximity/certainty, not on being the cheapest option, so
  // it shouldn't accidentally also win Worth Every Rupee.
  ticketPriceRupeesPerPerson: 1200,
  outboundTransportCostRupees: 50,
  returnTransportCostRupees: 50,
  outboundDurationMinutes: 15,
  returnDurationMinutes: 10,
  returnAvailable: true,
};

function topPick(results: { venueId: string; totalScore: number }[]): string {
  return [...results].sort((a, b) => b.totalScore - a.totalScore)[0]!.venueId;
}

describe("scoreVenue — intents diverge", () => {
  it("The Full Epic picks the best screen even though it costs and takes more", () => {
    const results = [
      scoreVenue(PRIYA, priyaContext, FULL_EPIC),
      scoreVenue(SAKET, saketContext, FULL_EPIC),
      scoreVenue(LOCAL, localContext, FULL_EPIC),
    ];
    expect(topPick(results)).toBe("priya");
  });

  it("Worth Every Rupee picks the value pick, not the single cheapest venue", () => {
    const results = [
      scoreVenue(PRIYA, priyaContext, WORTH_EVERY_RUPEE),
      scoreVenue(SAKET, saketContext, WORTH_EVERY_RUPEE),
      scoreVenue(LOCAL, localContext, WORTH_EVERY_RUPEE),
    ];
    expect(topPick(results)).toBe("saket");
  });

  it("The Easy Evening picks the closest/fastest venue, not the best screen", () => {
    const results = [
      scoreVenue(PRIYA, priyaContext, EASY_EVENING),
      scoreVenue(SAKET, saketContext, EASY_EVENING),
      scoreVenue(LOCAL, localContext, EASY_EVENING),
    ];
    expect(topPick(results)).toBe("local");
  });

  it("the three intents do not converge on the same top-ranked venue for this input set", () => {
    const winners = new Set([
      topPick([
        scoreVenue(PRIYA, priyaContext, FULL_EPIC),
        scoreVenue(SAKET, saketContext, FULL_EPIC),
        scoreVenue(LOCAL, localContext, FULL_EPIC),
      ]),
      topPick([
        scoreVenue(PRIYA, priyaContext, WORTH_EVERY_RUPEE),
        scoreVenue(SAKET, saketContext, WORTH_EVERY_RUPEE),
        scoreVenue(LOCAL, localContext, WORTH_EVERY_RUPEE),
      ]),
      topPick([
        scoreVenue(PRIYA, priyaContext, EASY_EVENING),
        scoreVenue(SAKET, saketContext, EASY_EVENING),
        scoreVenue(LOCAL, localContext, EASY_EVENING),
      ]),
    ]);
    expect(winners.size).toBe(3);
  });
});

describe("scoreVenue — Easy Evening's experience floor is not a ceiling", () => {
  it("does not reward experience above the floor: two venues above the floor with identical cost/time/feasibility score identically", () => {
    const context: UserContext = {
      ticketPriceRupeesPerPerson: 500,
      outboundTransportCostRupees: 50,
      returnTransportCostRupees: 50,
      outboundDurationMinutes: 15,
      returnDurationMinutes: 10,
      returnAvailable: true,
    };
    const decent: Venue = { id: "decent", name: "Decent Screen", experienceScore: 70 };
    const stellar: Venue = { id: "stellar", name: "Stellar Screen", experienceScore: 99 };

    const decentResult = scoreVenue(decent, context, EASY_EVENING);
    const stellarResult = scoreVenue(stellar, context, EASY_EVENING);

    expect(decentResult.totalScore).toBeCloseTo(stellarResult.totalScore, 10);
  });

  it("still penalizes a venue below the floor (the floor gates the bottom, not just caps the top)", () => {
    const context: UserContext = {
      ticketPriceRupeesPerPerson: 500,
      outboundTransportCostRupees: 50,
      returnTransportCostRupees: 50,
      outboundDurationMinutes: 15,
      returnDurationMinutes: 10,
      returnAvailable: true,
    };
    const belowFloor: Venue = { id: "below-floor", name: "Rough Screen", experienceScore: 40 };
    const aboveFloor: Venue = { id: "above-floor", name: "Fine Screen", experienceScore: 70 };

    const belowResult = scoreVenue(belowFloor, context, EASY_EVENING);
    const aboveResult = scoreVenue(aboveFloor, context, EASY_EVENING);

    expect(belowResult.totalScore).toBeLessThan(aboveResult.totalScore);
  });
});

describe("scoreVenue — feasibility gate", () => {
  const strandedContext: UserContext = {
    ticketPriceRupeesPerPerson: 900,
    outboundTransportCostRupees: 200,
    returnTransportCostRupees: 600, // cab fallback, since there's no train home
    outboundDurationMinutes: 45,
    returnDurationMinutes: 40,
    returnAvailable: false,
  };
  const reachableContext: UserContext = {
    ...strandedContext,
    returnTransportCostRupees: 200,
    returnAvailable: true,
  };

  it("sets strandedWarning true when there is no way home", () => {
    const result = scoreVenue(SAKET, strandedContext, FULL_EPIC);
    expect(result.strandedWarning).toBe(true);
  });

  it("sets strandedWarning false when there is a way home", () => {
    const result = scoreVenue(SAKET, reachableContext, FULL_EPIC);
    expect(result.strandedWarning).toBe(false);
  });

  it("suppresses the score of an otherwise-identical venue when it strands the user", () => {
    const stranded = scoreVenue(SAKET, strandedContext, FULL_EPIC);
    const reachable = scoreVenue(SAKET, reachableContext, FULL_EPIC);
    expect(stranded.totalScore).toBeLessThan(reachable.totalScore);
    expect(stranded.dimensions.feasibility).toBeLessThan(reachable.dimensions.feasibility);
  });

  it("the gate is a real penalty, not cosmetic: it can flip the ranking between two venues", () => {
    // LOCAL is a much weaker screen than SAKET, but if SAKET stranded the
    // user, a reachable-but-worse LOCAL should be able to outrank it under
    // an intent that weighs feasibility meaningfully (Easy Evening).
    const strandedSaket = scoreVenue(SAKET, strandedContext, EASY_EVENING);
    const reachableLocal = scoreVenue(LOCAL, localContext, EASY_EVENING);
    expect(reachableLocal.totalScore).toBeGreaterThan(strandedSaket.totalScore);
  });
});

describe("scoreVenue — partySize future-proofing (BRIEF.md 'Noted for later')", () => {
  it("defaults partySize to 1 when omitted", () => {
    const context: UserContext = {
      ticketPriceRupeesPerPerson: 500,
      outboundTransportCostRupees: 400, // a flat cab fare, not per-person
      returnTransportCostRupees: 400,
      outboundDurationMinutes: 30,
      returnDurationMinutes: 30,
      returnAvailable: true,
    };
    const result = scoreVenue(LOCAL, context, FULL_EPIC);
    expect(result.costPerPersonRupees).toBe(result.totalCostRupees);
    expect(result.totalCostRupees).toBe(500 + 400 + 400);
  });

  it("increasing partySize lowers per-person cost and therefore changes the cost dimension score", () => {
    const soloContext: UserContext = {
      ticketPriceRupeesPerPerson: 500,
      outboundTransportCostRupees: 400, // flat cab fare, shared across the party
      returnTransportCostRupees: 400,
      outboundDurationMinutes: 30,
      returnDurationMinutes: 30,
      returnAvailable: true,
      partySize: 1,
    };
    const groupContext: UserContext = { ...soloContext, partySize: 4 };

    const solo = scoreVenue(LOCAL, soloContext, FULL_EPIC);
    const group = scoreVenue(LOCAL, groupContext, FULL_EPIC);

    // Total cost rises (4 tickets instead of 1) but per-person cost falls
    // (the flat cab fare is now split four ways) — this is the exact
    // "3-4 people splitting one car" case from BRIEF.md.
    expect(group.totalCostRupees).toBeGreaterThan(solo.totalCostRupees);
    expect(group.costPerPersonRupees).toBeLessThan(solo.costPerPersonRupees);
    expect(group.dimensions.cost).toBeGreaterThan(solo.dimensions.cost);
    expect(group.totalScore).toBeGreaterThan(solo.totalScore);
  });
});
