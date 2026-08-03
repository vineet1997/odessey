import { describe, expect, it } from "vitest";
import { adjustedExperienceScore, signalApplies, type ActiveCommunitySignal } from "./communitySignals";

const signal: ActiveCommunitySignal = {
  id: "one",
  canonical_url: "https://www.reddit.com/r/imax/comments/one/example/",
  public_summary: "Club bass can reach quiet scenes after 8 PM.",
  matched_venue_ids: ["priya-vasant-vihar"],
  score_adjustment: -8,
  applies_to_formats: ["IMAX 2D"],
  applies_after_local_time: "20:00",
  applies_before_local_time: null,
  active_from: "2026-08-01",
  active_until: "2026-08-31",
};

describe("community signal applicability", () => {
  it("matches the exact venue, date and local showtime", () => {
    expect(signalApplies(signal, "priya-vasant-vihar", "IMAX 2D", "2026-08-04", "8:20 PM")).toBe(true);
    expect(signalApplies(signal, "priya-vasant-vihar", "IMAX 2D", "2026-08-04", "7:30 PM")).toBe(false);
    expect(signalApplies(signal, "priya-vasant-vihar", "RECLINER 2D", "2026-08-04", "8:20 PM")).toBe(false);
    expect(signalApplies(signal, "select-citywalk-saket", "IMAX 2D", "2026-08-04", "8:20 PM")).toBe(false);
  });

  it("expires without deleting the public record", () => {
    expect(signalApplies(signal, "priya-vasant-vihar", "IMAX 2D", "2026-09-01", "9:00 PM")).toBe(false);
  });

  it("caps stacked adjustments and keeps scores in range", () => {
    expect(adjustedExperienceScore(96, [signal], "priya-vasant-vihar", "IMAX 2D", "2026-08-04", "9:00 PM")).toBe(88);
    expect(adjustedExperienceScore(5, [{ ...signal, score_adjustment: -30 }, { ...signal, id: "two", score_adjustment: -30 }], "priya-vasant-vihar", "IMAX 2D", "2026-08-04", "9:00 PM")).toBe(0);
  });
});
