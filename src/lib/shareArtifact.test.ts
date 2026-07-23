import { describe, expect, it } from "vitest";
import { sampleResult } from "../fixtures/sampleResult";
import type { Origin } from "../components/helm/types";
import { buildShareArtifactModel, normalizedPublicUrl } from "./shareArtifact";

const privateOrigin: Origin = { label: "Hauz Khas Village", lat: 28.5494, lng: 77.2001, region: "Delhi NCR" };

describe("Screening Declaration share model", () => {
  it("creates the exact social invitation and public homepage", () => {
    const model = buildShareArtifactModel(sampleResult, privateOrigin);
    expect(model.caption).toBe(
      "The Odyssey. IMAX 2D at PVR Select City Walk, MON JUL 20 · 4:50 PM.\n\nWho’s in?\n\nI found my screening with Ithaka:\nhttps://odessey-topaz.vercel.app/"
    );
    expect(model.filename).toBe("ithaka-odyssey-plan-pvr-select-city-walk.png");
    expect(model).toMatchObject({ date: "MON JUL 20", format: "IMAX 2D", showtime: "4:50 PM", venueName: "PVR Select City Walk" });
  });

  it("keeps every origin and route detail outside the model, caption and filename", () => {
    const model = buildShareArtifactModel(sampleResult, privateOrigin);
    const publicData = JSON.stringify(model);
    expect(publicData).not.toMatch(/Hauz Khas|28\.5494|77\.2001|maps\/dir|origin=|directions/i);
    expect(model.caption).not.toMatch(/screen 93|₹|door to door|venues|viable plans|return/i);
    expect(model.filename).not.toMatch(/hauz|28|77/i);
  });

  it("does not leak decision receipts, scores or travel facts for any return state", () => {
    for (const status of ["live", "no-route", "unverified"] as const) {
      const result = structuredClone(sampleResult);
      result.evidence.return.status = status;
      const model = buildShareArtifactModel(result, privateOrigin);
      expect(JSON.stringify(model)).not.toMatch(/scheduled|cab|return|screen 93|1,180|31 viable/i);
    }
  });

  it("normalizes configured URLs to the public homepage", () => {
    expect(normalizedPublicUrl("https://odessey-topaz.vercel.app/results?origin=28.5,77.2#x")).toBe("https://odessey-topaz.vercel.app/");
    expect(normalizedPublicUrl(undefined, "http://localhost/anything?x=1")).toBe("http://localhost/");
  });
});
