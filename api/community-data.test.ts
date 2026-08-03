import { describe, expect, it } from "vitest";
import { parseReviewRequest } from "./community-data";

const id = "6d4e3c2b-4ad8-4f56-9df0-ff2ed3bfe4b1";

describe("parseReviewRequest", () => {
  it("accepts a complete approval", () => {
    expect(parseReviewRequest({ id, status: "approved", publicSummary: "  Late-night club bass can reach quiet scenes.  ", publicImpact: "negative", appliesToFormats: [" IMAX 2D "] }))
      .toMatchObject({ id, status: "approved", publicSummary: "Late-night club bass can reach quiet scenes.", publicImpact: "negative", appliesToFormats: ["IMAX 2D"] });
  });

  it("requires a public summary for approvals", () => {
    expect(parseReviewRequest({ id, status: "approved" })).toBeNull();
  });

  it("accepts dismiss and pending transitions", () => {
    expect(parseReviewRequest({ id, status: "dismissed", reviewNotes: "Duplicate" })?.status).toBe("dismissed");
    expect(parseReviewRequest({ id, status: "pending" })?.status).toBe("pending");
  });

  it("rejects malformed identifiers and unbounded fields", () => {
    expect(parseReviewRequest({ id: "not-an-id", status: "pending" })).toBeNull();
    expect(parseReviewRequest({ id, status: "approved", publicSummary: "x".repeat(1201) })).toBeNull();
  });
});
