/**
 * Daily, low-volume Reddit discovery for Ithaka's review inbox.
 *
 * This script deliberately discovers *leads*, not facts. It reads the eight
 * opted-in public Reddit Atom feeds, rejects anything that is not both
 * local/venue-relevant and cinema/journey-relevant, then writes the survivors
 * as `pending` community signals. A human must approve a signal before it can
 * influence a recommendation.
 *
 * It never fetches a Reddit post page: only the lightweight feed entry is read.
 * A future reviewer can open a candidate only after it has passed the filters.
 *
 * Usage:
 *   npm run discover:community
 *   npm run discover:community -- --dry-run
 *   npm run discover:community -- --fixture scripts/fixtures/community-discovery.json --dry-run
 *   npm run discover:community -- --release "The Odyssey"
 *   npm run discover:community -- --release "The Odyssey" --release-only
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMUNITY_SIGNALS_TABLE = "community_signals";
const FRESHNESS_DAYS = 7;
const RSS_USER_AGENT = "IthakaCommunityDiscovery/0.1 (+https://github.com/vineet1997/odessey)";
// The run is daily, so use deliberately slow pacing. This is cheap at eight
// feeds/day and substantially kinder to Reddit's shared rate limits.
const FEED_DELAY_MS = 8_000;
const RETRY_AFTER_429_MS = 30_000;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENUES_PATH = path.join(ROOT, "data", "venues-curated.json");

export const DAILY_SUBREDDITS = [
  "delhi",
  "noida",
  "gurgaon",
  "imax",
  "imaxindia",
  "NewDelhi",
  "ghaziabad",
  "IndianCinema",
] as const;

const RELEASE_SUBREDDIT = "bollywood";
const CINEMA_TERMS = /\b(cinema|cinemas|movie|movies|film|films|theatre|theater|screen|screening|projector|projection|imax|laser|xenon|sound|audio|dolby|atmos|picture|brightness|seat|seats|seating|maintenance|4dx|pxl|onyx|insignia|recliner)\b/i;
const DISRUPTION_TERMS = /\b(traffic|jam|congestion|parking|metro|construction|roadwork|road work|closure|closed|blocked|blockade|waterlog|waterlogging|flood|noise|nightclub|access|late[ -]?night|cab|auto)\b/i;

export interface CuratedVenue {
  id: string;
  name: string;
  locality: string;
  city: string;
}

interface VenuesFile {
  shortlist: CuratedVenue[];
}

export interface DiscoveryResult {
  title?: string;
  url?: string;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  summary?: string;
}

export interface DailyFeedSource {
  label: string;
  subreddit: string;
  url: string;
  allowedSubreddits: readonly string[];
}

export interface CommunityCandidate {
  canonicalUrl: string;
  sourceUrl: string;
  redditPostId: string;
  subreddit: string;
  title: string;
  excerpt: string;
  author: string | null;
  publishedAt: string;
  matchedVenueIds: string[];
  matchedTerms: string[];
  signalCategories: string[];
  queryLabels: string[];
  provider: "reddit_rss";
}

export interface FilterSummary {
  received: number;
  accepted: number;
  rejectedBadUrl: number;
  rejectedSubreddit: number;
  rejectedStale: number;
  rejectedRelevance: number;
}

interface FixtureFile {
  results?: DiscoveryResult[];
  queries?: Record<string, DiscoveryResult[]>;
  feeds?: Record<string, DiscoveryResult[]>;
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function normaliseText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normaliseForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates search aliases from the curated source of truth, rather than
 * maintaining a second hand-written venue list. The transformations remove
 * only distributors/format descriptors that Reddit users commonly omit.
 */
export function venueAliases(venue: CuratedVenue): string[] {
  const name = normaliseText(venue.name);
  const aliases = new Set<string>([name, venue.locality]);
  const strippedParenthetical = name.replace(/\s*\([^)]*\)/g, "").trim();
  aliases.add(strippedParenthetical);
  aliases.add(strippedParenthetical.replace(/^(Pepsi|Kotak|Coca-Cola)\s+/i, ""));

  const noFormat = strippedParenthetical
    .replace(/\bIMAX with Laser\b/gi, "")
    .replace(/\bIMAX\b/gi, "")
    .replace(/\bSuperplex\b/gi, "")
    .replace(/\bwith Laser\b/gi, "")
    .replace(/\s*[-/,]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (noFormat.length >= 5) aliases.add(noFormat);

  // The right-hand name after a dash is the venue identifier for the Priya
  // entry; retaining its chain prefix yields the common "PVR Priya" spelling.
  const dashPart = strippedParenthetical.split("-").at(-1)?.trim();
  if (dashPart && dashPart.length >= 3 && /^PVR\b/i.test(strippedParenthetical)) {
    aliases.add(`PVR ${dashPart}`);
  }

  for (const localityPart of venue.locality.split(",")) {
    const clean = localityPart.replace(/\([^)]*\)/g, "").trim();
    if (clean.length >= 4) aliases.add(clean);
  }

  return [...aliases]
    .map(normaliseText)
    .filter((alias) => alias.length >= 4)
    .sort((a, b) => b.length - a.length);
}

/** The normal daily collection: two combined listings preserve specialist
 * cinema coverage without creating unnecessary request pressure. Every entry
 * is still hard-filtered against only the subreddits in its own source. */
export function buildCombinedFeedSources(): DailyFeedSource[] {
  const groups = [
    { label: "rss_local", subreddits: ["delhi", "noida", "gurgaon", "NewDelhi", "ghaziabad"] },
    { label: "rss_specialist", subreddits: ["imax", "imaxindia", "IndianCinema"] },
  ];
  return groups.map(({ label, subreddits }) => {
    const canonicalSubreddits = subreddits.map((subreddit) => subreddit.toLowerCase());
    return {
      label,
      subreddit: canonicalSubreddits.join("+"),
      url: `https://old.reddit.com/r/${canonicalSubreddits.join("+")}/new/.rss`,
      allowedSubreddits: canonicalSubreddits,
    };
  });
}

/** Fallback only: if Reddit rejects the combined listing, retry individual
 * sources slowly. r/bollywood is intentionally excluded from both paths. */
export function buildFallbackFeedSources(subreddits: readonly string[] = DAILY_SUBREDDITS): DailyFeedSource[] {
  return subreddits.map((subreddit) => {
    const canonicalSubreddit = subreddit.toLowerCase();
    return {
      label: `rss_${canonicalSubreddit}`,
      subreddit: canonicalSubreddit,
      url: `https://old.reddit.com/r/${canonicalSubreddit}/new/.rss`,
      allowedSubreddits: [canonicalSubreddit],
    };
  });
}

/** Release search is opt-in. This is the only path that permits r/bollywood,
 * and it remains a Reddit Atom request rather than a separate search service. */
export function buildReleaseFeedSource(releaseTitle: string): DailyFeedSource {
  const title = normaliseText(releaseTitle);
  if (!title || title.length > 160) throw new Error("--release must be a film title between 1 and 160 characters.");
  const url = new URL(`https://old.reddit.com/r/${RELEASE_SUBREDDIT}/search.rss`);
  url.searchParams.set("q", `"${title}" (cinema OR theatre OR theater OR IMAX OR PVR OR INOX OR screen)`);
  url.searchParams.set("restrict_sr", "on");
  url.searchParams.set("sort", "new");
  url.searchParams.set("t", "week");
  return {
    label: "rss_release_bollywood",
    subreddit: RELEASE_SUBREDDIT,
    url: url.toString(),
    allowedSubreddits: [RELEASE_SUBREDDIT],
  };
}

export function canonicaliseRedditUrl(rawUrl: string): { canonicalUrl: string; subreddit: string; redditPostId: string } | null {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (!/(^|\.)(reddit\.com)$/.test(host)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const subredditIndex = parts.findIndex((part) => part.toLowerCase() === "r");
    if (subredditIndex < 0 || parts[subredditIndex + 1] === undefined) return null;
    const commentsIndex = parts.findIndex((part) => part.toLowerCase() === "comments");
    if (commentsIndex < 0 || parts[commentsIndex + 1] === undefined) return null;
    const subreddit = parts[subredditIndex + 1];
    const redditPostId = parts[commentsIndex + 1];
    if (!/^[A-Za-z0-9_]{2,32}$/.test(subreddit) || !/^[A-Za-z0-9]+$/.test(redditPostId)) return null;
    return {
      canonicalUrl: `https://www.reddit.com/r/${subreddit.toLowerCase()}/comments/${redditPostId.toLowerCase()}`,
      subreddit: subreddit.toLowerCase(),
      redditPostId: redditPostId.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function excerptOf(result: DiscoveryResult): string {
  const highlight = Array.isArray(result.highlights) && typeof result.highlights[0] === "string" ? result.highlights[0] : undefined;
  const summary = typeof result.summary === "string" ? result.summary : "";
  return normaliseText(highlight ?? summary).slice(0, 4000);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_whole, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_whole, decimal: string) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function atomTag(entry: string, tag: string): string | undefined {
  const match = entry.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXmlEntities(match[1]) : undefined;
}

function atomLink(entry: string): string | undefined {
  const links = [...entry.matchAll(/<link\b([^>]*?)\/?>(?:<\/link>)?/gi)];
  for (const link of links) {
    const attributes = link[1];
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href && (/\brel=["']alternate["']/i.test(attributes) || links.length === 1)) return decodeXmlEntities(href);
  }
  return undefined;
}

function atomText(value: string | undefined): string {
  return normaliseText(decodeXmlEntities(value ?? "").replace(/<[^>]+>/g, " "));
}

/** Parses only the Atom fields the discovery filter needs. It intentionally
 * avoids following post links or loading any embedded HTML/resources. */
export function parseRedditAtomFeed(xml: string): DiscoveryResult[] {
  return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].flatMap((match) => {
    const entry = match[1];
    const url = atomLink(entry);
    const title = atomText(atomTag(entry, "title"));
    const content = atomText(atomTag(entry, "content"));
    const publishedDate = atomText(atomTag(entry, "published")) || atomText(atomTag(entry, "updated"));
    const authorBlock = atomTag(entry, "author");
    const author = atomText(authorBlock ? atomTag(authorBlock, "name") : undefined);
    if (!url || !title || !publishedDate) return [];
    return [{ url, title, publishedDate, author: author || undefined, summary: content }];
  });
}

function parseFreshDate(value: string | undefined, now: Date): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const oldest = now.getTime() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
  if (parsed.getTime() < oldest || parsed.getTime() > now.getTime() + 5 * 60 * 1000) return null;
  return parsed.toISOString();
}

function matchedVenueData(venues: CuratedVenue[], text: string): { ids: string[]; terms: string[] } {
  const searchable = normaliseForMatch(text);
  const matched = venues
    .map((venue) => ({ venue, aliases: venueAliases(venue) }))
    .filter(({ aliases }) => aliases.some((alias) => searchable.includes(normaliseForMatch(alias))))
    .map(({ venue, aliases }) => ({
      id: venue.id,
      term: aliases.find((alias) => searchable.includes(normaliseForMatch(alias))) ?? venue.name,
    }));
  return {
    ids: [...new Set(matched.map((item) => item.id))],
    terms: [...new Set(matched.map((item) => item.term))],
  };
}

export function signalCategories(text: string): string[] {
  const categories = new Set<string>();
  if (/\b(screen|projection|projector|picture|brightness|masking|aspect ratio)\b/i.test(text)) categories.add("screen_quality");
  if (/\b(sound|audio|dolby|atmos|noise|nightclub)\b/i.test(text)) categories.add("audio_environment");
  if (/\b(seat|seating|recliner|clean|maintenance|crowd|queue)\b/i.test(text)) categories.add("venue_experience");
  if (/\b(imax|laser|xenon|renovation|opening|reopening|upgrade|downgrade|projector)\b/i.test(text)) categories.add("format_change");
  if (DISRUPTION_TERMS.test(text)) categories.add("journey_disruption");
  if (/\b(late[ -]?night|nightclub|after \d{1,2}\s?(?:pm|p\.m\.))\b/i.test(text)) categories.add("time_specific");
  return [...categories];
}

export function filterDiscoveryResults(
  results: DiscoveryResult[],
  query: Pick<DailyFeedSource, "label" | "allowedSubreddits">,
  venues: CuratedVenue[],
  now = new Date(),
): { candidates: CommunityCandidate[]; summary: FilterSummary } {
  const summary: FilterSummary = { received: results.length, accepted: 0, rejectedBadUrl: 0, rejectedSubreddit: 0, rejectedStale: 0, rejectedRelevance: 0 };
  const candidates: CommunityCandidate[] = [];
  const allowed = new Set(query.allowedSubreddits.map((subreddit) => subreddit.toLowerCase()));

  for (const result of results) {
    const sourceUrl = typeof result.url === "string" ? result.url : undefined;
    const reddit = sourceUrl ? canonicaliseRedditUrl(sourceUrl) : null;
    if (!reddit) {
      summary.rejectedBadUrl++;
      continue;
    }
    if (!allowed.has(reddit.subreddit)) {
      summary.rejectedSubreddit++;
      continue;
    }
    const publishedAt = parseFreshDate(result.publishedDate, now);
    if (!publishedAt) {
      summary.rejectedStale++;
      continue;
    }
    const title = normaliseText(typeof result.title === "string" ? result.title : "").slice(0, 500);
    const excerpt = excerptOf(result);
    const material = `${title}\n${excerpt}`;
    const match = matchedVenueData(venues, material);
    if (!title || match.ids.length === 0 || (!CINEMA_TERMS.test(material) && !DISRUPTION_TERMS.test(material))) {
      summary.rejectedRelevance++;
      continue;
    }

    candidates.push({
      canonicalUrl: reddit.canonicalUrl,
      sourceUrl,
      redditPostId: reddit.redditPostId,
      subreddit: reddit.subreddit,
      title,
      excerpt,
      author: typeof result.author === "string" ? normaliseText(result.author).slice(0, 100) || null : null,
      publishedAt,
      matchedVenueIds: match.ids.slice(0, 20),
      matchedTerms: match.terms.slice(0, 20),
      signalCategories: signalCategories(material).slice(0, 12),
      queryLabels: [query.label],
      provider: "reddit_rss",
    });
    summary.accepted++;
  }
  return { candidates, summary };
}

export function dedupeCandidates(candidates: CommunityCandidate[]): CommunityCandidate[] {
  const deduped = new Map<string, CommunityCandidate>();
  for (const candidate of candidates) {
    const existing = deduped.get(candidate.canonicalUrl);
    if (!existing) {
      deduped.set(candidate.canonicalUrl, candidate);
      continue;
    }
    existing.queryLabels = [...new Set([...existing.queryLabels, ...candidate.queryLabels])];
    existing.matchedVenueIds = [...new Set([...existing.matchedVenueIds, ...candidate.matchedVenueIds])].slice(0, 20);
    existing.matchedTerms = [...new Set([...existing.matchedTerms, ...candidate.matchedTerms])].slice(0, 20);
    existing.signalCategories = [...new Set([...existing.signalCategories, ...candidate.signalCategories])].slice(0, 12);
    if (candidate.excerpt.length > existing.excerpt.length) existing.excerpt = candidate.excerpt;
  }
  return [...deduped.values()];
}

async function loadLocalEnvironment(): Promise<void> {
  try {
    const raw = await readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      const value = match[2].trim();
      process.env[match[1]] = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")) ? value.slice(1, -1) : value;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function loadVenues(): Promise<CuratedVenue[]> {
  const parsed = JSON.parse(await readFile(VENUES_PATH, "utf8")) as Partial<VenuesFile>;
  if (!Array.isArray(parsed.shortlist) || !parsed.shortlist.every((venue) => venue && typeof venue.id === "string" && typeof venue.name === "string" && typeof venue.locality === "string" && typeof venue.city === "string")) {
    throw new Error("data/venues-curated.json does not contain a valid shortlist.");
  }
  return parsed.shortlist;
}

async function loadFixture(fixturePath: string, label: string): Promise<DiscoveryResult[]> {
  const parsed = JSON.parse(await readFile(path.resolve(fixturePath), "utf8")) as FixtureFile;
  if (parsed.feeds?.[label]) return parsed.feeds[label];
  if (parsed.queries?.[label]) return parsed.queries[label];
  if (Array.isArray(parsed.results)) return parsed.results;
  throw new Error(`Fixture ${fixturePath} has no results for ${label}.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelay(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) return Math.max(RETRY_AFTER_429_MS, Number(retryAfter) * 1000);
  return RETRY_AFTER_429_MS;
}

/** One polite request per public feed. A 429 gets one delayed retry; any other
 * failure is surfaced before database writes so a partial source run cannot be
 * mistaken for a complete daily collection. */
export async function fetchRedditFeed(
  source: DailyFeedSource,
  fetcher: typeof fetch = fetch,
  wait: (milliseconds: number) => Promise<void> = sleep,
): Promise<DiscoveryResult[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetcher(source.url, {
      headers: {
        "User-Agent": RSS_USER_AGENT,
        Accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
      },
    });
    if (response.ok) return parseRedditAtomFeed(await response.text());
    if (response.status === 429 && attempt === 0) {
      await wait(retryDelay(response));
      continue;
    }
    throw new Error(`Reddit RSS feed r/${source.subreddit} failed (HTTP ${response.status}).`);
  }
  throw new Error(`Reddit RSS feed r/${source.subreddit} was rate limited after one retry.`);
}

type SupabaseRow = {
  id: string;
};

function supabaseHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
}

async function supabaseJson<T>(url: URL, init: RequestInit, serviceKey: string): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...supabaseHeaders(serviceKey), ...init.headers } });
  if (!response.ok) throw new Error(`Supabase ${init.method ?? "GET"} failed (HTTP ${response.status}): ${(await response.text()).slice(0, 500)}`);
  const body = await response.text();
  // POST/PATCH use `return=minimal`, so successful writes intentionally have
  // an empty body. Reads are the only calls in this script that need JSON.
  return (body ? JSON.parse(body) : undefined) as T;
}

async function findExisting(baseUrl: string, serviceKey: string, candidate: CommunityCandidate): Promise<SupabaseRow | null> {
  for (const [column, value] of [["canonical_url", candidate.canonicalUrl], ["reddit_post_id", candidate.redditPostId]] as const) {
    const url = new URL(`/rest/v1/${COMMUNITY_SIGNALS_TABLE}`, baseUrl);
    url.searchParams.set("select", "id");
    url.searchParams.set(column, `eq.${value}`);
    const rows = await supabaseJson<SupabaseRow[]>(url, { method: "GET" }, serviceKey);
    if (rows[0]) return rows[0];
  }
  return null;
}

function sourceMetadata(candidate: CommunityCandidate): Record<string, unknown> {
  return {
    provider: candidate.provider,
    query_labels: candidate.queryLabels,
    matched_terms: candidate.matchedTerms,
    discovered_without_page_fetch: true,
  };
}

function insertPayload(candidate: CommunityCandidate, seenAt: string): Record<string, unknown> {
  return {
    canonical_url: candidate.canonicalUrl,
    source_url: candidate.sourceUrl,
    reddit_post_id: candidate.redditPostId,
    subreddit: candidate.subreddit,
    title: candidate.title,
    excerpt: candidate.excerpt,
    author: candidate.author,
    published_at: candidate.publishedAt,
    discovered_at: seenAt,
    last_seen_at: seenAt,
    matched_venue_ids: candidate.matchedVenueIds,
    signal_categories: candidate.signalCategories,
    source_metadata: sourceMetadata(candidate),
  };
}

/** Updates only discovery-owned fields. Review status and review-only columns
 * are intentionally absent, so rediscovery can never reverse a decision. */
function rediscoveryPayload(candidate: CommunityCandidate, seenAt: string): Record<string, unknown> {
  return {
    source_url: candidate.sourceUrl,
    title: candidate.title,
    excerpt: candidate.excerpt,
    author: candidate.author,
    published_at: candidate.publishedAt,
    last_seen_at: seenAt,
    updated_at: seenAt,
    matched_venue_ids: candidate.matchedVenueIds,
    signal_categories: candidate.signalCategories,
    source_metadata: sourceMetadata(candidate),
  };
}

export async function persistCandidates(candidates: CommunityCandidate[], env: { supabaseUrl: string; serviceRoleKey: string }, seenAt = new Date().toISOString()): Promise<{ inserted: number; rediscovered: number }> {
  let inserted = 0;
  let rediscovered = 0;
  for (const candidate of candidates) {
    const existing = await findExisting(env.supabaseUrl, env.serviceRoleKey, candidate);
    if (existing) {
      const url = new URL(`/rest/v1/${COMMUNITY_SIGNALS_TABLE}`, env.supabaseUrl);
      url.searchParams.set("id", `eq.${existing.id}`);
      await supabaseJson<unknown>(url, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rediscoveryPayload(candidate, seenAt)) }, env.serviceRoleKey);
      rediscovered++;
      continue;
    }
    const url = new URL(`/rest/v1/${COMMUNITY_SIGNALS_TABLE}`, env.supabaseUrl);
    try {
      await supabaseJson<unknown>(url, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(insertPayload(candidate, seenAt)) }, env.serviceRoleKey);
      inserted++;
    } catch (error) {
      // A concurrent manual run can insert the same Reddit post between the
      // read and POST. Look once more, then safely treat it as rediscovery.
      const racedExisting = await findExisting(env.supabaseUrl, env.serviceRoleKey, candidate);
      if (!racedExisting) throw error;
      const retryUrl = new URL(`/rest/v1/${COMMUNITY_SIGNALS_TABLE}`, env.supabaseUrl);
      retryUrl.searchParams.set("id", `eq.${racedExisting.id}`);
      await supabaseJson<unknown>(retryUrl, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(rediscoveryPayload(candidate, seenAt)) }, env.serviceRoleKey);
      rediscovered++;
    }
  }
  return { inserted, rediscovered };
}

async function main(): Promise<void> {
  await loadLocalEnvironment();
  const venues = await loadVenues();
  const releaseTitle = readFlag("--release");
  const releaseOnly = process.argv.includes("--release-only");
  if (releaseOnly && !releaseTitle) throw new Error("--release-only requires --release \"Film title\".");
  const fixturePath = readFlag("--fixture");
  const dryRun = process.argv.includes("--dry-run");
  const now = new Date();

  const allCandidates: CommunityCandidate[] = [];
  const totals: FilterSummary = { received: 0, accepted: 0, rejectedBadUrl: 0, rejectedSubreddit: 0, rejectedStale: 0, rejectedRelevance: 0 };
  const feedFailures: string[] = [];
  let completedSources = 0;
  const recordFiltered = (filtered: { candidates: CommunityCandidate[]; summary: FilterSummary }, label: string) => {
    completedSources++;
    allCandidates.push(...filtered.candidates);
    for (const key of Object.keys(totals) as Array<keyof FilterSummary>) totals[key] += filtered.summary[key];
    process.stdout.write(`${label}: ${filtered.summary.accepted}/${filtered.summary.received} candidates accepted.\n`);
  };

  if (!releaseOnly) {
    const combinedSources = buildCombinedFeedSources();
    for (let combinedIndex = 0; combinedIndex < combinedSources.length; combinedIndex++) {
      const combined = combinedSources[combinedIndex];
      try {
      const results = fixturePath ? await loadFixture(fixturePath, combined.label) : await fetchRedditFeed(combined);
      recordFiltered(filterDiscoveryResults(results, combined, venues, now), combined.label);
      } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${combined.label}: unavailable — ${message}; falling back to individual feeds.\n`);
      const fallbacks = buildFallbackFeedSources(combined.allowedSubreddits);
      for (let index = 0; index < fallbacks.length; index++) {
        const source = fallbacks[index];
        try {
          const results = fixturePath ? await loadFixture(fixturePath, source.label) : await fetchRedditFeed(source);
          recordFiltered(filterDiscoveryResults(results, source, venues, now), source.label);
        } catch (fallbackError) {
          const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          feedFailures.push(source.subreddit);
          process.stderr.write(`${source.label}: unavailable — ${fallbackMessage}\n`);
        }
        if (!fixturePath && index < fallbacks.length - 1) await sleep(FEED_DELAY_MS);
      }
      if (feedFailures.length > 0) process.stdout.write(`RSS fallback availability: ${fallbacks.length - feedFailures.length}/${fallbacks.length} feeds completed; unavailable: ${feedFailures.join(", ")}.\n`);
      }
      if (!fixturePath && combinedIndex < combinedSources.length - 1) await sleep(FEED_DELAY_MS);
    }
  }

  if (releaseTitle) {
    const source = buildReleaseFeedSource(releaseTitle);
    const results = fixturePath ? await loadFixture(fixturePath, source.label) : await fetchRedditFeed(source);
    const filtered = filterDiscoveryResults(results, source, venues, now);
    recordFiltered(filtered, source.label);
  }
  if (completedSources === 0) throw new Error("No Reddit feed completed; refusing to report a successful empty discovery run.");
  const candidates = dedupeCandidates(allCandidates);
  process.stdout.write(`Discovery summary: ${totals.received} received, ${candidates.length} unique candidates, ${totals.rejectedBadUrl} bad URL, ${totals.rejectedSubreddit} wrong subreddit, ${totals.rejectedStale} stale, ${totals.rejectedRelevance} irrelevant.\n`);

  if (dryRun) {
    process.stdout.write("Dry run: no Supabase write was attempted.\n");
    return;
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required outside --dry-run.");
  const persisted = await persistCandidates(candidates, { supabaseUrl, serviceRoleKey });
  process.stdout.write(`Supabase summary: ${persisted.inserted} new pending leads, ${persisted.rediscovered} existing leads refreshed.\n`);
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
