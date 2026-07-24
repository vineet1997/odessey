import { describe, expect, it } from "vitest";
import venuesData from "../../data/venues-curated.json";
import showtimesData from "../../data/showtimes-live.json";
import { FULL_EPIC, WORTH_EVERY_RUPEE, scoreVenue, type IntentWeights } from "../scoring/score";
import {
  formatProfileIntegrityIssues,
  getScreenProof,
  getVenueFormatEditorial,
  VENUE_FORMAT_EDITORIALS,
} from "./formatProfiles";
import type { ReturnLeg } from "../types/recommendation";
import {
  buildRecommendationNarrative,
  buildReturnCopy,
  buildValueComparison,
  selectedFormatNarrative,
  type NarrativePlan,
} from "./recommendationNarrative";

function plan(overrides: Partial<NarrativePlan> = {}): NarrativePlan {
  const intent = overrides.score?.intent === "worth-every-rupee" ? WORTH_EVERY_RUPEE : FULL_EPIC;
  const experienceScore = overrides.experienceScore ?? 80;
  const totalCostRupees = overrides.totalCostRupees ?? 1200;
  const outboundDurationMinutes = overrides.outboundDurationMinutes ?? 30;
  const returnEvidence = overrides.returnEvidence ?? "live";
  const score = overrides.score ?? scoreVenue(
    { id: overrides.venueId ?? "venue", name: overrides.venueName ?? "Venue", experienceScore },
    {
      ticketPriceRupeesPerPerson: totalCostRupees - 200,
      outboundTransportCostRupees: 100,
      returnTransportCostRupees: 100,
      outboundDurationMinutes,
      returnDurationMinutes: 30,
      returnAvailable: returnEvidence === "live",
    },
    intent
  );
  return {
    venueId: "venue",
    venueName: "Venue",
    format: "IMAX 2D",
    experienceScore,
    totalCostRupees,
    outboundDurationMinutes,
    returnEvidence,
    score,
    ...overrides,
  };
}

describe("format-aware recommendation narrative", () => {
  it("keeps screen proof exact while marking 70mm as unavailable in India", () => {
    expect(getScreenProof("priya-vasant-vihar", "IMAX 2D")).toEqual({
      imax: "confirmed",
      laser: "confirmed",
      seventyMm: "unavailable",
    });
    expect(getScreenProof("ambience-gurugram-kotak-imax", "IMAX 2D")).toEqual({
      imax: "confirmed",
      laser: "unverified",
      seventyMm: "unavailable",
    });
    expect(getScreenProof("somewhere", "LASER 2D")).toEqual({
      imax: "unavailable",
      laser: "confirmed",
      seventyMm: "unavailable",
    });
    expect(getScreenProof("somewhere", "UNMAPPED FORMAT")).toEqual({
      imax: "unverified",
      laser: "unverified",
      seventyMm: "unavailable",
    });
  });

  it("keeps Priya's confirmed laser verdict on its exact IMAX label only", () => {
    expect(selectedFormatNarrative(plan({ venueId: "priya-vasant-vihar", format: "IMAX 2D", experienceScore: 96 })).judgment)
      .toContain("confirmed laser");
    const recliner = selectedFormatNarrative(plan({ venueId: "priya-vasant-vihar", format: "RECLINERS 2D", experienceScore: 48 }));
    expect(recliner.judgment).toBe("Listed as a recliner seating presentation.");
    expect(recliner.judgment).not.toContain("laser");
  });

  it("does not infer laser from a generic IMAX label", () => {
    const unknownImax = selectedFormatNarrative(plan({ venueId: "somewhere", format: "IMAX 2D" }));
    expect(unknownImax.judgment).toBe("Listed as an IMAX 2D presentation.");
    expect(unknownImax.caveat).toContain("does not establish laser");
    expect(getVenueFormatEditorial("select-citywalk-saket", "RECLINERS 2D")).toBeUndefined();
  });

  it("selects a reason by weighted contribution, not by cross-unit raw magnitude", () => {
    const timeIntent: IntentWeights = { id: "easy-evening", label: "Time", experience: 0.05, cost: 0.05, time: 0.85, feasibility: 0.05 };
    const winner = plan({ totalCostRupees: 1450, outboundDurationMinutes: 20, experienceScore: 80 });
    const runnerUp = plan({ venueName: "Slower Venue", totalCostRupees: 700, outboundDurationMinutes: 80, experienceScore: 80 });
    const narrative = buildRecommendationNarrative(winner, runnerUp, timeIntent, 2);
    expect(narrative.outcome.lead).toBe("OUTBOUND 60 MIN SHORTER");
    expect(narrative.outcome.receipt).toContain("20 vs 80 min outbound");
  });

  it("renders the decisive comparison as a measured fact", () => {
    const screenLead = buildRecommendationNarrative(
      plan({ experienceScore: 96 }),
      plan({ venueName: "Other Screen", experienceScore: 74 }),
      FULL_EPIC,
      2
    ).outcome.lead;
    const costLead = buildRecommendationNarrative(
      plan({ totalCostRupees: 900 }),
      plan({ venueName: "Costlier Venue", totalCostRupees: 1500 }),
      WORTH_EVERY_RUPEE,
      2
    ).outcome.lead;
    const returnLead = buildRecommendationNarrative(
      plan({ returnEvidence: "live" }),
      plan({ venueName: "No Ride", returnEvidence: "no-route" }),
      FULL_EPIC,
      2
    ).outcome.lead;

    expect(screenLead).toBe("SCREEN +22");
    expect(costLead).toContain("LESS DOOR TO DOOR");
    expect(returnLead).toBe("METRO CHECKED / NO METRO ROUTE");
    expect(`${screenLead} ${costLead} ${returnLead}`).not.toMatch(
      /Stronger screen evidence|Lower complete-night cost|Shorter outbound trip|More reliable return evidence/i
    );
  });

  it("uses plan scores for an honest near tie", () => {
    const winner = plan();
    const runnerUp = plan({ venueName: "Same Numbers" });
    const narrative = buildRecommendationNarrative(winner, runnerUp, FULL_EPIC, 2);
    expect(narrative.outcome.lead).toMatch(/^PLAN SCORE \d+ \/ \d+$/);
  });

  it("keeps intent weighting out of factual receipts", () => {
    const winner = plan({ experienceScore: 96, totalCostRupees: 1500 });
    const runnerUp = plan({ venueName: "Other", experienceScore: 74, totalCostRupees: 900 });
    const narrative = buildRecommendationNarrative(winner, runnerUp, FULL_EPIC, 2);
    expect(narrative.outcome.receipt).toContain("Screen 96/100 vs 74/100");
    expect(narrative.outcome.receipt).not.toMatch(/overall|on balance|for this intent|comparable experience/i);
  });

  it("uses the precise single-venue fallback", () => {
    const narrative = buildRecommendationNarrative(plan(), undefined, FULL_EPIC, 1);
    expect(narrative.outcome.lead).toBe("ONLY VIABLE VENUE IN THIS WINDOW");
  });

  it("only makes picture-versus-comfort value language from exact profiles", () => {
    const picture = { ...plan({ format: "IMAX 2D", experienceScore: 93, totalCostRupees: 1500 }), showtime: "7:00 PM" };
    const comfort = { ...plan({ format: "GOLD 2D", experienceScore: 52, totalCostRupees: 1000 }), showtime: "7:10 PM" };
    const comparison = buildValueComparison(picture, comfort)!;
    expect(comparison.narrative.lead).toContain("picture-led");
    expect(comparison.narrative.lead).toContain("comfort-led");
    const unknown = buildValueComparison(
      { ...plan({ format: "MYSTERY FORMAT", experienceScore: 90 }), showtime: "7:00 PM" },
      { ...plan({ format: "2D", experienceScore: 50 }), showtime: "7:00 PM" }
    )!;
    expect(unknown.narrative.lead).toContain("do not establish a physical comparison");
    expect(`${unknown.narrative.lead} ${unknown.narrative.receipt}`).not.toMatch(/same screen|same tier|frame itself is bigger/i);
  });

  it("covers every current scraper format with an exact profile", () => {
    const labels = new Set<string>();
    for (const venue of Object.values(showtimesData.venues)) for (const show of venue.showtimes) labels.add(show.format);
    for (const label of Object.keys(venuesData.format_scores)) if (label !== "_meta") labels.add(label);
    expect(formatProfileIntegrityIssues([...labels])).toEqual([]);
  });

  it("keeps every venue-format editorial scoped to a format that venue actually lists", () => {
    const curatedById = new Map(venuesData.shortlist.map((venue) => [venue.id, venue]));
    const liveById = showtimesData.venues as Record<string, { showtimes: Array<{ format: string }> }>;
    const invalidKeys = Object.keys(VENUE_FORMAT_EDITORIALS).filter((key) => {
      const separator = key.indexOf("|");
      const venueId = key.slice(0, separator);
      const format = key.slice(separator + 1);
      const curated = curatedById.get(venueId);
      const curatedFormats = curated?.formats ?? [];
      const liveFormats = liveById[venueId]?.showtimes.map((show) => show.format) ?? [];
      return !curated || (!curatedFormats.includes(format) && !liveFormats.includes(format));
    });

    expect(invalidKeys).toEqual([]);
  });
});

describe("return-state copy", () => {
  const leg = (overrides: Partial<ReturnLeg>): ReturnLeg => ({
    status: "good",
    lineLabel: "YELLOW LINE",
    lineColorHex: "#FFD200",
    durationMinutes: 42,
    costRupees: 60,
    costIsEstimate: true,
    headline: "",
    ...overrides,
  });

  it("labels a complete live step as metro, not a full route home", () => {
    const copy = buildReturnCopy(
      leg({
        departureTime: "2026-07-22T16:01:00.000Z",
        departureStop: "Sikanderpur",
        vehicleType: "SUBWAY",
      }),
      "9:37 PM"
    );
    expect(copy.heading).toBe("METRO HOME");
    expect(copy.detail).toContain("YELLOW LINE · Sikanderpur · 9:31 PM · 42 MIN · ₹60 EST.");
    expect(copy.detail).not.toMatch(/metro home|route home/i);
  });

  it("keeps confirmed no-route and failed lookup copy distinct", () => {
    const noRoute = buildReturnCopy(leg({ status: "stranded", costRupees: 420, durationMinutes: 34 }), "9:37 PM");
    const unverified = buildReturnCopy(leg({ status: "unverified", costRupees: 420, durationMinutes: 34 }), "9:37 PM");
    expect(noRoute).toMatchObject({
      heading: "CAB HOME",
      checkedValue: "NO METRO-ONLY CONNECTION HOME",
    });
    expect(noRoute.detail).toContain("NO METRO-ONLY CONNECTION HOME");
    expect(unverified).toMatchObject({
      heading: "CAB ESTIMATE",
      checkedValue: "METRO NOT VERIFIED",
    });
    expect(unverified.detail).toContain("METRO NOT VERIFIED");
  });

  it("never renders a blank cab value when a route distance is malformed", () => {
    const copy = buildReturnCopy(
      leg({ status: "stranded", costRupees: 0, cabEstimateAvailable: false }),
      "2:37 AM"
    );
    expect(copy.detail).toContain("CAB PRICE UNAVAILABLE");
    expect(copy.detail).not.toMatch(/₹0|undefined|NaN/);
  });

  it("calls an overnight service gap what it is", () => {
    const copy = buildReturnCopy(
      leg({ status: "stranded", fallbackReason: "metro-closed-for-night", costRupees: 420 }),
      "2:37 AM"
    );
    expect(copy.checkedValue).toBe("METRO HAS STOPPED FOR THE NIGHT");
    expect(copy.detail).not.toContain("after 2:37 AM");
  });

  it("does not claim first-transit detail when live fields are incomplete", () => {
    expect(buildReturnCopy(leg({}), "9:37 PM")).toEqual({
      heading: "METRO CHECKED",
      detail: "METRO CHECKED",
      checkedValue: "METRO CHECKED",
    });
  });
});
