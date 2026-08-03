import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCombinedFeedSources,
  buildFallbackFeedSources,
  buildReleaseFeedSource,
  canonicaliseRedditUrl,
  dedupeCandidates,
  fetchRedditFeed,
  filterDiscoveryResults,
  parseRedditAtomFeed,
  persistCandidates,
  venueAliases,
  type CuratedVenue,
  type DiscoveryResult,
} from "./discover-community-signals";

const venues: CuratedVenue[] = [
  { id: "priya-vasant-vihar", name: "PVR IMAX with Laser - Priya", locality: "Vasant Vihar", city: "Delhi" },
  { id: "mall-of-india-noida", name: "PVR Superplex, Mall of India", locality: "Sector 18", city: "Noida" },
];

const now = new Date("2026-08-04T12:00:00.000Z");

describe("community discovery filters", () => {
  it("derives practical aliases from the curated venue source", () => {
    expect(venueAliases(venues[0])).toContain("PVR Priya");
    expect(venueAliases(venues[1])).toContain("PVR Mall of India");
  });

  it("canonicalises a Reddit post and strips tracking/comment paths", () => {
    expect(canonicaliseRedditUrl("https://old.reddit.com/r/Delhi/comments/abc123/pvr_priya/?utm_source=share#x")).toEqual({
      canonicalUrl: "https://www.reddit.com/r/delhi/comments/abc123",
      subreddit: "delhi",
      redditPostId: "abc123",
    });
  });

  it("allows only fresh, allowed and relevant Reddit results", () => {
    const query = buildCombinedFeedSources()[0];
    const results: DiscoveryResult[] = [
      { title: "PVR Priya projection was excellent", url: "https://www.reddit.com/r/delhi/comments/abc123/pvr_priya/", publishedDate: "2026-08-02T10:00:00Z", highlights: ["Great IMAX sound and screen quality at Vasant Vihar."], author: "viewer" },
      { title: "PVR Priya", url: "https://www.reddit.com/r/india/comments/def456/pvr_priya/", publishedDate: "2026-08-02T10:00:00Z", highlights: ["Great IMAX screen." ] },
      { title: "PVR Priya was good", url: "https://www.reddit.com/r/delhi/comments/ghi789/pvr_priya/", publishedDate: "2026-07-01T10:00:00Z", highlights: ["Great IMAX screen." ] },
      { title: "Weekend meetup", url: "https://www.reddit.com/r/delhi/comments/jkl012/meetup/", publishedDate: "2026-08-02T10:00:00Z", highlights: ["Meet at Vasant Vihar park." ] },
    ];
    const output = filterDiscoveryResults(results, query, venues, now);
    expect(output.candidates).toHaveLength(1);
    expect(output.candidates[0]).toMatchObject({ subreddit: "delhi", redditPostId: "abc123", matchedVenueIds: ["priya-vasant-vihar"] });
    expect(output.summary).toMatchObject({ accepted: 1, rejectedSubreddit: 1, rejectedStale: 1, rejectedRelevance: 1 });
  });

  it("merges repeated candidates without losing the query trail", () => {
    const query = buildCombinedFeedSources()[0];
    const result: DiscoveryResult = { title: "PVR Priya IMAX report", url: "https://www.reddit.com/r/delhi/comments/abc123/pvr_priya/", publishedDate: "2026-08-02T10:00:00Z", highlights: ["Projection and sound were excellent." ] };
    const first = filterDiscoveryResults([result], query, venues, now).candidates[0];
    const second = { ...first, queryLabels: ["rss_delhi_repeat"], signalCategories: ["journey_disruption"] };
    const deduped = dedupeCandidates([first, second]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].queryLabels).toEqual(["rss_local", "rss_delhi_repeat"]);
    expect(deduped[0].signalCategories).toContain("journey_disruption");
  });
});

describe("RSS source scope", () => {
  it("uses two daily combined feeds and retains eight individual fallbacks", () => {
    const sources = buildCombinedFeedSources();
    expect(sources).toHaveLength(2);
    expect(sources.every((source) => source.url === `https://old.reddit.com/r/${source.subreddit}/new/.rss`)).toBe(true);
    expect(sources.every((source) => !source.allowedSubreddits.includes("bollywood"))).toBe(true);
    expect(buildFallbackFeedSources()).toHaveLength(8);
  });

  it("only admits r/bollywood for an explicit release search", () => {
    const source = buildReleaseFeedSource("The Odyssey");
    expect(source.allowedSubreddits).toEqual(["bollywood"]);
    expect(source.url).toContain("restrict_sr=on");
    expect(source.url).toContain("The+Odyssey");
  });
});

describe("Atom feed parsing", () => {
  it("extracts a Reddit post without loading its page", () => {
    const xml = `<?xml version="1.0"?><feed><entry><title>PVR Priya update</title><published>2026-08-03T12:00:00+00:00</published><author><name>viewer</name></author><content type="html">&lt;div&gt;The IMAX sound was excellent.&lt;/div&gt;</content><link rel="alternate" type="text/html" href="https://www.reddit.com/r/delhi/comments/abc123/pvr_priya_update/" /></entry></feed>`;
    expect(parseRedditAtomFeed(xml)).toEqual([{
      title: "PVR Priya update",
      publishedDate: "2026-08-03T12:00:00+00:00",
      author: "viewer",
      summary: "The IMAX sound was excellent.",
      url: "https://www.reddit.com/r/delhi/comments/abc123/pvr_priya_update/",
    }]);
  });

  it("retries a rate-limited feed once before parsing it", async () => {
    const source = buildCombinedFeedSources()[0];
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("<feed><entry><title>PVR Priya</title><published>2026-08-03T12:00:00Z</published><content>IMAX screen</content><link href=\"https://www.reddit.com/r/delhi/comments/abc123/pvr_priya/\" /></entry></feed>", { status: 200 }));
    const results = await fetchRedditFeed(source, fetcher, async () => undefined);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(results[0]?.url).toContain("reddit.com/r/delhi/comments/abc123");
  });
});

describe("Supabase persistence", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes a new pending lead without supplying review-owned fields", async () => {
    const candidate = filterDiscoveryResults([
      { title: "PVR Priya IMAX report", url: "https://www.reddit.com/r/delhi/comments/abc123/pvr_priya/", publishedDate: "2026-08-02T10:00:00Z", highlights: ["Projection and sound were excellent."] },
    ], buildCombinedFeedSources()[0], venues, now).candidates[0];
    const requests: Array<{ method: string; body: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(init?.method === "GET" ? "[]" : "", { status: init?.method === "POST" ? 201 : 200 });
    }));

    await expect(persistCandidates([candidate], { supabaseUrl: "https://example.supabase.co", serviceRoleKey: "service-secret" }, "2026-08-04T12:00:00.000Z")).resolves.toEqual({ inserted: 1, rediscovered: 0 });
    const inserted = requests.find((request) => request.method === "POST")?.body as Record<string, unknown>;
    expect(inserted).toMatchObject({ canonical_url: candidate.canonicalUrl, subreddit: "delhi", matched_venue_ids: ["priya-vasant-vihar"] });
    expect(inserted).not.toHaveProperty("status");
    expect(inserted).not.toHaveProperty("public_summary");
  });

  it("refreshes discovery fields without overwriting review status", async () => {
    const candidate = filterDiscoveryResults([
      { title: "PVR Priya IMAX report", url: "https://www.reddit.com/r/delhi/comments/abc123/pvr_priya/", publishedDate: "2026-08-02T10:00:00Z", highlights: ["Projection and sound were excellent."] },
    ], buildCombinedFeedSources()[0], venues, now).candidates[0];
    const requests: Array<{ method: string; body: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(init?.method === "GET" ? '[{"id":"db-id"}]' : "", { status: 200 });
    }));

    await expect(persistCandidates([candidate], { supabaseUrl: "https://example.supabase.co", serviceRoleKey: "service-secret" }, "2026-08-04T12:00:00.000Z")).resolves.toEqual({ inserted: 0, rediscovered: 1 });
    const patched = requests.find((request) => request.method === "PATCH")?.body as Record<string, unknown>;
    expect(patched).toHaveProperty("last_seen_at");
    expect(patched).not.toHaveProperty("status");
    expect(patched).not.toHaveProperty("review_notes");
    expect(patched).not.toHaveProperty("public_summary");
  });
});
