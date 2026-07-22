import { describe, expect, it } from "vitest";
import { sampleResult } from "../fixtures/sampleResult";
import type { Origin } from "../components/helm/types";
import { buildShareArtifactModel, normalizedPublicUrl } from "./shareArtifact";

const privateOrigin: Origin = { label: "Hauz Khas Village", lat: 28.5494, lng: 77.2001, region: "Delhi NCR" };

function whole(model: ReturnType<typeof buildShareArtifactModel>) {
  return JSON.stringify(model);
}

describe("share artifact model", () => {
  it("builds an exact, provenance-backed brief without exposing the user's origin", () => {
    const model = buildShareArtifactModel(sampleResult, privateOrigin);
    expect(model.provenance).toBe("12 VENUES / 47 SHOWS / 31 VIABLE PLANS");
    expect(model.comparisonReceipt).toBe("SCREEN 93/100 VS 96/100 · ₹1,180 VS ₹2,800 DOOR TO DOOR.");
    expect(model.timeline).toHaveLength(5);
    expect(model.caption).toContain("ONE ANSWER.");
    expect(whole(model)).not.toMatch(/Hauz Khas|28\.5494|77\.2001|maps\/dir|origin=/i);
    expect(model.filename).not.toMatch(/hauz|28|77/i);
  });

  it.each([
    ["live", "THE WAY HOME IS SCHEDULED."],
    ["no-route", "TRANSIT ENDS HERE. PLAN THE CAB HOME."],
    ["unverified", "THE RETURN NEEDS A FINAL CHECK."],
  ] as const)("has an operational headline for %s", (status, expected) => {
    const result = structuredClone(sampleResult);
    result.evidence.return.status = status;
    const model = buildShareArtifactModel(result, privateOrigin);
    expect(model.returnHeadline).toBe(expected);
  });

  it("does not require a runner-up and still uses the raw selected screen score", () => {
    const result = structuredClone(sampleResult);
    result.intentLabel = "EASY EVENING";
    result.screenScore = 71;
    result.runnerUp = undefined;
    const model = buildShareArtifactModel(result, privateOrigin);
    expect(model.comparisonReceipt).toBe("SCREEN 71/100 · ₹1,180 DOOR TO DOOR.");
  });

  it("normalizes configured URLs to a public homepage", () => {
    expect(normalizedPublicUrl("https://try-ithaka.example/results?origin=28.5,77.2#x")).toBe("https://try-ithaka.example/");
    expect(normalizedPublicUrl(undefined, "https://localhost:5173/anything?x=1")).toBe("https://localhost:5173/");
  });

  it.each(["unverified", "no-route"] as const)("does not present theatre exit as home when return is %s", (status) => {
    const result = structuredClone(sampleResult);
    result.evidence.return.status = status;
    expect(buildShareArtifactModel(result, privateOrigin).timeline.at(-1)).toEqual({ label: "EXIT", time: "7:57 pm" });
  });
});
