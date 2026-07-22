import { describe, expect, it } from "vitest";
import {
  computeTargetDates,
  filterMakeableShows,
  isFourDxFormat,
  isoDateOf,
  pickShow,
  resolveExperienceScore,
  type Show,
} from "./buildRecommendation";

function show(overrides: Partial<Show> & { time: string }): Show {
  return {
    date: "2026-07-22",
    format: "IMAX 2D",
    availability: null,
    priceRange: { min: 1000, max: 1500 },
    seatsAvailable: null,
    seatsTotal: null,
    cheapestSeatClassLabel: null,
    ...overrides,
  };
}

describe("pickShow", () => {
  describe("full-epic — closest to 19:30 IST, ties go later", () => {
    it("picks the show nearest 7:30 PM", () => {
      const shows = [show({ time: "5:00 PM" }), show({ time: "7:45 PM" }), show({ time: "10:00 PM" })];
      expect(pickShow(shows, "full-epic")?.time).toBe("7:45 PM");
    });

    it("breaks an equidistant tie by taking the later show", () => {
      // 7:00 PM and 8:00 PM are both 30 min from 7:30 PM
      const shows = [show({ time: "7:00 PM" }), show({ time: "8:00 PM" })];
      expect(pickShow(shows, "full-epic")?.time).toBe("8:00 PM");
    });
  });

  describe("easy-evening — closest to 18:30 IST, ties go earlier", () => {
    it("picks the show nearest 6:30 PM", () => {
      const shows = [show({ time: "4:00 PM" }), show({ time: "6:15 PM" }), show({ time: "9:00 PM" })];
      expect(pickShow(shows, "easy-evening")?.time).toBe("6:15 PM");
    });

    it("breaks an equidistant tie by taking the earlier show", () => {
      // 6:00 PM and 7:00 PM are both 30 min from 6:30 PM
      const shows = [show({ time: "6:00 PM" }), show({ time: "7:00 PM" })];
      expect(pickShow(shows, "easy-evening")?.time).toBe("6:00 PM");
    });
  });

  describe("worth-every-rupee — cheapest priceRange.min, ties go closest to 19:00", () => {
    it("picks the cheapest show", () => {
      const shows = [
        show({ time: "5:00 PM", priceRange: { min: 1200, max: 1200 } }),
        show({ time: "8:00 PM", priceRange: { min: 800, max: 800 } }),
        show({ time: "10:00 PM", priceRange: { min: 1500, max: 1500 } }),
      ];
      expect(pickShow(shows, "worth-every-rupee")?.time).toBe("8:00 PM");
    });

    it("breaks a price tie by taking the show closest to 7:00 PM", () => {
      const shows = [
        show({ time: "6:40 PM", priceRange: { min: 900, max: 900 } }), // 20 min from 19:00
        show({ time: "7:10 PM", priceRange: { min: 900, max: 900 } }), // 10 min from 19:00
      ];
      expect(pickShow(shows, "worth-every-rupee")?.time).toBe("7:10 PM");
    });

    it("ignores shows without a priceRange", () => {
      const shows = [show({ time: "7:00 PM", priceRange: null }), show({ time: "8:00 PM", priceRange: { min: 900, max: 900 } })];
      expect(pickShow(shows, "worth-every-rupee")?.time).toBe("8:00 PM");
    });

    it("returns null when nothing has a priceRange", () => {
      const shows = [show({ time: "7:00 PM", priceRange: null })];
      expect(pickShow(shows, "worth-every-rupee")).toBeNull();
    });
  });

  it("returns null for an empty list", () => {
    expect(pickShow([], "full-epic")).toBeNull();
  });

  it("weekend case: picks across two different dates purely on time-of-day distance", () => {
    // Saturday 7:00 PM is 30 min from the full-epic target (19:30); Sunday
    // 7:45 PM is only 15 min away — Sunday should win even though it comes
    // later chronologically and the shows span two separate dates.
    const shows = [
      show({ date: "2026-07-25", time: "7:00 PM" }),
      show({ date: "2026-07-26", time: "7:45 PM" }),
    ];
    const picked = pickShow(shows, "full-epic");
    expect(picked?.date).toBe("2026-07-26");
    expect(picked?.time).toBe("7:45 PM");
  });
});

describe("resolveExperienceScore", () => {
  const formatScores = { "RECLINERS 2D": 48, "IMAX 2D": 74 };
  const formatScoreDefault = 38;

  it("uses the venue's own curated score when the format is its flagship", () => {
    expect(resolveExperienceScore("IMAX 2D", 93, "IMAX 2D", formatScores, formatScoreDefault)).toBe(93);
  });

  it("uses the shared per-format table when the format is not the flagship", () => {
    expect(resolveExperienceScore("IMAX 2D", 93, "RECLINERS 2D", formatScores, formatScoreDefault)).toBe(48);
  });

  it("falls back to the default score for a format missing from the table", () => {
    expect(resolveExperienceScore("IMAX 2D", 93, "SOME UNKNOWN FORMAT", formatScores, formatScoreDefault)).toBe(
      38
    );
  });
});

describe("computeTargetDates", () => {
  // Represents "now" as IST wall-clock fields read via getUTC* — the same
  // convention buildRecommendation() uses (Date.now() + 330min, read with
  // getUTC*). This Date's UTC fields directly ARE the IST wall clock.
  const nowIst = new Date(Date.UTC(2026, 6, 22, 14, 5)); // "2026-07-22", a Wednesday

  it("tonight resolves to just today", () => {
    expect(computeTargetDates("tonight", nowIst, [])).toEqual(["2026-07-22"]);
  });

  it("tomorrow resolves to today + 1 day", () => {
    expect(computeTargetDates("tomorrow", nowIst, [])).toEqual(["2026-07-23"]);
  });

  it("weekend picks the Sat/Sun dates in datesCovered that aren't in the past", () => {
    const datesCovered = ["2026-07-22", "2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26"];
    expect(computeTargetDates("weekend", nowIst, datesCovered)).toEqual(["2026-07-25", "2026-07-26"]);
  });

  it("weekend returns an empty array when datesCovered has no Sat/Sun", () => {
    const datesCovered = ["2026-07-22", "2026-07-23", "2026-07-24"];
    expect(computeTargetDates("weekend", nowIst, datesCovered)).toEqual([]);
  });
});

describe("isoDateOf", () => {
  it("formats a Date's UTC fields as YYYY-MM-DD", () => {
    expect(isoDateOf(new Date(Date.UTC(2026, 6, 22, 23, 59)))).toBe("2026-07-22");
    expect(isoDateOf(new Date(Date.UTC(2026, 0, 5, 0, 0)))).toBe("2026-01-05");
  });
});

describe("filterMakeableShows — the tonight makeable-baseline boundary", () => {
  // nowMinutesOfDay = 1000 (4:40 PM), buffer = 40 -> cutoff = 1040 (5:20 PM)
  const nowMinutesOfDay = 1000;
  const buffer = 40;

  it("keeps a show starting exactly at the cutoff (inclusive boundary)", () => {
    const shows = [show({ time: "5:20 PM" })];
    expect(filterMakeableShows(shows, nowMinutesOfDay, buffer)).toHaveLength(1);
  });

  it("drops a show starting one minute before the cutoff", () => {
    const shows = [show({ time: "5:19 PM" })];
    expect(filterMakeableShows(shows, nowMinutesOfDay, buffer)).toHaveLength(0);
  });

  it("keeps a show starting after the cutoff", () => {
    const shows = [show({ time: "5:21 PM" })];
    expect(filterMakeableShows(shows, nowMinutesOfDay, buffer)).toHaveLength(1);
  });
});

describe("isFourDxFormat", () => {
  it("flags any format containing 4DX", () => {
    expect(isFourDxFormat("4DX-2D")).toBe(true);
  });

  it("does not flag ordinary formats", () => {
    expect(isFourDxFormat("IMAX 2D")).toBe(false);
    expect(isFourDxFormat("RECLINERS 2D")).toBe(false);
  });
});
